"use client";

import { useActionState, useEffect, useState } from "react";
import { updateFabricInwardAction, FabricActionState } from "@/actions/fabric";
import { metersToYards } from "@/lib/units";
import { X, FileEdit, AlertTriangle, CheckCircle2, History, Loader2, Save } from "lucide-react";

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

  const [partyChallanNo, setPartyChallanNo] = useState("");
  const [fabricType, setFabricType] = useState("");
  const [colorShade, setColorShade] = useState("");
  const [rollCount, setRollCount] = useState<number | string>("");
  const [challanMeters, setChallanMeters] = useState<string>("");
  const [measuredMeters, setMeasuredMeters] = useState<string>("");
  const [driverDetails, setDriverDetails] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (inward) {
      setPartyChallanNo(inward.partyChallanNo || "");
      setFabricType(inward.fabricType || "");
      setColorShade(inward.colorShade || "");
      setRollCount(inward.rollCount || "");
      setChallanMeters(inward.challanMeters?.toString() || "");
      setMeasuredMeters(inward.measuredMeters?.toString() || "");
      setDriverDetails(inward.driverDetails || "");
      setRemarks(inward.remarks || "");
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

  const numChallan = parseFloat(challanMeters) || 0;
  const numMeasured = parseFloat(measuredMeters) || 0;
  const shortage = numChallan > 0 && numMeasured > 0 ? Number((numChallan - numMeasured).toFixed(2)) : 0;
  const historyList = Array.isArray(inward.editHistory) ? inward.editHistory : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className="bg-white border border-zinc-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-950 font-mono">{inward.igpNumber}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-200 text-zinc-800">
                  {inward.party.name} ({inward.party.code})
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Created: {new Date(inward.createdAt).toLocaleDateString("en-GB")}
                {inward.receivedBy?.fullName && ` by ${inward.receivedBy.fullName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {state?.message && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold">{state.message}</span>
            </div>
          )}

          {state?.error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span className="font-semibold">{state.error}</span>
            </div>
          )}

          <form id="edit-inward-form" action={formAction} className="space-y-4">
            <input type="hidden" name="inwardId" value={inward.id} />

            {/* Row 1: Challan No & Rolls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Party Challan / Bilty #
                </label>
                <input
                  type="text"
                  name="partyChallanNo"
                  required
                  value={partyChallanNo}
                  onChange={(e) => setPartyChallanNo(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Total Rolls / Thans
                </label>
                <input
                  type="number"
                  name="rollCount"
                  required
                  min="1"
                  value={rollCount}
                  onChange={(e) => setRollCount(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            {/* Row 2: Fabric & Shade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Fabric Type
                </label>
                <input
                  type="text"
                  name="fabricType"
                  required
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Color / Shade State
                </label>
                <input
                  type="text"
                  name="colorShade"
                  required
                  value={colorShade}
                  onChange={(e) => setColorShade(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            {/* Row 3: Claimed & Measured Meters with Live Yard Conversion */}
            <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 space-y-3">
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
                    value={challanMeters}
                    onChange={(e) => setChallanMeters(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-zinc-500">Party invoice quantity</span>
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
                    value={measuredMeters}
                    onChange={(e) => setMeasuredMeters(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-zinc-500">Actual warehouse measurement</span>
                    {numMeasured > 0 && (
                      <span className="font-mono font-semibold text-zinc-700 bg-zinc-200/70 px-1.5 py-0.5 rounded text-[10px]">
                        ≈ {metersToYards(numMeasured).toLocaleString()} yds
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Shortage Status Preview */}
              {numChallan > 0 && numMeasured > 0 && (
                <div className="pt-2 border-t border-zinc-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                  <span className="text-zinc-600 font-medium">Recalculated Discrepancy:</span>
                  {shortage > 0 ? (
                    <span className="font-mono font-bold px-2.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>SHORTAGE: -{shortage.toFixed(2)}m (-{metersToYards(shortage).toFixed(2)} yds)</span>
                    </span>
                  ) : shortage < 0 ? (
                    <span className="font-mono font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 inline-flex items-center gap-1.5">
                      <span>EXCESS: +{Math.abs(shortage).toFixed(2)}m (+{metersToYards(Math.abs(shortage)).toFixed(2)} yds)</span>
                    </span>
                  ) : (
                    <span className="font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>EXACT MATCH (0.00m / 0.00 yds)</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Row 4: Driver & Remarks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Transporter / Driver Info
                </label>
                <input
                  type="text"
                  name="driverDetails"
                  value={driverDetails}
                  onChange={(e) => setDriverDetails(e.target.value)}
                  placeholder="e.g. Driver name, vehicle number"
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  name="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Checked on folding machine"
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
          </form>

          {/* Audit History Timeline */}
          {historyList.length > 0 && (
            <div className="pt-3 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full text-xs font-semibold text-zinc-700 hover:text-zinc-950 py-1"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Audit History ({historyList.length} previous {historyList.length === 1 ? "edit" : "edits"})</span>
                </span>
                <span className="text-[11px] text-zinc-400">{showHistory ? "Hide details" : "View timeline"}</span>
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-1">
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
        <div className="px-5 py-3.5 border-t border-zinc-100 flex items-center justify-end gap-2.5 bg-zinc-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 h-10 rounded-lg border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-inward-form"
            disabled={isPending}
            className="px-4 h-10 rounded-lg bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving & Reconciling...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
