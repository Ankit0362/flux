import { useCommitments } from "@/hooks/useCommitments";
import Link from "next/link";

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
  onTabChange
}: SidebarProps) {
  const { commitments } = useCommitments();
  const pendingCommitments = commitments.filter(c => c.status === "PENDING").length;

  return (
    <aside className="w-64 border-r border-[#E8ECF0] bg-white shadow-sm flex flex-col justify-between shrink-0">
      <div>
        {/* Logo */}
        <div className="p-6 border-b border-[#E8ECF0] flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#0C0A09] flex items-center justify-center font-extrabold text-white shadow-lg shadow-amber-900/30">
            C
          </div>
          <div>
            <span className="font-extrabold text-lg text-[#0C0A09] font-serif">
              Flux
            </span>
            <span className="text-[10px] block text-[#57534E] tracking-wider font-semibold uppercase">
              COGNITIVE LAYER
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="p-4 space-y-1">
          <Link
            href="/dashboard"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activePage === "dashboard"
                ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
                : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Daily Briefing
          </Link>
          
          {onTabChange && (activePage === "inbox" || activePage === "commitments") ? (
            <button
              onClick={() => onTabChange("inbox")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activePage === "inbox"
                  ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
                  : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
              </svg>
              Inbox
            </button>
          ) : (
            <Link
              href="/inbox"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activePage === "inbox"
                  ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
                  : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
              </svg>
              Inbox
            </Link>
          )}

          {onTabChange && (activePage === "inbox" || activePage === "commitments") ? (
            <button
              onClick={() => onTabChange("commitments")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activePage === "commitments"
                  ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
                  : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Commitments
              {pendingCommitments > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[#A16207] border border-amber-500/30 font-bold">
                  {pendingCommitments}
                </span>
              )}
            </button>
          ) : (
            <Link
              href="/inbox?tab=commitments"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activePage === "commitments"
                  ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
                  : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Commitments
              {pendingCommitments > 0 && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[#A16207] border border-amber-500/30 font-bold">
                  {pendingCommitments}
                </span>
              )}
            </Link>
          )}

          <Link
            href="/calendar"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activePage === "calendar"
                ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
                : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendar
          </Link>
          <Link
            href="/contacts"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activePage === "contacts"
                ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
                : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Contacts
          </Link>
          <Link
            href="/admin/sync-debug"
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activePage === "sync"
                ? "bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] shadow-inner"
                : "text-[#57534E] hover:text-[#0C0A09] hover:bg-[#FAFAF9] border border-transparent"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Sync Console
          </Link>
        </nav>
      </div>

      {/* User Account / Connect CTA */}
      <div className="p-4 border-t border-[#E8ECF0] bg-[#FAFAF9]">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white border border-[#E8ECF0] flex items-center justify-center font-bold text-[#0C0A09]">
                {userName ? userName.charAt(0).toUpperCase() : userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-[#0C0A09] truncate">{userName || (userEmail?.split("@")[0] || "User")}</p>
                <p className="text-[10px] text-[#57534E] truncate">{userEmail || "Loading..."}</p>
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
                    <svg className="animate-spin h-3 w-3 text-[#0C0A09]" fill="none" viewBox="0 0 24 24">
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
            <p className="text-xs text-[#A16207] font-medium leading-relaxed">Connect your Gmail to synchronize data</p>
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
    </aside>
  );
}
