"use client";

import { useState } from "react";
import {
  BookOpen,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  Filter,
  Layers,
  Scissors,
  Repeat,
} from "lucide-react";
import { metersToYards, yardsToMeters } from "@/lib/units";
import { formatPakistanDate } from "@/lib/dateUtils";

export interface LedgerEntry {
  id: string;
  partyId: string;
  partyChallanNo?: string | null;
  inwardId?: string | null;
  inwardItemId?: string | null;
  itemCategory?: string;
  fabricDescription?: string | null;
  unit?: string;
  movementType: string;
  referenceNumber: string;
  creditMeters: any;
  debitMeters: any;
  shrinkageMeters: any;
  runningBalance: any;
  creditPieces?: number;
  debitPieces?: number;
  shortagePieces?: number;
  runningPieces?: number;
  timestamp: Date;
  notes: string | null;
  lotNumber?: number | null;
  lotFabricType?: string | null;
  lotColorShade?: string | null;
}

interface PartySummary {
  id: string;
  name: string;
  code: string;
  partyType: string;
}

interface InwardOption {
  id: string;
  partyId: string;
  partyChallanNo: string;
  fabricType?: string | null;
  colorShade?: string | null;
}

export default function PartyRunningLedger({
  parties,
  entries,
  inwards = [],
}: {
  parties: PartySummary[];
  entries: LedgerEntry[];
  inwards?: InwardOption[];
}) {
  const [selectedPartyId, setSelectedPartyId] = useState<string>(parties[0]?.id || "");
  const [selectedChallan, setSelectedChallan] = useState<string>("ALL");
  const [selectedLot, setSelectedLot] = useState<string>("ALL");
  const [continuousUnit, setContinuousUnit] = useState<"METERS" | "YARDS">("METERS");

  const partyEntries = entries.filter((e) => e.partyId === selectedPartyId);
  const currentParty = parties.find((p) => p.id === selectedPartyId);

  // Extract distinct party challan numbers
  const partyChallanNumbers = Array.from(
    new Set(
      partyEntries
        .map((e) => e.partyChallanNo)
        .filter((c): c is string => Boolean(c && c.trim()))
    )
  );

  // Candidate entries for discovering available lots
  const candidateEntriesForLots =
    selectedChallan === "ALL"
      ? partyEntries
      : partyEntries.filter((e) => e.partyChallanNo === selectedChallan);

  // Extract distinct lots for this party / challan
  const distinctLotsMap = new Map<
    string,
    { id: string; lotNumber: number | null; label: string; challanNo: string | null }
  >();
  for (const e of candidateEntriesForLots) {
    if (e.inwardItemId) {
      if (!distinctLotsMap.has(e.inwardItemId)) {
        const lotNumStr = e.lotNumber ? `Lot #${e.lotNumber}` : "Lot";
        const desc = e.lotFabricType
          ? `${e.lotFabricType}${e.lotColorShade ? ` (${e.lotColorShade})` : ""}`
          : e.fabricDescription || "Fabric Lot";
        const challanPrefix = selectedChallan === "ALL" && e.partyChallanNo ? `[#${e.partyChallanNo}] ` : "";
        distinctLotsMap.set(e.inwardItemId, {
          id: e.inwardItemId,
          lotNumber: e.lotNumber ?? null,
          label: `${challanPrefix}${lotNumStr}: ${desc}`,
          challanNo: e.partyChallanNo ?? null,
        });
      }
    }
  }
  const availableLots = Array.from(distinctLotsMap.values()).sort((a, b) => {
    if (a.challanNo !== b.challanNo) return (a.challanNo || "").localeCompare(b.challanNo || "");
    return (a.lotNumber || 0) - (b.lotNumber || 0);
  });

  // Filter entries if specific challan or lot is chosen
  let filteredEntries =
    selectedChallan === "ALL"
      ? partyEntries
      : partyEntries.filter((e) => e.partyChallanNo === selectedChallan);

  if (selectedLot !== "ALL") {
    filteredEntries = filteredEntries.filter((e) => e.inwardItemId === selectedLot);
  }

  // Separate entries into Continuous Fabric vs Cut Pieces
  const continuousEntries = filteredEntries.filter(
    (e) => (e.itemCategory || "CONTINUOUS") !== "PIECES"
  );
  const piecesEntries = filteredEntries.filter(
    (e) => e.itemCategory === "PIECES"
  );

  // 1. Total Deposited
  const contDeposited = continuousEntries
    .filter((e) => e.movementType === "PARTY_INWARD" || e.movementType === "INWARD_SURPLUS")
    .reduce((acc, curr) => acc + Number(curr.creditMeters || 0), 0);
  const piecesDeposited = piecesEntries
    .filter((e) => e.movementType === "PARTY_INWARD" || e.movementType === "INWARD_SURPLUS")
    .reduce((acc, curr) => acc + (curr.creditPieces || 0), 0);

  // 2. Delivered to Party
  const contDelivered = continuousEntries
    .filter((e) => e.movementType === "DELIVERY_TO_PARTY")
    .reduce((acc, curr) => acc + Number(curr.debitMeters || 0), 0);
  const piecesDelivered = piecesEntries
    .filter((e) => e.movementType === "DELIVERY_TO_PARTY")
    .reduce((acc, curr) => acc + (curr.debitPieces || 0), 0);

  // 3. Shrinkage & Shortage
  const contShrinkage = continuousEntries.reduce(
    (acc, curr) => acc + Number(curr.shrinkageMeters || 0),
    0
  );
  const piecesShortage = piecesEntries.reduce(
    (acc, curr) => acc + (curr.shortagePieces || 0),
    0
  );

  // 4. In Factory Custody Balance
  // Continuous balance
  const contCurrentBalance =
    selectedChallan === "ALL" && selectedLot === "ALL"
      ? continuousEntries.length > 0
        ? Number(continuousEntries[0].runningBalance || 0)
        : 0
      : Math.max(
          0,
          Number(
            (
              continuousEntries.reduce((acc, curr) => acc + Number(curr.creditMeters || 0), 0) -
              continuousEntries.reduce((acc, curr) => acc + Number(curr.debitMeters || 0), 0) -
              continuousEntries.reduce((acc, curr) => acc + Number(curr.shrinkageMeters || 0), 0)
            ).toFixed(2)
          )
        );

  // Pieces balance
  const piecesCurrentBalance =
    selectedChallan === "ALL" && selectedLot === "ALL"
      ? piecesEntries.length > 0
        ? Number(piecesEntries[0].runningPieces || 0)
        : 0
      : Math.max(
          0,
          piecesEntries.reduce((acc, curr) => acc + (curr.creditPieces || 0), 0) -
            piecesEntries.reduce((acc, curr) => acc + (curr.debitPieces || 0), 0) -
            piecesEntries.reduce((acc, curr) => acc + (curr.shortagePieces || 0), 0)
        );

  // Calculate lot-level chronological running balances for Continuous Fabric
  const contLotAscending = [...continuousEntries].reverse();
  let contLotRun = 0;
  const contRunningByEntryId: Record<string, number> = {};
  for (const item of contLotAscending) {
    const c = Number(item.creditMeters || 0);
    const d = Number(item.debitMeters || 0);
    const s = Number(item.shrinkageMeters || 0);
    contLotRun = Number((contLotRun + c - d - s).toFixed(2));
    contRunningByEntryId[item.id] = contLotRun;
  }

  // Calculate lot-level chronological running balances for Pieces
  const piecesLotAscending = [...piecesEntries].reverse();
  let piecesLotRun = 0;
  const piecesRunningByEntryId: Record<string, number> = {};
  for (const item of piecesLotAscending) {
    const c = item.creditPieces || 0;
    const d = item.debitPieces || 0;
    const s = item.shortagePieces || 0;
    piecesLotRun = piecesLotRun + c - d - s;
    piecesRunningByEntryId[item.id] = piecesLotRun;
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-950">Party Custody Running Ledger</h2>
            <p className="text-xs text-zinc-500">
              Audit statements for continuous fabric & cut garment components
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Party Selector */}
          <select
            value={selectedPartyId}
            onChange={(e) => {
              setSelectedPartyId(e.target.value);
              setSelectedChallan("ALL");
              setSelectedLot("ALL");
            }}
            className="h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
          >
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>

          {/* Challan Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-300 rounded-lg px-2.5 h-10">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={selectedChallan}
              onChange={(e) => {
                setSelectedChallan(e.target.value);
                setSelectedLot("ALL");
              }}
              className="bg-transparent text-xs font-medium text-zinc-900 focus:outline-hidden font-mono cursor-pointer"
            >
              <option value="ALL">All Challans (Consolidated)</option>
              {partyChallanNumbers.map((cNo) => (
                <option key={cNo} value={cNo}>
                  Challan #{cNo}
                </option>
              ))}
            </select>
          </div>

          {/* Lot Filter Dropdown */}
          {availableLots.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50/60 border border-amber-300 rounded-lg px-2.5 h-10">
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              <select
                value={selectedLot}
                onChange={(e) => setSelectedLot(e.target.value)}
                className="bg-transparent text-xs font-medium text-amber-950 focus:outline-hidden font-mono cursor-pointer max-w-xs truncate"
              >
                <option value="ALL">All Lots (Consolidated)</option>
                {availableLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="h-10 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium rounded-lg border border-zinc-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print Statement</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards: Unified Dual Metrics (Continuous Length + Pieces) */}
      {currentParty && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Deposited */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
            <div className="text-zinc-500 text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                <span>Deposited</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Total In</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-lg font-bold font-mono text-zinc-950">
                +{contDeposited.toFixed(2)}m
              </div>
              <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between">
                <span>≈ {metersToYards(contDeposited).toFixed(1)} yd</span>
                <span className="font-semibold text-zinc-700">+{piecesDeposited.toLocaleString()} pcs</span>
              </div>
            </div>
          </div>

          {/* Card 2: Delivered to Party */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
            <div className="text-zinc-500 text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                <span>Delivered</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">To Party</span>
            </div>
            <div className="space-y-0.5">
              <div className="text-lg font-bold font-mono text-zinc-950">
                -{contDelivered.toFixed(2)}m
              </div>
              <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between">
                <span>≈ {metersToYards(contDelivered).toFixed(1)} yd</span>
                <span className="font-semibold text-zinc-700">-{piecesDelivered.toLocaleString()} pcs</span>
              </div>
            </div>
          </div>

          {/* Card 3: Technical Shrinkage + Dock Shortage */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
            <div className="text-zinc-500 text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>Loss / Variance</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Shortage / Excess</span>
            </div>
            <div className="space-y-0.5">
              <div className={`text-lg font-bold font-mono ${contShrinkage > 0 ? "text-rose-800" : contShrinkage < 0 ? "text-emerald-800" : "text-zinc-700"}`}>
                {contShrinkage > 0 ? `-${contShrinkage.toFixed(2)}m` : contShrinkage < 0 ? `+${Math.abs(contShrinkage).toFixed(2)}m` : "0.00m"}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between">
                <span>≈ {metersToYards(Math.abs(contShrinkage)).toFixed(1)} yd</span>
                <span className={`font-semibold ${piecesShortage > 0 ? "text-rose-700" : piecesShortage < 0 ? "text-emerald-700" : "text-zinc-600"}`}>
                  {piecesShortage > 0 ? `-${piecesShortage.toLocaleString()} pcs` : piecesShortage < 0 ? `+${Math.abs(piecesShortage).toLocaleString()} pcs` : "0 pcs"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Current In-Factory Stock Balance */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1.5">
            <div className="text-emerald-900 text-xs font-medium flex items-center justify-between">
              <span>{selectedChallan !== "ALL" ? `In Custody (#${selectedChallan})` : "In Factory Custody"}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xl font-bold font-mono text-emerald-950">
                {contCurrentBalance.toFixed(2)}m
              </div>
              <div className="text-[10px] text-emerald-800 font-mono flex items-center justify-between font-medium">
                <span>≈ {metersToYards(contCurrentBalance).toFixed(1)} yd</span>
                <span className="font-bold text-emerald-900">{piecesCurrentBalance.toLocaleString()} pcs</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ============================================================================== */}
      {/* TABLE 1: CONTINUOUS FABRIC LEDGER (ROLLS / THANS IN METERS & YARDS) */}
      {/* ============================================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-900" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                1. Continuous Fabric Custody Ledger (Rolls / Thans)
              </h3>
              <p className="text-[11px] text-zinc-500">
                Linear measurement tracking for raw and dyed continuous cloth
              </p>
            </div>
          </div>

          {/* Unit Switch Toggle: Meters (m) vs Yards (yd) */}
          <div className="inline-flex items-center p-0.5 bg-zinc-200/80 rounded-lg text-xs font-medium self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setContinuousUnit("METERS")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                continuousUnit === "METERS"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              Primary: Meters (m)
            </button>
            <button
              type="button"
              onClick={() => setContinuousUnit("YARDS")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                continuousUnit === "YARDS"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              Primary: Yards (yd)
            </button>
          </div>
        </div>

        {/* Desktop View Table for Continuous Fabric */}
        <div className="hidden md:block overflow-x-auto border border-zinc-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono bg-zinc-50/70">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Reference #</th>
                <th className="py-2.5 px-3">Challan & Lot #</th>
                <th className="py-2.5 px-3">Fabric & Details</th>
                <th className="py-2.5 px-3 text-right">Inward (+)</th>
                <th className="py-2.5 px-3 text-right">Outward / Delivery (-)</th>
                <th className="py-2.5 px-3 text-right">Shortage / Excess (-+)</th>
                <th className="py-2.5 px-3 text-right">
                  {selectedLot !== "ALL"
                    ? "Lot Balance"
                    : selectedChallan !== "ALL"
                    ? "Challan Balance"
                    : "Running Stock"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono">
              {continuousEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    No continuous fabric transactions recorded yet for this selection.
                  </td>
                </tr>
              ) : (
                continuousEntries.map((entry) => {
                  const rawBal =
                    selectedChallan === "ALL" && selectedLot === "ALL"
                      ? Number(entry.runningBalance)
                      : contRunningByEntryId[entry.id] ?? Number(entry.runningBalance);

                  const cMeters = Number(entry.creditMeters || 0);
                  const dMeters = Number(entry.debitMeters || 0);
                  const sMeters = Number(entry.shrinkageMeters || 0);

                  // Formatting helper according to active continuousUnit toggle
                  const formatMetric = (meters: number) => {
                    if (meters === 0) return null;
                    const yards = metersToYards(meters);
                    if (continuousUnit === "YARDS") {
                      return {
                        primary: `${yards.toFixed(2)} yd`,
                        secondary: `≈ ${meters.toFixed(2)} m`,
                      };
                    }
                    return {
                      primary: `${meters.toFixed(2)} m`,
                      secondary: `≈ ${yards.toFixed(2)} yd`,
                    };
                  };

                  const credFmt = formatMetric(cMeters);
                  const debFmt = formatMetric(dMeters);
                  const shrinkFmt = formatMetric(Math.abs(sMeters));
                  const balFmt = formatMetric(rawBal) || { primary: "0.00 m", secondary: "0.00 yd" };

                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">
                        {formatPakistanDate(entry.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900 whitespace-nowrap">
                        {entry.referenceNumber}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {entry.partyChallanNo ? (
                            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 font-semibold text-[11px] font-mono">
                              #{entry.partyChallanNo}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                          {entry.lotNumber && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px] font-mono flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5 text-amber-700" />
                              Lot #{entry.lotNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-zinc-700 max-w-xs">
                        {entry.notes || entry.fabricDescription || entry.movementType}
                      </td>

                      {/* INWARD (+) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {credFmt ? (
                          <div>
                            <span className="text-emerald-700 font-semibold">+{credFmt.primary}</span>
                            <span className="block text-[10px] text-zinc-400">{credFmt.secondary}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      {/* OUTWARD (-) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {debFmt ? (
                          <div>
                            <span className="text-blue-700 font-semibold">-{debFmt.primary}</span>
                            <span className="block text-[10px] text-zinc-400">{debFmt.secondary}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      {/* SHORTAGE / EXCESS (-+) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {sMeters !== 0 && shrinkFmt ? (
                          sMeters > 0 ? (
                            <div>
                              <span className="text-rose-700 font-semibold">-{shrinkFmt.primary}</span>
                              <span className="block text-[10px] text-zinc-400">{shrinkFmt.secondary}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-emerald-700 font-semibold">+{shrinkFmt.primary}</span>
                              <span className="block text-[10px] text-zinc-400">{shrinkFmt.secondary}</span>
                            </div>
                          )
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      {/* RUNNING BALANCE */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div>
                          <span className="text-zinc-950 font-bold">{balFmt.primary}</span>
                          <span className="block text-[10px] text-zinc-500 font-medium">
                            {balFmt.secondary}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ============================================================================== */}
      {/* TABLE 2: CUT PIECES & GARMENT COMPONENTS LEDGER (PCS) */}
      {/* ============================================================================== */}
      <div className="space-y-3 pt-4 border-t border-zinc-200/80">
        <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-lg border border-zinc-200">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-zinc-900" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                2. Cut Pieces & Garment Components Ledger (Pieces)
              </h3>
              <p className="text-[11px] text-zinc-500">
                Component accounting for cut panels, sleeves, fronts, backs, and trousers
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-zinc-500 bg-white px-2 py-0.5 rounded border border-zinc-200">
            {piecesEntries.length} piece entry{piecesEntries.length !== 1 ? "ies" : "y"}
          </span>
        </div>

        {/* Desktop View Table for Cut Pieces */}
        <div className="hidden md:block overflow-x-auto border border-zinc-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono bg-zinc-50/70">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Reference #</th>
                <th className="py-2.5 px-3">Challan & Lot #</th>
                <th className="py-2.5 px-3">Garment Component / Details</th>
                <th className="py-2.5 px-3 text-right">Inward (+) [pcs]</th>
                <th className="py-2.5 px-3 text-right">Outward (-) [pcs]</th>
                <th className="py-2.5 px-3 text-right">Shortage / Excess (-+) [pcs]</th>
                <th className="py-2.5 px-3 text-right">
                  {selectedLot !== "ALL"
                    ? "Lot Balance [pcs]"
                    : selectedChallan !== "ALL"
                    ? "Challan Balance [pcs]"
                    : "Running Balance [pcs]"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono">
              {piecesEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    No cut piece transactions recorded yet for this selection.
                  </td>
                </tr>
              ) : (
                piecesEntries.map((entry) => {
                  const displayBal =
                    selectedChallan === "ALL" && selectedLot === "ALL"
                      ? entry.runningPieces || 0
                      : piecesRunningByEntryId[entry.id] ?? (entry.runningPieces || 0);

                  const credPcs = entry.creditPieces || 0;
                  const debPcs = entry.debitPieces || 0;
                  const shortPcs = entry.shortagePieces || 0;

                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">
                        {formatPakistanDate(entry.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900 whitespace-nowrap">
                        {entry.referenceNumber}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {entry.partyChallanNo ? (
                            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 font-semibold text-[11px] font-mono">
                              #{entry.partyChallanNo}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                          {entry.lotNumber && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px] font-mono flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5 text-amber-700" />
                              Lot #{entry.lotNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-zinc-700 max-w-xs">
                        {entry.notes || entry.fabricDescription || entry.movementType}
                      </td>

                      {/* INWARD (+) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {credPcs > 0 ? (
                          <span className="text-emerald-700 font-semibold">
                            +{credPcs.toLocaleString()} pcs
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      {/* OUTWARD (-) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {debPcs > 0 ? (
                          <span className="text-blue-700 font-semibold">
                            -{debPcs.toLocaleString()} pcs
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      {/* SHORTAGE / EXCESS (-+) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {shortPcs !== 0 ? (
                          shortPcs > 0 ? (
                            <span className="text-rose-700 font-semibold">
                              -{shortPcs.toLocaleString()} pcs
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">
                              +{Math.abs(shortPcs).toLocaleString()} pcs
                            </span>
                          )
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>

                      {/* RUNNING BALANCE */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-zinc-950">
                        {displayBal.toLocaleString()} pcs
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE COMBINED VIEW (< 768px) */}
      <div className="block md:hidden space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">
          Mobile Ledger Stream ({filteredEntries.length})
        </h4>
        {filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 font-mono">
            No ledger transactions found for this selection.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isPieces = entry.itemCategory === "PIECES";
            const contBal =
              selectedChallan === "ALL"
                ? Number(entry.runningBalance || 0)
                : contRunningByEntryId[entry.id] ?? Number(entry.runningBalance || 0);
            const pieceBal =
              selectedChallan === "ALL"
                ? entry.runningPieces || 0
                : piecesRunningByEntryId[entry.id] ?? (entry.runningPieces || 0);

            return (
              <div key={entry.id} className="p-3.5 rounded-xl border border-zinc-200 bg-white space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-900">{entry.referenceNumber}</span>
                    {entry.partyChallanNo && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                        #{entry.partyChallanNo}
                      </span>
                    )}
                    {entry.lotNumber && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5 text-amber-700" />
                        Lot #{entry.lotNumber}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                      {isPieces ? "Pieces" : "Continuous"}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {formatPakistanDate(entry.timestamp)}
                  </span>
                </div>

                <div className="text-xs text-zinc-600 font-medium">
                  {entry.notes || entry.fabricDescription || entry.movementType}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Change</span>
                    {isPieces ? (
                      <>
                        {(entry.creditPieces || 0) > 0 && (
                          <span className="text-emerald-700 font-bold block">
                            +{(entry.creditPieces || 0).toLocaleString()} pcs
                          </span>
                        )}
                        {(entry.debitPieces || 0) > 0 && (
                          <span className="text-blue-700 font-bold block">
                            -{(entry.debitPieces || 0).toLocaleString()} pcs
                          </span>
                        )}
                        {(entry.shortagePieces || 0) !== 0 && (
                          (entry.shortagePieces || 0) > 0 ? (
                            <span className="text-rose-700 font-bold block">
                              -{(entry.shortagePieces || 0).toLocaleString()} pcs
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold block">
                              +{Math.abs(entry.shortagePieces || 0).toLocaleString()} pcs
                            </span>
                          )
                        )}
                      </>
                    ) : (
                      <>
                        {Number(entry.creditMeters || 0) > 0 && (
                          <div>
                            <span className="text-emerald-700 font-bold">
                              +{Number(entry.creditMeters).toFixed(2)}m
                            </span>
                            <span className="text-[10px] text-zinc-400 block">
                              ≈ {metersToYards(Number(entry.creditMeters)).toFixed(1)} yd
                            </span>
                          </div>
                        )}
                        {Number(entry.debitMeters || 0) > 0 && (
                          <div>
                            <span className="text-blue-700 font-bold">
                              -{Number(entry.debitMeters).toFixed(2)}m
                            </span>
                            <span className="text-[10px] text-zinc-400 block">
                              ≈ {metersToYards(Number(entry.debitMeters)).toFixed(1)} yd
                            </span>
                          </div>
                        )}
                        {Number(entry.shrinkageMeters || 0) !== 0 && (
                          Number(entry.shrinkageMeters || 0) > 0 ? (
                            <div>
                              <span className="text-rose-700 font-bold">
                                -{Number(entry.shrinkageMeters).toFixed(2)}m
                              </span>
                              <span className="text-[10px] text-zinc-400 block">
                                ≈ {metersToYards(Number(entry.shrinkageMeters)).toFixed(1)} yd
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-emerald-700 font-bold">
                                +{Math.abs(Number(entry.shrinkageMeters)).toFixed(2)}m
                              </span>
                              <span className="text-[10px] text-zinc-400 block">
                                ≈ {metersToYards(Math.abs(Number(entry.shrinkageMeters))).toFixed(1)} yd
                              </span>
                            </div>
                          )
                        )}
                      </>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block uppercase">
                      {selectedChallan !== "ALL" ? "Lot Balance" : "Running Stock"}
                    </span>
                    {isPieces ? (
                      <span className="font-bold text-zinc-950 block">
                        {pieceBal.toLocaleString()} pcs
                      </span>
                    ) : (
                      <div>
                        <span className="font-bold text-zinc-950">
                          {contBal.toFixed(2)}m
                        </span>
                        <span className="text-[10px] text-zinc-500 block font-medium">
                          ≈ {metersToYards(contBal).toFixed(1)} yd
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
