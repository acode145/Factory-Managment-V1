"use client";

import { useActionState, useState, useEffect } from "react";
import {
  createOutsourceDispatchAction,
  returnOutsourceBatchAction,
  FabricActionState,
} from "@/actions/fabric";
import DatePicker from "@/components/ui/DatePicker";
import { metersToYards, yardsToMeters } from "@/lib/units";
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
  Boxes,
} from "lucide-react";

interface PartyOption {
  id: string;
  name: string;
  code: string;
  balance?: number;
  piecesBalance?: number;
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
    standardMeters: number | null;
    availableQty?: number;
    availableMeters?: number | null;
  }>;
}

interface BatchReturnItem {
  id: string;
  vendorChallanNo: string;
  unit?: string;
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
  inwardItemId?: string | null;
  unit?: string;
  itemCategory?: string;
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
  inwardItem?: {
    fabricType: string;
    colorShade: string;
    unit: string;
  } | null;
  returns?: BatchReturnItem[];
}

interface LotRow {
  tempId: string;
  partyId: string;
  inwardId: string;
  inwardItemId: string;
  processType: string;
  targetShade: string;
  unit: "METERS" | "YARDS" | "PIECES";
  sentQty: string;
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
      inwardItemId: "",
      processType: "SOLID_DYEING",
      targetShade: "",
      unit: "METERS",
      sentQty: "",
    },
  ]);

  // Auto-reset form on successful OGP dispatch
  useEffect(() => {
    if (dispatchState?.success) {
      setLotRows([
        {
          tempId: `lot-${Date.now()}`,
          partyId: parties[0]?.id || "",
          inwardId: "",
          inwardItemId: "",
          processType: "SOLID_DYEING",
          targetShade: "",
          unit: "METERS",
          sentQty: "",
        },
      ]);
      setVendorId("");
      setRemarks("");
    }
  }, [dispatchState]);

  // Return Modal State
  const [activeReturnBatch, setActiveReturnBatch] = useState<OutsourceBatchItem | null>(null);
  const [accountedQtyInput, setAccountedQtyInput] = useState("");
  const [receivedQtyInput, setReceivedQtyInput] = useState("");
  const [returnUnit, setReturnUnit] = useState<"" | "METERS" | "YARDS" | "PIECES">("");

  // Auto-reset return modal on successful return submission
  useEffect(() => {
    if (returnState?.success) {
      setActiveReturnBatch(null);
      setAccountedQtyInput("");
      setReceivedQtyInput("");
      setReturnUnit("");
    }
  }, [returnState]);

  const handleReturnUnitChange = (newUnit: "" | "METERS" | "YARDS") => {
    setReturnUnit(newUnit);
    if (!newUnit || !activeReturnBatch) {
      setAccountedQtyInput("");
      return;
    }
    const rawPending = Number(
      (
        Number(activeReturnBatch.sentMeters) -
        Number(activeReturnBatch.accountedMeters || 0)
      ).toFixed(2)
    );
    let pendingInNewUnit = rawPending;
    if (activeReturnBatch.unit === "YARDS" && newUnit === "METERS") {
      pendingInNewUnit = Number(yardsToMeters(rawPending).toFixed(2));
    } else if (activeReturnBatch.unit === "METERS" && newUnit === "YARDS") {
      pendingInNewUnit = Number(metersToYards(rawPending).toFixed(2));
    }
    setAccountedQtyInput(pendingInNewUnit.toString());
  };

  const addLotRow = () => {
    setLotRows((prev) => [
      ...prev,
      {
        tempId: `lot-${Date.now()}`,
        partyId: prev[prev.length - 1]?.partyId || parties[0]?.id || "",
        inwardId: "",
        inwardItemId: "",
        processType: "SOLID_DYEING",
        targetShade: "",
        unit: prev[prev.length - 1]?.unit || "METERS",
        sentQty: "",
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
        updated[index].inwardItemId = "";
      }

      if (field === "inwardId") {
        updated[index].inwardItemId = "";
        if (value) {
          const matchingInward = inwards.find((i) => i.id === value);
          if (matchingInward) {
            if (matchingInward.items && matchingInward.items.length === 1) {
              const it = matchingInward.items[0];
              updated[index].inwardItemId = it.id;
              updated[index].unit = (it.unit as any) || "METERS";
              if (!updated[index].targetShade) {
                updated[index].targetShade = it.colorShade;
              }
            } else if (!updated[index].targetShade) {
              updated[index].targetShade = matchingInward.colorShade;
            }
          }
        }
      }

      if (field === "inwardItemId" && value) {
        const matchingInward = inwards.find((i) => i.id === updated[index].inwardId);
        const matchingItem = matchingInward?.items?.find((it) => it.id === value);
        if (matchingItem) {
          updated[index].unit = (matchingItem.unit as any) || "METERS";
          if (!updated[index].targetShade) {
            updated[index].targetShade = matchingItem.colorShade;
          }
        }
      }

      return updated;
    });
  };

  // Aggregated totals
  const totalContinuousMeters = lotRows
    .filter((r) => r.unit !== "PIECES")
    .reduce((sum, r) => {
      const q = parseFloat(r.sentQty) || 0;
      return sum + (r.unit === "YARDS" ? yardsToMeters(q) : q);
    }, 0);
  const totalContinuousYards = Number((totalContinuousMeters / 0.9144).toFixed(2));
  const totalPieces = lotRows
    .filter((r) => r.unit === "PIECES")
    .reduce((sum, r) => sum + (parseInt(r.sentQty, 10) || 0), 0);

  // Custody & Lot balance validation
  let hasOverbalanceError = false;
  const partyUsageContinuousMap: Record<string, number> = {};
  const partyUsagePiecesMap: Record<string, number> = {};
  const itemUsageMap: Record<string, number> = {};
  const inwardUsageMap: Record<string, number> = {};

  // First pass: aggregate usages
  for (const row of lotRows) {
    const qty = parseFloat(row.sentQty) || 0;
    if (qty > 0) {
      if (row.partyId) {
        if (row.unit === "PIECES") {
          partyUsagePiecesMap[row.partyId] =
            (partyUsagePiecesMap[row.partyId] || 0) + Math.round(qty);
        } else {
          const stdM = row.unit === "YARDS" ? yardsToMeters(qty) : qty;
          partyUsageContinuousMap[row.partyId] =
            (partyUsageContinuousMap[row.partyId] || 0) + stdM;
        }
      }

      if (row.inwardItemId) {
        const stdQty =
          row.unit === "PIECES"
            ? Math.round(qty)
            : row.unit === "YARDS"
            ? yardsToMeters(qty)
            : qty;
        itemUsageMap[row.inwardItemId] = (itemUsageMap[row.inwardItemId] || 0) + stdQty;
      } else if (row.inwardId) {
        const stdQty =
          row.unit === "PIECES"
            ? Math.round(qty)
            : row.unit === "YARDS"
            ? yardsToMeters(qty)
            : qty;
        inwardUsageMap[row.inwardId] = (inwardUsageMap[row.inwardId] || 0) + stdQty;
      }
    }
  }

  // Second pass: check party & lot bounds
  for (const row of lotRows) {
    const qty = parseFloat(row.sentQty) || 0;
    if (qty > 0) {
      if (row.partyId) {
        const party = parties.find((p) => p.id === row.partyId);
        if (row.unit === "PIECES") {
          if (party && (partyUsagePiecesMap[row.partyId] || 0) > (party.piecesBalance || 0)) {
            hasOverbalanceError = true;
          }
        } else {
          if (party && (partyUsageContinuousMap[row.partyId] || 0) > (party.balance || 0) + 0.005) {
            hasOverbalanceError = true;
          }
        }
      }

      if (row.inwardItemId) {
        const matchingInward = inwards.find((i) => i.id === row.inwardId);
        const matchingItem = matchingInward?.items?.find((it) => it.id === row.inwardItemId);
        if (matchingItem) {
          const maxStd =
            matchingItem.unit === "PIECES"
              ? matchingItem.availableQty ?? matchingItem.measuredQty ?? 0
              : matchingItem.availableMeters ??
                (matchingItem.unit === "YARDS"
                  ? yardsToMeters(matchingItem.availableQty ?? matchingItem.measuredQty ?? 0)
                  : matchingItem.availableQty ?? matchingItem.measuredQty ?? 0);
          if ((itemUsageMap[row.inwardItemId] || 0) > maxStd + 0.005) {
            hasOverbalanceError = true;
          }
        }
      } else if (row.inwardId) {
        const matchingInward = inwards.find((i) => i.id === row.inwardId);
        if (matchingInward && (inwardUsageMap[row.inwardId] || 0) > (matchingInward.availableMeters || 0) + 0.005) {
          hasOverbalanceError = true;
        }
      }
    }
  }

  // Active Return Batch Calculations
  const isReturnPieces =
    activeReturnBatch?.itemCategory === "PIECES" || activeReturnBatch?.unit === "PIECES";

  const sentQtyBatchUnit = activeReturnBatch ? Number(activeReturnBatch.sentMeters) : 0;
  const prevAccountedBatchUnit = activeReturnBatch ? Number(activeReturnBatch.accountedMeters || 0) : 0;
  const rawPendingBatchUnit = Number((sentQtyBatchUnit - prevAccountedBatchUnit).toFixed(2));
  const batchUnitLabel = isReturnPieces
    ? "pcs"
    : activeReturnBatch?.unit === "YARDS"
    ? "yd"
    : "m";

  // Effective Return Unit & Label
  const effectiveReturnUnit = isReturnPieces ? "PIECES" : returnUnit;
  const returnUnitLabel =
    effectiveReturnUnit === "PIECES"
      ? "pcs"
      : effectiveReturnUnit === "YARDS"
      ? "yd"
      : effectiveReturnUnit === "METERS"
      ? "m"
      : "";

  // Compute pending quantity in the chosen slip unit
  let pendingQtyNum = rawPendingBatchUnit;
  if (!isReturnPieces && activeReturnBatch && effectiveReturnUnit) {
    if (activeReturnBatch.unit === "YARDS" && effectiveReturnUnit === "METERS") {
      pendingQtyNum = Number(yardsToMeters(rawPendingBatchUnit).toFixed(2));
    } else if (activeReturnBatch.unit === "METERS" && effectiveReturnUnit === "YARDS") {
      pendingQtyNum = Number(metersToYards(rawPendingBatchUnit).toFixed(2));
    }
  }

  const accountedQtyNum = parseFloat(accountedQtyInput) || 0;
  const receivedQtyNum = parseFloat(receivedQtyInput) || 0;

  const calculatedShrinkage =
    accountedQtyNum > 0 && receivedQtyNum > 0
      ? Number((accountedQtyNum - receivedQtyNum).toFixed(2))
      : 0;

  const calculatedPercent =
    accountedQtyNum > 0 && receivedQtyNum > 0
      ? Number(((calculatedShrinkage / accountedQtyNum) * 100).toFixed(2))
      : 0;

  const remainingAfterThisDelivery = Number((pendingQtyNum - accountedQtyNum).toFixed(2));
  const isOverPendingError = returnUnitLabel !== "" && accountedQtyNum > pendingQtyNum + 0.05;

  const pendingBatches = batches.filter(
    (b) => b.status === "WITH_VENDOR" || b.status === "RECEIVED_PARTIAL"
  );
  const completedBatches = batches.filter((b) => b.status === "RECEIVED_COMPLETE");

  return (
    <div className="space-y-6">
      {(dispatchState?.message || returnState?.message) && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-semibold">{dispatchState?.message || returnState?.message}</span>
        </div>
      )}

      {(dispatchState?.error || returnState?.error) && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2 shadow-xs">
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
                Generate single Outward Gate Pass with multi-unit lots (m, yd, pcs)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {totalContinuousMeters > 0 && (
              <span className="text-xs font-mono px-3 py-1 rounded bg-zinc-100 border border-zinc-200 text-zinc-800 font-semibold">
                Continuous: {totalContinuousMeters.toFixed(2)}m (≈ {totalContinuousYards.toFixed(1)} yd)
              </span>
            )}
            {totalPieces > 0 && (
              <span className="text-xs font-mono px-3 py-1 rounded bg-purple-50 border border-purple-200 text-purple-900 font-semibold">
                Pieces: {totalPieces.toLocaleString()} pcs
              </span>
            )}
            {totalContinuousMeters === 0 && totalPieces === 0 && (
              <span className="text-xs font-mono px-3 py-1 rounded bg-zinc-50 border border-zinc-200 text-zinc-400">
                No quantity entered
              </span>
            )}
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
                inwardItemId: r.inwardItemId || undefined,
                unit: r.unit,
                processType: r.processType,
                targetShade: r.targetShade,
                sentQty: parseFloat(r.sentQty) || 0,
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
                Outsource Vendor (Dyer / Printer) *
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
            </div>

            <div className="space-y-3">
              {lotRows.map((row, index) => {
                const party = parties.find((p) => p.id === row.partyId);
                const partyInwards = inwards.filter((i) => i.partyId === row.partyId);
                const selectedInward = inwards.find((i) => i.id === row.inwardId);
                const selectedItem = selectedInward?.items?.find((it) => it.id === row.inwardItemId);
                const parsedQty = parseFloat(row.sentQty) || 0;

                const isPiecesRow = row.unit === "PIECES";
                const isOverParty = isPiecesRow
                  ? Boolean(party && (partyUsagePiecesMap[row.partyId] || 0) > (party.piecesBalance || 0))
                  : Boolean(party && (partyUsageContinuousMap[row.partyId] || 0) > (party.balance || 0));

                // Lot / Line-Item Available Balances
                let lotAvailableBadge: string | null = null;
                let maxAllowedInRowUnit: number | null = null;
                let isOverLot = false;

                if (selectedItem) {
                  const isItemPcs = selectedItem.unit === "PIECES";
                  if (isItemPcs) {
                    const avail = selectedItem.availableQty ?? selectedItem.measuredQty ?? 0;
                    maxAllowedInRowUnit = avail;
                    lotAvailableBadge = `${avail} pcs`;
                    if (parsedQty > 0 && (itemUsageMap[selectedItem.id] || 0) > avail) {
                      isOverLot = true;
                    }
                  } else {
                    const availMeters =
                      selectedItem.availableMeters ??
                      (selectedItem.unit === "YARDS"
                        ? yardsToMeters(selectedItem.availableQty ?? selectedItem.measuredQty ?? 0)
                        : selectedItem.availableQty ?? selectedItem.measuredQty ?? 0);
                    const availYards = Number(metersToYards(availMeters).toFixed(2));

                    if (row.unit === "YARDS") {
                      maxAllowedInRowUnit = availYards;
                    } else if (row.unit === "METERS") {
                      maxAllowedInRowUnit = availMeters;
                    }

                    lotAvailableBadge =
                      selectedItem.unit === "YARDS"
                        ? `${availYards.toFixed(2)} yd (≈ ${availMeters.toFixed(2)} m)`
                        : `${availMeters.toFixed(2)} m (≈ ${availYards.toFixed(2)} yd)`;

                    if (parsedQty > 0 && (itemUsageMap[selectedItem.id] || 0) > availMeters + 0.005) {
                      isOverLot = true;
                    }
                  }
                } else if (selectedInward) {
                  const availMeters = selectedInward.availableMeters;
                  const availYards = Number(metersToYards(availMeters).toFixed(2));
                  if (row.unit === "YARDS") {
                    maxAllowedInRowUnit = availYards;
                  } else if (row.unit === "METERS") {
                    maxAllowedInRowUnit = availMeters;
                  }
                  lotAvailableBadge = `${availMeters.toFixed(2)} m (≈ ${availYards.toFixed(2)} yd)`;

                  if (parsedQty > 0 && (inwardUsageMap[selectedInward.id] || 0) > availMeters + 0.005) {
                    isOverLot = true;
                  }
                }

                const isRowInvalid = isOverParty || isOverLot;

                return (
                  <div
                    key={row.tempId}
                    className="p-4 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 transition-colors shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-zinc-700">
                          Lot Item #{index + 1}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                            isPiecesRow
                              ? "bg-purple-50 text-purple-900 border-purple-200"
                              : "bg-blue-50 text-blue-900 border-blue-200"
                          }`}
                        >
                          {isPiecesRow ? "Cut Pieces (Pcs)" : "Continuous Fabric"}
                        </span>
                      </div>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                      {/* Client Party */}
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
                            Custody: {party.balance?.toFixed(1)}m | {party.piecesBalance || 0} pcs
                          </span>
                        )}
                      </div>

                      {/* Party Inward Challan & Item */}
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                          Inward Challan / Lot #
                        </label>
                        <select
                          value={row.inwardId}
                          onChange={(e) => updateLotRow(index, "inwardId", e.target.value)}
                          className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-md text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 font-mono"
                        >
                          <option value="">-- General Stock / Challan --</option>
                          {partyInwards.map((i) => (
                            <option key={i.id} value={i.id}>
                              #{i.partyChallanNo} ({i.fabricType})
                            </option>
                          ))}
                        </select>
                        {selectedInward && selectedInward.items && selectedInward.items.length > 1 && (
                          <select
                            value={row.inwardItemId}
                            onChange={(e) => updateLotRow(index, "inwardItemId", e.target.value)}
                            className="w-full h-8 px-2 bg-zinc-50 border border-zinc-200 rounded text-[11px] text-zinc-800 font-mono mt-1.5 focus:outline-hidden"
                          >
                            <option value="">-- Select Specific Line Item --</option>
                            {selectedInward.items.map((it) => (
                              <option key={it.id} value={it.id}>
                                #{it.itemIndex + 1}: {it.fabricType} ({it.colorShade}) — {it.measuredQty} {it.unit === "PIECES" ? "pcs" : it.unit === "YARDS" ? "yd" : "m"}
                              </option>
                            ))}
                          </select>
                        )}
                        {lotAvailableBadge && (
                          <span className="text-[10px] text-zinc-600 font-mono block mt-1 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded truncate">
                            📦 Lot Avail: <strong className="text-zinc-900">{lotAvailableBadge}</strong>
                          </span>
                        )}
                      </div>

                      {/* Process Type */}
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

                      {/* Target Color / Shade */}
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

                      {/* Unit Selector (M, Yd, Pcs) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                          Unit *
                        </label>
                        <select
                          value={row.unit}
                          onChange={(e) => updateLotRow(index, "unit", e.target.value)}
                          className="w-full h-10 px-2.5 bg-white border border-zinc-300 rounded-md text-xs font-semibold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 cursor-pointer"
                        >
                          {selectedItem?.unit === "PIECES" ? (
                            <option value="PIECES">Pcs</option>
                          ) : selectedItem?.unit && selectedItem.unit !== "PIECES" ? (
                            <>
                              <option value="METERS">M</option>
                              <option value="YARDS">Yd</option>
                            </>
                          ) : (
                            <>
                              <option value="METERS">M</option>
                              <option value="YARDS">Yd</option>
                              <option value="PIECES">Pcs</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Sent Qty Input with live companion preview */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-zinc-600 uppercase">
                            Sent Qty *
                          </label>
                          {maxAllowedInRowUnit !== null && (
                            <span
                              className={`text-[10px] font-mono font-medium ${
                                isOverLot ? "text-rose-600 font-bold" : "text-zinc-500"
                              }`}
                            >
                              Max: {maxAllowedInRowUnit.toFixed(row.unit === "PIECES" ? 0 : 2)}{" "}
                              {row.unit === "PIECES" ? "pcs" : row.unit === "YARDS" ? "yd" : "m"}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step={row.unit === "PIECES" ? "1" : "0.01"}
                          required
                          min={row.unit === "PIECES" ? "1" : "0.01"}
                          value={row.sentQty}
                          onChange={(e) => updateLotRow(index, "sentQty", e.target.value)}
                          placeholder={row.unit === "PIECES" ? "e.g. 500" : "e.g. 1000.00"}
                          className={`w-full h-10 px-2.5 bg-white border rounded-md text-xs font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 ${
                            isRowInvalid
                              ? "border-rose-400 bg-rose-50/30 focus:ring-rose-500 text-rose-950 font-semibold"
                              : "border-zinc-300 focus:ring-zinc-900"
                          }`}
                        />
                        {parsedQty > 0 && (
                          <span className="text-[10px] font-mono text-zinc-500 font-medium block mt-1">
                            {row.unit === "YARDS" && `≈ ${yardsToMeters(parsedQty).toFixed(2)} m`}
                            {row.unit === "METERS" && `≈ ${metersToYards(parsedQty).toFixed(2)} yd`}
                            {row.unit === "PIECES" && `${Math.round(parsedQty)} pcs`}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOverLot && (
                      <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-md flex items-start gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Exceeds lot stock! </span>
                          You cannot dispatch {parsedQty.toFixed(row.unit === "PIECES" ? 0 : 2)}{" "}
                          {row.unit === "PIECES" ? "pcs" : row.unit === "YARDS" ? "yd" : "m"}.
                          Maximum available in {selectedItem ? `Lot #${selectedInward?.partyChallanNo} (${selectedItem.fabricType} - ${selectedItem.colorShade})` : `Challan #${selectedInward?.partyChallanNo}`} is{" "}
                          <strong className="underline">
                            {maxAllowedInRowUnit?.toFixed(row.unit === "PIECES" ? 0 : 2)}{" "}
                            {row.unit === "PIECES" ? "pcs" : row.unit === "YARDS" ? "yd" : "m"}
                          </strong>
                          {selectedItem && (
                            <span className="text-zinc-600 font-normal">
                              {" "}(lot received: {selectedItem.measuredQty} {selectedItem.unit === "PIECES" ? "pcs" : selectedItem.unit === "YARDS" ? "yd" : "m"})
                            </span>
                          )}.
                        </div>
                      </div>
                    )}

                    {!isOverLot && isOverParty && (
                      <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>
                          {isPiecesRow
                            ? `Exceeds Party ${party?.name}'s available cut pieces custody (${party?.piecesBalance || 0} pcs).`
                            : `Exceeds Party ${party?.name}'s available continuous fabric custody (${party?.balance?.toFixed(2)}m).`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* FULL-WIDTH ADD LOT BUTTON BELOW LAST ROW */}
            <button
              type="button"
              onClick={addLotRow}
              className="w-full h-11 border-2 border-dashed border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50/80 rounded-lg text-xs font-semibold text-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-zinc-500" />
              <span>+ Add Item Row</span>
            </button>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100">
            <div className="text-xs text-zinc-500 font-mono">
              Total to Dispatch:{" "}
              <strong className="text-zinc-900">
                {totalContinuousMeters > 0 && `${totalContinuousMeters.toFixed(2)}m (≈ ${totalContinuousYards.toFixed(1)} yd)`}
                {totalContinuousMeters > 0 && totalPieces > 0 && " + "}
                {totalPieces > 0 && `${totalPieces.toLocaleString()} pcs`}
                {totalContinuousMeters === 0 && totalPieces === 0 && "0"}
              </strong>
            </div>

            <button
              type="submit"
              disabled={
                isDispatching ||
                hasOverbalanceError ||
                !vendorId ||
                (totalContinuousMeters <= 0 && totalPieces <= 0)
              }
              className="h-11 px-6 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-md text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDispatching ? (
                <span className="font-mono">ISSUING OGP...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    Issue Outward Gate Pass ({lotRows.length} Lot{lotRows.length > 1 ? "s" : ""})
                  </span>
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
                const isBatchPieces =
                  batch.itemCategory === "PIECES" || batch.unit === "PIECES";
                const unitText = isBatchPieces
                  ? "pcs"
                  : batch.unit === "YARDS"
                  ? "yd"
                  : "m";

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
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                              isBatchPieces
                                ? "bg-purple-100 text-purple-900 border-purple-200"
                                : "bg-zinc-100 text-zinc-800 border-zinc-200"
                            }`}
                          >
                            {isBatchPieces ? "Pieces" : "Continuous"}
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
                        <span className="text-sm font-bold text-zinc-950">
                          {isBatchPieces
                            ? `${Math.round(pending).toLocaleString()} pcs`
                            : batch.unit === "YARDS"
                            ? `${pending.toFixed(2)} yd`
                            : `${pending.toFixed(2)} m`}
                        </span>
                        {!isBatchPieces && (
                          <span className="text-[10px] text-zinc-500 block">
                            {batch.unit === "YARDS"
                              ? `≈ ${yardsToMeters(pending).toFixed(1)} m`
                              : `≈ ${metersToYards(pending).toFixed(1)} yd`}
                          </span>
                        )}
                      </div>
                    </div>

                    {isPartial && (
                      <div className="p-2 bg-white/80 rounded border border-amber-200/70 text-[11px] font-mono flex items-center justify-between text-zinc-700">
                        <span>
                          Cleared: {isBatchPieces ? Math.round(accounted) : accounted.toFixed(2)} /{" "}
                          {isBatchPieces ? Math.round(totalSent) : totalSent.toFixed(2)} {unitText}
                        </span>
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
                          const isBatchPieces =
                            batch.itemCategory === "PIECES" || batch.unit === "PIECES";
                          const remaining = Number(
                            (Number(batch.sentMeters) - Number(batch.accountedMeters || 0)).toFixed(2)
                          );
                          if (isBatchPieces) {
                            setReturnUnit("PIECES");
                            setAccountedQtyInput(Math.round(remaining).toString());
                          } else {
                            // Nothing selected by default; user must pick M or Yd
                            setReturnUnit("");
                            setAccountedQtyInput("");
                          }
                          setReceivedQtyInput("");
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
              {completedBatches.slice(0, 6).map((batch) => {
                const isBatchPieces =
                  batch.itemCategory === "PIECES" || batch.unit === "PIECES";
                const unitText = isBatchPieces
                  ? "pcs"
                  : batch.unit === "YARDS"
                  ? "yd"
                  : "m";

                return (
                  <div key={batch.id} className="pt-2.5 pb-2.5 flex flex-col space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-900">{batch.ogpNumber}</span>
                        {batch.inward?.partyChallanNo && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                            Ref: #{batch.inward.partyChallanNo}
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-50 border border-zinc-200 text-zinc-600">
                          {isBatchPieces ? "Pieces" : "Continuous"}
                        </span>
                      </div>
                      <div className="text-right font-mono font-bold text-zinc-900">
                        {isBatchPieces
                          ? `${Math.round(Number(batch.receivedMeters || 0))} pcs received`
                          : batch.unit === "YARDS"
                          ? `${Number(batch.receivedMeters || 0).toFixed(2)} yd received`
                          : `${Number(batch.receivedMeters || 0).toFixed(2)} m received`}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600 text-[11px]">
                      <span>
                        {batch.party.name} • {batch.targetShade} ({batch.vendor.name})
                      </span>
                      <span className="font-mono text-rose-700 font-medium">
                        Loss: -
                        {isBatchPieces
                          ? `${Math.round(Number(batch.shrinkageMeters || 0))} pcs`
                          : batch.unit === "YARDS"
                          ? `${Number(batch.shrinkageMeters || 0).toFixed(2)} yd (${Number(
                              batch.shrinkagePercent || 0
                            ).toFixed(2)}%)`
                          : `${Number(batch.shrinkageMeters || 0).toFixed(2)} m (${Number(
                              batch.shrinkagePercent || 0
                            ).toFixed(2)}%)`}
                      </span>
                    </div>

                    {batch.vendorChallanNo && (
                      <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                        <FileText className="w-3 h-3 text-zinc-400" />
                        <span>Dyer Delivery Slips: {batch.vendorChallanNo}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RECEIVE RETURN MODAL / DRAWER */}
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
                <span className="text-zinc-500 font-sans">Dispatched Unit:</span>
                <span className="font-bold text-zinc-900 uppercase">
                  {isReturnPieces ? "Cut Pieces (Pcs)" : `Continuous Fabric (${batchUnitLabel})`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Total Dispatched Lot:</span>
                <span className="font-bold text-zinc-900">
                  {isReturnPieces
                    ? `${Math.round(sentQtyBatchUnit)} pcs`
                    : `${sentQtyBatchUnit.toFixed(2)} ${batchUnitLabel}`}
                  {!isReturnPieces && (
                    <span className="text-zinc-500 font-normal text-[11px] ml-1">
                      {batchUnitLabel === "yd"
                        ? `(≈ ${yardsToMeters(sentQtyBatchUnit).toFixed(2)} m)`
                        : `(≈ ${metersToYards(sentQtyBatchUnit).toFixed(2)} yd)`}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-sans">Previously Accounted:</span>
                <span className="text-zinc-700">
                  {isReturnPieces
                    ? `${Math.round(prevAccountedBatchUnit)} pcs`
                    : `${prevAccountedBatchUnit.toFixed(2)} ${batchUnitLabel}`}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-zinc-200 font-bold">
                <span className="text-amber-800 font-sans">Remaining Pending with Dyer:</span>
                <span className="text-amber-900">
                  {isReturnPieces
                    ? `${Math.round(rawPendingBatchUnit)} pcs`
                    : `${rawPendingBatchUnit.toFixed(2)} ${batchUnitLabel}`}
                  {!isReturnPieces && (
                    <span className="text-amber-700/80 font-normal text-[11px] ml-1">
                      {batchUnitLabel === "yd"
                        ? `(≈ ${yardsToMeters(rawPendingBatchUnit).toFixed(2)} m)`
                        : `(≈ ${metersToYards(rawPendingBatchUnit).toFixed(2)} yd)`}
                    </span>
                  )}
                </span>
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

              {/* Dyer Delivery Slip Measurement Unit */}
              {!isReturnPieces ? (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Dyer Slip Measurement Unit *
                    </label>
                    <span className="text-[11px] font-mono text-amber-800">
                      Dispatched in: <strong className="uppercase">{batchUnitLabel}</strong>
                    </span>
                  </div>
                  <select
                    name="returnUnit"
                    required
                    value={returnUnit}
                    onChange={(e) =>
                      handleReturnUnitChange(e.target.value as "" | "METERS" | "YARDS")
                    }
                    className={`w-full h-11 px-3 bg-white border rounded-md text-sm font-semibold focus:outline-hidden focus:ring-2 ${
                      !returnUnit
                        ? "border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-500"
                        : "border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    }`}
                  >
                    <option value="">-- Please Select Slip Unit (M or Yd) --</option>
                    <option value="METERS">M (Meters) — Receiving physical slip in meters</option>
                    <option value="YARDS">Yd (Yards) — Receiving physical slip in yards</option>
                  </select>
                  {!returnUnit ? (
                    <p className="text-[11px] text-amber-800 font-medium">
                      ⚠️ Please select whether the Dyer's delivery challan is in Meters (M) or Yards (Yd) to proceed.
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-800 font-medium">
                      ✓ Active slip unit:{" "}
                      <strong className="uppercase font-bold">
                        {returnUnit === "YARDS" ? "Yards (yd)" : "Meters (m)"}
                      </strong>
                      {returnUnit !== activeReturnBatch.unit && (
                        <span className="ml-1 text-zinc-600 font-normal">
                          (System will auto-reconcile with {batchUnitLabel} dispatched)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <input type="hidden" name="returnUnit" value="PIECES" />
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    {isReturnPieces
                      ? "Dispatched Lot Pieces Accounted *"
                      : `Dispatched Lot Quantity Accounted ${returnUnitLabel ? `(${returnUnitLabel})` : ""} *`}
                  </label>
                  {(!isReturnPieces ? returnUnit : true) && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      Max Pending:{" "}
                      {isReturnPieces
                        ? `${Math.round(pendingQtyNum)} pcs`
                        : `${pendingQtyNum.toFixed(2)} ${returnUnitLabel}`}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step={isReturnPieces ? "1" : "0.01"}
                  name="accountedQty"
                  required
                  disabled={!isReturnPieces && !returnUnit}
                  min={isReturnPieces ? "1" : "0.01"}
                  max={pendingQtyNum > 0 ? pendingQtyNum : undefined}
                  inputMode="decimal"
                  value={accountedQtyInput}
                  onChange={(e) => setAccountedQtyInput(e.target.value)}
                  placeholder={
                    !isReturnPieces && !returnUnit
                      ? "Select Slip Unit (M or Yd) first"
                      : undefined
                  }
                  className={`w-full h-11 px-3 bg-white border rounded-md text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 disabled:bg-zinc-100 disabled:text-zinc-400 ${
                    isOverPendingError
                      ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20"
                      : "border-zinc-300 focus:ring-zinc-900"
                  }`}
                />
                <span className="text-[11px] text-zinc-500 block mt-1">
                  {!isReturnPieces && !returnUnit
                    ? "Select measurement unit above to calculate max pending quantity."
                    : `Leave at ${
                        isReturnPieces
                          ? Math.round(pendingQtyNum)
                          : pendingQtyNum.toFixed(2)
                      } ${returnUnitLabel} for complete return, or enter smaller value for partial delivery.`}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    {isReturnPieces
                      ? "Physical Received Pieces (from Dyer Slip) *"
                      : `Physical Received Length ${returnUnitLabel ? `(${returnUnitLabel})` : ""} *`}
                  </label>
                  {receivedQtyNum > 0 && !isReturnPieces && returnUnit && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      {returnUnitLabel === "m"
                        ? `≈ ${metersToYards(receivedQtyNum).toFixed(1)} yd`
                        : `≈ ${yardsToMeters(receivedQtyNum).toFixed(1)} m`}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step={isReturnPieces ? "1" : "0.01"}
                  name="receivedQty"
                  required
                  disabled={!isReturnPieces && !returnUnit}
                  min={isReturnPieces ? "1" : "0.01"}
                  inputMode="decimal"
                  value={receivedQtyInput}
                  onChange={(e) => setReceivedQtyInput(e.target.value)}
                  placeholder={
                    !isReturnPieces && !returnUnit
                      ? "Select Slip Unit (M or Yd) first"
                      : isReturnPieces
                      ? "e.g. 495"
                      : `e.g. ${returnUnit === "YARDS" ? "2150.00" : "2000.00"}`
                  }
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </div>

              {receivedQtyNum > 0 && (isReturnPieces || returnUnit) && (
                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-md text-xs space-y-1.5">
                  <div className="flex justify-between font-mono">
                    <span className="text-rose-800 font-medium">
                      {isReturnPieces ? "Vendor Loss / Damaged:" : "Technical Shrinkage Loss:"}
                    </span>
                    <span className="font-bold text-rose-900">
                      -{isReturnPieces ? `${Math.round(calculatedShrinkage)} pcs` : `${calculatedShrinkage.toFixed(2)} ${returnUnitLabel}`}
                    </span>
                  </div>
                  {!isReturnPieces && (
                    <div className="flex justify-between font-mono">
                      <span className="text-rose-800 font-medium">Shrinkage Rate:</span>
                      <span className="font-bold text-rose-900">{calculatedPercent.toFixed(2)}%</span>
                    </div>
                  )}
                  <div className="pt-1.5 border-t border-rose-200/60 flex justify-between font-mono">
                    <span className="text-zinc-700 font-sans">Batch Status After Delivery:</span>
                    <span
                      className={`font-bold ${
                        remainingAfterThisDelivery <= 0.05 ? "text-emerald-700" : "text-blue-700"
                      }`}
                    >
                      {remainingAfterThisDelivery <= 0.05
                        ? "RECEIVED_COMPLETE (0 remaining)"
                        : `RECEIVED_PARTIAL (${isReturnPieces ? Math.round(remainingAfterThisDelivery) : remainingAfterThisDelivery.toFixed(2)} ${returnUnitLabel} left)`}
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
                  placeholder="e.g. Received partial delivery on truck #LES-421"
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={
                    isReturning ||
                    (!isReturnPieces && !returnUnit) ||
                    isOverPendingError ||
                    receivedQtyNum <= 0 ||
                    accountedQtyNum <= 0
                  }
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