"use client";

import { useActionState, useState } from "react";
import { loginAction, LoginState } from "@/actions/auth";
import { Lock, User, AlertCircle, ArrowRight, Shield } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-zinc-100">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-900 text-white mb-3 shadow-xs">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            Factory-Management <span className="text-zinc-500 font-normal">v1</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-mono">
            Terminal Access • fm.mainweb.store
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 shadow-xs">
          <div className="border-b border-zinc-100 pb-4 mb-5">
            <h2 className="text-base font-semibold text-zinc-900">Sign In to Workstation</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Enter your assigned username and 6-digit PIN / password.
            </p>
          </div>

          {state?.error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{state.error}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            {/* Username Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. amir or admin"
                  className="w-full h-12 pl-10 pr-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                />
              </div>
            </div>

            {/* Password / 6-digit PIN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider"
                >
                  6-Digit PIN / Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full h-12 pl-10 pr-3.5 bg-white border border-zinc-300 rounded-lg text-sm font-mono tabular-nums text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-12 mt-2 bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isPending ? (
                <span className="text-xs font-mono">AUTHENTICATING...</span>
              ) : (
                <>
                  <span>Unlock Workstation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Fill Testing Helper */}
          <div className="mt-6 pt-5 border-t border-zinc-100">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2.5">
              Quick Test Accounts (Click to Fill):
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("admin", "ABC!123@")}
                className="py-1.5 px-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded text-center text-xs text-zinc-700 font-mono transition-colors"
              >
                admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("amir", "123456")}
                className="py-1.5 px-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded text-center text-xs text-zinc-700 font-mono transition-colors"
              >
                amir (123456)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("tariq", "654321")}
                className="py-1.5 px-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded text-center text-xs text-zinc-700 font-mono transition-colors"
              >
                tariq (654321)
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-xs text-zinc-400 font-mono">
          Security policy: No public registration • Super Admin controls access
        </div>
      </div>
    </div>
  );
}
