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
  isCuttingTransformation?: boolean;
  piecesProduced?: number | null;
  scrapMeters?: number | null;
  scrapNotes?: string | null;
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

const DEPT_ICONS: Record<string, any> = {
  STORE: Building2,
  EMBROIDERY: Cpu,
  CROPPING_AND_CUTTING: Scissors,
  FINISHING_AND_PACKAGING: Sparkles,
  CROPPING: Scissors,
  CUTTING: Layers,
  FINISHING: Sparkles,
  PACKAGING: Package,
};

const DEPT_LABELS: Record<string, string> = {
  STORE: "Raw & Fabric Store",
  EMBROIDERY: "Embroidery Floor (Machines)",
  CROPPING_AND_CUTTING: "Cropping & Cutting (Prep & Tables)",
  FINISHING_AND_PACKAGING: "Finishing & Packaging (QC, Press & Packing)",
  CROPPING: "Cropping & Cutting",
  CUTTING: "Cropping & Cutting",
  FINISHING: "Finishing & Packaging",
  PACKAGING: "Finishing & Packaging",
};

export const INTERNAL_WORKSTATION_DEPARTMENTS: WorkstationDepartment[] = [
  "STORE",
  "CROPPING_AND_CUTTING",
  "FINISHING_AND_PACKAGING",
];

// Helper to normalize legacy department strings to the 2 consolidated floor rooms
export const normalizeDept = (dept: string): WorkstationDepartment => {
  if (dept === "CROPPING" || dept === "CUTTING") return "CROPPING_AND_CUTTING";
  if (dept === "FINISHING" || dept === "PACKAGING") return "FINISHING_AND_PACKAGING";
  return dept as WorkstationDepartment;
};

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

  const rawUserDept = currentUser?.department ? normalizeDept(currentUser.department) : null;
  const userDept = rawUserDept as WorkstationDepartment | null;

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
    return initialFrom === "STORE" ? "CROPPING_AND_CUTTING" : "FINISHING_AND_PACKAGING";
  });

  const [transferQty, setTransferQty] = useState("");
  const [fabricDesc, setFabricDesc] = useState("");
  const [activeUnit, setActiveUnit] = useState<"METERS" | "YARDS" | "PIECES">("METERS");
  const [transferDate, setTransferDate] = useState(() => getPakistanTodayIso());
  const [searchLog, setSearchLog] = useState("");
  const [logDeptFilter, setLogDeptFilter] = useState<string>("ALL");

  // Cutting Transformation mode state (Cropping & Cutting only)
  const [isCuttingMode, setIsCuttingMode] = useState(false);
  const [piecesProduced, setPiecesProduced] = useState("");
  const [scrapMeters, setScrapMeters] = useState("");
  const [scrapNotes, setScrapNotes] = useState("");

  // Keep fromDept locked for department incharges
  useEffect(() => {
    if (!isUnrestricted && userDept && INTERNAL_WORKSTATION_DEPARTMENTS.includes(userDept)) {
      setFromDept(userDept);
      if (toDept === userDept) {
        const next = userDept === "STORE" ? "CROPPING_AND_CUTTING" : userDept === "CROPPING_AND_CUTTING" ? "FINISHING_AND_PACKAGING" : "STORE";
        setToDept(next);
      }
    }
  }, [isUnrestricted, userDept, toDept]);

  // Ensure toDept updates sensibly when fromDept changes
  const handleFromDeptChange = (newFrom: WorkstationDepartment) => {
    setFromDept(newFrom);
    setIsCuttingMode(false);
    if (newFrom === "STORE") {
      setToDept("CROPPING_AND_CUTTING");
    } else if (newFrom === "CROPPING_AND_CUTTING") {
      setToDept("FINISHING_AND_PACKAGING");
    } else if (newFrom === "FINISHING_AND_PACKAGING") {
      setToDept("STORE");
    }
  };

  // Destination routing rules:
  // - STORE -> CROPPING_AND_CUTTING or EMBROIDERY
  // - CROPPING_AND_CUTTING -> FINISHING_AND_PACKAGING (or return to STORE)
  // - FINISHING_AND_PACKAGING -> STORE
  const allowedToDepartments = useMemo(() => {
    if (fromDept === "STORE") {
      return ["CROPPING_AND_CUTTING", "EMBROIDERY"] as WorkstationDepartment[];
    }
    if (fromDept === "CROPPING_AND_CUTTING") {
      if (isCuttingMode) {
        return ["FINISHING_AND_PACKAGING"] as WorkstationDepartment[];
      }
      return ["FINISHING_AND_PACKAGING", "STORE"] as WorkstationDepartment[];
    }
    if (fromDept === "FINISHING_AND_PACKAGING") {
      return ["STORE"] as WorkstationDepartment[];
    }
    return ["STORE"] as WorkstationDepartment[];
  }, [fromDept, isCuttingMode]);

  const handlePartyChange = (partyId: string) => {
    setSelectedPartyId(partyId);
    setSelectedInwardId("");
    setSelectedInwardItemId("");
    setFabricDesc("");
    setTransferQty("");
    setPiecesProduced("");
    setScrapMeters("");
    setScrapNotes("");
    setIsCuttingMode(false);
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
    setTransferQty("");
    setPiecesProduced("");
    setScrapMeters("");
    setScrapNotes("");
    setIsCuttingMode(false);
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
    setTransferQty("");
    setPiecesProduced("");
    setScrapMeters("");
    setScrapNotes("");
    setIsCuttingMode(false);
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
      if (res.success && res.message) setActionFeedback({ type: "success", text: res.message });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (transferId: string, transferNo: string) => {
    const reason = window.prompt(`Reject transfer #${transferNo}? Please state reason (e.g. quantity discrepancy, stained fabric):`);
    if (reason === null) return;
    setAcceptingId(transferId);
    setActionFeedback(null);
    try {
      const res = await rejectDepartmentTransferAction(transferId, reason);
      if (res.error) setActionFeedback({ type: "error", text: res.error });
      if (res.success && res.message) setActionFeedback({ type: "success", text: res.message });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeleteTransfer = async (id: string, transferNo: string) => {
    if (
      !window.confirm(
        `Are you sure you want to void transfer #${transferNo}? Material will return to the source workstation and customer ledger will update.`
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
      setPiecesProduced("");
      setScrapMeters("");
      setScrapNotes("");
      setIsCuttingMode(false);
    }
  }, [state]);

  // Compute pending returns from Embroidery into Store awaiting Storekeeper acceptance
  const pendingInboundToStore = useMemo(() => {
    return safeTransfers.filter(
      (t) => t && normalizeDept(t.toDepartment) === "STORE" && t.status === "PENDING"
    );
  }, [safeTransfers]);

  // Compute live balance (meters and pieces) at each workstation for the active Party & Lot selection
  interface DeptBalance {
    meters: number;
    pieces: number;
  }

  const deptBalances: Record<string, DeptBalance> = {
    STORE: { meters: 0, pieces: 0 },
    CROPPING_AND_CUTTING: { meters: 0, pieces: 0 },
    FINISHING_AND_PACKAGING: { meters: 0, pieces: 0 },
    EMBROIDERY: { meters: 0, pieces: 0 },
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

  const lotIsPieces = activeUnit === "PIECES" || currentItem?.unit === "PIECES";
  if (lotIsPieces) {
    deptBalances.STORE.pieces = baseCustodyQty;
  } else {
    deptBalances.STORE.meters = baseCustodyQty;
  }

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

    const from = normalizeDept(t.fromDepartment);
    const to = normalizeDept(t.toDepartment);
    const q = Number(t.quantity);
    const d = Number(t.damagedQuantity || 0);
    const isAccepted = (t.status || "ACCEPTED") === "ACCEPTED";

    if (t.isCuttingTransformation) {
      // Cutting table transformation:
      // Continuous roll meters leave CROPPING_AND_CUTTING
      if (deptBalances[from]) {
        deptBalances[from].meters = Math.max(0, Number((deptBalances[from].meters - q - d).toFixed(2)));
      }
      // Finished pieces enter FINISHING_AND_PACKAGING
      if (deptBalances[to] && isAccepted) {
        deptBalances[to].pieces = deptBalances[to].pieces + Number(t.piecesProduced || 0);
      }
    } else {
      // Standard transfer (either continuous meters or pieces)
      const isPcs = t.unit === "PIECES";
      if (deptBalances[from]) {
        if (isPcs) {
          deptBalances[from].pieces = Math.max(0, deptBalances[from].pieces - Math.round(q + d));
        } else {
          deptBalances[from].meters = Math.max(0, Number((deptBalances[from].meters - q - d).toFixed(2)));
        }
      }
      if (deptBalances[to] && isAccepted) {
        if (isPcs) {
          deptBalances[to].pieces = deptBalances[to].pieces + Math.round(q);
        } else {
          deptBalances[to].meters = Number((deptBalances[to].meters + q).toFixed(2));
        }
      }
    }
  }

  // Determine available stock and unit at the active fromDepartment
  const fromBal = deptBalances[fromDept] || { meters: 0, pieces: 0 };
  const isFinishingPieces = fromDept === "FINISHING_AND_PACKAGING" && fromBal.pieces > 0;
  const isStorePieces = fromDept === "STORE" && lotIsPieces;

  let availableAtSource = 0;
  let activeTransferUnit = activeUnit;

  if (isCuttingMode && fromDept === "CROPPING_AND_CUTTING") {
    availableAtSource = fromBal.meters;
    activeTransferUnit = activeUnit;
  } else if (isFinishingPieces) {
    availableAtSource = fromBal.pieces;
    activeTransferUnit = "PIECES";
  } else if (isStorePieces) {
    availableAtSource = fromBal.pieces;
    activeTransferUnit = "PIECES";
  } else {
    availableAtSource = fromBal.meters;
    activeTransferUnit = activeUnit;
  }

  const numQty = parseFloat(transferQty) || 0;
  const numPieces = parseInt(piecesProduced, 10) || 0;
  const numScrap = parseFloat(scrapMeters) || 0;

  const isOverQty = numQty > availableAtSource && availableAtSource > 0;

  const isFormValid = Boolean(selectedPartyId) && Boolean(selectedInwardId) && numQty > 0 && numQty <= availableAtSource && (
    isCuttingMode
      ? fromDept === "CROPPING_AND_CUTTING" && numPieces > 0 && (isNaN(numScrap) || (numScrap >= 0 && numScrap < numQty))
      : fromDept !== toDept
  );

  // Filter transfers history:
  // - Incharge scoped to their room
  // - Admin scoped by logDeptFilter tab
  // - Plus text search
  const filteredLog = useMemo(() => {
    return safeTransfers.filter((t) => {
      if (!t) return false;

      const normFrom = normalizeDept(t.fromDepartment);
      const normTo = normalizeDept(t.toDepartment);

      // Incharge scoping
      if (!isUnrestricted && userDept) {
        const normUser = normalizeDept(userDept);
        if (normFrom !== normUser && normTo !== normUser) {
          return false;
        }
      }

      // Admin tab filter
      if (isUnrestricted && logDeptFilter !== "ALL") {
        const normFilter = normalizeDept(logDeptFilter);
        if (normFrom !== normFilter && normTo !== normFilter) {
          return false;
        }
      }

      // Text search
      if (searchLog.trim()) {
        const q = searchLog.toLowerCase();
        const matchesNo = t.transferNumber?.toLowerCase().includes(q);
        const matchesParty = t.party?.name?.toLowerCase().includes(q) || t.party?.code?.toLowerCase().includes(q);
        const matchesLot = t.inward?.partyChallanNo?.toLowerCase().includes(q);
        const matchesFrom = t.fromDepartment?.toLowerCase().includes(q);
        const matchesTo = t.toDepartment?.toLowerCase().includes(q);
        const matchesOp = t.operatorName?.toLowerCase().includes(q);
        const matchesMachine = t.machineNumber?.toLowerCase().includes(q);
        const matchesRemarks = t.remarks?.toLowerCase().includes(q);
        const matchesFabric = t.fabricDescription?.toLowerCase().includes(q);
        return Boolean(
          matchesNo ||
            matchesParty ||
            matchesLot ||
            matchesFrom ||
            matchesTo ||
            matchesOp ||
            matchesMachine ||
            matchesRemarks ||
            matchesFabric
        );
      }

      return true;
    });
  }, [safeTransfers, isUnrestricted, userDept, logDeptFilter, searchLog]);

  return (
    <div className="space-y-6">
      {/* ACTION FEEDBACK ALERT */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between shadow-xs ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* FORM ACTION ERROR */}
      {state?.error && (
        <div className="p-4 rounded-xl border bg-rose-50 text-rose-900 border-rose-200 text-xs font-medium flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* 1. PIPELINE & ROOM BALANCES */}
      {isUnrestricted ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
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

          {/* 3 CONSOLIDATED WORKSTATIONS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {INTERNAL_WORKSTATION_DEPARTMENTS.map((dept) => {
              const Icon = DEPT_ICONS[dept] || Building2;
              const bal = deptBalances[dept] || { meters: 0, pieces: 0 };
              const isSource = fromDept === dept;
              const isDest = toDept === dept;

              return (
                <div
                  key={dept}
                  onClick={() => handleFromDeptChange(dept)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs space-y-2 ${
                    isSource
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900 ring-offset-2"
                      : isDest
                      ? "bg-amber-50/80 border-amber-300 text-zinc-900"
                      : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono uppercase tracking-wider font-bold ${
                        isSource ? "text-zinc-200" : "text-zinc-700"
                      }`}
                    >
                      {dept === "CROPPING_AND_CUTTING"
                        ? "Cropping & Cutting"
                        : dept === "FINISHING_AND_PACKAGING"
                        ? "Finishing & Packaging"
                        : "Store"}
                    </span>
                    <Icon
                      className={`w-4 h-4 ${
                        isSource ? "text-emerald-400" : "text-zinc-500"
                      }`}
                    />
                  </div>

                  {/* Quantity Display */}
                  <div className="space-y-0.5">
                    {bal.meters > 0 && (
                      <div className="text-xl font-bold font-mono">
                        {bal.meters.toFixed(2)}
                        <span
                          className={`text-xs ml-1 font-sans font-normal ${
                            isSource ? "text-zinc-300" : "text-zinc-500"
                          }`}
                        >
                          {activeUnit === "YARDS" ? "yd" : "m"}
                        </span>
                      </div>
                    )}
                    {bal.pieces > 0 && (
                      <div className={`text-xl font-bold font-mono ${bal.meters > 0 ? "text-emerald-400" : ""}`}>
                        {bal.pieces.toLocaleString()}
                        <span
                          className={`text-xs ml-1 font-sans font-normal ${
                            isSource ? "text-zinc-300" : "text-zinc-500"
                          }`}
                        >
                          pcs
                        </span>
                      </div>
                    )}
                    {bal.meters === 0 && bal.pieces === 0 && (
                      <div className="text-xl font-bold font-mono text-zinc-400">
                        0.00
                        <span className="text-xs ml-1 font-sans font-normal">
                          {activeUnit === "PIECES" ? "pcs" : activeUnit === "YARDS" ? "yd" : "m"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    className={`text-[11px] leading-tight ${
                      isSource ? "text-zinc-300" : "text-zinc-500"
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
                      {DEPT_LABELS[userDept] || userDept}
                    </h2>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Your Workstation
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">Internal Factory Floor Room</p>
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
                  {fromBal.pieces > 0 ? (
                    <>
                      <span>{fromBal.pieces.toLocaleString()}</span>
                      <span className="text-xs font-sans text-zinc-400 font-normal">Pieces</span>
                      {fromBal.meters > 0 && (
                        <span className="text-sm font-mono text-zinc-400 ml-2">
                          (+{fromBal.meters.toFixed(1)} {activeUnit === "YARDS" ? "yd" : "m"})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span>{fromBal.meters.toFixed(2)}</span>
                      <span className="text-xs font-sans text-zinc-400 font-normal">
                        {activeUnit === "YARDS" ? "Yards" : "Meters"}
                      </span>
                    </>
                  )}
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
                  Auto-accepted for downstream internal movements
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
                className="bg-white border border-amber-200 rounded-lg p-3.5 shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-xs text-zinc-900">
                      {t.transferNumber}
                    </div>
                    <div className="text-xs font-semibold text-zinc-800">
                      {t.party?.name || "Client"}
                      {t.inward?.partyChallanNo ? ` (Challan #${t.inward.partyChallanNo})` : ""}
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
          <input type="hidden" name="unit" value={activeTransferUnit} />

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
                Inward Challan / Lot *
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

          {/* CROPPING & CUTTING ACTION SELECTOR: TOGGLE BETWEEN UNCUT ROLLS VS CUT TRANSFORMATION */}
          {fromDept === "CROPPING_AND_CUTTING" && activeUnit !== "PIECES" && (
            <div className="p-3.5 bg-gradient-to-r from-zinc-50 to-blue-50/50 rounded-xl border border-zinc-200 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
                    Cropping & Cutting Floor Action
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    Choose whether to move rolls uncut, or cut the roll into finished garment pieces
                  </p>
                </div>
                <div className="inline-flex items-center p-1 bg-zinc-200/80 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCuttingMode(false);
                      setToDept("FINISHING_AND_PACKAGING");
                    }}
                    className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                      !isCuttingMode ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Standard Roll Transfer (Uncut)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCuttingMode(true);
                      setToDept("FINISHING_AND_PACKAGING");
                    }}
                    className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                      isCuttingMode ? "bg-zinc-900 text-white shadow-xs" : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                    Cut into Pieces (Transformation)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CUTTING TRANSFORMATION CARD (WHEN CUTTING MODE ACTIVE) */}
          {isCuttingMode && fromDept === "CROPPING_AND_CUTTING" ? (
            <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-950">
                  <Scissors className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Cutting Table Transformation (Meters → Finished Pieces)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  Auto-Accepted into Finishing & Packaging
                </span>
              </div>

              <input type="hidden" name="isCuttingTransformation" value="true" />
              <input type="hidden" name="fromDepartment" value="CROPPING_AND_CUTTING" />
              <input type="hidden" name="toDepartment" value="FINISHING_AND_PACKAGING" />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Fabric Consumed from Roll */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                      Fabric Cut ({activeUnit === "YARDS" ? "Yards" : "Meters"}) *
                    </label>
                    {availableAtSource > 0 && (
                      <button
                        type="button"
                        onClick={() => setTransferQty(availableAtSource.toString())}
                        className="text-[10px] font-mono text-blue-700 hover:underline cursor-pointer"
                      >
                        All ({availableAtSource.toFixed(1)})
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
                  <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                    Avail: <strong>{availableAtSource.toFixed(2)}</strong> {activeUnit === "YARDS" ? "yd" : "m"}
                  </span>
                </div>

                {/* 2. Finished Pieces Produced */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Pieces Produced *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    name="piecesProduced"
                    required
                    value={piecesProduced}
                    onChange={(e) => setPiecesProduced(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Sent to Finishing & Packaging floor
                  </span>
                </div>

                {/* 3. Cutting Scrap / Wastage */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Cutting Scrap ({activeUnit === "YARDS" ? "Yards" : "Meters"})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="scrapMeters"
                    value={scrapMeters}
                    onChange={(e) => setScrapMeters(e.target.value)}
                    placeholder="e.g. 4.00"
                    className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Logged in Customer Waste Ledger
                  </span>
                </div>

                {/* 4. Scrap Reason / Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Scrap Reason (Optional)
                  </label>
                  <input
                    type="text"
                    name="scrapNotes"
                    value={scrapNotes}
                    onChange={(e) => setScrapNotes(e.target.value)}
                    placeholder="e.g. Border trimmings, flaws"
                    className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    Visible in Party Running Ledger
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* STANDARD ROUTING & QUANTITY (3 Columns) */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-50/70 rounded-xl border border-zinc-200">
              {/* 5. FROM DEPARTMENT */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  From Department *
                </label>
                {!isUnrestricted && userDept ? (
                  <div>
                    <div className="h-11 px-3 bg-zinc-100 border border-zinc-300 rounded-lg flex items-center justify-between text-xs font-bold text-zinc-900">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Lock className="w-3.5 h-3.5 text-zinc-500" />
                        {userDept === "CROPPING_AND_CUTTING"
                          ? "Cropping & Cutting"
                          : userDept === "FINISHING_AND_PACKAGING"
                          ? "Finishing & Packaging"
                          : userDept}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 font-normal">Locked</span>
                    </div>
                    <input type="hidden" name="fromDepartment" value={userDept} />
                  </div>
                ) : (
                  <select
                    name="fromDepartment"
                    value={fromDept}
                    onChange={(e) => handleFromDeptChange(e.target.value as WorkstationDepartment)}
                    className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  >
                    {INTERNAL_WORKSTATION_DEPARTMENTS.map((dept) => {
                      const bal = deptBalances[dept];
                      const label = dept === "CROPPING_AND_CUTTING" ? "Cropping & Cutting" : dept === "FINISHING_AND_PACKAGING" ? "Finishing & Packaging" : "Store";
                      const qtyDisplay = bal.pieces > 0 ? `${bal.pieces} pcs` : `${bal.meters.toFixed(1)} ${activeUnit === "YARDS" ? "yd" : "m"}`;
                      return (
                        <option key={dept} value={dept}>
                          {label} ({qtyDisplay})
                        </option>
                      );
                    })}
                  </select>
                )}
                <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                  Available: <strong>{availableAtSource.toFixed(isFinishingPieces || isStorePieces ? 0 : 2)}</strong> {isFinishingPieces || isStorePieces ? "pcs" : activeUnit === "YARDS" ? "yd" : "m"}
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
                      {DEPT_LABELS[dept] || dept}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                  {toDept === "EMBROIDERY"
                    ? "Requires physical acceptance handshake on Embroidery floor"
                    : toDept === "STORE"
                    ? "Returns to Store for customer delivery challan"
                    : "Auto-accepted internal workstation"}
                </span>
              </div>

              {/* 7. QUANTITY */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                    Quantity ({isFinishingPieces || isStorePieces ? "Pieces" : activeUnit === "YARDS" ? "Yards" : "Meters"}) *
                  </label>
                  {availableAtSource > 0 && (
                    <button
                      type="button"
                      onClick={() => setTransferQty(availableAtSource.toString())}
                      className="text-[10px] font-mono text-zinc-600 hover:text-zinc-950 underline cursor-pointer"
                    >
                      Move All ({availableAtSource.toFixed(isFinishingPieces || isStorePieces ? 0 : 1)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step={isFinishingPieces || isStorePieces ? "1" : "0.01"}
                  name="quantity"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  placeholder={`Max ${availableAtSource.toFixed(isFinishingPieces || isStorePieces ? 0 : 2)}`}
                  className={`w-full h-11 px-3 bg-white border rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 ${
                    isOverQty
                      ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20 text-rose-950"
                      : "border-zinc-300 focus:ring-zinc-900"
                  }`}
                />
                {isOverQty && (
                  <p className="text-[10px] text-rose-600 font-medium mt-1">
                    Exceeds balance ({availableAtSource.toFixed(isFinishingPieces || isStorePieces ? 0 : 2)} {isFinishingPieces || isStorePieces ? "pcs" : activeUnit === "YARDS" ? "yd" : "m"}) in {fromDept}.
                  </p>
                )}
              </div>
            </div>
          )}

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
              ) : isCuttingMode ? (
                <>
                  <Scissors className="w-4 h-4 text-emerald-400" />
                  <span>
                    Cut & Transfer: {transferQty || "0"} {activeUnit === "YARDS" ? "yd" : "m"} → {piecesProduced || "0"} Pieces to Finishing & Packaging
                  </span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                  <span>
                    Transfer {fromDept === "CROPPING_AND_CUTTING" ? "Cropping & Cutting" : fromDept === "FINISHING_AND_PACKAGING" ? "Finishing & Packaging" : fromDept} → {toDept === "CROPPING_AND_CUTTING" ? "Cropping & Cutting" : toDept === "FINISHING_AND_PACKAGING" ? "Finishing & Packaging" : toDept}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 3. FULL-WIDTH TRANSFER ENTRIES LOG */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Workstation Handover Log</h3>
            <p className="text-xs text-zinc-500">
              Audit trail of material dispatches, cutting transformations & department handovers
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700">
            {filteredLog.length} Records
          </span>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Department Tabs */}
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
                  {dept === "CROPPING_AND_CUTTING" ? "Cropping & Cutting" : dept === "FINISHING_AND_PACKAGING" ? "Finishing & Packaging" : "Store"}
                </button>
              ))}
            </div>
          ) : (
            userDept && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200">
                  <Filter className="w-3.5 h-3.5 text-amber-700" />
                  <span>Scoped to: {DEPT_LABELS[userDept] || userDept} Handover Log</span>
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
                          {t.fromDepartment === "CROPPING_AND_CUTTING" ? "Cropping & Cutting" : t.fromDepartment === "FINISHING_AND_PACKAGING" ? "Finishing & Packaging" : t.fromDepartment}
                        </span>
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {t.toDepartment === "CROPPING_AND_CUTTING" ? "Cropping & Cutting" : t.toDepartment === "FINISHING_AND_PACKAGING" ? "Finishing & Packaging" : t.toDepartment}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-zinc-700 truncate block max-w-[180px]">
                          {t.fabricDescription}
                        </span>
                        {t.isCuttingTransformation && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 font-semibold text-[10px] font-mono w-fit">
                            <Scissors className="w-2.5 h-2.5" />
                            Cut: {t.piecesProduced} pcs
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      {t.isCuttingTransformation ? (
                        <div>
                          <div className="font-mono font-bold text-blue-900">
                            {t.piecesProduced} pcs
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500">
                            from {Number(t.quantity).toFixed(2)} {t.unit === "YARDS" ? "yd" : "m"}
                          </div>
                          {t.scrapMeters && Number(t.scrapMeters) > 0 && (
                            <div className="text-[10px] font-mono text-rose-600">
                              Scrap: {Number(t.scrapMeters).toFixed(2)} {t.unit === "YARDS" ? "yd" : "m"}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="font-mono font-bold text-zinc-900">
                            {Number(t.quantity).toFixed(t.unit === "PIECES" ? 0 : 2)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 ml-1">
                            {t.unit === "PIECES" ? "pcs" : t.unit === "YARDS" ? "yd" : "m"}
                          </span>
                        </div>
                      )}
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
                      {t.fromDepartment === "CROPPING_AND_CUTTING" ? "Cropping & Cutting" : t.fromDepartment === "FINISHING_AND_PACKAGING" ? "Finishing & Packaging" : t.fromDepartment}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {t.toDepartment === "CROPPING_AND_CUTTING" ? "Cropping & Cutting" : t.toDepartment === "FINISHING_AND_PACKAGING" ? "Finishing & Packaging" : t.toDepartment}
                    </span>
                  </div>

                  <div className="text-right">
                    {t.isCuttingTransformation ? (
                      <div>
                        <span className="font-mono font-bold text-blue-900 text-xs">
                          {t.piecesProduced} pcs
                        </span>
                        <div className="text-[10px] font-mono text-zinc-500">
                          cut {Number(t.quantity).toFixed(2)} {t.unit === "YARDS" ? "yd" : "m"}
                        </div>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-zinc-900 text-xs">
                        {Number(t.quantity).toFixed(t.unit === "PIECES" ? 0 : 2)} {t.unit === "PIECES" ? "pcs" : t.unit === "YARDS" ? "yd" : "m"}
                      </span>
                    )}
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
