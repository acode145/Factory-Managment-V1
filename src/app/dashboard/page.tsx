import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import FabricInwardManager from "@/components/fabric/FabricInwardManager";
import OutsourceBatchManager from "@/components/fabric/OutsourceBatchManager";
import DeliveryChallanForm from "@/components/fabric/DeliveryChallanForm";
import PartyRunningLedger from "@/components/fabric/PartyRunningLedger";
import { metersToYards } from "@/lib/units";
import {
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Truck,
  BookOpen,
  Building2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

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
  const [parties, vendors, rawInwardList, rawBatches, rawLedgerEntries] = await Promise.all([
    prisma.party.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, partyType: true },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, defaultProcess: true },
      orderBy: { name: "asc" },
    }),
    prisma.fabricInward.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        party: { select: { name: true, code: true } },
        receivedBy: { select: { fullName: true } },
      },
    }),
    prisma.outsourceBatch.findMany({
      orderBy: { sentDate: "desc" },
      include: {
        party: { select: { name: true, code: true } },
        vendor: { select: { name: true, code: true } },
        sentBy: { select: { fullName: true } },
      },
    }),
    prisma.fabricLedgerEntry.findMany({
      orderBy: { timestamp: "desc" },
    }),
  ]);

  // Serialize Prisma Decimals into plain JavaScript numbers to prevent Client Component serialization errors
  const batches = rawBatches.map((b: any) => ({
    id: b.id,
    ogpNumber: b.ogpNumber,
    processType: b.processType,
    targetShade: b.targetShade,
    sentMeters: Number(b.sentMeters),
    sentDate: b.sentDate,
    status: b.status,
    vendorChallanNo: b.vendorChallanNo,
    receivedMeters: b.receivedMeters !== null && b.receivedMeters !== undefined ? Number(b.receivedMeters) : null,
    shrinkageMeters: b.shrinkageMeters !== null && b.shrinkageMeters !== undefined ? Number(b.shrinkageMeters) : null,
    shrinkagePercent: b.shrinkagePercent !== null && b.shrinkagePercent !== undefined ? Number(b.shrinkagePercent) : null,
    receivedDate: b.receivedDate,
    party: b.party,
    vendor: b.vendor,
    sentBy: b.sentBy,
  }));

  const ledgerEntries = rawLedgerEntries.map((e: any) => ({
    id: e.id,
    partyId: e.partyId,
    movementType: e.movementType,
    referenceNumber: e.referenceNumber,
    creditMeters: Number(e.creditMeters || 0),
    debitMeters: Number(e.debitMeters || 0),
    shrinkageMeters: Number(e.shrinkageMeters || 0),
    runningBalance: Number(e.runningBalance || 0),
    timestamp: e.timestamp,
    notes: e.notes,
  }));

  const inwardList = rawInwardList.map((i: any) => ({
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
    driverDetails: i.driverDetails,
    remarks: i.remarks,
    editHistory: i.editHistory,
    challanDate: i.challanDate,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    party: i.party,
    receivedBy: i.receivedBy,
  }));

  // Compute live KPI metrics
  const partyBalances = parties.map((p: any) => {
    const partyEntries = ledgerEntries.filter((e: any) => e.partyId === p.id);
    const balance = partyEntries.length > 0 ? Number(partyEntries[0].runningBalance) : 0;
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      partyType: p.partyType,
      balance,
    };
  });

  const totalFabricInCustody = partyBalances.reduce((acc: number, curr: any) => acc + curr.balance, 0);

  const totalAtDyers = batches
    .filter((b: any) => b.status === "WITH_VENDOR")
    .reduce((acc: number, curr: any) => acc + Number(curr.sentMeters), 0);

  const totalShortagesFlagged = inwardList.reduce(
    (acc: number, curr: any) => acc + (curr.shortageMeters > 0 ? curr.shortageMeters : 0),
    0
  );

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
                Inward gate verification, outsource dyeing tracking, and party running statements.
              </p>
            </div>
          </div>

          {/* Quick Metrics Cards (Stacked on Mobile, 4-col on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>In Factory Custody</span>
                <Layers className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-zinc-950">
                {totalFabricInCustody.toFixed(2)}m
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                ≈ {metersToYards(totalFabricInCustody).toFixed(1)} yds • Across {parties.length} parties
              </span>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Active at Dyers</span>
                <Truck className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-zinc-950">
                {totalAtDyers.toFixed(2)}m
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                ≈ {metersToYards(totalAtDyers).toFixed(1)} yds • In vendor processing
              </span>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Inward Shortages</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-rose-800">
                {totalShortagesFlagged.toFixed(2)}m
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                ≈ {metersToYards(totalShortagesFlagged).toFixed(1)} yds • Claimed vs measured gap
              </span>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Registered Parties</span>
                <Building2 className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-zinc-950">{parties.length}</div>
              <span className="text-[10px] text-zinc-400 font-mono">Active accounts</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation (Horizontal Scrollable on Mobile) */}
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
        </div>

        {/* Tab View Content */}
        {tab === "inward" && (
          <FabricInwardManager parties={parties} inwardList={inwardList} />
        )}

        {tab === "outsource" && (
          <OutsourceBatchManager parties={partyBalances} vendors={vendors} batches={batches} />
        )}

        {tab === "delivery" && <DeliveryChallanForm parties={partyBalances} />}

        {tab === "ledger" && (
          <PartyRunningLedger parties={partyBalances} entries={ledgerEntries} />
        )}
      </main>
    </div>
  );
}
