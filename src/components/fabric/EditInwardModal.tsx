"use client";

import { useActionState, useEffect, useState } from "react";
import { updateFabricInwardAction, FabricActionState } from "@/actions/fabric";
import { metersToYards, yardsToMeters, computeDiscrepancy } from "@/lib/units";
import {
  X,
  FileEdit,
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  Save,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  ArrowDownLeft,
  Building2,
} from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";

export interface InwardReceiptItem {
  id: string;
  igpNumber: string;
  partyId: string;
  partyChallanNo: string;
  fabricType: string;
  colorShade: string;
  rollCount: number;
  challanMeters: number;
  measuredMeters: number;
  shortageMeters: number;
  driverDetails?: string | null;
  remarks?: string | null;
  challanDate?: string | Date;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  receivedBy?: { fullName: string } | null;
  party: { name: string; code: string };
  editHistory?: Array<{
    updatedById: string;
    updatedByName: string;
    updatedAt: string;
    changes: string;
  }> | null;
  items?: Array<{
    id: string;
    itemIndex: number;
    fabricType: string;
    colorShade: string;
    unit: string;
    rollCount: number;
    challanQty: number;
    measuredQty: number;
    shortageQty: number;
    standardMeters?: number | null;
  }>;
}

interface InwardRowState {
  id: string;
  fabricType: string;
  colorShade: string;
  unit: "METERS" | "YARDS" | "PIECES";
  rollCount: string;
  challanQty: string;
  measuredQty: string;
}

interface EditInwardModalProps {
  inward: InwardReceiptItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditInwardModal({ inward, onClose, onSuccess }: EditInwardModalProps) {
  const [state, formAction, isPending] = useActionState<FabricActionState, FormData>(
    updateFabricInwardAction,
    {}
  );

  const [challanDate, setChallanDate] = useState("");
  const [partyChallanNo, setPartyChallanNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const [rows, setRows] = useState<InwardRowState[]>([
    {
      id: "row-1",
      fabricType: "",
      colorShade: "",
      unit: "METERS",
      rollCount: "1",
      challanQty: "",
      measuredQty: "",
    },
  ]);

  useEffect(() => {
    if (inward) {
      const rawDate = inward.challanDate ? new Date(inward.challanDate) : new Date(inward.createdAt);
      setChallanDate(rawDate.toISOString().split("T")[0]);
      setPartyChallanNo(inward.partyChallanNo || "");

      const mergedRemarks = [inward.driverDetails, inward.remarks]
        .filter(Boolean)
        .join(" • ");
      setRemarks(mergedRemarks);

      if (inward.items && inward.items.length > 0) {
        setRows(
          inward.items.map((it) => ({
            id: it.id || "row-" + Math.random().toString(16).slice(2, 8),
            fabricType: it.fabricType || "",
            colorShade: it.colorShade || "",
            unit: (it.unit as "METERS" | "YARDS" | "PIECES") || "METERS",
            rollCount: it.rollCount ? String(it.rollCount) : "1",
            challanQty: it.challanQty ? String(it.challanQty) : "",
            measuredQty: it.measuredQty ? String(it.measuredQty) : "",
          }))
        );
      } else {
        setRows([
          {
            id: "row-" + Date.now(),
            fabricType: inward.fabricType || "",
            colorShade: inward.colorShade || "",
            unit: "METERS",
            rollCount: inward.rollCount ? String(inward.rollCount) : "1",
            challanQty: inward.challanMeters ? String(inward.challanMeters) : "",
            measuredQty: inward.measuredMeters ? String(inward.measuredMeters) : "",
          },
        ]);
      }
    }
  }, [inward]);

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state?.success, onClose, onSuccess]);

  if (!inward) return null;

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: "row-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6),
        fabricType: "",
        colorShade: "",
        unit: "METERS",
        rollCount: "1",
        challanQty: "",
        measuredQty: "",
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof InwardRowState, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Compute live multi-row summary aggregates
  let totalRolls = 0;
  let totalContClaimedM = 0;
  let totalContMeasuredM = 0;
  let totalPiecesClaimed = 0;
  let totalPiecesMeasured = 0;

  for (const r of rows) {
    const rRolls = parseInt(r.rollCount) || 0;
    totalRolls += rRolls;

    const cQty = parseFloat(r.challanQty) || 0;
    const mQty = parseFloat(r.measuredQty) || 0;

    if (r.unit === "PIECES") {
      totalPiecesClaimed += Math.round(cQty);
      totalPiecesMeasured += Math.round(mQty);
    } else {
      const cMeters = r.unit === "YARDS" ? yardsToMeters(cQty) : cQty;
      const mMeters = r.unit === "YARDS" ? yardsToMeters(mQty) : mQty;
      totalContClaimedM += cMeters;
      totalContMeasuredM += mMeters;
    }
  }

  const contShortageM = Number(Math.max(0, totalContClaimedM - totalContMeasuredM).toFixed(2));
  const contSurplusM = Number(Math.max(0, totalContMeasuredM - totalContClaimedM).toFixed(2));
  const piecesShortage = Math.max(0, totalPiecesClaimed - totalPiecesMeasured);
  const piecesSurplus = Math.max(0, totalPiecesMeasured - totalPiecesClaimed);
  const historyList = Array.isArray(inward.editHistory) ? inward.editHistory : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-950 font-mono">{inward.igpNumber}</h3>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-200 text-zinc-800">
                  {inward.party.name} ({inward.party.code})
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Created on {new Date(inward.createdAt).toLocaleDateString("en-GB")}
                {inward.receivedBy?.fullName && ` by ${inward.receivedBy.fullName}`} • Modify multi-lot delivery details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {state?.message && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold">{state.message}</span>
            </div>
          )}

          {state?.error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2.5 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span className="font-semibold">{state.error}</span>
            </div>
          )}

          <form id="edit-inward-form" action={formAction} className="space-y-5">
            <input type="hidden" name="inwardId" value={inward.id} />
            <input type="hidden" name="itemsPayload" value={JSON.stringify(rows)} />

            {/* Header Card: Date first, then Party, then Challan #, then Merged Remarks */}
            <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* 1. Challan / Receiving Date */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Challan / Receiving Date
                  </label>
                  <DatePicker
                    name="challanDate"
                    required
                    value={challanDate}
                    onChange={(val) => setChallanDate(val)}
                  />
                </div>

                {/* 2. Client Party / Mill (Read-only badge display for existing gate pass) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Client Party / Mill
                  </label>
                  <div className="w-full h-11 px-3 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-800 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">{inward.party.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400">({inward.party.code})</span>
                  </div>
                </div>

                {/* 3. Party Challan / Bilty # */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Party Challan / Bilty #
                  </label>
                  <input
                    type="text"
                    name="partyChallanNo"
                    required
                    value={partyChallanNo}
                    onChange={(e) => setPartyChallanNo(e.target.value)}
                    placeholder="e.g. CH-8901"
                    className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Merged Single Field: REMARKS AND VEHICLE INFO */}
              <div className="pt-2 border-t border-zinc-200/60">
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  REMARKS AND VEHICLE INFO
                </label>
                <input
                  type="text"
                  name="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Driver name, vehicle number • Receiving condition, packaging notes"
                  className="w-full h-11 px-3.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            {/* Multi-Item Lot Builder Section */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                  Inward Items & Lots ({rows.length})
                </h4>
              </div>

              {/* Item Row Cards */}
              <div className="space-y-3">
                {rows.map((row, index) => {
                  const cQty = parseFloat(row.challanQty) || 0;
                  const mQty = parseFloat(row.measuredQty) || 0;
                  const disc = computeDiscrepancy(cQty, mQty, row.unit);

                  // Real-time secondary companion conversion
                  let claimedCompanion: string | null = null;
                  let measuredCompanion: string | null = null;

                  if (row.unit === "YARDS") {
                    if (cQty > 0) claimedCompanion = `≈ ${yardsToMeters(cQty).toFixed(2)} m`;
                    if (mQty > 0) measuredCompanion = `≈ ${yardsToMeters(mQty).toFixed(2)} m`;
                  } else if (row.unit === "METERS") {
                    if (cQty > 0) claimedCompanion = `≈ ${metersToYards(cQty).toFixed(2)} yd`;
                    if (mQty > 0) measuredCompanion = `≈ ${metersToYards(mQty).toFixed(2)} yd`;
                  }

                  return (
                    <div
                      key={row.id}
                      className="p-3.5 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 transition-all space-y-3 shadow-2xs"
                    >
                      {/* Row Header with Item Index and Delete */}
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-bold flex items-center justify-center font-mono">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-zinc-800">
                            {row.fabricType || `Item #${index + 1}`}
                            {row.colorShade ? ` • ${row.colorShade}` : ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Shortage / Surplus Indicator Pill */}
                          {cQty > 0 && mQty > 0 && (
                            <div
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
                                disc.isShortage
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : disc.isSurplus
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              <span>
                                {disc.isShortage
                                  ? `Shortage: ${disc.formattedPrimary} (${disc.percent}%)`
                                  : disc.isSurplus
                                  ? `Surplus: ${disc.formattedPrimary}`
                                  : "Exact Match (0 shortage)"}
                              </span>
                            </div>
                          )}

                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="w-7 h-7 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove item row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Row Input Fields Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        {/* 1. Fabric Construction */}
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                            Fabric Construction
                          </label>
                          <input
                            type="text"
                            required
                            value={row.fabricType}
                            onChange={(e) => updateRow(row.id, "fabricType", e.target.value)}
                            placeholder="e.g. Lawn 68/68, Cambric"
                            className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                          />
                        </div>

                        {/* 2. Color / Shade */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                            Color / Shade
                          </label>
                          <input
                            type="text"
                            required
                            value={row.colorShade}
                            onChange={(e) => updateRow(row.id, "colorShade", e.target.value)}
                            placeholder="e.g. Greige, White"
                            className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                          />
                        </div>

                        {/* 3. Pack */}
                        <div className="sm:col-span-1">
                          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                            Pack
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={row.rollCount}
                            onChange={(e) => updateRow(row.id, "rollCount", e.target.value)}
                            placeholder="1"
                            className="w-full h-10 px-2 bg-white border border-zinc-300 rounded-lg text-xs font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                          />
                        </div>

                        {/* 4. Claimed */}
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                              Claimed
                            </label>
                            {claimedCompanion && (
                              <span className="text-[9px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1 rounded">
                                {claimedCompanion}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            value={row.challanQty}
                            onChange={(e) => updateRow(row.id, "challanQty", e.target.value)}
                            placeholder={row.unit === "PIECES" ? "e.g. 200" : "e.g. 1000"}
                            className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-semibold tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                          />
                        </div>

                        {/* 5. Unit Dropdown */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                            Unit
                          </label>
                          <select
                            value={row.unit}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "unit",
                                e.target.value as "METERS" | "YARDS" | "PIECES"
                              )
                            }
                            className="w-full h-10 px-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 cursor-pointer font-mono"
                          >
                            <option value="METERS">M</option>
                            <option value="YARDS">Yd</option>
                            <option value="PIECES">Pcs</option>
                          </select>
                        </div>

                        {/* 6. Measured */}
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                              Measured
                            </label>
                            {measuredCompanion && (
                              <span className="text-[9px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1 rounded">
                                {measuredCompanion}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            value={row.measuredQty}
                            onChange={(e) => updateRow(row.id, "measuredQty", e.target.value)}
                            placeholder={row.unit === "PIECES" ? "e.g. 200" : "e.g. 1000"}
                            className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add Row Button: full width below the last row */}
                <button
                  type="button"
                  onClick={addRow}
                  className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.99]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Item Row</span>
                </button>
              </div>
            </div>

            {/* Live Challan Pre-Save Summary Banner */}
            <div className="p-4 rounded-xl bg-zinc-900 text-white space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-2">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Updated Challan Aggregate Verification</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {rows.length} item lot{rows.length > 1 ? "s" : ""} • {totalRolls} total pack
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Continuous Fabric Total */}
                <div className="p-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 space-y-1">
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Continuous Fabric (Rolls / Thans)
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-zinc-300 text-[11px]">Measured:</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {totalContMeasuredM.toFixed(2)} m
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between font-mono text-[10px] text-zinc-400">
                    <span>In Yards:</span>
                    <span>≈ {metersToYards(totalContMeasuredM).toFixed(1)} yd</span>
                  </div>
                  {contShortageM > 0 && (
                    <div className="flex items-baseline justify-between font-mono text-[10px] text-rose-400 pt-1 border-t border-zinc-700/60">
                      <span>Shortage Loss:</span>
                      <span>-{contShortageM.toFixed(2)} m (≈ -{metersToYards(contShortageM).toFixed(1)} yd)</span>
                    </div>
                  )}
                  {contSurplusM > 0 && (
                    <div className="flex items-baseline justify-between font-mono text-[10px] text-blue-400 pt-1 border-t border-zinc-700/60">
                      <span>Surplus Gain:</span>
                      <span>+{contSurplusM.toFixed(2)} m (≈ +{metersToYards(contSurplusM).toFixed(1)} yd)</span>
                    </div>
                  )}
                </div>

                {/* Cut Pieces Total */}
                <div className="p-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 space-y-1">
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Cut Pieces / Components
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-zinc-300 text-[11px]">Measured Count:</span>
                    <span className="text-sm font-bold text-blue-400">
                      {totalPiecesMeasured.toLocaleString()} pcs
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between font-mono text-[10px] text-zinc-400">
                    <span>Claimed:</span>
                    <span>{totalPiecesClaimed.toLocaleString()} pcs</span>
                  </div>
                  {piecesShortage > 0 && (
                    <div className="flex items-baseline justify-between font-mono text-[10px] text-rose-400 pt-1 border-t border-zinc-700/60">
                      <span>Shortage Loss:</span>
                      <span>-{piecesShortage.toLocaleString()} pcs</span>
                    </div>
                  )}
                  {piecesSurplus > 0 && (
                    <div className="flex items-baseline justify-between font-mono text-[10px] text-blue-400 pt-1 border-t border-zinc-700/60">
                      <span>Surplus Gain:</span>
                      <span>+{piecesSurplus.toLocaleString()} pcs</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          {/* Audit History Timeline */}
          {historyList.length > 0 && (
            <div className="pt-3 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full text-xs font-semibold text-zinc-700 hover:text-zinc-950 py-1 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Audit History ({historyList.length} previous {historyList.length === 1 ? "edit" : "edits"})</span>
                </span>
                <span className="text-[11px] text-zinc-400">{showHistory ? "Hide details" : "View timeline"}</span>
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-44 overflow-y-auto pr-1">
                  {historyList.map((entry, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-200/80 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between text-zinc-600 font-medium">
                        <span>{entry.updatedByName}</span>
                        <span className="font-mono text-zinc-400 text-[10px]">
                          {new Date(entry.updatedAt).toLocaleString("en-GB")}
                        </span>
                      </div>
                      <div className="text-zinc-800 font-mono text-[10px] bg-white p-1.5 rounded border border-zinc-200">
                        {entry.changes}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-3 bg-zinc-50/70">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 h-11 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-inward-form"
            disabled={isPending}
            className="px-5 h-11 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving & Reconciling Ledger...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes ({rows.length} {rows.length === 1 ? "Lot" : "Lots"})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
