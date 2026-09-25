"use client";

import { useActionState, useState, useEffect, useMemo } from "react";
import {
  createDepartmentTransferAction,
  deleteDepartmentTransferAction,
  acceptDepartmentTransferAction,
  rejectDepartmentTransferAction,
  TransferActionState,
} from "@/actions/transfer";
import {
  WORKSTATION_DEPARTMENTS,
  WorkstationDepartment,
} from "@/lib/workstations";
import DatePicker from "@/components/ui/DatePicker";
import { formatPakistanDate, getPakistanTodayIso } from "@/lib/dateUtils";
import {
  GitFork,
  ArrowRight,
  Package,
  Layers,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Building2,
  Search,
  Cpu,
  Sparkles,
  Trash2,
  Lock,
  Filter,
  Clock,
  XCircle,
  ArrowDownLeft,
} from "lucide-react";

export interface TransferLogItem {
  id: string;
  transferNumber: string;
  partyId: string;
  inwardId?: string | null;
  inwardItemId?: string | null;
  fabricDescription: string;
  unit: string;
  quantity: number;
  damagedQuantity: number;
  fromDepartment: string;
  toDepartment: string;
  machineNumber?: string | null;
  operatorName?: string | null;
  remarks?: string | null;
  status?: string;
  acceptedById?: string | null;
  acceptedAt?: string | Date | null;
  rejectionReason?: string | null;
  acceptedBy?: { fullName: string } | null;
  transferDate: string | Date;
  transferredBy?: { fullName: string } | null;
  party?: { name: string; code: string } | null;
  inward?: { partyChallanNo: string } | null;
}

export interface PartyOption {
  id: string;
  name: string;
  code: string;
  balance?: number;
  piecesBalance?: number;
}

export interface InwardLotOption {
  id: string;
  partyId: string;
  partyChallanNo: string;
  fabricType?: string | null;
  colorShade?: string | null;
  measuredMeters: number;
  availableMeters: number;
  items?: Array<{
    id: string;
    itemIndex: number;
    fabricType: string;
    colorShade: string;
    unit: string;
    rollCount: number;
    measuredQty: number;
    availableMeters?: number | null;
    availableQty?: number;
  }>;
}

const DEPT_ICONS: Record<WorkstationDepartment, any> = {
  STORE: Building2,
  EMBROIDERY: Cpu,
  CROPPING: Scissors,
  CUTTING: Layers,
  FINISHING: Sparkles,
  PACKAGING: Package,
};

const DEPT_LABELS: Record<WorkstationDepartment, string> = {
  STORE: "Raw & Fabric Store",
  EMBROIDERY: "Embroidery (Machines)",
  CROPPING: "Cropping (Trimming)",
  CUTTING: "Cutting & Panels",
  FINISHING: "Finishing & QC",
  PACKAGING: "Packaging & Boxes",
};

export const INTERNAL_WORKSTATION_DEPARTMENTS: WorkstationDepartment[] = [
  "STORE",
  "CROPPING",
  "CUTTING",
  "FINISHING",
  "PACKAGING",
];

export default function WorkstationManager({
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

  // Determine permissions based on user role and assigned department
  const isUnrestricted =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "FABRIC_PROCESSING_INCHARGE" ||
    !currentUser?.department;

  const userDept = (currentUser?.department as WorkstationDepartment) || null;

  const [state, formAction, isPending] = useActionState<TransferActionState, FormData>(
    createDepartmentTransferAction,
    {}
  );
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  const [selectedPartyId, setSelectedPartyId] = useState(safeParties[0]?.id || "");
  const [selectedInwardId, setSelectedInwardId] = useState("");
  const [selectedInwardItemId, setSelectedInwardItemId] = useState("");

  // Initialize fromDept based on user role
  const [fromDept, setFromDept] = useState<WorkstationDepartment>(() => {
    if (!isUnrestricted && userDept && INTERNAL_WORKSTATION_DEPARTMENTS.includes(userDept)) {
      return userDept;
    }
    return "STORE";
  });

  // Initialize toDept ensuring it is different from fromDept
  const [toDept, setToDept] = useState<WorkstationDepartment>(() => {
    const initialFrom =
      !isUnrestricted && userDept && INTERNAL_WORKSTATION_DEPARTMENTS.includes(userDept)
        ? userDept
        : "STORE";
    return INTERNAL_WORKSTATION_DEPARTMENTS.find((d) => d !== initialFrom) || "CROPPING";
  });

  const [transferQty, setTransferQty] = useState("");
  const [fabricDesc, setFabricDesc] = useState("");
  const [activeUnit, setActiveUnit] = useState<"METERS" | "YARDS" | "PIECES">("METERS");
  const [transferDate, setTransferDate] = useState(() => getPakistanTodayIso());
  const [searchLog, setSearchLog] = useState("");
  const [logDeptFilter, setLogDeptFilter] = useState<string>("ALL");

  // Keep fromDept locked for department incharges
  useEffect(() => {
    if (!isUnrestricted && userDept && INTERNAL_WORKSTATION_DEPARTMENTS.includes(userDept)) {
      setFromDept(userDept);
      if (toDept === userDept || (userDept !== "STORE" && toDept === "EMBROIDERY")) {
        const next = INTERNAL_WORKSTATION_DEPARTMENTS.find((d) => d !== userDept) || "STORE";
        setToDept(next);
      }
    }
  }, [isUnrestricted, userDept, toDept]);

  // Ensure toDept does not collide with fromDept or invalid destination
  const handleFromDeptChange = (newFrom: WorkstationDepartment) => {
    setFromDept(newFrom);
    if (newFrom === toDept || (newFrom !== "STORE" && toDept === "EMBROIDERY")) {
      const next = INTERNAL_WORKSTATION_DEPARTMENTS.find((d) => d !== newFrom) || "CROPPING";
      setToDept(next);
    }
  };

  // Allowed destination departments:
  // - If fromDept is STORE: internal departments (Cropping, Cutting, Finishing, Packaging) + EMBROIDERY
  // - If fromDept is NOT STORE: only other internal departments (only Store can send to Embroidery)
  const allowedToDepartments = useMemo(() => {
    const list: WorkstationDepartment[] = INTERNAL_WORKSTATION_DEPARTMENTS.filter((d) => d !== fromDept);
    if (fromDept === "STORE") {
      list.unshift("EMBROIDERY");
    }
    return list;
  }, [fromDept]);

  const handlePartyChange = (partyId: string) => {
    setSelectedPartyId(partyId);
    setSelectedInwardId("");
    setSelectedInwardItemId("");
    setFabricDesc("");
    setTransferQty("");
  };

  useEffect(() => {
    if (!selectedPartyId && safeParties.length > 0) {
      setSelectedPartyId(safeParties[0].id);
    }
  }, [safeParties, selectedPartyId]);

  const partyInwards = safeInwards.filter((i) => i && i.partyId === selectedPartyId);
  const currentInward = safeInwards.find((i) => i && i.id === selectedInwardId);
  const currentItem = currentInward?.items?.find((it) => it && it.id === selectedInwardItemId);

  // Active outsource batches tracking for selected inward or lot item
  const activeOutsourceBatches = useMemo(() => {
    if (!selectedInwardId && !selectedInwardItemId) return [];
    return (batches || []).filter((b: any) => {
      if (b.status !== "WITH_VENDOR" && b.status !== "RECEIVED_PARTIAL") return false;
      if (selectedInwardItemId && b.inwardItemId) {
        return b.inwardItemId === selectedInwardItemId;
      }
      if (selectedInwardId && b.inwardId) {
        return b.inwardId === selectedInwardId;
      }
      return false;
    });
  }, [batches, selectedInwardId, selectedInwardItemId]);

  const totalAtOutsource = useMemo(() => {
    return activeOutsourceBatches.reduce(
      (sum: number, b: any) => sum + (Number(b.sentMeters || 0) - Number(b.accountedMeters || 0)),
      0
    );
  }, [activeOutsourceBatches]);

  // Auto-fill fabric specification and unit when inward lot item changes
  const handleLotChange = (itemId: string) => {
    setSelectedInwardItemId(itemId);
    if (itemId && currentInward?.items) {
      const item = currentInward.items.find((it) => it && it.id === itemId);
      if (item) {
        setFabricDesc(`${item.fabricType} (${item.colorShade})`);
        setActiveUnit(
          item.unit === "PIECES"
            ? "PIECES"
            : item.unit === "YARDS"
            ? "YARDS"
            : "METERS"
        );
      }
    }
  };

  const handleInwardChange = (inwardId: string) => {
    setSelectedInwardId(inwardId);
    setSelectedInwardItemId("");
    if (inwardId) {
      const inv = safeInwards.find((i) => i && i.id === inwardId);
      if (inv?.items && inv.items.length === 1) {
        const it = inv.items[0];
        setSelectedInwardItemId(it.id);
        setFabricDesc(`${it.fabricType} (${it.colorShade})`);
        setActiveUnit(
          it.unit === "PIECES"
            ? "PIECES"
            : it.unit === "YARDS"
            ? "YARDS"
            : "METERS"
        );
      } else if (inv) {
        setFabricDesc(`${inv.fabricType || "Continuous Fabric"} (${inv.colorShade || "General"})`);
      }
    }
  };

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleConfirmAccept = async (transferId: string, transferNo: string) => {
    setAcceptingId(transferId);
    setActionFeedback(null);
    try {
      const res = await acceptDepartmentTransferAction(transferId);
      if (res.error) setActionFeedback({ type: "error", text: res.error });
      if (res.message) setActionFeedback({ type: "success", text: res.message });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (transferId: string, transferNo: string) => {
    const reason = window.prompt(`Enter reason for rejecting transfer #${transferNo} (material will return to sender):`);
    if (reason === null) return;
    setActionFeedback(null);
    try {
      const res = await rejectDepartmentTransferAction(transferId, reason);
      if (res.error) setActionFeedback({ type: "error", text: res.error });
      if (res.message) setActionFeedback({ type: "success", text: res.message });
    } catch (e: any) {
      setActionFeedback({ type: "error", text: e.message || "Failed to reject transfer." });
    }
  };

  const handleDeleteTransfer = async (id: string, transferNo: string) => {
    if (
      !window.confirm(
        `Are you sure you want to void transfer #${transferNo}? Material will return to the source workstation.`
      )
    ) {
      return;
    }
    setDeletePendingId(id);
    setActionFeedback(null);
    try {
      const res = await deleteDepartmentTransferAction(id);
      if (res?.error) {
        setActionFeedback({ type: "error", text: res.error });
      } else if (res?.message) {
        setActionFeedback({ type: "success", text: res.message });
      }
    } finally {
      setDeletePendingId(null);
    }
  };

  // Reset form on success
  useEffect(() => {
    if (state?.success) {
      setTransferQty("");
    }
  }, [state]);

  // Compute pending returns from Embroidery into Store awaiting Storekeeper acceptance
  const pendingInboundToStore = useMemo(() => {
    return safeTransfers.filter(
      (t) => t && t.toDepartment === "STORE" && t.status === "PENDING"
    );
  }, [safeTransfers]);

  // Compute live balance at each workstation for the active Party & Lot selection
  const deptBalances: Record<WorkstationDepartment, number> = {
    STORE: 0,
    EMBROIDERY: 0,
    CROPPING: 0,
    CUTTING: 0,
    FINISHING: 0,
    PACKAGING: 0,
  };

  // 1. Initial base store quantity from inward lot in factory custody
  let baseCustodyQty = 0;
  if (currentItem) {
    baseCustodyQty = Number(
      currentItem.availableQty !== undefined && currentItem.availableQty !== null
        ? currentItem.availableQty
        : currentItem.availableMeters || 0
    );
  } else if (currentInward) {
    baseCustodyQty = Number(currentInward.availableMeters || 0);
  }

  deptBalances.STORE = baseCustodyQty;

  // 2. Tally all historical transfers for this party & lot
  const relevantTransfers = safeTransfers.filter((t) => {
    if (!t) return false;
    if (t.partyId !== selectedPartyId) return false;
    if (selectedInwardItemId && t.inwardItemId !== selectedInwardItemId) return false;
    if (selectedInwardId && !selectedInwardItemId && t.inwardId !== selectedInwardId) return false;
    return true;
  });

  for (const t of relevantTransfers) {
    if (t.status === "REJECTED") continue;

    const q = Number(t.quantity);
    const d = Number(t.damagedQuantity || 0);
    const from = t.fromDepartment as WorkstationDepartment;
    const to = t.toDepartment as WorkstationDepartment;

    if (deptBalances[from] !== undefined) {
      deptBalances[from] = Math.max(0, Number((deptBalances[from] - q - d).toFixed(2)));
    }
    if (deptBalances[to] !== undefined && (t.status || "ACCEPTED") === "ACCEPTED") {
      deptBalances[to] = Number((deptBalances[to] + q).toFixed(2));
    }
  }

  const availableAtSource = deptBalances[fromDept] || 0;
  const numQty = parseFloat(transferQty) || 0;
  const isOverQty = numQty > availableAtSource && availableAtSource > 0;
  const isFormValid =
    Boolean(selectedPartyId) &&
    Boolean(selectedInwardId) &&
    fromDept !== toDept &&
    numQty > 0 &&
    numQty <= availableAtSource;

  // Filter transfers history:
  // - For Department Incharge: strictly scoped to transfers where fromDepartment === userDept || toDepartment === userDept
  // - For Admin / Fabric Incharge: scoped by logDeptFilter tab (ALL or specific department)
  // - Plus global text search query
  const filteredLog = useMemo(() => {
    return safeTransfers.filter((t) => {
      if (!t) return false;

      // Scoping rules
      if (!isUnrestricted && userDept) {
        if (t.fromDepartment !== userDept && t.toDepartment !== userDept) {
          return false;
        }
      } else if (logDeptFilter !== "ALL") {
        if (t.fromDepartment !== logDeptFilter && t.toDepartment !== logDeptFilter) {
          return false;
        }
      }

      // Search query filter
      const q = searchLog.toLowerCase().trim();
      if (!q) return true;
      return (
        (t.transferNumber && t.transferNumber.toLowerCase().includes(q)) ||
        (t.fabricDescription && t.fabricDescription.toLowerCase().includes(q)) ||
        (t.fromDepartment && t.fromDepartment.toLowerCase().includes(q)) ||
        (t.toDepartment && t.toDepartment.toLowerCase().includes(q)) ||
        (t.operatorName && t.operatorName.toLowerCase().includes(q)) ||
        (t.machineNumber && t.machineNumber.toLowerCase().includes(q)) ||
        (t.party?.name && t.party.name.toLowerCase().includes(q))
      );
    });
  }, [safeTransfers, isUnrestricted, userDept, logDeptFilter, searchLog]);

  return (
    <div className="space-y-6">
      {/* Top Banner Feedback */}
      {state?.message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-semibold">{state.message}</span>
        </div>
      )}

      {state?.error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2.5 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span className="font-semibold">{state.error}</span>
        </div>
      )}

      {/* 1. PIPELINE & ROOM BALANCES */}
      {isUnrestricted ? (
        // ADMIN & FABRIC INCHARGE VIEW: 6 Department Cards Grid
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <GitFork className="w-4 h-4 text-zinc-700" />
                <span>Live Workstation Pipeline & Room Balances</span>
              </h2>
              <p className="text-xs text-zinc-500">
                Plant-wide fabric inventory across internal workstations for:{" "}
                <strong className="text-zinc-800">
                  {safeParties.find((p) => p.id === selectedPartyId)?.name || "Client Party"}
                </strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {INTERNAL_WORKSTATION_DEPARTMENTS.map((dept) => {
              const Icon = DEPT_ICONS[dept];
              const qty = deptBalances[dept];
              const isSource = fromDept === dept;
              const isDest = toDept === dept;

              return (
                <div
                  key={dept}
                  onClick={() => handleFromDeptChange(dept)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-2xs space-y-1.5 ${
                    isSource
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                      : isDest
                      ? "bg-amber-50/70 border-amber-300 text-zinc-900"
                      : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                        isSource ? "text-zinc-300" : "text-zinc-500"
                      }`}
                    >
                      {dept}
                    </span>
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        isSource ? "text-emerald-400" : "text-zinc-400"
                      }`}
                    />
                  </div>

                  <div className="text-lg font-bold font-mono">
                    {qty.toFixed(2)}
                    <span
                      className={`text-xs ml-1 font-sans font-normal ${
                        isSource ? "text-zinc-300" : "text-zinc-500"
                      }`}
                    >
                      {activeUnit === "PIECES" ? "pcs" : activeUnit === "YARDS" ? "yd" : "m"}
                    </span>
                  </div>

                  <div
                    className={`text-[10px] truncate ${
                      isSource ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    {DEPT_LABELS[dept]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // DEPARTMENT INCHARGE VIEW: 1 Full-Width Live Room Card
        userDept && (
          <div className="bg-zinc-900 text-white rounded-xl p-5 shadow-xs border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400">
                  {(() => {
                    const DeptIcon = DEPT_ICONS[userDept] || Building2;
                    return <DeptIcon className="w-5 h-5" />;
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-wide">
                      {userDept} Room Custody & Balance
                    </h2>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Your Workstation
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{DEPT_LABELS[userDept]}</p>
                </div>
              </div>

              {/* Active Party Indicator */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs text-zinc-400 font-medium">Active Party:</span>
                <span className="text-xs font-semibold text-zinc-200 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                  {safeParties.find((p) => p.id === selectedPartyId)?.name || "Select in Form Below"}
                </span>
              </div>
            </div>

            {/* Room Balance & Context Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="bg-zinc-800/70 border border-zinc-700/60 rounded-lg p-3.5 space-y-1">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Available in Room
                </span>
                <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                  <span>{deptBalances[userDept].toFixed(2)}</span>
                  <span className="text-xs font-sans text-zinc-400 font-normal">
                    {activeUnit === "PIECES" ? "Pieces" : activeUnit === "YARDS" ? "Yards" : "Meters"}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 block font-mono">
                  Ready for handover / processing
                </span>
              </div>

              <div className="bg-zinc-800/70 border border-zinc-700/60 rounded-lg p-3.5 space-y-1">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Active Lot Selection
                </span>
                <div className="text-sm font-semibold text-zinc-200 truncate">
                  {currentInward ? `Challan #${currentInward.partyChallanNo}` : "No lot selected"}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {fabricDesc || "Select inward lot below"}
                </div>
              </div>

              <div className="bg-zinc-800/70 border border-zinc-700/60 rounded-lg p-3.5 space-y-1">
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                  Handover Authorization
                </span>
                <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Outbound origin locked to {userDept}</span>
                </div>
                <span className="text-[10px] text-zinc-400 block">
                  You can transfer material to any downstream workstation
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {/* PENDING INBOUND INTAKE FOR STORE (FROM EMBROIDERY) */}
      {(userDept === "STORE" || isUnrestricted) && pendingInboundToStore.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                  <span>Inbound Fabric from Embroidery Floor Pending Store Acceptance</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-bold">
                    {pendingInboundToStore.length} Pending
                  </span>
                </h3>
                <p className="text-xs text-amber-900">
                  Embroidery has finished work and returned fabric to Store. Click Confirm & Accept to officially add to Store inventory.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingInboundToStore.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-lg border border-amber-200 bg-white shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                      {t.transferNumber}
                    </span>
                    <div className="font-bold text-zinc-900 text-xs mt-1">
                      {t.party?.name} {t.inward?.partyChallanNo ? `• Challan #${t.inward.partyChallanNo}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-zinc-900 block">
                      {Number(t.quantity).toFixed(2)} {t.unit === "PIECES" ? "pcs" : "m"}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {formatPakistanDate(t.transferDate)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-zinc-700 bg-zinc-50 p-2 rounded border border-zinc-100 flex items-center justify-between">
                  <span className="truncate max-w-[200px]">{t.fabricDescription}</span>
                  {t.operatorName && (
                    <span className="text-[10px] text-zinc-500">Operator: {t.operatorName}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={acceptingId === t.id}
                    onClick={() => handleConfirmAccept(t.id, t.transferNumber)}
                    className="flex-1 h-9 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {acceptingId === t.id ? (
                      <span>Accepting...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Confirm & Accept into Store</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={acceptingId === t.id}
                    onClick={() => handleReject(t.id, t.transferNumber)}
                    className="h-9 px-3 rounded-lg border border-zinc-300 hover:border-rose-300 hover:bg-rose-50 text-zinc-700 hover:text-rose-700 text-xs font-medium cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. FULL-WIDTH HANDOVER FORM */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <GitFork className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950">Internal Department Handover</h3>
              <p className="text-xs text-zinc-500">Record room-to-room material movements on the factory floor</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isUnrestricted && userDept && (
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                Origin: {userDept}
              </span>
            )}
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="fabricDescription" value={fabricDesc || "General Fabric"} />
          <input type="hidden" name="unit" value={activeUnit} />

          {/* ROW 1: DATE, PARTY, CHALLAN & LOT ITEM (4 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. DATE SELECTOR (dd/mm/yyyy) */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Transfer Date *
              </label>
              <DatePicker
                name="transferDate"
                value={transferDate}
                onChange={(val) => setTransferDate(val)}
                required
                className="w-full"
              />
            </div>

            {/* 2. CLIENT PARTY */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Client Party *
              </label>
              <select
                name="partyId"
                required
                value={selectedPartyId}
                onChange={(e) => handlePartyChange(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">-- Select Party --</option>
                {safeParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. INWARD CHALLAN / ORIGINATING LOT */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Inward Challan / Originating Lot *
              </label>
              <select
                name="inwardId"
                required
                value={selectedInwardId}
                onChange={(e) => handleInwardChange(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">-- Select Inward Challan --</option>
                {partyInwards.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    Challan #{inv.partyChallanNo} ({inv.availableMeters.toFixed(1)}m in factory)
                  </option>
                ))}
              </select>
            </div>

            {/* 4. SPECIFIC LOT ITEM */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Specific Lot Item {currentInward && currentInward.items && currentInward.items.length > 1 ? "*" : "(Optional)"}
              </label>
              <select
                name="inwardItemId"
                disabled={!currentInward || !currentInward.items || currentInward.items.length <= 1}
                value={selectedInwardItemId}
                onChange={(e) => handleLotChange(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400"
              >
                <option value="">
                  {currentInward && currentInward.items && currentInward.items.length > 1
                    ? "-- Select Specific Lot Item --"
                    : currentInward
                    ? "Single continuous lot"
                    : "-- Select Challan First --"}
                </option>
                {currentInward?.items?.map((it) => (
                  <option key={it.id} value={it.id}>
                    Lot #{it.itemIndex + 1}: {it.fabricType} ({it.colorShade}) — Avail: {Number(it.availableQty || 0).toFixed(1)} {it.unit === "PIECES" ? "pcs" : "m"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Outsource Notice if fabric is currently at dyer/printer */}
          {totalAtOutsource > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs">
                  {totalAtOutsource.toFixed(1)}m Currently with Outsource Dyer/Printer
                </div>
                <p className="text-[11px] text-amber-800 leading-tight mt-0.5">
                  Fabric has been dispatched for external processing and is not in factory custody. Only fabric received back into factory can be transferred to internal workstations.
                </p>
              </div>
            </div>
          )}

          {/* ROW 2: ROUTING & QUANTITY (3 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50/70 rounded-xl border border-zinc-200">
            {/* 5. FROM DEPARTMENT */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                From Department *
              </label>
              {!isUnrestricted && userDept ? (
                // Locked for Department Incharge
                <div>
                  <div className="h-11 px-3 bg-zinc-100 border border-zinc-300 rounded-lg flex items-center justify-between text-xs font-bold text-zinc-900">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                      {userDept}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 font-normal">Locked</span>
                  </div>
                  <input type="hidden" name="fromDepartment" value={userDept} />
                </div>
              ) : (
                // Dropdown for Admin and Fabric Processing Incharge (5 Internal Departments)
                <select
                  name="fromDepartment"
                  value={fromDept}
                  onChange={(e) => handleFromDeptChange(e.target.value as WorkstationDepartment)}
                  className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                >
                  {INTERNAL_WORKSTATION_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept} ({deptBalances[dept].toFixed(1)})
                    </option>
                  ))}
                </select>
              )}
              <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                Available: <strong>{availableAtSource.toFixed(2)}</strong> {activeUnit === "PIECES" ? "pcs" : "m"}
              </span>
            </div>

            {/* 6. TO DEPARTMENT */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                To Department *
              </label>
              <select
                name="toDepartment"
                value={toDept}
                onChange={(e) => setToDept(e.target.value as WorkstationDepartment)}
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                {allowedToDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept} ({DEPT_LABELS[dept]})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                {toDept === "EMBROIDERY"
                  ? "Awaiting physical acceptance in Embroidery floor"
                  : "Receiving internal workstation"}
              </span>
            </div>

            {/* 7. QUANTITY */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                  Quantity *
                </label>
                {availableAtSource > 0 && (
                  <button
                    type="button"
                    onClick={() => setTransferQty(availableAtSource.toString())}
                    className="text-[10px] font-mono text-zinc-600 hover:text-zinc-950 underline cursor-pointer"
                  >
                    Move All ({availableAtSource.toFixed(1)})
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                name="quantity"
                required
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                placeholder={`Max ${availableAtSource.toFixed(2)}`}
                className={`w-full h-11 px-3 bg-white border rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 ${
                  isOverQty
                    ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20 text-rose-950"
                    : "border-zinc-300 focus:ring-zinc-900"
                }`}
              />
              {isOverQty && (
                <p className="text-[10px] text-rose-600 font-medium mt-1">
                  Exceeds balance ({availableAtSource.toFixed(2)} {activeUnit === "PIECES" ? "pcs" : "m"}) in {fromDept}.
                </p>
              )}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid || isPending}
              className={`w-full h-12 rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs transition-all flex items-center justify-center gap-2 ${
                !isFormValid || isPending
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300"
                  : "bg-zinc-950 hover:bg-zinc-800 text-white cursor-pointer"
              }`}
            >
              {isPending ? (
                <span>Recording Handover...</span>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                  <span>Transfer {fromDept} → {toDept}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 3. FULL-WIDTH TRANSFER ENTRIES LOG */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Internal Transfer Log</h3>
            <p className="text-xs text-zinc-500">
{!isUnrestricted && userDept
                ? `Showing inbound and outbound material movements for ${userDept} workstation`
                : "Chronological history of room-to-room material handovers across all workstations"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-zinc-100 px-2.5 py-1 rounded text-zinc-700">
              {filteredLog.length} Transfers
            </span>
          </div>
        </div>

        {/* Filter Toolbar: Department Pills (Admin/Fabric Incharge) & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Admin / Fabric Incharge Department Tabs */}
          {isUnrestricted ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setLogDeptFilter("ALL")}
                className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  logDeptFilter === "ALL"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                All Departments
              </button>
              {INTERNAL_WORKSTATION_DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setLogDeptFilter(dept)}
                  className={`h-8 px-2.5 rounded-lg text-xs font-mono whitespace-nowrap transition-colors cursor-pointer ${
                    logDeptFilter === dept
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          ) : (
            userDept && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200">
                  <Filter className="w-3.5 h-3.5 text-amber-700" />
                  <span>Scoped to: {userDept} Handover Log</span>
                </span>
              </div>
            )
          )}

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <input
              type="text"
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              placeholder="Search transfer #, party, lot, room, operator..."
              className="w-full h-9 pl-8 pr-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white"
            />
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Transfer Entries Table (Desktop >= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          {filteredLog.length === 0 ? (
            <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs">
              No workstation transfers match your current filter criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono bg-zinc-50/50">
                  <th className="py-2.5 px-3">Transfer # & Date</th>
                  <th className="py-2.5 px-3">Party & Lot</th>
                  <th className="py-2.5 px-3">Route (From → To)</th>
                  <th className="py-2.5 px-3">Fabric Specification</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Machine / Operator</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLog.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-zinc-900">{t.transferNumber}</div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {formatPakistanDate(t.transferDate)}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-zinc-900 truncate max-w-[160px]">
                        {t.party?.name || "Party"}
                      </div>
                      {t.inward?.partyChallanNo && (
                        <div className="text-[10px] font-mono text-zinc-500">
                          Challan #{t.inward.partyChallanNo}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                          {t.fromDepartment}
                        </span>
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {t.toDepartment}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-zinc-700 truncate block max-w-[180px]">
                        {t.fabricDescription}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className="font-mono font-bold text-zinc-900">
                        {Number(t.quantity).toFixed(2)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-1">
                        {t.unit === "PIECES" ? "pcs" : t.unit === "YARDS" ? "yd" : "m"}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {(!t.status || t.status === "ACCEPTED") && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>ACCEPTED</span>
                        </span>
                      )}
                      {t.status === "PENDING" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>PENDING</span>
                        </span>
                      )}
                      {t.status === "REJECTED" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>REJECTED</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-zinc-800 text-[11px]">
                        {t.operatorName || "-"}
                      </div>
                      {t.machineNumber && (
                        <div className="text-[10px] font-mono text-zinc-500">
                          {t.machineNumber}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-zinc-500 italic text-[11px] truncate block max-w-[160px]">
                        {t.remarks || "-"}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        title="Void Transfer"
                        disabled={deletePendingId === t.id}
                        onClick={() => handleDeleteTransfer(t.id, t.transferNumber)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Transfer Entries Cards (Mobile < 768px) */}
        <div className="block md:hidden space-y-3">
          {filteredLog.length === 0 ? (
            <div className="p-6 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs">
              No workstation transfers match your current filter.
            </div>
          ) : (
            filteredLog.map((t) => (
              <div
                key={t.id}
                className="p-3.5 border border-zinc-200 rounded-lg bg-white shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                      {t.transferNumber}
                    </span>
                    <span className="font-semibold text-zinc-800 truncate max-w-[160px]">
                      {t.party?.name || "Party"}
                    </span>
                  </div>
                  <button
                    type="button"
                    title="Void Transfer"
                    disabled={deletePendingId === t.id}
                    onClick={() => handleDeleteTransfer(t.id, t.transferNumber)}
                    className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                      {t.fromDepartment}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {t.toDepartment}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-zinc-900 text-xs">
                      {Number(t.quantity).toFixed(2)} {t.unit === "PIECES" ? "pcs" : t.unit === "YARDS" ? "yd" : "m"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span>{formatPakistanDate(t.transferDate)}</span>
                    {t.status === "PENDING" && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold">
                        PENDING
                      </span>
                    )}
                  </div>
                  <span>{t.operatorName ? `Operator: ${t.operatorName}` : ""}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
