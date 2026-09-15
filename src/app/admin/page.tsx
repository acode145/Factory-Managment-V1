import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import UserManagement from "@/components/admin/UserManagement";
import { Users, Building2, Truck, ShieldCheck } from "lucide-react";

export default async function AdminPage() {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }

  const [users, partiesCount, vendorsCount] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        fullName: true,
        username: true,
        password: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.party.count(),
    prisma.vendor.count(),
  ]);

  const activeUsersCount = users.filter((u) => u.isActive).length;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100">
      <Header session={session} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Admin Header & Stat Cards */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
                System Administration
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500">
                User access control, workstation roles, and system configuration.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 text-white text-xs rounded-md font-mono self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Super Admin Active</span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Active Users</span>
                <Users className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-zinc-950">
                {activeUsersCount} <span className="text-xs text-zinc-400 font-normal">/ {users.length}</span>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Client Parties</span>
                <Building2 className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-zinc-950">{partiesCount}</div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Dyeing Vendors</span>
                <Truck className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="mt-1 text-xl font-bold font-mono text-zinc-950">{vendorsCount}</div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
                <span>Domain</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              </div>
              <div className="mt-1 text-xs font-mono font-semibold text-zinc-800 truncate">
                fm.mainweb.store
              </div>
            </div>
          </div>
        </div>

        {/* User Management Section */}
        <UserManagement initialUsers={users} currentAdminId={session.userId} />
      </main>
    </div>
  );
}
