"use client";

import { useActionState, useState } from "react";
import { createUserAction, toggleUserStatusAction, updatePasswordAction, AdminActionState } from "@/actions/admin";
import { UserPlus, UserCheck, UserX, Key, Shield, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

interface UserItem {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

function getRoleBadge(role: string) {
  switch (role) {
    case "ADMIN":
      return "bg-zinc-900 text-white";
    case "FABRIC_PROCESSING_INCHARGE":
      return "bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold";
    case "STOREKEEPER":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "FLOOR_SUPERVISOR":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "GATE_CLERK":
      return "bg-sky-50 text-sky-700 border border-sky-200";
    default:
      return "bg-zinc-100 text-zinc-700 border border-zinc-200";
  }
}

export default function UserManagement({
  initialUsers,
  currentAdminId,
}: {
  initialUsers: UserItem[];
  currentAdminId: string;
}) {
  const [createState, formAction, isCreating] = useActionState<AdminActionState, FormData>(
    createUserAction,
    {}
  );

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleStatus = async (userId: string) => {
    setIsUpdating(true);
    setFeedback(null);
    const res = await toggleUserStatusAction(userId);
    if (res.error) setFeedback(res.error);
    if (res.message) setFeedback(res.message);
    setIsUpdating(false);
  };

  const handleUpdatePassword = async (userId: string) => {
    if (!newPasswordVal || newPasswordVal.length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }
    setIsUpdating(true);
    setFeedback(null);
    const res = await updatePasswordAction(userId, newPasswordVal);
    if (res.error) setFeedback(res.error);
    if (res.message) setFeedback(res.message);
    setEditingUserId(null);
    setNewPasswordVal("");
    setIsUpdating(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Feedback */}
      {(createState?.message || feedback) && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-medium">{createState?.message || feedback}</span>
        </div>
      )}

      {(createState?.error) && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span className="font-medium">{createState.error}</span>
        </div>
      )}

      {/* Grid: Add User Form (Left) & User List Table (Right) on Desktop, Stacked on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD NEW USER FORM */}
        <div className="lg:col-span-1 bg-white border border-zinc-200 rounded-xl p-5 shadow-xs h-fit">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-zinc-100">
            <div className="w-8 h-8 rounded-md bg-zinc-900 text-white flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Add New User</h2>
              <p className="text-[11px] text-zinc-500">Provision factory staff credentials</p>
            </div>
          </div>

          <form action={formAction} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                required
                placeholder="e.g. Muhammad Aslam"
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Username (Lower case)
              </label>
              <input
                type="text"
                name="username"
                required
                autoCapitalize="none"
                placeholder="e.g. aslam or store2"
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                6-Digit PIN / Password
              </label>
              <input
                type="text"
                name="password"
                required
                inputMode="numeric"
                placeholder="e.g. 123456"
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm font-mono tabular-nums text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Assigned Role
              </label>
              <select
                name="role"
                defaultValue="STOREKEEPER"
                className="w-full h-11 px-3 bg-white border border-zinc-300 rounded-md text-sm text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
              >
                <option value="STOREKEEPER">STOREKEEPER (Store & In/Out)</option>
                <option value="FLOOR_SUPERVISOR">FLOOR_SUPERVISOR (Production)</option>
                <option value="GATE_CLERK">GATE_CLERK (Gate Receiving)</option>
                <option value="FABRIC_PROCESSING_INCHARGE">FABRIC_PROCESSING_INCHARGE (Fabric & Party Incharge)</option>
                <option value="ADMIN">ADMIN (Full Super Access)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full h-12 mt-2 bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white text-xs font-semibold tracking-wide uppercase rounded-md flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isCreating ? (
                <span>CREATING USER...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create User Account</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* USERS DIRECTORY (DESKTOP TABLE + MOBILE CARDS) */}
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">User Accounts & Credentials</h2>
              <p className="text-[11px] text-zinc-500">
                Passwords are shown visible per factory management requirement.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold bg-zinc-100 px-2.5 py-1 rounded text-zinc-700">
              {initialUsers.length} Users
            </span>
          </div>

          {/* MOBILE VIEW (< 768px): Responsive Card Stack */}
          <div className="block md:hidden space-y-3">
            {initialUsers.map((user) => {
              const isSelf = user.id === currentAdminId;
              return (
                <div
                  key={user.id}
                  className={`p-4 rounded-lg border ${
                    user.isActive ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-zinc-900">{user.fullName}</div>
                      <div className="text-xs font-mono text-zinc-500">@{user.username}</div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                        user.isActive
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {user.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-b border-zinc-100 py-2">
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase font-mono mb-0.5">Role</span>
                      <span className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase font-mono">Password / PIN</span>
                      <span className="font-mono font-bold text-zinc-900 bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                        {user.password}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingUserId(user.id);
                        setNewPasswordVal(user.password);
                      }}
                      className="h-8 px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs rounded border border-zinc-200 flex items-center gap-1"
                    >
                      <Key className="w-3 h-3" />
                      <span>Change PIN</span>
                    </button>

                    {!isSelf && (
                      <button
                        onClick={() => handleToggleStatus(user.id)}
                        disabled={isUpdating}
                        className={`h-8 px-2.5 text-xs rounded border flex items-center gap-1 ${
                          user.isActive
                            ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {user.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                        <span>{user.isActive ? "Deactivate" : "Activate"}</span>
                      </button>
                    )}
                  </div>

                  {/* Inline PIN edit box */}
                  {editingUserId === user.id && (
                    <div className="mt-3 p-3 bg-zinc-50 border border-zinc-300 rounded-md">
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        New 6-Digit PIN for {user.username}:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPasswordVal}
                          onChange={(e) => setNewPasswordVal(e.target.value)}
                          className="h-8 px-2 text-xs font-mono bg-white border border-zinc-300 rounded flex-1"
                        />
                        <button
                          onClick={() => handleUpdatePassword(user.id)}
                          className="h-8 px-3 bg-zinc-900 text-white text-xs rounded font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="h-8 px-2 text-xs text-zinc-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP VIEW (>= 768px): Dense High-Contrast Tabular Grid */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 uppercase tracking-wider text-[10px] font-mono bg-zinc-50/50">
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Password / PIN (Visible)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {initialUsers.map((user) => {
                  const isSelf = user.id === currentAdminId;
                  return (
                    <tr key={user.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-zinc-900">{user.fullName}</td>
                      <td className="py-2.5 px-3 font-mono text-zinc-600">@{user.username}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded ${getRoleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {editingUserId === user.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newPasswordVal}
                              onChange={(e) => setNewPasswordVal(e.target.value)}
                              className="h-7 w-28 px-2 text-xs font-mono bg-white border border-zinc-400 rounded"
                            />
                            <button
                              onClick={() => handleUpdatePassword(user.id)}
                              className="h-7 px-2 bg-zinc-900 text-white text-[11px] rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="text-[11px] text-zinc-500 hover:text-zinc-800"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            {user.password}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                            user.isActive
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-zinc-200 text-zinc-600"
                          }`}
                        >
                          {user.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {editingUserId !== user.id && (
                            <button
                              onClick={() => {
                                setEditingUserId(user.id);
                                setNewPasswordVal(user.password);
                              }}
                              title="Update Password"
                              className="h-7 px-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded border border-zinc-200 inline-flex items-center gap-1 text-[11px]"
                            >
                              <Key className="w-3 h-3" />
                              <span>PIN</span>
                            </button>
                          )}

                          {!isSelf && (
                            <button
                              onClick={() => handleToggleStatus(user.id)}
                              disabled={isUpdating}
                              title={user.isActive ? "Deactivate user" : "Activate user"}
                              className={`h-7 px-2 rounded border text-[11px] inline-flex items-center gap-1 ${
                                user.isActive
                                  ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {user.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                              <span>{user.isActive ? "Deactivate" : "Activate"}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
