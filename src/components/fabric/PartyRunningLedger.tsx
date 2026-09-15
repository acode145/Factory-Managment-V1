"use client";

import { useState } from "react";
import { BookOpen, Printer, ArrowDownLeft, ArrowUpRight, TrendingDown } from "lucide-react";

interface LedgerEntry {
  id: string;
  partyId: string;
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

export default function PartyRunningLedger({
  parties,
  entries,
}: {
  parties: PartySummary[];
  entries: LedgerEntry[];
}) {
  const [selectedPartyId, setSelectedPartyId] = useState<string>(parties[0]?.id || "");

  const filteredEntries = entries.filter((e) => e.partyId === selectedPartyId);
  const currentParty = parties.find((p) => p.id === selectedPartyId);

  const totalCredit = filteredEntries.reduce((acc, curr) => acc + Number(curr.creditMeters || 0), 0);
  const totalDebit = filteredEntries.reduce((acc, curr) => acc + Number(curr.debitMeters || 0), 0);
  const totalShrinkage = filteredEntries.reduce(
    (acc, curr) => acc + Number(curr.shrinkageMeters || 0),
    0
  );
  const currentBalance =
    filteredEntries.length > 0 ? Number(filteredEntries[0].runningBalance) : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-950">Party Custody Running Ledger</h2>
            <p className="text-xs text-zinc-500">
              Continuous stock statement & reconciliation account
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedPartyId}
            onChange={(e) => setSelectedPartyId(e.target.value)}
            className="h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
          >
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>

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

      {/* Summary KPI Cards for the Selected Party */}
      {currentParty && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="text-zinc-500 text-xs font-medium flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>Total Deposited</span>
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-zinc-950">
              +{totalCredit.toFixed(2)}m
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="text-zinc-500 text-xs font-medium flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
              <span>Total Delivered</span>
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-zinc-950">
              -{totalDebit.toFixed(2)}m
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
            <div className="text-zinc-500 text-xs font-medium flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              <span>Process Shrinkage</span>
            </div>
            <div className="mt-1 text-lg font-bold font-mono text-rose-800">
              -{totalShrinkage.toFixed(2)}m
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
            <div className="text-emerald-900 text-xs font-medium">In Factory Custody</div>
            <div className="mt-1 text-xl font-bold font-mono text-emerald-950">
              {currentBalance.toFixed(2)}m
            </div>
          </div>
        </div>
      )}

      {/* MOBILE VIEW (< 768px): Chronological Cards */}
      <div className="block md:hidden space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 font-mono">
            No ledger transactions found for this party.
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="p-3.5 rounded-lg border border-zinc-200 bg-white space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-zinc-900">{entry.referenceNumber}</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(entry.timestamp).toLocaleDateString("en-GB")}
                </span>
              </div>

              <div className="text-xs text-zinc-600 font-medium">{entry.notes || entry.movementType}</div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-zinc-400 block uppercase">Change</span>
                  {Number(entry.creditMeters) > 0 && (
                    <span className="text-emerald-700 font-bold">
                      +{Number(entry.creditMeters).toFixed(2)}m
                    </span>
                  )}
                  {Number(entry.debitMeters) > 0 && (
                    <span className="text-blue-700 font-bold">
                      -{Number(entry.debitMeters).toFixed(2)}m
                    </span>
                  )}
                  {Number(entry.shrinkageMeters) > 0 && (
                    <span className="text-rose-700 font-bold">
                      -{Number(entry.shrinkageMeters).toFixed(2)}m
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block uppercase">Balance</span>
                  <span className="font-bold text-zinc-950">
                    {Number(entry.runningBalance).toFixed(2)}m
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP VIEW (>= 768px): Tabular Ledger */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono bg-zinc-50/50">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Reference #</th>
              <th className="py-2.5 px-3">Transaction Details</th>
              <th className="py-2.5 px-3 text-right">Inward (+)</th>
              <th className="py-2.5 px-3 text-right">Delivery (-)</th>
              <th className="py-2.5 px-3 text-right">Shrinkage (-)</th>
              <th className="py-2.5 px-3 text-right">Running Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-mono">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-400">
                  No ledger transactions recorded yet.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="py-2.5 px-3 text-zinc-500 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleDateString("en-GB")}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-zinc-900 whitespace-nowrap">
                    {entry.referenceNumber}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-zinc-700">{entry.notes}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold whitespace-nowrap">
                    {Number(entry.creditMeters) > 0
                      ? `+${Number(entry.creditMeters).toFixed(2)}m`
                      : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-700 font-semibold whitespace-nowrap">
                    {Number(entry.debitMeters) > 0
                      ? `-${Number(entry.debitMeters).toFixed(2)}m`
                      : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-700 font-semibold whitespace-nowrap">
                    {Number(entry.shrinkageMeters) > 0
                      ? `-${Number(entry.shrinkageMeters).toFixed(2)}m`
                      : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-zinc-950 whitespace-nowrap">
                    {Number(entry.runningBalance).toFixed(2)}m
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
