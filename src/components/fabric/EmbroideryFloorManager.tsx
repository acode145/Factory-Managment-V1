"use client";

import { useActionState, useState, useEffect, useMemo } from "react";
import {
  createDepartmentTransferAction,
  acceptDepartmentTransferAction,
  rejectDepartmentTransferAction,
  deleteDepartmentTransferAction,
  TransferActionState,
} from "@/actions/transfer";
import {
  Cpu,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Building2,
  Search,
  Trash2,
  Lock,
  Clock,
  XCircle,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { PartyOption, InwardLotOption, TransferLogItem } from "./WorkstationManager";
import { formatPakistanDate } from "@/lib/dateUtils";

export default function EmbroideryFloorManager({
  parties = [],
  inwards = [],
  transfers = [],
  batches = [],
  currentUser,
}: {
  parties?: PartyOption[];
  inwards?: InwardLotOption[];
  transfers?: TransferLogItem[];
  batches?: any[];
  currentUser?: {
    role: string;
    department?: string | null;
  };
}) {
  const safeParties = useMemo(() => (Array.isArray(parties) ? parties : []), [parties]);
  const safeInwards = useMemo(() => (Array.isArray(inwards) ? inwards : []), [inwards]);
  const safeTransfers = useMemo(() => (Array.isArray(transfers) ? transfers : []), [transfers]);

  const [state, formAction, isPending] = useActionState<TransferActionState, FormData>(
    createDepartmentTransferAction,
    {}
  );

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Party filter (or ALL)
  const [selectedPartyId, setSelectedPartyId] = useState<string>(safeParties[0]?.id || "");
  const [selectedLotKey, setSelectedLotKey] = useState<string>("");
  const [returnQty, setReturnQty] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [machineNum, setMachineNum] = useState("");
  const [operator, setOperator] = useState("");
  const [remarks, setRemarks] = useState("");

  const [searchLog, setSearchLog] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!selectedPartyId && safeParties.length > 0) {
      setSelectedPartyId(safeParties[0].id);
    }
  }, [safeParties, selectedPartyId]);

  // All transfers involving Embroidery
  const embroideryTransfers = useMemo(() => {
    return safeTransfers.filter(
      (t) => t && (t.fromDepartment === "EMBROIDERY" || t.toDepartment === "EMBROIDERY")
    );
  }, [safeTransfers]);

  // 1. Inbound transfers from Store waiting for physical count & acceptance by Embroidery
  const pendingInboundFromStore = useMemo(() => {
    return embroideryTransfers.filter(
      (t) => t.toDepartment === "EMBROIDERY" && t.status === "PENDING"
    );
  }, [embroideryTransfers]);

  // 2. Outbound transfers sent from Embroidery to Store waiting for Storekeeper acceptance
  const pendingOutboundToStore = useMemo(() => {
    return embroideryTransfers.filter(
      (t) => t.fromDepartment === "EMBROIDERY" && t.status === "PENDING"
    );
  }, [embroideryTransfers]);

  // 3. Compute active floor custody lots inside Embroidery (accepted into Embroidery, minus dispatched out)
  interface FloorLotItem {
    key: string;
    partyId: string;
    partyName: string;
    inwardId?: string | null;
    inwardItemId?: string | null;
    partyChallanNo: string;
    fabricDescription: string;
    unit: string;
    totalAcceptedIn: number;
    totalDispatchedOut: number;
    currentBalance: number;
  }

  const floorLots = useMemo(() => {
    const lotMap = new Map<string, FloorLotItem>();

    for (const t of embroideryTransfers) {
      if (t.status === "REJECTED") continue;

      const key = `${t.partyId}_${t.inwardItemId || t.inwardId || t.fabricDescription}`;
      let item = lotMap.get(key);
      if (!item) {
        item = {
          key,
          partyId: t.partyId,
          partyName: t.party?.name || "Party",
          inwardId: t.inwardId,
          inwardItemId: t.inwardItemId,
          partyChallanNo: t.inward?.partyChallanNo || "-",
          fabricDescription: t.fabricDescription,
          unit: t.unit || "METERS",
          totalAcceptedIn: 0,
          totalDispatchedOut: 0,
          currentBalance: 0,
        };
        lotMap.set(key, item);
      }

      const q = Number(t.quantity);

      // Only count as IN if ACCEPTED by Embroidery
      if (t.toDepartment === "EMBROIDERY" && t.status === "ACCEPTED") {
        item.totalAcceptedIn += q;
      }

      // Count as OUT if dispatched (PENDING or ACCEPTED) out of Embroidery
      if (t.fromDepartment === "EMBROIDERY" && t.status !== "REJECTED") {
        item.totalDispatchedOut += q;
      }

      item.currentBalance = Math.max(0, Number((item.totalAcceptedIn - item.totalDispatchedOut).toFixed(2)));
    }

    return Array.from(lotMap.values()).filter((l) => l.currentBalance > 0);
  }, [embroideryTransfers]);

  // Total floor balance
  const totalFloorMeters = useMemo(() => {
    return floorLots.reduce((sum, l) => sum + (l.unit !== "PIECES" ? l.currentBalance : 0), 0);
  }, [floorLots]);

  const totalFloorPieces = useMemo(() => {
    return floorLots.reduce((sum, l) => sum + (l.unit === "PIECES" ? l.currentBalance : 0), 0);
  }, [floorLots]);

  // Selected floor lot for returning to store
  const selectedFloorLot = floorLots.find((l) => l.key === selectedLotKey);
  const maxAvailableToReturn = selectedFloorLot?.currentBalance || 0;
  const numReturnQty = parseFloat(returnQty) || 0;
  const isReturnOverQty = numReturnQty > maxAvailableToReturn;
  const isReturnFormValid =
    Boolean(selectedFloorLot) &&
    numReturnQty > 0 &&
    numReturnQty <= maxAvailableToReturn;

  // Single-Click Confirm & Accept
  const handleConfirmAccept = async (transferId: string, transferNo: string) => {
    setAcceptingId(transferId);
    setActionFeedback(null);
    try {
      const res = await acceptDepartmentTransferAction(transferId);
      if (res.error) {
        setActionFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setActionFeedback({ type: "success", text: res.message });
      }
    } finally {
      setAcceptingId(null);
    }
  };

  // Reject with reason prompt
  const handleReject = async (transferId: string, transferNo: string) => {
    const reason = window.prompt(`Enter reason for rejecting transfer #${transferNo} (material will return to sender):`);
    if (reason === null) return; // user cancelled

    setRejectingId(transferId);
    setActionFeedback(null);
    try {
      const res = await rejectDepartmentTransferAction(transferId, reason);
      if (res.error) {
        setActionFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setActionFeedback({ type: "success", text: res.message });
      }
    } finally {
      setRejectingId(null);
    }
  };

  const handleDeleteTransfer = async (id: string, transferNo: string) => {
    if (
      !window.confirm(
        `Are you sure you want to void transfer #${transferNo}? Material will return to sender.`
      )
    ) {
      return;
    }
    setDeletePendingId(id);
    setActionFeedback(null);
    try {
      const res = await deleteDepartmentTransferAction(id);
      if (res.error) {
        setActionFeedback({ type: "error", text: res.error });
      } else if (res.message) {
        setActionFeedback({ type: "success", text: res.message });
      }
    } finally {
      setDeletePendingId(null);
    }
  };

  // Reset form on success
  useEffect(() => {
    if (state?.success) {
      setReturnQty("");
      setSelectedLotKey("");
      setMachineNum("");
      setOperator("");
      setRemarks("");
    }
  }, [state]);

  // Filtered audit log
  const filteredLog = useMemo(() => {
    return embroideryTransfers.filter((t) => {
      if (statusFilter !== "ALL" && (t.status || "ACCEPTED") !== statusFilter) {
        return false;
      }
      const q = searchLog.toLowerCase().trim();
      if (!q) return true;
      return (
        (t.transferNumber && t.transferNumber.toLowerCase().includes(q)) ||
        (t.fabricDescription && t.fabricDescription.toLowerCase().includes(q)) ||
        (t.party?.name && t.party.name.toLowerCase().includes(q)) ||
        (t.operatorName && t.operatorName.toLowerCase().includes(q)) ||
        (t.machineNumber && t.machineNumber.toLowerCase().includes(q))
      );
    });
  }, [embroideryTransfers, statusFilter, searchLog]);

  return (
    <div className="space-y-6">
      {/* Top Banner Feedback */}
      {(state?.message || actionFeedback?.text) && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 shadow-xs ${
            actionFeedback?.type === "error" || state?.error
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          {actionFeedback?.type === "error" || state?.error ? (
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          )}
          <span className="font-semibold">{actionFeedback?.text || state?.message || state?.error}</span>
        </div>
      )}

      {/* TOP HEADER & EMBROIDERY KPI SUMMARY */}
      <div className="bg-zinc-950 text-white rounded-xl p-5 shadow-xs border border-zinc-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-wide">
                  Embroidery Floor Management
                </h1>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                  Two-Way Handshake Mode
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Store-to-floor physical intake, active floor custody, and returns to Store
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              Department: EMBROIDERY
            </span>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Card 1: Active Accepted Floor Custody */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3.5 space-y-1">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
              Active Floor Custody
            </span>
            <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
              <span>{totalFloorMeters.toFixed(2)}</span>
              <span className="text-xs font-sans text-zinc-400 font-normal">Meters</span>
              {totalFloorPieces > 0 && (
                <span className="text-xs font-mono text-zinc-400 ml-2">
                  (+{totalFloorPieces} pcs)
                </span>
              )}
            </div>
            <span className="text-[10px] text-emerald-400 block font-mono">
              {floorLots.length} Lot(s) accepted and in custody
            </span>
          </div>

          {/* Card 2: Pending Inbound from Store */}
          <div className={`rounded-lg p-3.5 space-y-1 border ${
            pendingInboundFromStore.length > 0
              ? "bg-amber-950/40 border-amber-800/80 text-amber-200"
              : "bg-zinc-900/90 border-zinc-800 text-zinc-400"
          }`}>
            <span className="text-[11px] font-mono uppercase tracking-wider block">
              Pending Inbound Intake
            </span>
            <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
              <span>{pendingInboundFromStore.length}</span>
              <span className="text-xs font-sans font-normal text-zinc-400">Transfers</span>
            </div>
            <span className={`text-[10px] font-mono block ${
              pendingInboundFromStore.length > 0 ? "text-amber-400 font-bold" : "text-zinc-500"
            }`}>
              {pendingInboundFromStore.length > 0
                ? "Physical count & acceptance required below"
                : "No pending arrivals from Store"}
            </span>
          </div>

          {/* Card 3: Outbound In-Transit to Store */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-3.5 space-y-1">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
              In-Transit Back to Store
            </span>
            <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
              <span>{pendingOutboundToStore.length}</span>
              <span className="text-xs font-sans font-normal text-zinc-400">Transfers</span>
            </div>
            <span className="text-[10px] text-zinc-400 block font-mono">
              Awaiting Storekeeper intake acceptance
            </span>
          </div>
        </div>
      </div>

      {/* 1. PENDING INBOUND INTAKE FROM STORE (TWO-WAY HANDSHAKE GATE) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <span>Inbound Physical Intake from Store</span>
                {pendingInboundFromStore.length > 0 && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                    {pendingInboundFromStore.length} Awaiting Acceptance
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-500">
                Verify rolls and measurements on arrival, then click Confirm & Accept to officially take into embroidery custody
              </p>
            </div>
          </div>
        </div>

        {pendingInboundFromStore.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs">
            No incoming fabric transfers from Store currently awaiting acceptance.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingInboundFromStore.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-zinc-950 bg-white px-2 py-0.5 rounded border border-zinc-200">
                        {t.transferNumber}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {formatPakistanDate(t.transferDate)}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-zinc-900 mt-1">
                      {t.party?.name || "Party"}
                    </div>
                    {t.inward?.partyChallanNo && (
                      <div className="text-xs font-mono text-zinc-600">
                        Challan #{t.inward.partyChallanNo}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                      PENDING INTAKE
                    </span>
                    <div className="text-lg font-bold font-mono text-zinc-950 mt-1">
                      {Number(t.quantity).toFixed(2)} {t.unit === "PIECES" ? "pcs" : "m"}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-700 bg-white p-2.5 rounded-lg border border-amber-100">
                  <div className="font-medium">{t.fabricDescription}</div>
                  <div className="text-[11px] text-zinc-500 mt-1 flex flex-wrap gap-2">
                    {t.transferredBy?.fullName && (
                      <span>Dispatched by: <strong>{t.transferredBy.fullName}</strong></span>
                    )}
                    {t.remarks && <span>Notes: <em>"{t.remarks}"</em></span>}
                  </div>
                </div>

                {/* Handshake Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={acceptingId === t.id || rejectingId === t.id}
                    onClick={() => handleConfirmAccept(t.id, t.transferNumber)}
                    className="flex-1 h-10 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {acceptingId === t.id ? (
                      <span>Accepting...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Confirm & Accept</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={acceptingId === t.id || rejectingId === t.id}
                    onClick={() => handleReject(t.id, t.transferNumber)}
                    className="h-10 px-3 rounded-lg border border-zinc-300 hover:border-rose-300 hover:bg-rose-50 text-zinc-700 hover:text-rose-700 text-xs font-medium cursor-pointer transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. ACTIVE EMBROIDERY FLOOR CUSTODY (ACCEPTED LOTS READY FOR PRODUCTION) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Active Embroidery Floor Custody</h2>
              <p className="text-xs text-zinc-500">Fabric accepted into room and currently available for machine runs</p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold bg-zinc-100 px-2.5 py-1 rounded text-zinc-700 self-start sm:self-auto">
            {floorLots.length} Active Lots
          </span>
        </div>

        {floorLots.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs">
            No fabric lots currently residing in embroidery custody. Accept inbound fabric from Store above to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono bg-zinc-50/50">
                  <th className="py-2.5 px-3">Party & Lot</th>
                  <th className="py-2.5 px-3">Fabric Specification</th>
                  <th className="py-2.5 px-3 text-right">Total Accepted In</th>
                  <th className="py-2.5 px-3 text-right">Dispatched Out</th>
                  <th className="py-2.5 px-3 text-right">Available in Room</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {floorLots.map((lot) => (
                  <tr key={lot.key} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-zinc-900">{lot.partyName}</div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        Challan #{lot.partyChallanNo}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-zinc-800 font-medium">{lot.fabricDescription}</span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-zinc-600">
                      {lot.totalAcceptedIn.toFixed(2)} {lot.unit === "PIECES" ? "pcs" : "m"}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-zinc-500">
                      {lot.totalDispatchedOut.toFixed(2)} {lot.unit === "PIECES" ? "pcs" : "m"}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className="font-mono font-bold text-sm text-zinc-950 bg-emerald-50 text-emerald-950 px-2 py-0.5 rounded border border-emerald-200">
                        {lot.currentBalance.toFixed(2)} {lot.unit === "PIECES" ? "pcs" : "m"}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLotKey(lot.key);
                          setReturnQty(lot.currentBalance.toString());
                        }}
                        className="h-7 px-2.5 rounded text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 transition-colors cursor-pointer"
                      >
                        Return to Store
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. DISPATCH EMBROIDERED FABRIC BACK TO STORE (OUTBOUND HANDOVER) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">Dispatch Embroidered Fabric to Store</h2>
              <p className="text-xs text-zinc-500">
                Send completed fabric back to Raw Store. Storekeeper will verify and accept into Store inventory.
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
            Route: EMBROIDERY → STORE
          </span>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="fromDepartment" value="EMBROIDERY" />
          <input type="hidden" name="toDepartment" value="STORE" />
          <input type="hidden" name="partyId" value={selectedFloorLot?.partyId || ""} />
          <input type="hidden" name="inwardId" value={selectedFloorLot?.inwardId || ""} />
          <input type="hidden" name="inwardItemId" value={selectedFloorLot?.inwardItemId || ""} />
          <input type="hidden" name="fabricDescription" value={selectedFloorLot?.fabricDescription || "Embroidered Fabric"} />
          <input type="hidden" name="unit" value={selectedFloorLot?.unit || "METERS"} />
          <input type="hidden" name="transferDate" value={transferDate} />

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* LOT SELECTOR */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Select Floor Fabric Lot *
              </label>
              <select
                required
                value={selectedLotKey}
                onChange={(e) => {
                  setSelectedLotKey(e.target.value);
                  const found = floorLots.find((l) => l.key === e.target.value);
                  if (found) {
                    setReturnQty(found.currentBalance.toString());
                  } else {
                    setReturnQty("");
                  }
                }}
                className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">-- Choose Floor Lot to Return --</option>
                {floorLots.map((lot) => (
                  <option key={lot.key} value={lot.key}>
                    {lot.partyName} • {lot.fabricDescription} ({lot.currentBalance.toFixed(1)} {lot.unit === "PIECES" ? "pcs" : "m"} available)
                  </option>
                ))}
              </select>
            </div>

            {/* RETURN QUANTITY */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  Quantity to Dispatch *
                </label>
                {maxAvailableToReturn > 0 && (
                  <button
                    type="button"
                    onClick={() => setReturnQty(maxAvailableToReturn.toString())}
                    className="text-[10px] font-mono text-zinc-600 hover:text-zinc-950 underline cursor-pointer"
                  >
                    Send All ({maxAvailableToReturn.toFixed(1)})
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                name="quantity"
                required
                disabled={!selectedFloorLot}
                value={returnQty}
                onChange={(e) => setReturnQty(e.target.value)}
                placeholder={selectedFloorLot ? `Max ${maxAvailableToReturn.toFixed(2)}` : "Select lot first"}
                className={`w-full h-10 px-3 bg-white border rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 disabled:bg-zinc-50 ${
                  isReturnOverQty
                    ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20 text-rose-950"
                    : "border-zinc-300 focus:ring-zinc-900"
                }`}
              />
              {isReturnOverQty && (
                <p className="text-[10px] text-rose-600 font-medium mt-1">
                  Exceeds active embroidery balance ({maxAvailableToReturn.toFixed(2)} {selectedFloorLot?.unit === "PIECES" ? "pcs" : "m"}).
                </p>
              )}
            </div>

            {/* DATE */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Handover Date *
              </label>
              <input
                type="date"
                required
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          {/* METADATA (3 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1">
                Machine # <span className="font-normal lowercase text-zinc-400">(optional)</span>
              </label>
              <input
                type="text"
                name="machineNumber"
                value={machineNum}
                onChange={(e) => setMachineNum(e.target.value)}
                placeholder="e.g. Tajima 02"
                className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1">
                Operator / Floor Supervisor <span className="font-normal lowercase text-zinc-400">(optional)</span>
              </label>
              <input
                type="text"
                name="operatorName"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="e.g. Aslam Khan"
                className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1">
                Batch Notes <span className="font-normal lowercase text-zinc-400">(optional)</span>
              </label>
              <input
                type="text"
                name="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Embroidered with golden zari thread"
                className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isReturnFormValid || isPending}
              className={`w-full h-12 rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs transition-all flex items-center justify-center gap-2 ${
                !isReturnFormValid || isPending
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300"
                  : "bg-zinc-950 hover:bg-zinc-800 text-white cursor-pointer"
              }`}
            >
              {isPending ? (
                <span>Dispatching Handover...</span>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                  <span>Dispatch to Store (Awaiting Storekeeper Acceptance)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 4. OUTBOUND IN-TRANSIT TO STORE */}
      {pendingOutboundToStore.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-zinc-950">
                Dispatched Transfers Awaiting Storekeeper Acceptance ({pendingOutboundToStore.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Material is in transit until accepted by Store
            </span>
          </div>

          <div className="space-y-2">
            {pendingOutboundToStore.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-lg border border-amber-200 bg-amber-50/30 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200">
                    {t.transferNumber}
                  </span>
                  <div>
                    <span className="font-semibold text-zinc-900">{t.party?.name}</span>
                    <span className="text-zinc-500 ml-2">({t.fabricDescription})</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-zinc-900">
                    {Number(t.quantity).toFixed(2)} {t.unit === "PIECES" ? "pcs" : "m"}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                    WAITING STORE INTAKE
                  </span>
                  <button
                    type="button"
                    title="Void Transfer"
                    disabled={deletePendingId === t.id}
                    onClick={() => handleDeleteTransfer(t.id, t.transferNumber)}
                    className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. EMBROIDERY AUDIT & TRANSFER HISTORY LOG */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Embroidery Handshake & Transfer Audit Log</h3>
            <p className="text-xs text-zinc-500">
              Complete historical record of Store ↔ Embroidery handovers, physical intake confirmations, and return dispatches
            </p>
          </div>

          <span className="text-xs font-mono font-bold bg-zinc-100 px-2.5 py-1 rounded text-zinc-700">
            {filteredLog.length} Records
          </span>
        </div>

        {/* Filter Toolbar: Status Tabs & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {["ALL", "ACCEPTED", "PENDING", "REJECTED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === st
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {st === "ALL" ? "All Statuses" : st}
              </button>
            ))}
          </div>

          <div className="relative min-w-[260px]">
            <input
              type="text"
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              placeholder="Search transfer #, party, operator, machine..."
              className="w-full h-9 pl-8 pr-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            />
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          {filteredLog.length === 0 ? (
            <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs">
              No embroidery transfers match your filter criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono bg-zinc-50/50">
                  <th className="py-2.5 px-3">Transfer # & Date</th>
                  <th className="py-2.5 px-3">Party & Lot</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Fabric Specification</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Acceptance / Signoff</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLog.map((t) => {
                  const isAccepted = (t.status || "ACCEPTED") === "ACCEPTED";
                  const isPendingStatus = t.status === "PENDING";
                  const isRejected = t.status === "REJECTED";

                  return (
                    <tr key={t.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-zinc-900">{t.transferNumber}</div>
                        <div className="text-[10px] font-mono text-zinc-400">
                          {formatPakistanDate(t.transferDate)}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-900">{t.party?.name || "Party"}</div>
                        {t.inward?.partyChallanNo && (
                          <div className="text-[10px] font-mono text-zinc-500">
                            Challan #{t.inward.partyChallanNo}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold">
                          <span className={`px-2 py-0.5 rounded ${
                            t.fromDepartment === "EMBROIDERY" ? "bg-purple-100 text-purple-900" : "bg-zinc-100 text-zinc-700"
                          }`}>
                            {t.fromDepartment}
                          </span>
                          <ArrowRight className="w-3 h-3 text-zinc-400" />
                          <span className={`px-2 py-0.5 rounded ${
                            t.toDepartment === "EMBROIDERY" ? "bg-purple-100 text-purple-900" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}>
                            {t.toDepartment}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-zinc-700 block max-w-[180px] truncate">
                          {t.fabricDescription}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <span className="font-mono font-bold text-zinc-900">
                          {Number(t.quantity).toFixed(2)}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 ml-1">
                          {t.unit === "PIECES" ? "pcs" : "m"}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>ACCEPTED</span>
                          </span>
                        )}
                        {isPendingStatus && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>PENDING</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>REJECTED</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {isAccepted && t.acceptedBy?.fullName && (
                          <div className="text-[11px] text-zinc-700">
                            Accepted by <strong>{t.acceptedBy.fullName}</strong>
                          </div>
                        )}
                        {isRejected && t.rejectionReason && (
                          <div className="text-[11px] text-rose-700 italic">
                            "{t.rejectionReason}"
                          </div>
                        )}
                        {isPendingStatus && (
                          <span className="text-[10px] text-zinc-400 italic">
                            Waiting physical intake
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        {isPendingStatus && (
                          <button
                            type="button"
                            title="Void Transfer"
                            disabled={deletePendingId === t.id}
                            onClick={() => handleDeleteTransfer(t.id, t.transferNumber)}
                            className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
