import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Starting ledger lot backfill and synchronization...");

  const entries = await prisma.fabricLedgerEntry.findMany({
    include: {
      inwardItem: true,
      inward: {
        include: {
          items: {
            orderBy: { itemIndex: "asc" },
          },
        },
      },
    },
  });

  console.log(`Found ${entries.length} ledger entries to check.`);

  let updatedCount = 0;

  for (const entry of entries) {
    let inwardItemId = entry.inwardItemId;
    let fabricDescription = entry.fabricDescription;
    let notes = entry.notes || "";
    let changed = false;

    // 1. Try to deduce inwardItemId if missing
    if (!inwardItemId) {
      if (entry.movementType === "OUTWARD_TO_VENDOR" || entry.movementType === "INWARD_FROM_VENDOR") {
        const batch = await prisma.outsourceBatch.findFirst({
          where: { ogpNumber: entry.referenceNumber },
          select: { inwardItemId: true },
        });
        if (batch?.inwardItemId) {
          inwardItemId = batch.inwardItemId;
          changed = true;
        }
      }

      if (!inwardItemId && entry.inward && entry.inward.items.length === 1) {
        inwardItemId = entry.inward.items[0].id;
        changed = true;
      }
    }

    // 2. Fetch lot item if we now have inwardItemId
    let lotItem = entry.inwardItem;
    if (inwardItemId && (!lotItem || lotItem.id !== inwardItemId)) {
      lotItem = await prisma.fabricInwardItem.findUnique({
        where: { id: inwardItemId },
      });
    }

    // 3. Update fabricDescription if missing
    if (lotItem && !fabricDescription) {
      fabricDescription = `${lotItem.fabricType} (${lotItem.colorShade})`;
      changed = true;
    }

    // 4. Update notes to mention lot if missing
    if (lotItem && !notes.includes(`Lot #${lotItem.itemIndex + 1}`)) {
      const lotTag = `[Lot #${lotItem.itemIndex + 1}: ${lotItem.fabricType}]`;
      if (!notes.includes(lotTag)) {
        notes = `${lotTag} ${notes}`;
        changed = true;
      }
    }

    if (changed) {
      await prisma.fabricLedgerEntry.update({
        where: { id: entry.id },
        data: {
          inwardItemId,
          fabricDescription,
          notes,
        },
      });
      updatedCount++;
    }
  }

  console.log(`Backfilled and updated ${updatedCount} ledger entries with lot details.`);

  // Reconcile ledgers for all parties
  const parties = await prisma.party.findMany({ select: { id: true, name: true } });
  for (const p of parties) {
    const allEntries = await prisma.fabricLedgerEntry.findMany({
      where: { partyId: p.id },
      orderBy: [{ timestamp: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    let runningMeters = 0;
    let runningPieces = 0;
    for (const e of allEntries) {
      if (e.itemCategory === "PIECES") {
        const credit = Number(e.creditPieces || 0);
        const debit = Number(e.debitPieces || 0);
        const shortage = Number(e.shortagePieces || 0);
        runningPieces = runningPieces + credit - debit - shortage;
        if (e.runningPieces !== runningPieces) {
          await prisma.fabricLedgerEntry.update({
            where: { id: e.id },
            data: { runningPieces },
          });
        }
      } else {
        const credit = Number(e.creditMeters || 0);
        const debit = Number(e.debitMeters || 0);
        const shrinkage = Number(e.shrinkageMeters || 0);
        runningMeters = Number((runningMeters + credit - debit - shrinkage).toFixed(2));
        if (Number(e.runningBalance) !== runningMeters) {
          await prisma.fabricLedgerEntry.update({
            where: { id: e.id },
            data: { runningBalance: runningMeters },
          });
        }
      }
    }
  }

  console.log("All party ledgers reconciled successfully.");
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
