"use client";

import { useState } from "react";
import { SessionData } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";
import { Building2, Sun, User, Lock, Shield, Menu, X, Layers } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header({ session }: { session: SessionData }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isAdmin = session.role === "ADMIN";

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-zinc-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand & Context (Left) */}
          <div className="flex items-center space-x-3">
            <Link
              href={isAdmin ? "/admin" : "/dashboard"}
              className="flex items-center space-x-1.5 focus:outline-hidden"
              onClick={closeMobileMenu}
            >
              <span className="font-bold text-base tracking-tight text-zinc-950">
                FM<span className="text-zinc-500 font-normal">.v1</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center space-x-2 text-xs text-zinc-500 border-l border-zinc-200 pl-3">
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                Main Warehouse
              </span>
              <span className="text-zinc-300">•</span>
              <span className="inline-flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                Day Shift
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center space-x-2 text-xs font-medium">
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition-colors ${
                  pathname === "/admin"
                    ? "bg-zinc-900 text-white font-semibold shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </Link>
            )}

            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition-colors ${
                pathname === "/dashboard"
                  ? "bg-zinc-900 text-white font-semibold shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Fabric Operations</span>
            </Link>
          </nav>

          {/* Right Area: User Info + Lock Button + Mobile Hamburger Toggle */}
          <div className="flex items-center space-x-2">
            {/* Desktop User Tag */}
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-zinc-900 flex items-center justify-end gap-1">
                <User className="w-3 h-3 text-zinc-500" />
                {session.fullName}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                {session.role}
              </div>
            </div>

            {/* Lock / Switch Button */}
            <form action={logoutAction}>
              <button
                type="submit"
                title="Lock terminal and switch user"
                className="h-9 w-9 sm:w-auto sm:px-3 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md border border-zinc-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-zinc-700" />
                <span className="hidden sm:inline">Lock / Switch</span>
              </button>
            </form>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              aria-label="Toggle Navigation Menu"
              className="md:hidden h-9 w-9 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md border border-zinc-300 cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4 text-zinc-800" />
              ) : (
                <Menu className="w-4 h-4 text-zinc-800" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-down Navigation Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-zinc-200 px-4 py-3 space-y-3 shadow-md animate-in slide-in-from-top-2 duration-150">
          {/* User profile header in menu */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 text-xs">
            <div>
              <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                <span>{session.fullName}</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase">
                {session.role} • @{session.username}
              </div>
            </div>
            <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Day Shift</span>
            </div>
          </div>

          {/* Navigation Links (Large Touch Targets for Mobile) */}
          <div className="space-y-1.5">
            {isAdmin && (
              <Link
                href="/admin"
                onClick={closeMobileMenu}
                className={`w-full h-11 px-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
                  pathname === "/admin"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Panel (User Management)</span>
              </Link>
            )}

            <Link
              href="/dashboard"
              onClick={closeMobileMenu}
              className={`w-full h-11 px-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
                pathname === "/dashboard"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Fabric Operations Desk</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
