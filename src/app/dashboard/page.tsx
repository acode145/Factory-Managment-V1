import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import FabricInwardManager from "@/components/fabric/FabricInwardManager";
import OutsourceBatchManager from "@/components/fabric/OutsourceBatchManager";
import DeliveryChallanForm from "@/components/fabric/DeliveryChallanForm";
import PartyRunningLedger from "@/components/fabric/PartyRunningLedger";
import PartyManagement from "@/components/fabric/PartyManagement";
import VendorManagement from "@/components/fabric/VendorManagement";
import { getNextPartyCode } from "@/actions/party";
import { getNextVendorCode } from "@/actions/vendor";
import { metersToYards, yardsToMeters } from "@/lib/units";
import {
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Truck,
  BookOpen,
  Building2,
  AlertTriangle,
  GitFork,
} from "lucide-react";
import Link from "next/link";
import WorkstationManager from "@/components/fabric/WorkstationManager";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { tab = "inward" } = await searchParams;

  // Fetch data concurrently from Supabase
  const [parties, vendors, rawInwardList, rawBatches, rawLedgerEntries, rawTransfers] = await Promise.all([
    prisma.party.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        partyType: true,
        contactPerson: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.vendor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        defaultProcess: true,
        contactPerson: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.fabricInward.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        party: { select: { name: true, code: true } },
        receivedBy: { select: { fullName: true } },
        items: {
          orderBy: { itemIndex: "asc" },
        },
      },
    }),
    prisma.outsourceBatch.findMany({
      orderBy: { sentDate: "desc" },
      include: {
        party: { select: { name: true, code: true } },
        vendor: { select: { name: true, code: true } },
        sentBy: { select: { fullName: true } },
        inward: { select: { partyChallanNo: true, igpNumber: true, fabricType: true, colorShade: true } },
        inwardItem: { select: { fabricType: true, colorShade: true, unit: true } },
        returns: {
          orderBy: { returnDate: "desc" },
          include: { receivedBy: { select: { fullName: true } } },
        },
      },
    }),
    prisma.fabricLedgerEntry.findMany({
      orderBy: [
        { timestamp: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      include: {
        inwardItem: {
          select: {
            id: true,
            itemIndex: true,
            fabricType: true,
            colorShade: true,
            unit: true,
          },
        },
      },
    }),
    prisma.departmentTransfer.findMany({
      orderBy: { transferDate: "desc" },
      include: {
        party: { select: { name: true, code: true } },
        inward: { select: { partyChallanNo: true } },
        transferredBy: { select: { fullName: true } },
      },
    }),
  ]);

  const nextPartyCode = await getNextPartyCode();
  const nextVendorCode = await getNextVendorCode();
  const canCreateParty =
    session.role === "ADMIN" || session.role === "FABRIC_PROCESSING_INCHARGE";

  // Serialize Prisma Decimals into plain JavaScript numbers to prevent Client Component serialization errors
  const batches = rawBatches.map((b: any) => ({
    id: b.id,
    ogpNumber: b.ogpNumber,
    partyId: b.partyId,
    vendorId: b.vendorId,
    inwardId: b.inwardId,
    inwardItemId: b.inwardItemId,
    unit: b.unit || "METERS",
    itemCategory: b.itemCategory || "CONTINUOUS",
    processType: b.processType,
    targetShade: b.targetShade,
    sentMeters: Number(b.sentMeters),
    accountedMeters: Number(b.accountedMeters || 0),
    sentDate: b.sentDate,
    status: b.status,
    vendorChallanNo: b.vendorChallanNo,
    receivedMeters: b.receivedMeters !== null && b.receivedMeters !== undefined ? Number(b.receivedMeters) : null,
    shrinkageMeters: b.shrinkageMeters !== null && b.shrinkageMeters !== undefined ? Number(b.shrinkageMeters) : null,
    shrinkagePercent: b.shrinkagePercent !== null && b.shrinkagePercent !== undefined ? Number(b.shrinkagePercent) : null,
    receivedDate: b.receivedDate,
    remarks: b.remarks,
    party: b.party,
    vendor: b.vendor,
    sentBy: b.sentBy,
    inward: b.inward,
    inwardItem: b.inwardItem,
    returns: (b.returns || []).map((r: any) => ({
      id: r.id,
      vendorChallanNo: r.vendorChallanNo,
      accountedMeters: Number(r.accountedMeters),
      receivedMeters: Number(r.receivedMeters),
      shrinkageMeters: Number(r.shrinkageMeters),
      shrinkagePercent: Number(r.shrinkagePercent),
      returnDate: r.returnDate,
      receivedBy: r.receivedBy,
      remarks: r.remarks,
    })),
  }));

  const transfers = rawTransfers.map((t: any) => ({
    id: t.id,
    transferNumber: t.transferNumber,
    partyId: t.partyId,
    inwardId: t.inwardId,
    inwardItemId: t.inwardItemId,
    fabricDescription: t.fabricDescription,
    unit: t.unit,
    quantity: Number(t.quantity),
    damagedQuantity: Number(t.damagedQuantity || 0),
    fromDepartment: t.fromDepartment,
    toDepartment: t.toDepartment,
    machineNumber: t.machineNumber,
    operatorName: t.operatorName,
    remarks: t.remarks,
    transferDate: t.transferDate instanceof Date ? t.transferDate.toISOString() : String(t.transferDate),
    transferredBy: t.transferredBy,
    party: t.party,
    inward: t.inward,
  }));

  const ledgerEntries = rawLedgerEntries.map((e: any) => ({
    id: e.id,
    partyId: e.partyId,
    partyChallanNo: e.partyChallanNo,
    inwardId: e.inwardId,
    inwardItemId: e.inwardItemId,
    itemCategory: e.itemCategory || "CONTINUOUS",
    fabricDescription: e.fabricDescription || (e.inwardItem ? `${e.inwardItem.fabricType} (${e.inwardItem.colorShade})` : null),
    unit: e.unit || "METERS",
    movementType: e.movementType,
    referenceNumber: e.referenceNumber,
    creditMeters: Number(e.creditMeters || 0),
    debitMeters: Number(e.debitMeters || 0),
    shrinkageMeters: Number(e.shrinkageMeters || 0),
    runningBalance: Number(e.runningBalance || 0),
    creditPieces: Number(e.creditPieces || 0),
    debitPieces: Number(e.debitPieces || 0),
    shortagePieces: Number(e.shortagePieces || 0),
    runningPieces: Number(e.runningPieces || 0),
    timestamp: e.timestamp,
    notes: e.notes,
    lotNumber: e.inwardItem ? e.inwardItem.itemIndex + 1 : null,
    lotFabricType: e.inwardItem?.fabricType || null,
    lotColorShade: e.inwardItem?.colorShade || null,
  }));

  const inwardList = rawInwardList.map((i: any) => {
    const lotEntries = ledgerEntries.filter(
      (e: any) =>
        e.inwardId === i.id ||
        (e.partyChallanNo && e.partyChallanNo === i.partyChallanNo && e.partyId === i.partyId)
    );
    let availableMeters = Number(i.measuredMeters);
    if (lotEntries.length > 0) {
      const c = lotEntries.reduce((s: number, e: any) => s + Number(e.creditMeters || 0), 0);
      const d = lotEntries.reduce((s: number, e: any) => s + Number(e.debitMeters || 0), 0);
      const sh = lotEntries.reduce((s: number, e: any) => s + Number(e.shrinkageMeters || 0), 0);
      availableMeters = Math.max(0, Number((c - d - sh).toFixed(2)));
    }
    return {
      id: i.id,
      igpNumber: i.igpNumber,
      partyId: i.partyId,
      partyChallanNo: i.partyChallanNo,
      fabricType: i.fabricType,
      colorShade: i.colorShade,
      rollCount: i.rollCount,
      challanMeters: Number(i.challanMeters),
      measuredMeters: Number(i.measuredMeters),
      shortageMeters: Number(i.shortageMeters),
      availableMeters,
      driverDetails: i.driverDetails,
      remarks: i.remarks,
      editHistory: i.editHistory,
      challanDate: i.challanDate,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      party: i.party,
      receivedBy: i.receivedBy,
      items: (i.items || []).map((it: any) => {
        const itemEntries = ledgerEntries.filter(
          (e: any) =>
            e.inwardItemId === it.id ||
            ((!e.inwardItemId || e.inwardItemId === it.id) &&
              (i.items.length === 1 && e.inwardId === i.id))
        );

        let availableQty = Number(it.measuredQty || 0);
        let availableMeters: number | null = null;

        if (it.unit === "PIECES") {
          if (itemEntries.length > 0) {
            const c = itemEntries.reduce((s: number, e: any) => s + Number(e.creditPieces || 0), 0);
            const d = itemEntries.reduce((s: number, e: any) => s + Number(e.debitPieces || 0), 0);
            const sh = itemEntries.reduce((s: number, e: any) => s + Number(e.shortagePieces || 0), 0);
            availableQty = Math.max(0, c - d - sh);
          }
        } else {
          // CONTINUOUS fabric (METERS or YARDS)
          if (itemEntries.length > 0) {
            const c = itemEntries.reduce((s: number, e: any) => s + Number(e.creditMeters || 0), 0);
            const d = itemEntries.reduce((s: number, e: any) => s + Number(e.debitMeters || 0), 0);
            const sh = itemEntries.reduce((s: number, e: any) => s + Number(e.shrinkageMeters || 0), 0);
            availableMeters = Math.max(0, Number((c - d - sh).toFixed(2)));
          } else {
            availableMeters =
              it.standardMeters !== null
                ? Number(it.standardMeters)
                : it.unit === "YARDS"
                ? yardsToMeters(Number(it.measuredQty))
                : Number(it.measuredQty);
          }
          if (it.unit === "YARDS") {
            availableQty = Number(metersToYards(availableMeters).toFixed(2));
          } else {
            availableQty = availableMeters;
          }
        }

        return {
          id: it.id,
          itemIndex: it.itemIndex,
          fabricType: it.fabricType,
          colorShade: it.colorShade,
          unit: it.unit,
          rollCount: it.rollCount,
          challanQty: Number(it.challanQty),
          measuredQty: Number(it.measuredQty),
          shortageQty: Number(it.shortageQty),
          standardMeters: it.standardMeters !== null ? Number(it.standardMeters) : null,
          availableQty,
          availableMeters,
        };
      }),
    };
  });

  // Compute live multi-metric KPI aggregates
  const partyBalances = parties.map((p: any) => {
    const contEntries = ledgerEntries.filter((e: any) => e.partyId === p.id && e.itemCategory !== "PIECES");
    const pieceEntries = ledgerEntries.filter((e: any) => e.partyId === p.id && e.itemCategory === "PIECES");
    const balance = contEntries.length > 0 ? Number(contEntries[0].runningBalance || 0) : 0;
    const piecesBalance = pieceEntries.length > 0 ? Number(pieceEntries[0].runningPieces || 0) : 0;
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      partyType: p.partyType,
      balance,
      piecesBalance,
    };
  });

  const totalFabricInCustody = partyBalances.reduce((acc: number, curr: any) => acc + curr.balance, 0);
  const totalPiecesInCustody = partyBalances.reduce((acc: number, curr: any) => acc + curr.piecesBalance, 0);

  const totalAtDyers = batches
    .filter((b: any) => b.status === "WITH_VENDOR" || b.status === "RECEIVED_PARTIAL")
    .reduce((acc: number, curr: any) => acc + (Number(curr.sentMeters) - Number(curr.accountedMeters || 0)), 0);

  const totalShortagesFlagged = ledgerEntries
    .filter((e: any) => e.itemCategory !== "PIECES")
    .reduce((acc: number, curr: any) => {
      const s = Number(curr.shrinkageMeters || 0);
      return acc + (s > 0 ? s : 0);
    }, 0);

  const totalPieceShortages = ledgerEntries
    .filter((e: any) => e.itemCategory === "PIECES")
    .reduce((acc: number, curr: any) => {
      const sp = Number(curr.shortagePieces || 0);
      return acc + (sp > 0 ? sp : 0);
    }, 0);
  return (
    <div className="min-h-screen flex flex-col bg-zinc-100">
      <Header session={session} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Top Summary Bar */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
                Fabric Operations & Custody Desk
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500">
                Inward gate verification, outsource dyeing tracking, and dual-table running statements.
              </p>
            </div>
          </div>

          {/* Quick Metrics Cards (Stacked on Mobile, 4-col on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: In Factory Custody */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>In Factory Custody</span>
                <Layers className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold font-mono text-zinc-950">
                {totalFabricInCustody.toFixed(2)}m
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>≈ {metersToYards(totalFabricInCustody).toFixed(1)} yd</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {totalPiecesInCustody.toLocaleString()} pcs
                </span>
              </div>
            </div>

            {/* Card 2: Active at Dyers */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Active at Dyers</span>
                <Truck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold font-mono text-zinc-950">
                {totalAtDyers.toFixed(2)}m
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>≈ {metersToYards(totalAtDyers).toFixed(1)} yd</span>
                <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  0 pcs
                </span>
              </div>
            </div>

            {/* Card 3: Inward Shortages */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Inward Shortages</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-800">
                {totalShortagesFlagged.toFixed(2)}m
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>≈ {metersToYards(totalShortagesFlagged).toFixed(1)} yd</span>
                <span className="font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  {totalPieceShortages.toLocaleString()} pcs
                </span>
              </div>
            </div>

            {/* Card 4: Registered Parties (Clickable tab link) */}
            <Link
              href="/dashboard?tab=parties"
              className="bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 rounded-xl p-3.5 shadow-xs space-y-1 transition-all block group cursor-pointer"
            >
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Registered Parties</span>
                <Building2 className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
              </div>
              <div className="text-xl font-bold font-mono text-zinc-950">{parties.length}</div>
              <span className="text-[10px] text-zinc-400 font-mono block">Active client accounts →</span>
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-zinc-200 pb-2 mb-6 overflow-x-auto">
          <Link
            href="/dashboard?tab=inward"
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === "inward"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-200"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Fabric Inward (Gate)</span>
          </Link>

          <Link
            href="/dashboard?tab=outsource"
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === "outsource"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-200"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Outsource Dyeing & Printing</span>
          </Link>

          <Link
            href="/dashboard?tab=delivery"
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === "delivery"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-200"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Delivery Challan</span>
          </Link>

          <Link
            href="/dashboard?tab=ledger"
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === "ledger"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Party Running Ledger</span>
          </Link>

          <Link
            href="/dashboard?tab=workstations"
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === "workstations"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-200"
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Internal Workstations</span>
          </Link>

          <Link
            href="/dashboard?tab=parties"
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === "parties"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-200"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Client Parties</span>
          </Link>

          <Link
            href="/dashboard?tab=vendors"
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              tab === "vendors"
                ? "bg-zinc-900 text-white shadow-xs"
                : "bg-white text-zinc-600 hover:text-zinc-950 border border-zinc-200"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Outsource Vendors</span>
          </Link>
        </div>

        {/* Tab View Content */}
        {tab === "inward" && (
          <FabricInwardManager parties={parties} inwardList={inwardList} />
        )}

        {tab === "outsource" && (
          <OutsourceBatchManager
            parties={partyBalances}
            vendors={vendors}
            batches={batches}
            inwards={inwardList}
          />
        )}

        {tab === "workstations" && (
          <WorkstationManager
            parties={partyBalances}
            inwards={inwardList}
            transfers={transfers}
            batches={batches}
          />
        )}

        {tab === "delivery" && (
          <DeliveryChallanForm parties={partyBalances} inwards={inwardList} />
        )}

        {tab === "ledger" && (
          <PartyRunningLedger
            parties={partyBalances}
            entries={ledgerEntries}
            inwards={inwardList}
          />
        )}

        {tab === "parties" && (
          <PartyManagement
            parties={parties}
            canCreateParty={canCreateParty}
            nextPartyCode={nextPartyCode}
          />
        )}

        {tab === "vendors" && (
          <VendorManagement
            vendors={vendors}
            canCreateVendor={canCreateParty}
            nextVendorCode={nextVendorCode}
          />
        )}
      </main>
    </div>
  );
}
