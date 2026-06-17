"use client";

import { useCommitments } from "@/hooks/useCommitments";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SidebarProps {
  activePage: "dashboard" | "inbox" | "commitments" | "calendar" | "contacts" | "sync";
  userEmail?: string | null;
  userName?: string | null;
  isConnected?: boolean;
  syncing?: boolean;
  onManualSync?: () => void;
  onConnect?: () => void;
  onTabChange?: (tab: "inbox" | "commitments") => void;
}

export function Sidebar({
  activePage,
  userEmail,
  userName,
  isConnected = true,
  syncing = false,
  onManualSync,
  onConnect,
  onTabChange,
}: SidebarProps) {
  const { commitments } = useCommitments();
  const pendingCommitments = commitments.filter((c) => c.status === "PENDING").length;
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [todayEventCount, setTodayEventCount] = useState<number | null>(null);

  // Fetch live badge counts
  useEffect(() => {
    fetch("/api/dashboard/briefing")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setUnreadCount(d.unreadEmailCount ?? null);
          setTodayEventCount(d.calendarStats?.todayEventCount ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  };

  const openAskFlux = () => {
    window.dispatchEvent(new CustomEvent("flux:open-ai"));
  };

  const linkClass = (page: string) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative ${
      activePage === page
        ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
        : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
    }`;

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-64 border-r border-[#E8ECF0] bg-white shadow-sm flex-col justify-between shrink-0">
        <div className="flex flex-col h-full">
          {/* ── Logo ── */}
          <div className="p-5 border-b border-[#E8ECF0] flex items-center gap-3 shrink-0">
            <img src="/shortlogo.png" alt="Flux Icon" className="h-8 w-8 object-contain" />
            <div>
              <span className="font-extrabold text-lg text-[#0C0A09] font-sans tracking-wide">FLUX</span>
              <span className="text-[9px] block text-[#C5A06D] tracking-widest font-bold uppercase">AI CHIEF OF STAFF</span>
            </div>
          </div>

          {/* ── Search / Command Launcher ── */}
          <div className="px-4 pt-4 pb-2 shrink-0">
            <button
              onClick={openCommandPalette}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#FAFAF9] border border-[#E8ECF0] text-[#57534E] hover:text-[#0C0A09] hover:border-amber-500/40 transition-all text-xs font-medium"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="flex-1 text-left">Search or jump to...</span>
              <kbd className="text-[9px] font-bold bg-white border border-[#E8ECF0] px-1.5 py-0.5 rounded text-[#57534E]">⌘K</kbd>
            </button>
          </div>

          {/* ── Navigation ── */}
          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">

            {/* WORKSPACE Group */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#57534E]/60 px-3 mb-1.5">Workspace</p>
              <div className="space-y-0.5">
                <Link href="/dashboard" className={linkClass("dashboard")}>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Daily Briefing</span>
                </Link>

                {/* Inbox with unread badge */}
                {onTabChange && (activePage === "inbox" || activePage === "commitments") ? (
                  <button onClick={() => onTabChange("inbox")} className={linkClass("inbox")}>
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
                    </svg>
                    <span>Inbox</span>
                    {unreadCount != null && unreadCount > 0 && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[#A16207] border border-amber-500/30 font-bold">{unreadCount > 99 ? "99+" : unreadCount}</span>
                    )}
                  </button>
                ) : (
                  <Link href="/inbox" className={linkClass("inbox")}>
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
                    </svg>
                    <span>Inbox</span>
                    {unreadCount != null && unreadCount > 0 && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[#A16207] border border-amber-500/30 font-bold">{unreadCount > 99 ? "99+" : unreadCount}</span>
                    )}
                  </Link>
                )}

                <Link href="/calendar" className={linkClass("calendar")}>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Calendar</span>
                  {todayEventCount != null && todayEventCount > 0 && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-600 border border-sky-500/30 font-bold">{todayEventCount} today</span>
                  )}
                </Link>
              </div>
            </div>

            {/* INTELLIGENCE Group */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#57534E]/60 px-3 mb-1.5">Intelligence</p>
              <div className="space-y-0.5">
                {/* Commitments */}
                {onTabChange && (activePage === "inbox" || activePage === "commitments") ? (
                  <button onClick={() => onTabChange("commitments")} className={linkClass("commitments")}>
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>Commitments</span>
                    {pendingCommitments > 0 && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[#A16207] border border-amber-500/30 font-bold">{pendingCommitments}</span>
                    )}
                  </button>
                ) : (
                  <Link href="/inbox?tab=commitments" className={linkClass("commitments")}>
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>Commitments</span>
                    {pendingCommitments > 0 && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[#A16207] border border-amber-500/30 font-bold">{pendingCommitments}</span>
                    )}
                  </Link>
                )}

                <Link href="/contacts" className={linkClass("contacts")}>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Contacts
                </Link>
              </div>
            </div>

            {/* TOOLS Group */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#57534E]/60 px-3 mb-1.5">Tools</p>
              <div className="space-y-0.5">
                {/* Ask Flux AI */}
                <button
                  onClick={openAskFlux}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent group"
                >
                  <div className="w-4 h-4 shrink-0 relative flex items-center justify-center">
                    <span className="absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </div>
                  <span>Ask Flux AI</span>
                  <kbd className="ml-auto text-[9px] font-bold bg-white border border-[#E8ECF0] px-1.5 py-0.5 rounded text-[#57534E] opacity-0 group-hover:opacity-100 transition-opacity">⌘J</kbd>
                </button>

                {/* Keyboard Shortcuts */}
                <button
                  onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }))}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Shortcuts</span>
                  <kbd className="ml-auto text-[9px] font-bold bg-white border border-[#E8ECF0] px-1.5 py-0.5 rounded text-[#57534E]">?</kbd>
                </button>

                {/* Sync Console (dev) */}
                <Link href="/admin/sync-debug" className={linkClass("sync")}>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Sync Console
                </Link>
              </div>
            </div>
          </nav>

          {/* ── User Account Footer ── */}
          <div className="p-4 border-t border-[#E8ECF0] bg-[#FAFAF9] shrink-0">
            {isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-white border border-[#E8ECF0] flex items-center justify-center font-bold text-[#0C0A09] shrink-0">
                    {userName ? userName.charAt(0).toUpperCase() : userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-semibold text-[#0C0A09] truncate">{userName || (userEmail?.split("@")[0] || "User")}</p>
                    <p className="text-[10px] text-[#57534E] truncate">{userEmail || "Loading..."}</p>
                  </div>
                  {/* Sync Status Dot */}
                  <div title={syncing ? "Syncing..." : "Gmail connected"} className="shrink-0">
                    {syncing ? (
                      <div className="h-2.5 w-2.5 border border-amber-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                    )}
                  </div>
                </div>
                {onManualSync && (
                  <button
                    onClick={onManualSync}
                    disabled={syncing}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-white hover:bg-[#f3f4f6] text-[#0C0A09] transition-all border border-[#E8ECF0] disabled:opacity-50"
                  >
                    {syncing ? (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                        </svg>
                        Refresh Mail
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-center p-2 rounded-xl bg-white border border-[#E8ECF0]">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                  <p className="text-xs text-rose-500 font-semibold">Gmail not connected</p>
                </div>
                {onConnect && (
                  <button
                    onClick={onConnect}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30 transition-all"
                  >
                    Connect Gmail
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E8ECF0] flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        <Link href="/dashboard" className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${activePage === "dashboard" ? "text-[#A16207]" : "text-[#57534E]"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-[9px] font-bold">Brief</span>
        </Link>
        <Link href="/inbox" className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl relative ${activePage === "inbox" ? "text-[#A16207]" : "text-[#57534E]"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
          </svg>
          {unreadCount != null && unreadCount > 0 && <span className="absolute top-0 right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[8px] font-black flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          <span className="text-[9px] font-bold">Inbox</span>
        </Link>
        <Link href="/calendar" className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${activePage === "calendar" ? "text-[#A16207]" : "text-[#57534E]"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[9px] font-bold">Calendar</span>
        </Link>
        <Link href="/contacts" className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${activePage === "contacts" ? "text-[#A16207]" : "text-[#57534E]"}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[9px] font-bold">Contacts</span>
        </Link>
        <button onClick={openAskFlux} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[#57534E]">
          <div className="w-5 h-5 relative flex items-center justify-center">
            <span className="absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </div>
          <span className="text-[9px] font-bold">Ask AI</span>
        </button>
      </nav>
    </>
  );
}
