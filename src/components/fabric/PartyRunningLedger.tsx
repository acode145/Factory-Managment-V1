"use client";

import { useState } from "react";
import { BookOpen, Printer, ArrowDownLeft, ArrowUpRight, TrendingDown, Filter } from "lucide-react";
import { metersToYards } from "@/lib/units";

interface LedgerEntry {
  id: string;
  partyId: string;
  partyChallanNo?: string | null;
  inwardId?: string | null;
  movementType: string;
  referenceNumber: string;
  creditMeters: any;
  debitMeters: any;
  shrinkageMeters: any;
  runningBalance: any;
  timestamp: Date;
  notes: string | null;
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
  fabricType: string;
  colorShade: string;
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

  const partyEntries = entries.filter((e) => e.partyId === selectedPartyId);
  const currentParty = parties.find((p) => p.id === selectedPartyId);

  // Extract distinct party challan numbers for the selected party
  const partyChallanNumbers = Array.from(
    new Set(
      partyEntries
        .map((e) => e.partyChallanNo)
        .filter((c): c is string => Boolean(c && c.trim()))
    )
  );

  // Filter entries if a specific challan is chosen
  const filteredEntries =
    selectedChallan === "ALL"
      ? partyEntries
      : partyEntries.filter((e) => e.partyChallanNo === selectedChallan);

  // 1. Total Deposited: ONLY count true client deposits (PARTY_INWARD)
  const totalPartyDeposited = filteredEntries
    .filter((e) => e.movementType === "PARTY_INWARD")
    .reduce((acc, curr) => acc + Number(curr.creditMeters || 0), 0);

  // 2. Delivered to Party: ONLY count customer dispatches (DELIVERY_TO_PARTY)
  const totalPartyDelivered = filteredEntries
    .filter((e) => e.movementType === "DELIVERY_TO_PARTY")
    .reduce((acc, curr) => acc + Number(curr.debitMeters || 0), 0);

  // 3. Total Shrinkage & Shortage: All dock shortages + technical process loss
  const totalShrinkage = filteredEntries.reduce(
    (acc, curr) => acc + Number(curr.shrinkageMeters || 0),
    0
  );

  // 4. In Factory Custody:
  // If "ALL", use latest running stock balance from party ledger
  // If single challan, compute net custody balance: (Credit - Debit - Shrinkage)
  const currentBalance =
    selectedChallan === "ALL"
      ? filteredEntries.length > 0
        ? Number(filteredEntries[0].runningBalance)
        : 0
      : Math.max(
          0,
          Number(
            (
              filteredEntries.reduce((acc, curr) => acc + Number(curr.creditMeters || 0), 0) -
              filteredEntries.reduce((acc, curr) => acc + Number(curr.debitMeters || 0), 0) -
              filteredEntries.reduce((acc, curr) => acc + Number(curr.shrinkageMeters || 0), 0)
            ).toFixed(2)
          )
        );

  // Calculate chronological lot running balance when filtered by single challan
  // partyEntries are sorted in descending order ([0] is latest)
  // For lot-specific running calculation, we reverse to calculate ascending, then map back
  const lotEntriesWithBalance = [...filteredEntries].reverse();
  let lotRunning = 0;
  const runningByEntryId: Record<string, number> = {};

  for (const item of lotEntriesWithBalance) {
    const c = Number(item.creditMeters || 0);
    const d = Number(item.debitMeters || 0);
    const s = Number(item.shrinkageMeters || 0);
    lotRunning = Number((lotRunning + c - d - s).toFixed(2));
    runningByEntryId[item.id] = lotRunning;
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-950">Party Custody Running Ledger</h2>
            <p className="text-xs text-zinc-500">
              Continuous stock statement & single-challan lifecycle tracking
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
              onChange={(e) => setSelectedChallan(e.target.value)}
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

      {/* Summary KPI Cards for the Selected Party & Challan */}
      {currentParty && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Deposited */}
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="text-zinc-500 text-xs font-medium flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>Total Deposited {selectedChallan !== "ALL" ? `(#${selectedChallan})` : ""}</span>
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-zinc-950">
              +{totalPartyDeposited.toFixed(2)}m
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              ≈ {metersToYards(totalPartyDeposited).toFixed(1)} yds
            </span>
          </div>

          {/* Card 2: Delivered to Party */}
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="text-zinc-500 text-xs font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
              <span>Delivered to Party</span>
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-zinc-950">
              -{totalPartyDelivered.toFixed(2)}m
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              ≈ {metersToYards(totalPartyDelivered).toFixed(1)} yds
            </span>
          </div>

          {/* Card 3: Technical Shrinkage + Dock Shortage */}
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="text-zinc-500 text-xs font-medium flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              <span>Shrinkage / Shortage</span>
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-rose-800">
              -{totalShrinkage.toFixed(2)}m
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              ≈ {metersToYards(totalShrinkage).toFixed(1)} yds
            </span>
          </div>

          {/* Card 4: Current In-Factory Stock Balance */}
          <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
            <div className="text-emerald-900 text-xs font-medium">
              {selectedChallan !== "ALL" ? `In Custody (#${selectedChallan})` : "In Factory Custody"}
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-emerald-950">
              {currentBalance.toFixed(2)}m
            </div>
            <span className="text-[10px] text-emerald-700 font-mono font-medium">
              ≈ {metersToYards(currentBalance).toFixed(1)} yds
            </span>
          </div>
        </div>
      )}
      {/* MOBILE VIEW (< 768px): Chronological Cards with Dual Units & Challan Ref Badge */}
      <div className="block md:hidden space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 font-mono">
            No ledger transactions found for this party / challan.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const displayBalance =
              selectedChallan === "ALL"
                ? Number(entry.runningBalance)
                : runningByEntryId[entry.id] ?? Number(entry.runningBalance);

            return (
              <div key={entry.id} className="p-3.5 rounded-lg border border-zinc-200 bg-white space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-900">{entry.referenceNumber}</span>
                    {entry.partyChallanNo && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                        #{entry.partyChallanNo}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(entry.timestamp).toLocaleDateString("en-GB")}
                  </span>
                </div>

                <div className="text-xs text-zinc-600 font-medium">{entry.notes || entry.movementType}</div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Change</span>
                    {Number(entry.creditMeters) > 0 && (
                      <div>
                        <span className="text-emerald-700 font-bold">
                          +{Number(entry.creditMeters).toFixed(2)}m
                        </span>
                        <span className="text-[10px] text-zinc-400 block">
                          ≈ {metersToYards(Number(entry.creditMeters)).toFixed(1)} yds
                        </span>
                      </div>
                    )}
                    {Number(entry.debitMeters) > 0 && (
                      <div>
                        <span className="text-blue-700 font-bold">
                          -{Number(entry.debitMeters).toFixed(2)}m
                        </span>
                        <span className="text-[10px] text-zinc-400 block">
                          ≈ {metersToYards(Number(entry.debitMeters)).toFixed(1)} yds
                        </span>
                      </div>
                    )}
                    {Number(entry.shrinkageMeters) > 0 && (
                      <div>
                        <span className="text-rose-700 font-bold">
                          -{Number(entry.shrinkageMeters).toFixed(2)}m
                        </span>
                        <span className="text-[10px] text-zinc-400 block">
                          ≈ {metersToYards(Number(entry.shrinkageMeters)).toFixed(1)} yds
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block uppercase">
                      {selectedChallan !== "ALL" ? "Lot Balance" : "Running Stock"}
                    </span>
                    <span className="font-bold text-zinc-950">
                      {displayBalance.toFixed(2)}m
                    </span>
                    <span className="text-[10px] text-zinc-500 block font-medium">
                      ≈ {metersToYards(displayBalance).toFixed(1)} yds
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP VIEW (>= 768px): Tabular Ledger with Dual Units & Challan Ref Badges */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono bg-zinc-50/50">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Reference #</th>
              <th className="py-2.5 px-3">Party Challan #</th>
              <th className="py-2.5 px-3">Transaction Details</th>
              <th className="py-2.5 px-3 text-right">Inward (+)</th>
              <th className="py-2.5 px-3 text-right">Outward / Delivery (-)</th>
              <th className="py-2.5 px-3 text-right">Shrinkage / Shortage (-)</th>
              <th className="py-2.5 px-3 text-right">
                {selectedChallan !== "ALL" ? "Lot Balance" : "Running Stock"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-mono">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-400">
                  No ledger transactions recorded yet for this selection.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const displayBalance =
                  selectedChallan === "ALL"
                    ? Number(entry.runningBalance)
                    : runningByEntryId[entry.id] ?? Number(entry.runningBalance);

                return (
                  <tr key={entry.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-zinc-900 whitespace-nowrap">
                      {entry.referenceNumber}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {entry.partyChallanNo ? (
                        <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 font-semibold text-[11px]">
                          #{entry.partyChallanNo}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-zinc-700 max-w-xs">{entry.notes}</td>

                    {/* INWARD (+) */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {Number(entry.creditMeters) > 0 ? (
                        <div>
                          <span className="text-emerald-700 font-semibold">
                            +{Number(entry.creditMeters).toFixed(2)}m
                          </span>
                          <span className="block text-[10px] text-zinc-400">
                            ≈ {metersToYards(Number(entry.creditMeters)).toFixed(1)} yds
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>

                    {/* OUTWARD / DELIVERY (-) */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {Number(entry.debitMeters) > 0 ? (
                        <div>
                          <span className="text-blue-700 font-semibold">
                            -{Number(entry.debitMeters).toFixed(2)}m
                          </span>
                          <span className="block text-[10px] text-zinc-400">
                            ≈ {metersToYards(Number(entry.debitMeters)).toFixed(1)} yds
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>

                    {/* SHRINKAGE / SHORTAGE (-) */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {Number(entry.shrinkageMeters) > 0 ? (
                        <div>
                          <span className="text-rose-700 font-semibold">
                            -{Number(entry.shrinkageMeters).toFixed(2)}m
                          </span>
                          <span className="block text-[10px] text-zinc-400">
                            ≈ {metersToYards(Number(entry.shrinkageMeters)).toFixed(1)} yds
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>

                    {/* RUNNING STOCK / LOT BALANCE */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div>
                        <span className="text-zinc-950 font-bold">
                          {displayBalance.toFixed(2)}m
                        </span>
                        <span className="block text-[10px] text-zinc-500 font-medium">
                          ≈ {metersToYards(displayBalance).toFixed(1)} yds
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
  );
}