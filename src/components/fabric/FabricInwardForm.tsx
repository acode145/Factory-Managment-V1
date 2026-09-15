"use client";

import { useActionState, useState } from "react";
import { createPartyInwardAction, FabricActionState } from "@/actions/fabric";
import { PackagePlus, AlertTriangle, CheckCircle2, ArrowDownLeft } from "lucide-react";
import { metersToYards } from "@/lib/units";

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

export default function FabricInwardForm({ parties }: { parties: PartyOption[] }) {
  const [state, formAction, isPending] = useActionState<FabricActionState, FormData>(
    createPartyInwardAction,
    {}
  );

  const [challanMeters, setChallanMeters] = useState<string>("");
  const [measuredMeters, setMeasuredMeters] = useState<string>("");

  const numChallan = parseFloat(challanMeters) || 0;
  const numMeasured = parseFloat(measuredMeters) || 0;
  const shortage = numChallan > 0 && numMeasured > 0 ? Number((numChallan - numMeasured).toFixed(2)) : 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs">
      <div className="flex items-center gap-2.5 pb-3.5 mb-5 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
          <PackagePlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-zinc-950">Party Fabric Inward Receipt</h2>
          <p className="text-xs text-zinc-500">Log incoming customer cloth & detect meterage shortage</p>
        </div>
      </div>

      {state?.message && (
        <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-semibold">{state.message}</span>
        </div>
      )}

      {state?.error && (
        <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span className="font-semibold">{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {/* Party Selector */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
            Client Party
          </label>
          <select
            name="partyId"
            required
            className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">-- Select Party / Brand --</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Row: Party Challan # & Roll Count */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Party Challan / Bilty #
            </label>
            <input
              type="text"
              name="partyChallanNo"
              required
              placeholder="e.g. CH-9902 or BL-410"
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Total Rolls / Thans
            </label>
            <input
              type="number"
              name="rollCount"
              required
              min="1"
              inputMode="numeric"
              placeholder="e.g. 20"
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Row: Fabric Type & Color/Shade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Fabric Type / Construction
            </label>
            <input
              type="text"
              name="fabricType"
              required
              placeholder="e.g. Lawn 68/68, Cambric, Silk"
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Color / Shade State
            </label>
            <input
              type="text"
              name="colorShade"
              required
              placeholder="e.g. Greige / Raw, Bleached White"
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Meterage Section with Real-Time Shortage Indicator */}
        <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Party Claimed Meters
              </label>
              <input
                type="number"
                step="0.01"
                name="challanMeters"
                required
                inputMode="decimal"
                value={challanMeters}
                onChange={(e) => setChallanMeters(e.target.value)}
                placeholder="e.g. 10000.00"
                className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-zinc-500">Printed on client delivery slip</span>
                {numChallan > 0 && (
                  <span className="font-mono font-semibold text-zinc-700 bg-zinc-200/70 px-1.5 py-0.5 rounded text-[10px]">
                    ≈ {metersToYards(numChallan).toLocaleString()} yds
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Physical Measured Meters
              </label>
              <input
                type="number"
                step="0.01"
                name="measuredMeters"
                required
                inputMode="decimal"
                value={measuredMeters}
                onChange={(e) => setMeasuredMeters(e.target.value)}
                placeholder="e.g. 9900.00"
                className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-zinc-500">Staff measurement at receiving dock</span>
                {numMeasured > 0 && (
                  <span className="font-mono font-semibold text-zinc-700 bg-zinc-200/70 px-1.5 py-0.5 rounded text-[10px]">
                    ≈ {metersToYards(numMeasured).toLocaleString()} yds
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Shortage Alert Badge */}
          {numChallan > 0 && numMeasured > 0 && (
            <div className="pt-2 border-t border-zinc-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-xs">
              <span className="text-zinc-600 font-medium">Inward Discrepancy Status:</span>
              {shortage > 0 ? (
                <span className="font-mono font-bold px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>SHORTAGE: -{shortage.toFixed(2)}m (-{metersToYards(shortage).toFixed(2)} yds)</span>
                </span>
              ) : shortage < 0 ? (
                <span className="font-mono font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 inline-flex items-center gap-1.5">
                  <span>EXCESS: +{Math.abs(shortage).toFixed(2)}m (+{metersToYards(Math.abs(shortage)).toFixed(2)} yds)</span>
                </span>
              ) : (
                <span className="font-mono font-bold px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>EXACT MATCH (0.00m / 0.00 yds)</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Row: Driver details & Remarks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Transporter / Driver Info
            </label>
            <input
              type="text"
              name="driverDetails"
              placeholder="e.g. Driver Aslam (Mazda LES-410)"
              className="w-full h-11 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Receiving Remarks (Optional)
            </label>
            <input
              type="text"
              name="remarks"
              placeholder="e.g. Roll #3 water damaged on edge"
              className="w-full h-11 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-12 mt-2 bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <span className="font-mono text-xs">RECORDING INWARD RECEIPT...</span>
          ) : (
            <>
              <ArrowDownLeft className="w-4 h-4" />
              <span>Confirm Inward Gate Receipt</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
