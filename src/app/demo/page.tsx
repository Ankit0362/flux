"use client";

import { useEffect, useState } from "react";

export default function DemoLauncherPage() {
  const [activated, setActivated] = useState(false);

  const handleLaunch = () => {
    setActivated(true);
    // Set cookie to activate Demo Mode server-side
    document.cookie = "flux_mode=demo; path=/; max-age=86400"; // Expires in 24 hours
    // Also save in localStorage for UI convenience
    localStorage.setItem("flux_mode", "demo");
    // Redirect to dashboard
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-[#05070e] text-slate-100 flex flex-col justify-between selection:bg-amber-900/50 selection:text-amber-200 font-sans relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-amber-900/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-stone-950/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="relative w-full max-w-5xl mx-auto px-6 py-8 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-600 to-stone-500 flex items-center justify-center font-extrabold text-white shadow-lg shadow-amber-950/50">
            C
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-amber-300 bg-clip-text text-transparent">
              Flux
            </span>
            <span className="text-[9px] block text-amber-400/80 tracking-widest font-extrabold uppercase -mt-0.5">
              COGNITIVE ASSISTANT
            </span>
          </div>
        </div>

        <a
          href="/"
          className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancel
        </a>
      </header>

      {/* Body Content */}
      <main className="relative flex-1 flex flex-col justify-center items-center max-w-4xl mx-auto px-6 py-12 z-10 w-full">
        <div className="text-center max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/45 border border-amber-900/40 shadow-inner">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase text-amber-300">
              Presentation Ready System
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Launch <span className="bg-gradient-to-r from-amber-400 via-stone-300 to-pink-400 bg-clip-text text-transparent">Flux Demo Mode</span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl mx-auto font-medium">
            Demo Mode loads a seeded, realistic executive database context. Present every cognitive intelligence feature live on stage with zero database side-effects.
          </p>

          {/* Seeded Data Cards Description */}
          <div className="grid grid-cols-2 gap-4 text-left pt-6 max-w-xl mx-auto">
            <div className="p-4 rounded-xl border border-slate-805/50 bg-[#0c0f1f]/35">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                <h4 className="text-xs font-bold text-slate-200">David Vance (Client)</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Enterprise client at Acme Corp. Flagged <strong>At Risk</strong> due to a critical overdue API spec commitment (Risk score: 90).
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-805/50 bg-[#0c0f1f]/35">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <h4 className="text-xs font-bold text-slate-200">Sarah Jenkins (Recruiter)</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                CTO Search recruiter. Flagged <strong>At Risk</strong> due to no communication in 12 days and outstanding NDA signatures.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-805/50 bg-[#0c0f1f]/35">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <h4 className="text-xs font-bold text-slate-200">Elena Rostova (Founder)</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                FutureAI Founder. <strong>Strong Health (85)</strong>. Highlights active pitch deck reviews and pending Sequoia VP introductions.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-805/50 bg-[#0c0f1f]/35">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <h4 className="text-xs font-bold text-slate-200">Dr. Marcus Aurelius (Mentor)</h4>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Advisor at VC Partners. <strong>Strong Health (95)</strong>. Pending coffee sync tomorrow and advisory agreement signoff.
              </p>
            </div>
          </div>

          <div className="pt-8">
            <button
              onClick={handleLaunch}
              disabled={activated}
              className="px-8 py-4.5 rounded-2xl font-bold bg-gradient-to-r from-amber-600 to-stone-600 hover:from-amber-500 hover:to-stone-500 text-white shadow-xl shadow-amber-950/40 hover:shadow-amber-950/60 transform hover:-translate-y-0.5 active:scale-95 transition-all text-sm w-full max-w-xs cursor-pointer disabled:opacity-60"
            >
              {activated ? "Initializing..." : "Launch Demo Workspace"}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full text-center py-6 border-t border-slate-900 z-10">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
          Flux Cognitive Layer · Hackathon V1
        </p>
      </footer>
    </div>
  );
}
