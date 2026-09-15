"use client";

import { useActionState, useState } from "react";
import {
  createOutsourceDispatchAction,
  returnOutsourceBatchAction,
  FabricActionState,
} from "@/actions/fabric";
import DatePicker from "@/components/ui/DatePicker";
import { metersToYards } from "@/lib/units";
import { Send, RotateCcw, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
  code: string;
  balance?: number;
}

interface VendorOption {
  id: string;
  name: string;
  code: string;
  defaultProcess: string;
}

interface OutsourceBatchItem {
  id: string;
  ogpNumber: string;
  processType: string;
  targetShade: string;
  sentMeters: any;
  sentDate: Date;
  status: string;
  vendorChallanNo: string | null;
  receivedMeters: any | null;
  shrinkageMeters: any | null;
  shrinkagePercent: any | null;
  receivedDate: Date | null;
  party: { name: string; code: string };
  vendor: { name: string; code: string };
  sentBy: { fullName: string };
}

export default function OutsourceBatchManager({
  parties,
  vendors,
  batches,
}: {
  parties: PartyOption[];
  vendors: VendorOption[];
  batches: OutsourceBatchItem[];
}) {
  const [dispatchState, dispatchFormAction, isDispatching] = useActionState<
    FabricActionState,
    FormData
  >(createOutsourceDispatchAction, {});

  const [returnState, returnFormAction, isReturning] = useActionState<FabricActionState, FormData>(
    returnOutsourceBatchAction,
    {}
  );

  // Dispatch Form State for balance validation & dual-unit preview
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [sentMetersInput, setSentMetersInput] = useState("");

  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const availableBalance = selectedParty?.balance ?? 0;
  const parsedSentMeters = parseFloat(sentMetersInput) || 0;
  const isExceedingBalance = Boolean(selectedPartyId && parsedSentMeters > availableBalance);

  // Return Modal State
  const [activeReturnBatch, setActiveReturnBatch] = useState<OutsourceBatchItem | null>(null);
  const [receivedMetersInput, setReceivedMetersInput] = useState("");

  const sentMetersNum = activeReturnBatch ? Number(activeReturnBatch.sentMeters) : 0;
  const receivedMetersNum = parseFloat(receivedMetersInput) || 0;
  const calculatedShrinkage =
    sentMetersNum > 0 && receivedMetersNum > 0
      ? Number((sentMetersNum - receivedMetersNum).toFixed(2))
      : 0;
  const calculatedPercent =
    sentMetersNum > 0 && receivedMetersNum > 0
      ? Number(((calculatedShrinkage / sentMetersNum) * 100).toFixed(2))
      : 0;

  const pendingBatches = batches.filter((b) => b.status === "WITH_VENDOR");
  const completedBatches = batches.filter((b) => b.status !== "WITH_VENDOR");

  return (
    <div className="space-y-6">
      {/* Feedback alerts */}
      {(dispatchState?.message || returnState?.message) && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-semibold">{dispatchState?.message || returnState?.message}</span>
        </div>
      )}

      {(dispatchState?.error || returnState?.error) && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span className="font-semibold">{dispatchState?.error || returnState?.error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DISPATCH TO DYER / PRINTER (OGP FORM) */}
        <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-xl p-5 shadow-xs h-fit">
          <div className="flex items-center gap-2.5 pb-3.5 mb-4 border-b border-zinc-100">
            <div className="w-8 h-8 rounded-md bg-zinc-900 text-white flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Dispatch to Dyer / Printer</h2>
              <p className="text-[11px] text-zinc-500">Generate Outward Gate Pass (OGP)</p>
            </div>
          </div>

          <form action={dispatchFormAction} className="space-y-3.5">
            {/* Dispatch Date Selector with DD/MM/YYYY */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Dispatch Date
              </label>
              <DatePicker name="sentDate" defaultValue={new Date()} />
            </div>

            {/* Client Party with Available Factory Custody Balance */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Client Party
              </label>
              <select
                name="partyId"
                required
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">-- Select Party --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              {selectedParty && (
                <div className="mt-1.5 flex items-center justify-between text-[11px] bg-zinc-50 px-2.5 py-1.5 rounded border border-zinc-200">
                  <span className="text-zinc-500 font-medium">Available in Factory:</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {availableBalance.toFixed(2)}m{" "}
                    <span className="text-zinc-500 font-normal">
                      (≈ {metersToYards(availableBalance).toFixed(1)} yds)
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Outsource Vendor
              </label>
              <select
                name="vendorId"
                required
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">-- Select Dyer / Printer --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.defaultProcess})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Process Type
              </label>
              <select
                name="processType"
                defaultValue="SOLID_DYEING"
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                <option value="SOLID_DYEING">SOLID_DYEING (Dye House)</option>
                <option value="ROTARY_PRINTING">ROTARY_PRINTING (Screen Print)</option>
                <option value="DIGITAL_PRINTING">DIGITAL_PRINTING (Reactive)</option>
                <option value="WASHING">WASHING (Enzyme / Chemical)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Target Color / Shade Specification
              </label>
              <input
                type="text"
                name="targetShade"
                required
                placeholder="e.g. Jet Black Shade #44 or Digital Lily Print"
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            {/* Meters Sent Out with Strict Balance Check & Dual Units */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  Meters Sent Out
                </label>
                {parsedSentMeters > 0 && (
                  <span className="text-[11px] font-mono text-zinc-500">
                    ≈ {metersToYards(parsedSentMeters).toFixed(1)} yds
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                name="sentMeters"
                required
                inputMode="decimal"
                value={sentMetersInput}
                onChange={(e) => setSentMetersInput(e.target.value)}
                placeholder={
                  selectedParty
                    ? `Max: ${availableBalance.toFixed(2)}m`
                    : "e.g. 9800.00"
                }
                className={`w-full h-11 px-3 bg-white border rounded-md text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 ${
                  isExceedingBalance
                    ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20"
                    : "border-zinc-300 focus:ring-zinc-900"
                }`}
              />

              {/* Red warning if exceeding available balance */}
              {isExceedingBalance && (
                <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>
                    Cannot send more than current balance ({availableBalance.toFixed(2)}m)
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isDispatching || isExceedingBalance}
              className="w-full h-12 mt-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-md text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDispatching ? (
                <span className="font-mono">DISPATCHING...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Issue Outward Gate Pass</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ACTIVE & COMPLETED BATCHES TRACKER */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active with Dyers */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-zinc-950">
                  Batches Currently With Vendors ({pendingBatches.length})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-zinc-500">Awaiting Dyer Return</span>
            </div>

            {pendingBatches.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 font-mono">
                No active fabric batches currently at dye houses.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="p-4 rounded-lg border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-zinc-900">
                          {batch.ogpNumber}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 font-semibold">
                          AT VENDOR
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-zinc-900 mt-1">
                        {batch.party.name} • {batch.targetShade}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Vendor: <span className="text-zinc-700 font-medium">{batch.vendor.name}</span>{" "}
                        ({batch.processType})
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/60">
                      <div className="text-right font-mono">
                        <span className="text-[10px] text-zinc-400 block uppercase">Sent</span>
                        <span className="text-sm font-bold text-zinc-900">
                          {Number(batch.sentMeters).toFixed(2)}m
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          ≈ {metersToYards(Number(batch.sentMeters)).toFixed(1)} yds
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setActiveReturnBatch(batch);
                          setReceivedMetersInput("");
                        }}
                        className="h-10 px-3.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Receive Return</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historical Completed Batches with Shrinkage Ledgers */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-zinc-950">
                  Recent Processed Returns ({completedBatches.length})
                </h3>
              </div>
            </div>

            {completedBatches.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400 font-mono">
                No completed returns recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 text-xs">
                {completedBatches.slice(0, 5).map((batch) => (
                  <div key={batch.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-zinc-900">{batch.ogpNumber}</div>
                      <div className="text-zinc-600">
                        {batch.party.name} • {batch.targetShade} ({batch.vendor.name})
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        Challan #{batch.vendorChallanNo || "N/A"}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-zinc-900 font-semibold">
                        {Number(batch.receivedMeters).toFixed(2)}m{" "}
                        <span className="text-[10px] text-zinc-400 font-normal">
                          / {Number(batch.sentMeters).toFixed(2)}m
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        ≈ {metersToYards(Number(batch.receivedMeters)).toFixed(1)} yds
                      </div>
                      <div className="text-[11px] text-rose-700 font-medium mt-0.5">
                        Shrinkage: -{Number(batch.shrinkageMeters).toFixed(2)}m{" "}
                        <span className="text-[10px] text-zinc-400 font-normal">
                          (≈ {metersToYards(Number(batch.shrinkageMeters)).toFixed(1)} yds)
                        </span>{" "}
                        ({Number(batch.shrinkagePercent).toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECEIVE RETURN MODAL / DRAWER */}
      {activeReturnBatch && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Receive Dyer / Printer Return</h3>
                <p className="text-xs text-zinc-500 font-mono">{activeReturnBatch.ogpNumber}</p>
              </div>
              <button
                onClick={() => setActiveReturnBatch(null)}
                className="text-zinc-400 hover:text-zinc-700 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Party:</span>
                <span className="font-semibold text-zinc-900">{activeReturnBatch.party.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Vendor:</span>
                <span className="font-semibold text-zinc-900">{activeReturnBatch.vendor.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Sent Meterage:</span>
                <span className="font-mono font-bold text-zinc-900">
                  {sentMetersNum.toFixed(2)}m{" "}
                  <span className="text-zinc-500 font-normal">
                    (≈ {metersToYards(sentMetersNum).toFixed(1)} yds)
                  </span>
                </span>
              </div>
            </div>

            <form action={returnFormAction} className="space-y-3.5">
              <input type="hidden" name="batchId" value={activeReturnBatch.id} />

              {/* Received Date Picker with DD/MM/YYYY format */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Received / Return Date
                </label>
                <DatePicker name="receivedDate" defaultValue={new Date()} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Vendor Return Challan #
                </label>
                <input
                  type="text"
                  name="vendorChallanNo"
                  required
                  placeholder="e.g. DY-8801"
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    Physical Received Meters
                  </label>
                  {receivedMetersNum > 0 && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      ≈ {metersToYards(receivedMetersNum).toFixed(1)} yds
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  name="receivedMeters"
                  required
                  inputMode="decimal"
                  value={receivedMetersInput}
                  onChange={(e) => setReceivedMetersInput(e.target.value)}
                  placeholder="e.g. 9600.00"
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* Real-time calculated technical shrinkage & 3-way reconciliation */}
              {receivedMetersNum > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-rose-800 font-medium">Process Shrinkage Loss:</span>
                    <span className="font-bold text-rose-900">
                      -{calculatedShrinkage.toFixed(2)}m{" "}
                      <span className="text-rose-700 font-normal">
                        (≈ {metersToYards(calculatedShrinkage).toFixed(1)} yds)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-rose-800 font-medium">Shrinkage Rate:</span>
                    <span className="font-bold text-rose-900">{calculatedPercent.toFixed(2)}%</span>
                  </div>
                  <span className="text-[10px] text-rose-700 block mt-1">
                    Factory stock will increase by +{receivedMetersNum.toFixed(2)}m (gross return +{sentMetersNum.toFixed(2)}m minus {calculatedShrinkage.toFixed(2)}m shrinkage).
                  </span>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isReturning}
                  onClick={() => {
                    setTimeout(() => setActiveReturnBatch(null), 800);
                  }}
                  className="flex-1 h-12 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold uppercase tracking-wider rounded-md flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Verify & Credit Return</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReturnBatch(null)}
                  className="h-12 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs rounded-md cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
