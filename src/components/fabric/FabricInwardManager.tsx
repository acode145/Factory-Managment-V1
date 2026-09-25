"use client";

import { useState } from "react";
import FabricInwardForm from "./FabricInwardForm";
import InwardReceiptsDirectory from "./InwardReceiptsDirectory";
import EditInwardModal, { InwardReceiptItem } from "./EditInwardModal";
import { metersToYards } from "@/lib/units";
import { formatPakistanDate } from "@/lib/dateUtils";
import {
  Clock,
  PlusCircle,
  ListFilter,
  FileEdit,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  History,
  Package,
} from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

interface FabricInwardManagerProps {
  parties: PartyOption[];
  inwardList: InwardReceiptItem[];
}

export default function FabricInwardManager({ parties, inwardList }: FabricInwardManagerProps) {
  const [view, setView] = useState<"form" | "directory">("form");
  const [editingInward, setEditingInward] = useState<InwardReceiptItem | null>(null);

  // Recent card strictly displays top 3 latest receipts
  const recentThree = inwardList.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Sub-navigation bar: Switch between New Entry and All Directory */}
      <div className="flex items-center justify-between pb-1">
        <div className="inline-flex p-1 bg-zinc-200/70 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setView("form")}
            className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              view === "form"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Inward Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setView("directory")}
            className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              view === "directory"
                ? "bg-white text-zinc-950 shadow-xs"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Inward Receipts History ({inwardList.length})</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {view === "form" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Inward Entry Form */}
          <div className="lg:col-span-2">
            <FabricInwardForm parties={parties} existingInwards={inwardList} />
          </div>

          {/* Right 1 Col: Recent Receipts Card (Max 3 items with full information) */}
          <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 shadow-xs h-fit space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span>Recent Inward Receipts</span>
              </h3>
              <span className="text-[11px] font-mono text-zinc-400">Latest 3</span>
            </div>

            {recentThree.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 font-mono">
                No inward receipts recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {recentThree.map((item) => {
                  const editsCount = Array.isArray(item.editHistory) ? item.editHistory.length : 0;
                  const lastEdit = editsCount > 0 ? item.editHistory![editsCount - 1] : null;

                  return (
                    <div key={item.id} className="py-3.5 space-y-2 first:pt-1 last:pb-1 text-xs">
                      {/* Top Row: IGP & Date */}
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-zinc-950 text-xs sm:text-sm">{item.igpNumber}</span>
                        <span className="text-zinc-400 text-[11px]">
                          {formatPakistanDate(item.challanDate || item.createdAt)}
                        </span>
                      </div>

                      {/* Party & Fabric info */}
                      <div className="space-y-0.5">
                        <div className="font-bold text-zinc-900">{item.party.name}</div>
                        <div className="text-[11px] text-zinc-600">
                          Challan #{item.partyChallanNo} • {item.rollCount} rolls of {item.fabricType} ({item.colorShade})
                        </div>
                      </div>

                      {/* Dual Measurement Figures (Claimed vs Measured) */}
                      <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-100 text-[11px] font-mono">
                        <div>
                          <span className="text-[9px] uppercase text-zinc-400 block font-sans">Claimed</span>
                          <span className="font-semibold text-zinc-800">{item.challanMeters.toFixed(2)}m</span>
                          <span className="text-[10px] text-zinc-500 block">
                            ≈ {metersToYards(item.challanMeters).toFixed(1)}yd
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] uppercase text-zinc-400 block font-sans">Measured</span>
                          <span className="font-bold text-zinc-950">{item.measuredMeters.toFixed(2)}m</span>
                          <span className="text-[10px] text-zinc-500 block">
                            ≈ {metersToYards(item.measuredMeters).toFixed(1)}yd
                          </span>
                        </div>
                      </div>

                      {/* Shortage Status & Audit Trail */}
                      <div className="flex items-center justify-between pt-0.5">
                        <div>
                          {item.shortageMeters > 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-50 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>Shortage: -{item.shortageMeters.toFixed(2)}m</span>
                            </span>
                          ) : item.shortageMeters < 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200">
                              <span>Excess: +{Math.abs(item.shortageMeters).toFixed(2)}m</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Exact (0m)</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-zinc-400 text-right">
                          {editsCount > 0 ? (
                            <span className="text-amber-800 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Edited {editsCount}x
                            </span>
                          ) : (
                            <span>By {item.receivedBy?.fullName || "Staff"}</span>
                          )}
                        </div>
                      </div>

                      {/* Edit Button */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingInward(item)}
                          className="w-full h-8 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <FileEdit className="w-3.5 h-3.5 text-zinc-500" />
                          <span>Edit Receipt</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* View All Inward Receipts Footer Button */}
            <div className="pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setView("directory")}
                className="w-full h-9 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>View All Inward Receipts ({inwardList.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Directory View: Full searchable and filterable list */
        <InwardReceiptsDirectory
          inwards={inwardList}
          parties={parties}
          onEdit={setEditingInward}
          onBackToNew={() => setView("form")}
        />
      )}

      {/* Edit Inward Modal Dialog */}
      <EditInwardModal
        inward={editingInward}
        onClose={() => setEditingInward(null)}
      />
    </div>
  );
}
