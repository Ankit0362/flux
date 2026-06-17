"use client";

import { useEffect, useState } from "react";

export default function DemoController() {
  const [isActive, setIsActive] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    // Check demo mode ONLY via cookie (same source the server reads).
    // Never use localStorage as a fallback — it is client-forgeable.
    const cookieMode = document.cookie
      .split("; ")
      .find((row) => row.startsWith("flux_mode="))
      ?.split("=")[1];

    if (cookieMode === "demo") {
      setIsActive(true);
    }
  }, []);

  const handleAction = async (action: "reset" | "simulate_email") => {
    setLoadingAction(action);
    setActionError(null);
    try {
      const res = await fetch("/api/demo/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        // Reload page to pull fresh state from DemoStore
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || "Failed to execute action in Demo Mode.");
      }
    } catch (err: unknown) {
      console.error(err);
      setActionError("Network error — could not reach the server.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExit = () => {
    // Clear demo mode cookie
    document.cookie = "flux_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    // Redirect to refresh and trigger live mode
    window.location.href = "/dashboard";
  };

  if (!isActive) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 select-none">
      <div className="flex items-center gap-4 px-5 py-2.5 rounded-full border border-amber-800/40 bg-amber-950/45 backdrop-blur-xl shadow-2xl animate-bounce-subtle">
        {/* Status indicator */}
        <div className="flex items-center gap-2 border-r border-slate-800/80 pr-4 shrink-0">
          <span className="flex h-2.5 w-2.5 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            Demo Active
          </span>
        </div>

        {/* Operations */}
        <div className="flex items-center gap-3">
          {/* Simulate Urgent Inbound */}
          <button
            onClick={() => handleAction("simulate_email")}
            disabled={loadingAction !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#140e2b] hover:bg-[#201744] text-amber-300 border border-amber-900/40 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Simulate receiving an urgent email escalation from Acme Corp"
          >
            {loadingAction === "simulate_email" ? (
              <div className="h-3 w-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
            Simulate Email
          </button>

          {/* Reset Store */}
          <button
            onClick={() => handleAction("reset")}
            disabled={loadingAction !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700/60 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Reset demo data to original seed values"
          >
            {loadingAction === "reset" ? (
              <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
              </svg>
            )}
            Reset Demo
          </button>

          {/* Exit Demo */}
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border border-rose-900/30 transition-all active:scale-95 cursor-pointer"
            title="Exit demo mode and return to live workspace"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Exit Demo
          </button>
        </div>

        {/* Inject custom micro-animations */}
        <style>{`
          @keyframes bounceSubtle {
            0%, 100% { transform: translate(-50%, 0px); }
            50%      { transform: translate(-50%, -2px); }
          }
          .animate-bounce-subtle {
            animation: bounceSubtle 4s ease-in-out infinite;
          }
        `}</style>
      </div>

      {/* Inline error — replaces alert() */}
      {actionError && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/60 border border-rose-800/50 text-rose-300 text-[10px] font-semibold backdrop-blur-xl shadow-lg">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {actionError}
          <button
            onClick={() => setActionError(null)}
            className="ml-1 text-rose-400 hover:text-rose-200"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

