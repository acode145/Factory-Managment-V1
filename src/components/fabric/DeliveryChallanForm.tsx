"use client";

import { useActionState, useState } from "react";
import { createDeliveryChallanAction, FabricActionState } from "@/actions/fabric";
import { metersToYards } from "@/lib/units";
import { Truck, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";

interface PartyBalanceOption {
  id: string;
  name: string;
  code: string;
  balance: number;
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
    measuredQty: number;
    availableMeters?: number | null;
    availableQty?: number;
  }>;
}

export default function DeliveryChallanForm({
  parties,
  inwards = [],
}: {
  parties: PartyBalanceOption[];
  inwards?: InwardOption[];
}) {
  const [state, formAction, isPending] = useActionState<FabricActionState, FormData>(
    createDeliveryChallanAction,
    {}
  );

  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedInwardId, setSelectedInwardId] = useState("");
  const [selectedInwardItemId, setSelectedInwardItemId] = useState("");
  const [deliveryMeters, setDeliveryMeters] = useState("");
  const [fabricType, setFabricType] = useState("");
  const [colorShade, setColorShade] = useState("");

  const currentParty = parties.find((p) => p.id === selectedPartyId);
  const partyInwards = inwards.filter((i) => i.partyId === selectedPartyId);
  const currentInward = inwards.find((i) => i.id === selectedInwardId);
  const currentItem = currentInward?.items?.find((it) => it.id === selectedInwardItemId);

  const maxAvailable = currentItem
    ? (currentItem.availableMeters ?? currentItem.availableQty ?? currentItem.measuredQty)
    : currentInward
    ? currentInward.availableMeters
    : currentParty?.balance || 0;
  const numMeters = parseFloat(deliveryMeters) || 0;
  const isOverBalance = numMeters > maxAvailable && maxAvailable > 0;

  const handleInwardChange = (inwardId: string) => {
    setSelectedInwardId(inwardId);
    setSelectedInwardItemId("");
    if (inwardId) {
      const inward = inwards.find((i) => i.id === inwardId);
      if (inward) {
        if (inward.items && inward.items.length === 1) {
          const onlyItem = inward.items[0];
          setSelectedInwardItemId(onlyItem.id);
          setFabricType(onlyItem.fabricType);
          setColorShade(onlyItem.colorShade);
        } else {
          setFabricType(inward.fabricType || "");
          setColorShade(inward.colorShade || "");
        }
      }
    }
  };

  const handleLotItemChange = (itemId: string) => {
    setSelectedInwardItemId(itemId);
    if (itemId && currentInward?.items) {
      const item = currentInward.items.find((it) => it.id === itemId);
      if (item) {
        setFabricType(item.fabricType);
        setColorShade(item.colorShade);
      }
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs">
      <div className="flex items-center gap-2.5 pb-3.5 mb-5 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-zinc-950">Party Outward Delivery Challan</h2>
          <p className="text-xs text-zinc-500">Dispatch finished goods & print reconciliation statement</p>
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
        {/* Row: Party & Inward Lot Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                Client Party *
              </label>
              {currentParty && (
                <span className="text-xs font-mono font-medium text-zinc-600">
                  Custody:{" "}
                  <strong className="text-zinc-950 font-bold">{currentParty.balance.toFixed(2)}m</strong>
                </span>
              )}
            </div>
            <select
              name="partyId"
              required
              value={selectedPartyId}
              onChange={(e) => {
                setSelectedPartyId(e.target.value);
                setSelectedInwardId("");
                setSelectedInwardItemId("");
              }}
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">-- Select Party to Dispatch --</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code}) — Balance: {p.balance.toFixed(2)}m
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                Originating Inward Challan Ref #
              </label>
              {currentInward && (
                <span className="text-xs font-mono font-medium text-emerald-700">
                  Challan Avail: <strong>{currentInward.availableMeters.toFixed(2)}m</strong>
                </span>
              )}
            </div>
            <select
              name="inwardId"
              value={selectedInwardId}
              onChange={(e) => handleInwardChange(e.target.value)}
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            >
              <option value="">-- General Factory Stock / Tag Specific Challan --</option>
              {partyInwards.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.partyChallanNo} ({i.fabricType}, {i.colorShade}) — Avail: {i.availableMeters.toFixed(2)}m
                </option>
              ))}
            </select>
          </div>

          {currentInward?.items && currentInward.items.length > 0 && (
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  Specific Lot in Challan #{currentInward.partyChallanNo} *
                </label>
                {currentItem && (
                  <span className="text-xs font-mono font-medium text-emerald-700">
                    Lot Avail: <strong>{(currentItem.availableMeters ?? currentItem.availableQty ?? currentItem.measuredQty).toFixed(2)} {currentItem.unit === "PIECES" ? "pcs" : "m"}</strong>
                  </span>
                )}
              </div>
              <select
                name="inwardItemId"
                value={selectedInwardItemId}
                onChange={(e) => handleLotItemChange(e.target.value)}
                className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                <option value="">-- Select Specific Lot Item --</option>
                {currentInward.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    Lot #{it.itemIndex + 1}: {it.fabricType} ({it.colorShade}) — Measured: {it.measuredQty} {it.unit} (Avail: {(it.availableMeters ?? it.availableQty ?? it.measuredQty).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row: Fabric Type & Color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Fabric Item / Specification *
            </label>
            <input
              type="text"
              name="fabricType"
              required
              value={fabricType}
              onChange={(e) => setFabricType(e.target.value)}
              placeholder="e.g. Embroidered Lawn Shirt Pieces"
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Color / Shade State *
            </label>
            <input
              type="text"
              name="colorShade"
              required
              value={colorShade}
              onChange={(e) => setColorShade(e.target.value)}
              placeholder="e.g. Dyed Jet Black (Batch #4)"
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Row: Meters Delivering & Roll Count */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                Delivered Meters *
              </label>
              <div className="flex items-center gap-2">
                {numMeters > 0 && (
                  <span className="text-[11px] font-mono text-zinc-500">
                    ≈ {metersToYards(numMeters).toFixed(1)} yds
                  </span>
                )}
                {isOverBalance && (
                  <span className="text-[11px] text-rose-600 font-medium">Exceeds available balance!</span>
                )}
              </div>
            </div>
            <input
              type="number"
              step="0.01"
              name="totalMeters"
              required
              inputMode="decimal"
              value={deliveryMeters}
              onChange={(e) => setDeliveryMeters(e.target.value)}
              placeholder="e.g. 9600.00"
              className={`w-full h-12 px-3.5 bg-white border rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 ${
                isOverBalance ? "border-rose-300 focus:ring-rose-600 bg-rose-50/20" : "border-zinc-300 focus:ring-zinc-900"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Roll / Than / Carton Count *
            </label>
            <input
              type="number"
              name="totalRolls"
              required
              min="1"
              inputMode="numeric"
              placeholder="e.g. 24"
              className="w-full h-12 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Transporter Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Transporter / Driver / Vehicle Info
            </label>
            <input
              type="text"
              name="vehicleDriver"
              placeholder="e.g. Driver Rashid (Rickshaw #441)"
              className="w-full h-11 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Delivery Remarks (Optional)
            </label>
            <input
              type="text"
              name="remarks"
              placeholder="e.g. Full final delivery against Order 101"
              className="w-full h-11 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={isPending || isOverBalance || !selectedPartyId || numMeters <= 0}
          className="w-full h-12 mt-2 bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <span className="font-mono text-xs">DISPATCHING DELIVERY...</span>
          ) : (
            <>
              <ArrowUpRight className="w-4 h-4" />
              <span>Generate Delivery Challan & Custody Statement</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}