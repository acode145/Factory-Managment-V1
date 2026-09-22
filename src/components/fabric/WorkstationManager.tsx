"use client";

import { useActionState, useState, useEffect, useMemo } from "react";
import {
  createDepartmentTransferAction,
  deleteDepartmentTransferAction,
  TransferActionState,
} from "@/actions/transfer";
import {
  WORKSTATION_DEPARTMENTS,
  WorkstationDepartment,
} from "@/lib/workstations";
import DatePicker from "@/components/ui/DatePicker";
import { metersToYards } from "@/lib/units";
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

export default function WorkstationManager({
  parties = [],
  inwards = [],
  transfers = [],
  batches = [],
}: {
  parties?: PartyOption[];
  inwards?: InwardLotOption[];
  transfers?: TransferLogItem[];
  batches?: any[];
}) {
  const safeParties = useMemo(() => (Array.isArray(parties) ? parties : []), [parties]);
  const safeInwards = useMemo(() => (Array.isArray(inwards) ? inwards : []), [inwards]);
  const safeTransfers = useMemo(() => (Array.isArray(transfers) ? transfers : []), [transfers]);

  const [state, formAction, isPending] = useActionState<TransferActionState, FormData>(
    createDepartmentTransferAction,
    {}
  );
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  const [selectedPartyId, setSelectedPartyId] = useState(safeParties[0]?.id || "");
  const [selectedInwardId, setSelectedInwardId] = useState("");
  const [selectedInwardItemId, setSelectedInwardItemId] = useState("");
  const [fromDept, setFromDept] = useState<WorkstationDepartment>("STORE");
  const [toDept, setToDept] = useState<WorkstationDepartment>("EMBROIDERY");
  const [transferQty, setTransferQty] = useState("");
  const [fabricDesc, setFabricDesc] = useState("");
  const [activeUnit, setActiveUnit] = useState<"METERS" | "YARDS" | "PIECES">("METERS");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchLog, setSearchLog] = useState("");

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

  const handleDeleteTransfer = async (id: string, transferNo: string) => {
    if (!window.confirm(`Are you sure you want to delete transfer #${transferNo}? Material will return to the source workstation.`)) {
      return;
    }
    setDeletePendingId(id);
    try {
      const res = await deleteDepartmentTransferAction(id);
      if (res?.error) {
        alert(res.error);
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
    const q = Number(t.quantity);
    const d = Number(t.damagedQuantity || 0);
    const from = t.fromDepartment as WorkstationDepartment;
    const to = t.toDepartment as WorkstationDepartment;

    if (deptBalances[from] !== undefined) {
      deptBalances[from] = Math.max(0, Number((deptBalances[from] - q - d).toFixed(2)));
    }
    if (deptBalances[to] !== undefined) {
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

  // Filter transfers history
  const filteredLog = safeTransfers.filter((t) => {
    if (!t) return false;
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

      {/* 1. LIVE WORKSTATIONS PIPELINE CARDS */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
              <GitFork className="w-4 h-4 text-zinc-700" />
              <span>Live Workstation Pipeline & Room Balances</span>
            </h2>
            <p className="text-xs text-zinc-500">
              Active fabric quantities currently residing at each factory workstation
            </p>
          </div>

          {/* Party Quick Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Party:</span>
            <select
              value={selectedPartyId}
              onChange={(e) => {
                setSelectedPartyId(e.target.value);
                setSelectedInwardId("");
                setSelectedInwardItemId("");
              }}
              className="h-8 px-2.5 bg-white border border-zinc-300 rounded-md text-xs font-semibold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            >
              {safeParties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 6 Department Cards in Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {WORKSTATION_DEPARTMENTS.map((dept) => {
            const Icon = DEPT_ICONS[dept];
            const qty = deptBalances[dept];
            const isSource = fromDept === dept;
            const isDest = toDept === dept;

            return (
              <div
                key={dept}
                onClick={() => setFromDept(dept)}
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

      {/* 2. TRANSFER FORM & LOG GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Transfer Form (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-zinc-100">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
                <GitFork className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Internal Department Handover</h3>
                <p className="text-xs text-zinc-500">Move fabric batches between factory workstations</p>
              </div>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="partyId" value={selectedPartyId} />
              <input type="hidden" name="inwardId" value={selectedInwardId} />
              <input type="hidden" name="inwardItemId" value={selectedInwardItemId} />
              <input type="hidden" name="fromDepartment" value={fromDept} />
              <input type="hidden" name="toDepartment" value={toDept} />
              <input type="hidden" name="fabricDescription" value={fabricDesc || "General Fabric"} />
              <input type="hidden" name="unit" value={activeUnit} />
              <input type="hidden" name="transferDate" value={transferDate} />

              {/* Inward Challan / Lot Selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Inward Challan / Originating Lot *
                </label>
                <select
                  required
                  value={selectedInwardId}
                  onChange={(e) => handleInwardChange(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">-- Select Inward Challan --</option>
                  {partyInwards.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      Challan #{inv.partyChallanNo} ({inv.availableMeters.toFixed(1)}m in factory)
                    </option>
                  ))}
                </select>

                {/* Specific Lot Item if inward has multiple */}
                {currentInward && currentInward.items && currentInward.items.length > 1 && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                      Specific Lot Item *
                    </label>
                    <select
                      required
                      value={selectedInwardItemId}
                      onChange={(e) => handleLotChange(e.target.value)}
                      className="w-full h-9 px-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="">-- Select Specific Lot Item --</option>
                      {currentInward.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          Lot #{it.itemIndex + 1}: {it.fabricType} ({it.colorShade}) — Factory Avail: {Number(it.availableQty || 0).toFixed(1)} {it.unit === "PIECES" ? "pcs" : "m"} (dock: {it.measuredQty})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Active Outsource Notice if fabric is currently at dyer/printer */}
                {totalAtOutsource > 0 && (
                  <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-[11px]">
                        {totalAtOutsource.toFixed(1)}m Currently at Outsource Dyer/Printer
                      </div>
                      <p className="text-[10px] text-amber-800 leading-tight mt-0.5">
                        Fabric has been dispatched for processing and is not in factory custody. Only fabric received back can be transferred to internal workstations.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Source & Destination Departments */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">
                    From Department *
                  </label>
                  <select
                    value={fromDept}
                    onChange={(e) => setFromDept(e.target.value as WorkstationDepartment)}
                    className="w-full h-9 px-2 bg-white border border-zinc-300 rounded-md text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  >
                    {WORKSTATION_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept} ({deptBalances[dept].toFixed(1)})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                    Available: <strong>{availableAtSource.toFixed(2)}</strong> {activeUnit === "PIECES" ? "pcs" : "m"}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">
                    To Department *
                  </label>
                  <select
                    value={toDept}
                    onChange={(e) => setToDept(e.target.value as WorkstationDepartment)}
                    className="w-full h-9 px-2 bg-white border border-zinc-300 rounded-md text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  >
                    {WORKSTATION_DEPARTMENTS.filter((d) => d !== fromDept).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                    Receiving workstation
                  </span>
                </div>
              </div>

              {/* Quantity to Move */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                    Transfer Quantity ({activeUnit === "PIECES" ? "Pieces" : activeUnit === "YARDS" ? "Yards" : "Meters"}) *
                  </label>
                  {availableAtSource > 0 && (
                    <button
                      type="button"
                      onClick={() => setTransferQty(availableAtSource.toString())}
                      className="text-[10px] font-mono text-zinc-600 hover:text-zinc-950 underline cursor-pointer"
                    >
                      Move All ({availableAtSource.toFixed(2)})
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
                  className={`w-full h-10 px-3 bg-white border rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-hidden focus:ring-2 ${
                    isOverQty
                      ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20 text-rose-950"
                      : "border-zinc-300 focus:ring-zinc-900"
                  }`}
                />
                {isOverQty && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                    Quantity exceeds available balance ({availableAtSource.toFixed(2)} {activeUnit === "PIECES" ? "pcs" : "m"}) in {fromDept}.
                  </p>
                )}
              </div>

              {/* Transfer Date & Machine # */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full h-9 px-2.5 bg-white border border-zinc-300 rounded-md text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                    Machine # <span className="font-normal lowercase text-zinc-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="machineNumber"
                    placeholder="e.g. Machine 04"
                    className="w-full h-9 px-2.5 bg-white border border-zinc-300 rounded-md text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                </div>
              </div>

              {/* Operator Name */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                  Operator / Incharge <span className="font-normal lowercase text-zinc-400">(optional)</span>
                </label>
                <input
                  type="text"
                  name="operatorName"
                  placeholder="e.g. Aslam Khan"
                  className="w-full h-9 px-2.5 bg-white border border-zinc-300 rounded-md text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 uppercase mb-1">
                  Notes / Batch Instructions <span className="font-normal lowercase text-zinc-400">(optional)</span>
                </label>
                <input
                  type="text"
                  name="remarks"
                  placeholder="e.g. Fast-track for embroidery framing"
                  className="w-full h-9 px-2.5 bg-white border border-zinc-300 rounded-md text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isFormValid || isPending}
                  className={`w-full h-11 rounded-lg text-xs font-bold uppercase tracking-wider shadow-xs transition-all flex items-center justify-center gap-2 ${
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
        </div>

        {/* RIGHT COLUMN: Transfer History Table (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Internal Transfer Log</h3>
                <p className="text-xs text-zinc-500">Chronological history of room-to-room material handovers</p>
              </div>
              <span className="text-xs font-mono font-bold bg-zinc-100 px-2.5 py-1 rounded text-zinc-700 self-start sm:self-auto">
                {safeTransfers.length} Transfers
              </span>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Search by transfer #, party, lot, room, or operator..."
                className="w-full h-9 pl-8 pr-3 bg-zinc-50 border border-zinc-200 rounded-md text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Transfers List */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredLog.length === 0 ? (
                <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs">
                  No department transfers recorded yet. Select an inward lot and transfer fabric to start tracking.
                </div>
              ) : (
                filteredLog.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 border border-zinc-200 rounded-lg hover:border-zinc-300 transition-all bg-white hover:bg-zinc-50/50 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                          {t.transferNumber}
                        </span>
                        <span className="font-semibold text-zinc-800 truncate max-w-[180px]">
                          {t.party?.name || "Party"}
                        </span>
                        {t.inward?.partyChallanNo && (
                          <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                            #{t.inward.partyChallanNo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-zinc-400">
                          {new Date(t.transferDate).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          title="Delete / Void Transfer"
                          disabled={deletePendingId === t.id}
                          onClick={() => handleDeleteTransfer(t.id, t.transferNumber)}
                          className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

                    {(t.machineNumber || t.operatorName || t.remarks) && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500 pt-0.5">
                        {t.machineNumber && (
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono">
                            {t.machineNumber}
                          </span>
                        )}
                        {t.operatorName && (
                          <span>Operator: {t.operatorName}</span>
                        )}
                        {t.remarks && (
                          <span className="italic text-zinc-400">"{t.remarks}"</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
