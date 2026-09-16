"use client";

import { useActionState, useState } from "react";
import {
  createOutsourceDispatchAction,
  returnOutsourceBatchAction,
  FabricActionState,
} from "@/actions/fabric";
import DatePicker from "@/components/ui/DatePicker";
import { metersToYards } from "@/lib/units";
import {
  Send,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Layers,
  FileText,
} from "lucide-react";

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

interface InwardOption {
  id: string;
  igpNumber: string;
  partyId: string;
  partyChallanNo: string;
  fabricType: string;
  colorShade: string;
  measuredMeters: number;
  availableMeters: number;
  party?: { name: string; code: string };
}

interface BatchReturnItem {
  id: string;
  vendorChallanNo: string;
  accountedMeters: number;
  receivedMeters: number;
  shrinkageMeters: number;
  shrinkagePercent: number;
  returnDate: Date;
  receivedBy?: { fullName: string };
  remarks?: string | null;
}

interface OutsourceBatchItem {
  id: string;
  ogpNumber: string;
  partyId: string;
  vendorId: string;
  inwardId?: string | null;
  processType: string;
  targetShade: string;
  sentMeters: any;
  accountedMeters?: any;
  sentDate: Date;
  status: string;
  vendorChallanNo: string | null;
  receivedMeters: any | null;
  shrinkageMeters: any | null;
  shrinkagePercent: any | null;
  receivedDate: Date | null;
  remarks?: string | null;
  party: { name: string; code: string };
  vendor: { name: string; code: string };
  sentBy: { fullName: string };
  inward?: {
    partyChallanNo: string;
    igpNumber: string;
    fabricType: string;
    colorShade: string;
  } | null;
  returns?: BatchReturnItem[];
}

interface LotRow {
  tempId: string;
  partyId: string;
  inwardId: string;
  processType: string;
  targetShade: string;
  sentMeters: string;
}

export default function OutsourceBatchManager({
  parties,
  vendors,
  batches,
  inwards = [],
}: {
  parties: PartyOption[];
  vendors: VendorOption[];
  batches: OutsourceBatchItem[];
  inwards?: InwardOption[];
}) {
  const [dispatchState, dispatchFormAction, isDispatching] = useActionState<
    FabricActionState,
    FormData
  >(createOutsourceDispatchAction, {});

  const [returnState, returnFormAction, isReturning] = useActionState<FabricActionState, FormData>(
    returnOutsourceBatchAction,
    {}
  );

  // Header State
  const [vendorId, setVendorId] = useState("");
  const [remarks, setRemarks] = useState("");

  // Dynamic Multi-Lot Lines State
  const [lotRows, setLotRows] = useState<LotRow[]>([
    {
      tempId: "lot-1",
      partyId: parties[0]?.id || "",
      inwardId: "",
      processType: "SOLID_DYEING",
      targetShade: "",
      sentMeters: "",
    },
  ]);

  const addLotRow = () => {
    setLotRows((prev) => [
      ...prev,
      {
        tempId: `lot-${Date.now()}`,
        partyId: prev[prev.length - 1]?.partyId || parties[0]?.id || "",
        inwardId: "",
        processType: "SOLID_DYEING",
        targetShade: "",
        sentMeters: "",
      },
    ]);
  };

  const removeLotRow = (index: number) => {
    if (lotRows.length <= 1) return;
    setLotRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLotRow = (index: number, field: keyof LotRow, value: string) => {
    setLotRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === "partyId") {
        updated[index].inwardId = "";
      }

      if (field === "inwardId" && value) {
        const matchingInward = inwards.find((i) => i.id === value);
        if (matchingInward && !updated[index].targetShade) {
          updated[index].targetShade = matchingInward.colorShade;
        }
      }

      return updated;
    });
  };

  const totalMetersToDispatch = lotRows.reduce((sum, r) => sum + (parseFloat(r.sentMeters) || 0), 0);

  let hasOverbalanceError = false;
  const partyUsageMap: Record<string, number> = {};

  for (const row of lotRows) {
    const meters = parseFloat(row.sentMeters) || 0;
    if (row.partyId) {
      partyUsageMap[row.partyId] = (partyUsageMap[row.partyId] || 0) + meters;
      const party = parties.find((p) => p.id === row.partyId);
      if (party && partyUsageMap[row.partyId] > (party.balance || 0)) {
        hasOverbalanceError = true;
      }
    }
    if (row.inwardId) {
      const inward = inwards.find((i) => i.id === row.inwardId);
      if (inward && meters > inward.availableMeters) {
        hasOverbalanceError = true;
      }
    }
  }

  // Return Modal State
  const [activeReturnBatch, setActiveReturnBatch] = useState<OutsourceBatchItem | null>(null);
  const [accountedMetersInput, setAccountedMetersInput] = useState("");
  const [receivedMetersInput, setReceivedMetersInput] = useState("");

  const sentMetersNum = activeReturnBatch ? Number(activeReturnBatch.sentMeters) : 0;
  const prevAccountedNum = activeReturnBatch ? Number(activeReturnBatch.accountedMeters || 0) : 0;
  const pendingMetersNum = Number((sentMetersNum - prevAccountedNum).toFixed(2));

  const accountedMetersNum = parseFloat(accountedMetersInput) || pendingMetersNum;
  const receivedMetersNum = parseFloat(receivedMetersInput) || 0;

  const calculatedShrinkage =
    accountedMetersNum > 0 && receivedMetersNum > 0
      ? Number((accountedMetersNum - receivedMetersNum).toFixed(2))
      : 0;

  const calculatedPercent =
    accountedMetersNum > 0 && receivedMetersNum > 0
      ? Number(((calculatedShrinkage / accountedMetersNum) * 100).toFixed(2))
      : 0;

  const remainingAfterThisDelivery = Number((pendingMetersNum - accountedMetersNum).toFixed(2));
  const isOverPendingError = accountedMetersNum > pendingMetersNum + 0.05;

  const pendingBatches = batches.filter(
    (b) => b.status === "WITH_VENDOR" || b.status === "RECEIVED_PARTIAL"
  );
  const completedBatches = batches.filter((b) => b.status === "RECEIVED_COMPLETE");

  return (
    <div className="space-y-6">
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

      {/* DISPATCH TO DYER / PRINTER (HEADER + DYNAMIC LOTS FORM) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-950">Dispatch to Dyer / Printer (OGP)</h2>
              <p className="text-xs text-zinc-500">
                Generate single Outward Gate Pass with one or multiple lot / challan items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold">
              Total Dispatched: {totalMetersToDispatch.toFixed(2)}m (≈ {metersToYards(totalMetersToDispatch).toFixed(1)} yds)
            </span>
          </div>
        </div>

        <form action={dispatchFormAction} className="space-y-5">
          <input
            type="hidden"
            name="itemsPayload"
            value={JSON.stringify(
              lotRows.map((r) => ({
                partyId: r.partyId,
                inwardId: r.inwardId || undefined,
                processType: r.processType,
                targetShade: r.targetShade,
                sentMeters: parseFloat(r.sentMeters) || 0,
              }))
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-50 p-4 rounded-lg border border-zinc-200">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Dispatch Date
              </label>
              <DatePicker name="sentDate" defaultValue={new Date()} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Outsource Vendor (Dyer / Printer)
              </label>
              <select
                name="vendorId"
                required
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
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
                Dispatch Remarks / Gate Pass Notes
              </label>
              <input
                type="text"
                name="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Urgent lot for summer lawn exhibition"
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>
          {/* Dynamic Lot Items Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                <span>Lots / Party Challans in this Dispatch ({lotRows.length})</span>
              </span>
              <button
                type="button"
                onClick={addLotRow}
                className="h-8 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Lot / Challan</span>
              </button>
            </div>

            <div className="space-y-3">
              {lotRows.map((row, index) => {
                const party = parties.find((p) => p.id === row.partyId);
                const partyInwards = inwards.filter((i) => i.partyId === row.partyId);
                const selectedInward = inwards.find((i) => i.id === row.inwardId);
                const parsedMeters = parseFloat(row.sentMeters) || 0;

                const isOverInward =
                  Boolean(selectedInward && parsedMeters > selectedInward.availableMeters);
                const isOverParty =
                  Boolean(party && (partyUsageMap[row.partyId] || 0) > (party.balance || 0));

                return (
                  <div
                    key={row.tempId}
                    className="p-4 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 transition-colors shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                      <span className="text-xs font-mono font-bold text-zinc-700">
                        Item #{index + 1}
                      </span>
                      {lotRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLotRow(index)}
                          className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                          Client Party *
                        </label>
                        <select
                          required
                          value={row.partyId}
                          onChange={(e) => updateLotRow(index, "partyId", e.target.value)}
                          className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-md text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                        >
                          <option value="">-- Select Party --</option>
                          {parties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.code})
                            </option>
                          ))}
                        </select>
                        {party && (
                          <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                            Custody: {party.balance?.toFixed(2)}m
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                          Party Inward Challan # *
                        </label>
                        <select
                          value={row.inwardId}
                          onChange={(e) => updateLotRow(index, "inwardId", e.target.value)}
                          className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-md text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 font-mono"
                        >
                          <option value="">-- General Stock / Select Challan --</option>
                          {partyInwards.map((i) => (
                            <option key={i.id} value={i.id}>
                              #{i.partyChallanNo} ({i.colorShade}) — Avail: {i.availableMeters.toFixed(2)}m
                            </option>
                          ))}
                        </select>
                        {selectedInward && (
                          <span className="text-[10px] text-emerald-700 font-mono block mt-1 font-medium">
                            Avail in #{selectedInward.partyChallanNo}: {selectedInward.availableMeters.toFixed(2)}m
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                          Process Type
                        </label>
                        <select
                          value={row.processType}
                          onChange={(e) => updateLotRow(index, "processType", e.target.value)}
                          className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-md text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                        >
                          <option value="SOLID_DYEING">SOLID_DYEING (Dye House)</option>
                          <option value="ROTARY_PRINTING">ROTARY_PRINTING (Screen)</option>
                          <option value="DIGITAL_PRINTING">DIGITAL_PRINTING (Reactive)</option>
                          <option value="WASHING">WASHING (Chemical)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                          Target Color / Shade *
                        </label>
                        <input
                          type="text"
                          required
                          value={row.targetShade}
                          onChange={(e) => updateLotRow(index, "targetShade", e.target.value)}
                          placeholder="e.g. Jet Black #01"
                          className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-md text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-zinc-600 uppercase">
                            Sent Meters *
                          </label>
                          {parsedMeters > 0 && (
                            <span className="text-[10px] font-mono text-zinc-500">
                              ≈ {metersToYards(parsedMeters).toFixed(1)} yds
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          required
                          min="0.01"
                          value={row.sentMeters}
                          onChange={(e) => updateLotRow(index, "sentMeters", e.target.value)}
                          placeholder="e.g. 5000.00"
                          className={`w-full h-10 px-2.5 bg-white border rounded-md text-xs font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 ${
                            isOverInward || isOverParty
                              ? "border-rose-400 bg-rose-50/30 focus:ring-rose-500"
                              : "border-zinc-300 focus:ring-zinc-900"
                          }`}
                        />
                      </div>
                    </div>

                    {(isOverInward || isOverParty) && (
                      <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>
                          {isOverInward
                            ? `Cannot dispatch ${parsedMeters.toFixed(2)}m. Originating Challan #${selectedInward?.partyChallanNo} only has ${selectedInward?.availableMeters.toFixed(2)}m remaining in factory.`
                            : `Exceeds Party ${party?.name}'s total factory custody balance (${party?.balance?.toFixed(2)}m).`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-zinc-100">
            <button
              type="button"
              onClick={addLotRow}
              className="h-10 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer border border-zinc-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Lot / Challan</span>
            </button>

            <button
              type="submit"
              disabled={isDispatching || hasOverbalanceError || !vendorId || totalMetersToDispatch <= 0}
              className="h-11 px-6 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-md text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDispatching ? (
                <span className="font-mono">ISSUING OGP...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Issue Outward Gate Pass ({lotRows.length} Lot{lotRows.length > 1 ? "s" : ""})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* ACTIVE & COMPLETED BATCHES TRACKER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACTIVE AT VENDORS (PENDING DYER RETURN) */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-zinc-950">
                Batches With Dye Houses ({pendingBatches.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">Awaiting Return</span>
          </div>

          {pendingBatches.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 font-mono">
              No active fabric batches currently at dye houses.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBatches.map((batch) => {
                const totalSent = Number(batch.sentMeters);
                const accounted = Number(batch.accountedMeters || 0);
                const pending = Number((totalSent - accounted).toFixed(2));
                const isPartial = accounted > 0;

                return (
                  <div
                    key={batch.id}
                    className="p-4 rounded-lg border border-amber-200 bg-amber-50/30 space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-zinc-950">
                            {batch.ogpNumber}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                              isPartial
                                ? "bg-blue-100 text-blue-900 border-blue-200"
                                : "bg-amber-100 text-amber-900 border-amber-200"
                            }`}
                          >
                            {isPartial ? "PARTIAL RETURN" : "AT VENDOR"}
                          </span>
                          {batch.inward?.partyChallanNo && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 font-medium">
                              Ref: #{batch.inward.partyChallanNo}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-zinc-900">
                          {batch.party.name} • {batch.targetShade}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Dyer: <span className="text-zinc-700 font-medium">{batch.vendor.name}</span>{" "}
                          ({batch.processType})
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className="text-[10px] text-zinc-400 block uppercase">
                          {isPartial ? "Pending Remaining" : "Total Sent"}
                        </span>
                        <span className="text-sm font-bold text-zinc-950">{pending.toFixed(2)}m</span>
                        <span className="text-[10px] text-zinc-500 block">
                          ≈ {metersToYards(pending).toFixed(1)} yds
                        </span>
                      </div>
                    </div>

                    {isPartial && (
                      <div className="p-2 bg-white/80 rounded border border-amber-200/70 text-[11px] font-mono flex items-center justify-between text-zinc-700">
                        <span>Cleared: {accounted.toFixed(2)}m / {totalSent.toFixed(2)}m</span>
                        <span className="text-zinc-500 font-sans">
                          {batch.returns?.length || 0} delivery slip(s) received
                        </span>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-amber-200/60">
                      <span className="text-[11px] text-zinc-500 font-mono">
                        Dispatched {new Date(batch.sentDate).toLocaleDateString("en-GB")}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveReturnBatch(batch);
                          const remaining = Number((Number(batch.sentMeters) - Number(batch.accountedMeters || 0)).toFixed(2));
                          setAccountedMetersInput(remaining.toString());
                          setReceivedMetersInput("");
                        }}
                        className="h-8 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-md flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Receive Return Slip</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* COMPLETED RETURNS & SHRINKAGE AUDIT */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-zinc-950">
                Completed Outsource Batches ({completedBatches.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">Fully Reconciled</span>
          </div>

          {completedBatches.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 font-mono">
              No completed outsource returns recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 text-xs space-y-2">
              {completedBatches.slice(0, 6).map((batch) => (
                <div key={batch.id} className="pt-2.5 pb-2.5 flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-900">{batch.ogpNumber}</span>
                      {batch.inward?.partyChallanNo && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                          Ref: #{batch.inward.partyChallanNo}
                        </span>
                      )}
                    </div>
                    <div className="text-right font-mono font-bold text-zinc-900">
                      {Number(batch.receivedMeters || 0).toFixed(2)}m received
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-zinc-600 text-[11px]">
                    <span>
                      {batch.party.name} • {batch.targetShade} ({batch.vendor.name})
                    </span>
                    <span className="font-mono text-rose-700 font-medium">
                      Shrinkage: -{Number(batch.shrinkageMeters || 0).toFixed(2)}m (
                      {Number(batch.shrinkagePercent || 0).toFixed(2)}%)
                    </span>
                  </div>

                  {batch.vendorChallanNo && (
                    <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                      <FileText className="w-3 h-3 text-zinc-400" />
                      <span>Dyer Delivery Slips: {batch.vendorChallanNo}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RECEIVE RETURN MODAL / DRAWER (PARTIAL OR FULL WITH TECHNICAL SHRINKAGE) */}
      {activeReturnBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Receive Dyer / Printer Return</h3>
                <p className="text-xs text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                  <span>Pass: {activeReturnBatch.ogpNumber}</span>
                  {activeReturnBatch.inward?.partyChallanNo && (
                    <span className="text-emerald-700 font-semibold">
                      • Originating Ref: #{activeReturnBatch.inward.partyChallanNo}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setActiveReturnBatch(null)}
                className="text-zinc-400 hover:text-zinc-700 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between font-sans">
                <span className="text-zinc-500">Client Party:</span>
                <span className="font-semibold text-zinc-900">{activeReturnBatch.party.name}</span>
              </div>
              <div className="flex justify-between font-sans">
                <span className="text-zinc-500">Dyer / Printer:</span>
                <span className="font-semibold text-zinc-900">{activeReturnBatch.vendor.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Total Dispatched Lot:</span>
                <span className="font-bold text-zinc-900">{sentMetersNum.toFixed(2)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Previously Accounted:</span>
                <span className="text-zinc-700">{prevAccountedNum.toFixed(2)}m</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-zinc-200 font-bold">
                <span className="text-amber-800 font-sans">Remaining Pending with Dyer:</span>
                <span className="text-amber-900">{pendingMetersNum.toFixed(2)}m</span>
              </div>
            </div>

            <form action={returnFormAction} className="space-y-4">
              <input type="hidden" name="batchId" value={activeReturnBatch.id} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Delivery Date *
                  </label>
                  <DatePicker name="receivedDate" defaultValue={new Date()} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Dyer Delivery Slip # *
                  </label>
                  <input
                    type="text"
                    name="vendorChallanNo"
                    required
                    placeholder="e.g. DY-8801"
                    className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    Dispatched Lot Meters Accounted *
                  </label>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Max Pending: {pendingMetersNum.toFixed(2)}m
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  name="accountedMeters"
                  required
                  min="0.01"
                  max={pendingMetersNum}
                  inputMode="decimal"
                  value={accountedMetersInput}
                  onChange={(e) => setAccountedMetersInput(e.target.value)}
                  className={`w-full h-11 px-3 bg-white border rounded-md text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 ${
                    isOverPendingError
                      ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20"
                      : "border-zinc-300 focus:ring-zinc-900"
                  }`}
                />
                <span className="text-[11px] text-zinc-500 block mt-1">
                  Leave at {pendingMetersNum.toFixed(2)}m for complete return, or enter smaller value for partial delivery.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    Physical Received Meters (from Dyer Slip) *
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
                  min="0.01"
                  inputMode="decimal"
                  value={receivedMetersInput}
                  onChange={(e) => setReceivedMetersInput(e.target.value)}
                  placeholder="e.g. 2450.00"
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {receivedMetersNum > 0 && (
                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-md text-xs space-y-1.5">
                  <div className="flex justify-between font-mono">
                    <span className="text-rose-800 font-medium">Technical Shrinkage Loss:</span>
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
                  <div className="pt-1.5 border-t border-rose-200/60 flex justify-between font-mono">
                    <span className="text-zinc-700 font-sans">Batch Status After This Delivery:</span>
                    <span className={`font-bold ${remainingAfterThisDelivery <= 0.05 ? "text-emerald-700" : "text-blue-700"}`}>
                      {remainingAfterThisDelivery <= 0.05
                        ? "RECEIVED_COMPLETE (0.00m left)"
                        : `RECEIVED_PARTIAL (${remainingAfterThisDelivery.toFixed(2)}m left with dyer)`}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Delivery Remarks / Notes
                </label>
                <input
                  type="text"
                  name="remarks"
                  placeholder="e.g. Received partial 1st delivery on truck #LES-421"
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isReturning || isOverPendingError || receivedMetersNum <= 0}
                  onClick={() => {
                    setTimeout(() => setActiveReturnBatch(null), 800);
                  }}
                  className="flex-1 h-12 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold uppercase tracking-wider rounded-md flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Accept Return & Update Ledger</span>
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