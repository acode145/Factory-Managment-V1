"use client";

import { useState } from "react";
import { InwardReceiptItem } from "./EditInwardModal";
import { metersToYards, formatDualUnits } from "@/lib/units";
import {
  Search,
  Filter,
  FileEdit,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Package,
} from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

interface InwardReceiptsDirectoryProps {
  inwards: InwardReceiptItem[];
  parties: PartyOption[];
  onEdit: (item: InwardReceiptItem) => void;
  onBackToNew?: () => void;
}

export default function InwardReceiptsDirectory({
  inwards,
  parties,
  onEdit,
  onBackToNew,
}: InwardReceiptsDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [discrepancyFilter, setDiscrepancyFilter] = useState<"ALL" | "SHORTAGE" | "EXACT" | "EXCESS">("ALL");

  // Filtering logic
  const filtered = inwards.filter((item) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchIgp = item.igpNumber?.toLowerCase().includes(q);
      const matchChallan = item.partyChallanNo?.toLowerCase().includes(q);
      const matchParty = item.party?.name?.toLowerCase().includes(q);
      const matchFabric = item.fabricType?.toLowerCase().includes(q);
      const matchShade = item.colorShade?.toLowerCase().includes(q);
      if (!matchIgp && !matchChallan && !matchParty && !matchFabric && !matchShade) {
        return false;
      }
    }

    // Party filter
    if (selectedPartyId && item.partyId !== selectedPartyId) {
      return false;
    }

    // Discrepancy filter
    if (discrepancyFilter === "SHORTAGE" && item.shortageMeters <= 0) return false;
    if (discrepancyFilter === "EXACT" && item.shortageMeters !== 0) return false;
    if (discrepancyFilter === "EXCESS" && item.shortageMeters >= 0) return false;

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header bar with Search & Filters */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {onBackToNew && (
              <button
                type="button"
                onClick={onBackToNew}
                className="h-9 px-2.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 flex items-center gap-1 text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>New Entry</span>
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-zinc-950">Inward Receipts Directory</h2>
              <p className="text-xs text-zinc-500">
                {filtered.length} of {inwards.length} total receipts recorded
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search IGP, Challan, Party, Fabric..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            />
          </div>

          {/* Party Dropdown */}
          <div>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            >
              <option value="">All Client Parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Discrepancy Status Filter */}
          <div>
            <select
              value={discrepancyFilter}
              onChange={(e) => setDiscrepancyFilter(e.target.value as any)}
              className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            >
              <option value="ALL">All Discrepancy Statuses</option>
              <option value="SHORTAGE">Shortages Flagged Only (-)</option>
              <option value="EXACT">Exact Matches (0.00m)</option>
              <option value="EXCESS">Excess Received (+)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Content: Desktop Table & Mobile Card Stack */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-500 font-mono">
          No inward receipts matched your search filters.
        </div>
      ) : (
        <>
          {/* Desktop Table View (hidden on small screens) */}
          <div className="hidden md:block bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">IGP # & Date</th>
                    <th className="py-3 px-4">Party & Challan</th>
                    <th className="py-3 px-4">Fabric Specs</th>
                    <th className="py-3 px-4 text-right">Claimed Quantity</th>
                    <th className="py-3 px-4 text-right">Physical Measured</th>
                    <th className="py-3 px-4 text-right">Discrepancy</th>
                    <th className="py-3 px-4">Audit / Recorded</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80">
                  {filtered.map((item) => {
                    const editsCount = Array.isArray(item.editHistory) ? item.editHistory.length : 0;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                        {/* IGP & Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-zinc-950">{item.igpNumber}</div>
                          <div className="text-zinc-400 text-[11px]">
                            {new Date(item.createdAt).toLocaleDateString("en-GB")}
                          </div>
                        </td>

                        {/* Party & Challan */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-zinc-900">{item.party.name}</div>
                          <div className="text-[11px] font-mono text-zinc-500">
                            Challan: <span className="text-zinc-800 font-semibold">{item.partyChallanNo}</span>
                          </div>
                        </td>

                        {/* Fabric Specs */}
                        <td className="py-3 px-4">
                          <div className="text-zinc-900 font-medium">{item.fabricType}</div>
                          <div className="text-zinc-500 text-[11px]">
                            {item.rollCount} rolls • {item.colorShade}
                          </div>
                        </td>

                        {/* Claimed Quantity (Meters + Yards) */}
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-zinc-900">{item.challanMeters.toFixed(2)}m</div>
                          <div className="text-[11px] text-zinc-500">
                            {metersToYards(item.challanMeters).toFixed(2)}yd
                          </div>
                        </td>

                        {/* Measured Quantity (Meters + Yards) */}
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="font-bold text-zinc-950">{item.measuredMeters.toFixed(2)}m</div>
                          <div className="text-[11px] text-zinc-500">
                            {metersToYards(item.measuredMeters).toFixed(2)}yd
                          </div>
                        </td>

                        {/* Discrepancy Badge */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                          {item.shortageMeters > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              -{item.shortageMeters.toFixed(2)}m
                              <span className="block text-[10px] font-normal text-rose-600">
                                -{metersToYards(item.shortageMeters).toFixed(2)}yd
                              </span>
                            </span>
                          ) : item.shortageMeters < 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              +{Math.abs(item.shortageMeters).toFixed(2)}m
                              <span className="block text-[10px] font-normal text-blue-600">
                                +{metersToYards(Math.abs(item.shortageMeters)).toFixed(2)}yd
                              </span>
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Exact (0m)
                            </span>
                          )}
                        </td>

                        {/* Audit / Recorded Info */}
                        <td className="py-3 px-4 text-[11px]">
                          <div className="text-zinc-700 font-medium">
                            {item.receivedBy?.fullName || "Staff"}
                          </div>
                          {editsCount > 0 ? (
                            <div className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200 mt-0.5">
                              <History className="w-3 h-3" />
                              <span>Edited {editsCount}x</span>
                            </div>
                          ) : (
                            <div className="text-zinc-400 text-[10px]">Original</div>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="h-8 px-3 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Stack View (displayed on <768px) */}
          <div className="md:hidden space-y-3">
            {filtered.map((item) => {
              const editsCount = Array.isArray(item.editHistory) ? item.editHistory.length : 0;
              return (
                <div
                  key={item.id}
                  className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-3"
                >
                  {/* Card Header: IGP & Date */}
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span className="font-mono font-bold text-zinc-950 text-sm">{item.igpNumber}</span>
                    </div>
                    <span className="text-zinc-400 text-xs font-mono">
                      {new Date(item.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>

                  {/* Party & Fabric */}
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-zinc-900">{item.party.name}</div>
                    <div className="text-xs text-zinc-600">
                      Challan #{item.partyChallanNo} • {item.rollCount} rolls of {item.fabricType} ({item.colorShade})
                    </div>
                  </div>

                  {/* Quantities & Shortage Matrix */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 text-xs font-mono">
                    <div>
                      <span className="text-[10px] uppercase text-zinc-400 block font-sans">Party Claimed</span>
                      <span className="font-semibold text-zinc-800">{item.challanMeters.toFixed(2)}m</span>
                      <span className="text-[10px] text-zinc-500 block">
                        ≈ {metersToYards(item.challanMeters).toFixed(2)}yd
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-zinc-400 block font-sans">Actual Measured</span>
                      <span className="font-bold text-zinc-950">{item.measuredMeters.toFixed(2)}m</span>
                      <span className="text-[10px] text-zinc-500 block">
                        ≈ {metersToYards(item.measuredMeters).toFixed(2)}yd
                      </span>
                    </div>
                  </div>

                  {/* Shortage Status & Audit */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {item.shortageMeters > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold font-mono bg-rose-50 text-rose-800 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>-{item.shortageMeters.toFixed(2)}m (-{metersToYards(item.shortageMeters).toFixed(2)}yd)</span>
                        </span>
                      ) : item.shortageMeters < 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200">
                          <span>+{Math.abs(item.shortageMeters).toFixed(2)}m</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Exact match</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-500">
                      {editsCount > 0 ? (
                        <span className="text-amber-800 font-medium">Edited {editsCount}x</span>
                      ) : (
                        <span>By {item.receivedBy?.fullName || "Staff"}</span>
                      )}
                    </div>
                  </div>

                  {/* Edit Action Button */}
                  <div className="pt-2 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="w-full h-10 rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-100 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>Edit Inward Receipt</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
