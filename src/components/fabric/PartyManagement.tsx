"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import { createPartyAction, PartyActionState } from "@/actions/party";
import {
  Building2,
  Plus,
  Search,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Hash,
} from "lucide-react";

export interface PartyDirectoryItem {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt?: string | Date;
}

export default function PartyManagement({
  parties,
  canCreateParty,
  nextPartyCode,
}: {
  parties: PartyDirectoryItem[];
  canCreateParty: boolean;
  nextPartyCode: string;
}) {
  const [state, formAction, isPending] = useActionState<PartyActionState, FormData>(
    createPartyAction,
    {}
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [formKey, setFormKey] = useState(0);

  // Reset form inputs upon successful creation
  useEffect(() => {
    if (state?.success) {
      setFormKey((k) => k + 1);
    }
  }, [state]);

  const filteredParties = parties.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Alert */}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Create Party Form (5 cols on lg) */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-zinc-100">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-950">Register Client Party</h2>
                <p className="text-xs text-zinc-500">
                  Provision client party / mill account for inward fabric tracking
                </p>
              </div>
            </div>

            {canCreateParty ? (
              <form key={formKey} action={formAction} className="space-y-4">
                {/* 1. System Auto-Generated Party ID (Read-Only) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Party ID (Auto System Generated)
                  </label>
                  <div className="flex items-center gap-2 h-11 px-3.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900">
                    <Hash className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>{nextPartyCode}</span>
                    <span className="ml-auto text-[10px] font-sans font-normal text-zinc-400 bg-zinc-200/70 px-2 py-0.5 rounded">
                      Assigned upon creation
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                    System sequentially generates next party identifier.
                  </p>
                </div>

                {/* 2. Party Name * */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Party Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Al-Karam Studio or Sapphire Mills"
                    className="w-full h-11 px-3.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                  />
                </div>

                {/* 3. Contact Person * */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Contact Person *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="contactPerson"
                      required
                      placeholder="e.g. Tariq Mahmood"
                      className="w-full h-11 pl-10 pr-3.5 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                    />
                    <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* 4. Phone * */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Phone *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="phone"
                      required
                      placeholder="e.g. +92 300 1234567"
                      className="w-full h-11 pl-10 pr-3.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                    />
                    <Phone className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* 5. Address (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Address <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                  </label>
                  <div className="relative">
                    <textarea
                      name="address"
                      rows={2}
                      placeholder="e.g. Plot 42, Sector 15, Korangi Industrial Area, Karachi"
                      className="w-full p-3 pl-10 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 resize-none"
                    />
                    <MapPin className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 active:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating Party...</span>
                      </span>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-emerald-400" />
                        <span>Create Client Party</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-zinc-400 text-center mt-2 font-mono">
                    Authorized Role: Admin & Fabric Processing Incharge
                  </p>
                </div>
              </form>
            ) : (
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-center space-y-2">
                <ShieldAlert className="w-6 h-6 text-zinc-400 mx-auto" />
                <h3 className="text-xs font-bold text-zinc-800">Creation Restricted</h3>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Only System Admin and Fabric Processing Incharge have authorization to create client parties.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Registered Parties Directory (7 cols on lg) */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div>
                <h2 className="text-base font-bold text-zinc-950">Registered Client Parties</h2>
                <p className="text-xs text-zinc-500">
                  Directory of all active mill and brand accounts
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-zinc-100 px-3 py-1 rounded-md text-zinc-700 self-start sm:self-auto">
                {parties.length} Parties
              </span>
            </div>

            {/* Search Filter Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name, code (PRT-...), contact person, or phone..."
                className="w-full h-10 pl-9 pr-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:bg-white"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
            </div>

            {/* Party Cards List */}
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredParties.length === 0 ? (
                <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs">
                  No client parties match your search query.
                </div>
              ) : (
                filteredParties.map((party) => (
                  <div
                    key={party.id}
                    className="p-4 border border-zinc-200 hover:border-zinc-300 rounded-xl bg-white hover:bg-zinc-50/50 transition-all shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-zinc-900 text-white px-2 py-0.5 rounded">
                          {party.code}
                        </span>
                        <h3 className="text-sm font-bold text-zinc-950">{party.name}</h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {party.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 pt-1 border-t border-zinc-100">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-medium text-zinc-800">
                          {party.contactPerson || "Not specified"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-mono text-zinc-800">
                          {party.phone || "Not specified"}
                        </span>
                      </div>
                    </div>

                    {party.address && (
                      <div className="flex items-start gap-1.5 text-xs text-zinc-500 pt-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{party.address}</span>
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
