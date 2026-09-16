"use client";

import { useActionState, useState } from "react";
import { createPartyInwardAction, FabricActionState } from "@/actions/fabric";
import {
  PackagePlus,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowDownLeft,
  Layers,
  Sparkles,
} from "lucide-react";
import { metersToYards, yardsToMeters, computeDiscrepancy } from "@/lib/units";
import DatePicker from "@/components/ui/DatePicker";

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

export interface InwardRowState {
  id: string;
  fabricType: string;
  colorShade: string;
  unit: "METERS" | "YARDS" | "PIECES";
  rollCount: string;
  challanQty: string;
  measuredQty: string;
}

export default function FabricInwardForm({ parties }: { parties: PartyOption[] }) {
  const [state, formAction, isPending] = useActionState<FabricActionState, FormData>(
    createPartyInwardAction,
    {}
  );

  const [rows, setRows] = useState<InwardRowState[]>([
    {
      id: "row-" + Date.now(),
      fabricType: "",
      colorShade: "",
      unit: "METERS",
      rollCount: "1",
      challanQty: "",
      measuredQty: "",
    },
  ]);

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
  const piecesShortage = Math.max(0, totalPiecesClaimed - totalPiecesMeasured);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3.5 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center shadow-xs">
          <PackagePlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-zinc-950">Party Fabric Inward Receipt</h2>
          <p className="text-xs text-zinc-500">
            Multi-item delivery receipt with live unit conversion (m ↔ yd) & pieces tracking
          </p>
        </div>
      </div>

      {state?.message && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-semibold">{state.message}</span>
        </div>
      )}

      {state?.error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span className="font-semibold">{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* Top Header Card: Party, Date, Challan # & Transport */}
        <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Party Selector */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Client Party / Mill
              </label>
              <select
                name="partyId"
                required
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">-- Select Party / Brand --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Challan Date */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Challan / Receiving Date
              </label>
              <DatePicker
                name="challanDate"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </div>

            {/* Party Challan # */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Party Challan / Bilty #
              </label>
              <input
                type="text"
                name="partyChallanNo"
                required
                placeholder="e.g. CH-8901"
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-zinc-200/60">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Vehicle & Driver Details
              </label>
              <input
                type="text"
                name="driverDetails"
                placeholder="e.g. Aslam - Suzuki Ravi (LEA-1920)"
                className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                General Receiving Remarks
              </label>
              <input
                type="text"
                name="remarks"
                placeholder="e.g. Received in sound condition, sealed bundles"
                className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>
        </div>
        {/* Multi-Item Lot Builder Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-zinc-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                Inward Items & Lots ({rows.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="h-8 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item Row</span>
            </button>
          </div>

          {/* Table / Row cards */}
          <div className="space-y-3">
            {rows.map((row, index) => {
              const cQty = parseFloat(row.challanQty) || 0;
              const mQty = parseFloat(row.measuredQty) || 0;
              const disc = computeDiscrepancy(cQty, mQty, row.unit);

              // Real-time secondary conversion
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
                      {/* Shortage indicator pill */}
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
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    {/* Fabric Type */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Fabric Construction
                      </label>
                      <input
                        type="text"
                        required
                        value={row.fabricType}
                        onChange={(e) => updateRow(row.id, "fabricType", e.target.value)}
                        placeholder="e.g. Lawn 68/68, Cambric, Sleeves"
                        className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>

                    {/* Color / Shade */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Color / Shade
                      </label>
                      <input
                        type="text"
                        required
                        value={row.colorShade}
                        onChange={(e) => updateRow(row.id, "colorShade", e.target.value)}
                        placeholder="e.g. Greige, White, Brown"
                        className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>

                    {/* UOM Selector */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Unit of Measure
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
                        className="w-full h-10 px-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                      >
                        <option value="METERS">Meters (m)</option>
                        <option value="YARDS">Yards (yd)</option>
                        <option value="PIECES">Pieces (pcs)</option>
                      </select>
                    </div>

                    {/* Rolls / Bundles */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Rolls / Pkgs
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={row.rollCount}
                        onChange={(e) => updateRow(row.id, "rollCount", e.target.value)}
                        placeholder="1"
                        className="w-full h-10 px-2 bg-white border border-zinc-300 rounded-lg text-xs font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>

                    {/* Claimed Qty */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                          Claimed {row.unit === "PIECES" ? "Pcs" : row.unit === "YARDS" ? "Yds" : "Meters"}
                        </label>
                        {claimedCompanion && (
                          <span className="text-[9px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1 rounded">
                            {claimedCompanion}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        step={row.unit === "PIECES" ? "1" : "0.01"}
                        min="0.01"
                        required
                        value={row.challanQty}
                        onChange={(e) => updateRow(row.id, "challanQty", e.target.value)}
                        placeholder={row.unit === "PIECES" ? "e.g. 125" : "e.g. 10000.00"}
                        className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-semibold tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>

                    {/* Measured Qty */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                          Measured {row.unit === "PIECES" ? "Pcs" : row.unit === "YARDS" ? "Yds" : "Meters"}
                        </label>
                        {measuredCompanion && (
                          <span className="text-[9px] font-mono font-medium text-emerald-700 bg-emerald-50 px-1 rounded">
                            {measuredCompanion}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        step={row.unit === "PIECES" ? "1" : "0.01"}
                        min="0.01"
                        required
                        value={row.measuredQty}
                        onChange={(e) => updateRow(row.id, "measuredQty", e.target.value)}
                        placeholder={row.unit === "PIECES" ? "e.g. 124" : "e.g. 9900.00"}
                        className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-semibold tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Live Challan Pre-Save Summary Banner */}
        <div className="p-4 rounded-xl bg-zinc-900 text-white space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-2">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Challan Aggregate Verification</span>
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              {rows.length} item lot{rows.length > 1 ? "s" : ""} • {totalRolls} total rolls/pkgs
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
                  <span>Net Shortage:</span>
                  <span>-{contShortageM.toFixed(2)} m (≈ {metersToYards(contShortageM).toFixed(1)} yd)</span>
                </div>
              )}
            </div>

            {/* Cut Pieces Total */}
            <div className="p-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 space-y-1">
              <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                Cut Pieces / Garment Components
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-zinc-300 text-[11px]">Measured:</span>
                <span className="text-sm font-bold text-emerald-400">
                  {totalPiecesMeasured.toLocaleString()} pcs
                </span>
              </div>
              <div className="flex items-baseline justify-between font-mono text-[10px] text-zinc-400">
                <span>Claimed:</span>
                <span>{totalPiecesClaimed.toLocaleString()} pcs</span>
              </div>
              {piecesShortage > 0 && (
                <div className="flex items-baseline justify-between font-mono text-[10px] text-rose-400 pt-1 border-t border-zinc-700/60">
                  <span>Pieces Shortage:</span>
                  <span>-{piecesShortage.toLocaleString()} pcs</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden payload of rows */}
        <input type="hidden" name="itemsPayload" value={JSON.stringify(rows)} />

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Recording Inward & Posting to Ledger...</span>
              </span>
            ) : (
              <>
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span>Save & Generate Inward Gate Pass ({rows.length} Items)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
