import { prisma } from "../src/lib/prisma";

function yardsToMeters(yards: number): number {
  return Number((yards * 0.9144).toFixed(2));
}

async function reconcilePartyLedger(tx: any, partyId: string) {
  const allEntries = await tx.fabricLedgerEntry.findMany({
    where: { partyId },
    orderBy: [
      { timestamp: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  let runningMeters = 0;
  let runningPieces = 0;
  const updateFns: (() => Promise<any>)[] = [];

  for (const entry of allEntries) {
    if (entry.itemCategory === "PIECES") {
      const credit = Number(entry.creditPieces || 0);
      const debit = Number(entry.debitPieces || 0);
      const shortage = Number(entry.shortagePieces || 0);
      runningPieces = runningPieces + credit - debit - shortage;

      if (entry.runningPieces !== runningPieces) {
        const targetPieces = runningPieces;
        updateFns.push(() =>
          tx.fabricLedgerEntry.update({
            where: { id: entry.id },
            data: { runningPieces: targetPieces },
          })
        );
      }
    } else {
      const credit = Number(entry.creditMeters || 0);
      const debit = Number(entry.debitMeters || 0);
      const shrinkage = Number(entry.shrinkageMeters || 0);
      runningMeters = Number((runningMeters + credit - debit - shrinkage).toFixed(2));

      if (Number(entry.runningBalance) !== runningMeters) {
        const targetBalance = runningMeters;
        updateFns.push(() =>
          tx.fabricLedgerEntry.update({
            where: { id: entry.id },
            data: { runningBalance: targetBalance },
          })
        );
      }
    }
  }

  for (let i = 0; i < updateFns.length; i += 5) {
    const chunk = updateFns.slice(i, i + 5);
    await Promise.all(chunk.map((fn) => fn()));
  }
}

async function main() {
  console.log("Starting inward ledger single-row consolidation...");

  const inwards = await prisma.fabricInward.findMany({
    include: {
      items: {
        orderBy: { itemIndex: "asc" },
      },
    },
  });

  console.log(`Found ${inwards.length} inward receipts to verify and consolidate.`);

  const partyIds = new Set<string>();

  for (const inward of inwards) {
    partyIds.add(inward.partyId);

    await prisma.$transaction(
      async (tx) => {
        // Delete all old ledger entries for this inward
        await tx.fabricLedgerEntry.deleteMany({
          where: { inwardId: inward.id },
        });

        // Recreate 1 single entry per item lot
        for (const item of inward.items) {
          const challanQty = Number(item.challanQty);
          const measuredQty = Number(item.measuredQty);
          const shortageQty = Number((challanQty - measuredQty).toFixed(2));

          if (item.unit === "PIECES") {
            const shortagePieces = Math.round(shortageQty);
            const diffText =
              shortagePieces > 0
                ? ` (-${shortagePieces} pcs)`
                : shortagePieces < 0
                ? ` (+${Math.abs(shortagePieces)} pcs)`
                : "";
            const notes = `Inward Challan #${inward.partyChallanNo} - ${item.rollCount} pkgs of ${item.fabricType} (${item.colorShade}) [Claimed: ${Math.round(challanQty)} pcs] vs [Measured: ${Math.round(measuredQty)} pcs]${diffText}`;

            await tx.fabricLedgerEntry.create({
              data: {
                partyId: inward.partyId,
                partyChallanNo: inward.partyChallanNo,
                inwardId: inward.id,
                inwardItemId: item.id,
                itemCategory: "PIECES",
                fabricDescription: `${item.fabricType} (${item.colorShade})`,
                unit: "PIECES",
                movementType: "PARTY_INWARD",
                referenceNumber: inward.igpNumber,
                creditMeters: 0,
                debitMeters: 0,
                shrinkageMeters: 0,
                creditPieces: Math.round(challanQty),
                debitPieces: 0,
                shortagePieces: shortagePieces,
                runningPieces: 0,
                timestamp: inward.challanDate,
                notes,
              },
            });
          } else {
            const stdClaimed = item.unit === "YARDS" ? yardsToMeters(challanQty) : challanQty;
            const stdMeasured = item.unit === "YARDS" ? yardsToMeters(measuredQty) : measuredQty;
            const stdSignedShortage = Number((stdClaimed - stdMeasured).toFixed(2));
            const unitSuffix = item.unit === "YARDS" ? "yd" : "m";
            const diffText =
              shortageQty > 0
                ? ` (-${shortageQty}${unitSuffix})`
                : shortageQty < 0
                ? ` (+${Math.abs(shortageQty)}${unitSuffix})`
                : "";
            const notes = `Inward Challan #${inward.partyChallanNo} - ${item.rollCount} rolls of ${item.fabricType} (${item.colorShade}) [Claimed: ${challanQty} ${unitSuffix}] vs [Measured: ${measuredQty} ${unitSuffix}]${diffText}`;

            await tx.fabricLedgerEntry.create({
              data: {
                partyId: inward.partyId,
                partyChallanNo: inward.partyChallanNo,
                inwardId: inward.id,
                inwardItemId: item.id,
                itemCategory: "CONTINUOUS",
                fabricDescription: `${item.fabricType} (${item.colorShade})`,
                unit: item.unit,
                movementType: "PARTY_INWARD",
                referenceNumber: inward.igpNumber,
                creditMeters: stdClaimed,
                debitMeters: 0,
                shrinkageMeters: stdSignedShortage,
                runningBalance: 0,
                timestamp: inward.challanDate,
                notes,
              },
            });
          }
        }
      },
      { maxWait: 15000, timeout: 45000 }
    );

    console.log(`Consolidated inward ${inward.igpNumber} (#${inward.partyChallanNo}) -> ${inward.items.length} clean item row(s).`);
  }

  // Reconcile ledgers for each affected party
  for (const pId of partyIds) {
    console.log(`Reconciling party ledger for partyId: ${pId}...`);
    await prisma.$transaction(
      async (tx) => {
        await reconcilePartyLedger(tx, pId);
      },
      { maxWait: 15000, timeout: 45000 }
    );
  }

  console.log("Consolidation & reconciliation completed successfully!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
