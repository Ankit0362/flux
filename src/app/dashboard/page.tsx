"use client";

import { useEffect, useState, useCallback } from "react";
import { CommitmentDTO } from "@/types/commitments";
import { parseEmailAddress } from "@/lib/emailUtils";
import { ExecutiveBriefingDTO } from "@/types/briefing";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { BentoGrid } from "@/components/ui/BentoGrid";
import { motion, AnimatePresence } from "framer-motion";

const CommitmentStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  SNOOZED: "SNOOZED",
} as const;
type CommitmentStatus = typeof CommitmentStatus[keyof typeof CommitmentStatus];

interface DashboardStats {
  pendingCount: number;
  completedCount: number;
  overdueCount: number;
  snoozedCount: number;
  totalCount: number;
}

interface DashboardLists {
  recentCommitments: CommitmentDTO[];
  highConfidenceCommitments: CommitmentDTO[];
  upcomingDeadlines: CommitmentDTO[];
}

interface ContactDTO {
  id: string;
  email: string;
  name: string | null;
  relationshipScore: number;
  relationshipHealth: string;
  relationshipReason: string;
  totalExchanges: number;
  inboundCount: number;
  outboundCount: number;
  openCommitments: number;
  completedCommitments: number;
  lastInteractionAt: string | null;
}

interface RelationshipsData {
  totalContacts: number;
  strongCount: number;
  neutralCount: number;
  atRiskCount: number;
  topContacts: ContactDTO[];
  atRiskContacts: ContactDTO[];
}

interface BriefingData {
  userName: string;
  userEmail: string;
  unreadEmailCount: number;
  stats: DashboardStats;
  relationships: RelationshipsData;
  lists: DashboardLists;
  calendarStats?: {
    todayEventCount: number;
    nextEvent: { title: string; startAt: string; attendeeCount: number } | null;
    upcomingWeekCount: number;
    conflictCount: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);

  // AI Executive Briefing states
  const [briefing, setBriefing] = useState<ExecutiveBriefingDTO | null>(null);
  const [briefingLoading, setBriefingLoading] = useState<boolean>(true);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [briefingCached, setBriefingCached] = useState<boolean>(false);

  // Set local time on client side to avoid SSR hydrations mismatch
  useEffect(() => {
    setCurrentTime(new Date());
  }, []);

  const fetchBriefing = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/briefing");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to load dashboard briefing");
      }
      const briefingData = await res.json();
      setData(briefingData);
    } catch (err: any) {
      console.error("Error fetching briefing stats:", err);
      setError(err.message || "Failed to load briefing dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExecutiveBriefing = useCallback(async (force = false) => {
    setBriefingLoading(true);
    setBriefingError(null);
    try {
      const url = `/api/dashboard/executive-briefing${force ? "?force=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate executive briefing");
      }
      const briefingData = await res.json();
      setBriefing(briefingData.briefing);
      setBriefingCached(briefingData.cached);
    } catch (err: any) {
      console.error("Error fetching executive briefing:", err);
      setBriefingError(err.message || "Failed to load executive briefing.");
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
    fetchExecutiveBriefing();
  }, [fetchBriefing, fetchExecutiveBriefing]);

  const handleCompleteAction = async (actionId: string, refType: string, refId?: string) => {
    if (refType === "commitment" && refId) {
      await updateStatus(refId, CommitmentStatus.COMPLETED);
    }
    // Remove completed action locally for instant feedback
    if (briefing) {
      setBriefing({
        ...briefing,
        recommendedActions: briefing.recommendedActions.filter((a) => a.id !== actionId),
      });
    }
  };

  const updateStatus = async (id: string, newStatus: CommitmentStatus) => {
    if (!data) return;
    setUpdatingId(id);
    setError(null);

    // Save previous state for rollback on error
    const previousData = { ...data };

    // 1. Optimistic Update Local State
    setData((prev) => {
      if (!prev) return null;

      // Helper to update arrays
      const updateList = (list: CommitmentDTO[]) =>
        list.map((c) => (c.id === id ? { ...c, status: newStatus } : c));

      // Find if commitment was pending and overdue
      const targetCommitment =
        prev.lists.recentCommitments.find((c) => c.id === id) ||
        prev.lists.highConfidenceCommitments.find((c) => c.id === id) ||
        prev.lists.upcomingDeadlines.find((c) => c.id === id);

      if (!targetCommitment) return prev;

      const wasPending = targetCommitment.status === CommitmentStatus.PENDING;
      const isOverdue =
        wasPending &&
        targetCommitment.dueDate &&
        new Date(targetCommitment.dueDate) < new Date();

      // Compute new counts
      let pendingDiff = 0;
      let completedDiff = 0;
      let snoozedDiff = 0;
      let overdueDiff = 0;

      if (wasPending) {
        pendingDiff = -1;
        if (newStatus === CommitmentStatus.COMPLETED) {
          completedDiff = 1;
        } else if (newStatus === CommitmentStatus.SNOOZED) {
          snoozedDiff = 1;
        }
        if (isOverdue) {
          overdueDiff = -1;
        }
      }

      return {
        ...prev,
        stats: {
          ...prev.stats,
          pendingCount: prev.stats.pendingCount + pendingDiff,
          completedCount: prev.stats.completedCount + completedDiff,
          snoozedCount: prev.stats.snoozedCount + snoozedDiff,
          overdueCount: Math.max(0, prev.stats.overdueCount + overdueDiff),
        },
        lists: {
          recentCommitments: updateList(prev.lists.recentCommitments),
          highConfidenceCommitments: updateList(prev.lists.highConfidenceCommitments),
          // Filter out of upcoming deadlines if no longer pending
          upcomingDeadlines: prev.lists.upcomingDeadlines
            .map((c) => (c.id === id ? { ...c, status: newStatus } : c))
            .filter((c) => c.status === CommitmentStatus.PENDING),
        },
      };
    });

    // 2. Perform API PATCH
    try {
      const res = await fetch(`/api/commitments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to update status to ${newStatus}`);
      }

      // RE-06: Do NOT trigger a background refetch here.
      // If the user clicks multiple checkboxes quickly, a slow refetch will return
      // stale data and overwrite the subsequent optimistic updates.
      // fetchBriefing(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save commitment status.";
      console.error(`Failed to update commitment ${id} to status ${newStatus}:`, err);
      setError(message);
      // Rollback to previous state
      setData(previousData);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleManualSync = async () => {
    if (!data) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bootstrap",
          email: data.userEmail,
        }),
      });
      if (res.ok) {
        await Promise.all([
          fetchBriefing(false),
          fetchExecutiveBriefing(true),
        ]);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Date Formatting Helper
  const formatBriefingDate = () => {
    if (!currentTime) return "Loading...";
    return currentTime.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatSender = (rawSender: string) => {
    const { name, email } = parseEmailAddress(rawSender);
    return name || email;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Get current hour for greeting text
  const getGreeting = () => {
    if (!currentTime) return "Welcome";
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex h-screen w-full bg-[#05070f] text-slate-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800 bg-[#080a14] flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-600 to-stone-500 flex items-center justify-center font-extrabold text-white shadow-lg shadow-amber-900/30">
              C
            </div>
            <div>
              <span className="font-extrabold text-lg bg-gradient-to-r from-amber-400 to-stone-300 bg-clip-text text-transparent">
                ChiefOS
              </span>
              <span className="text-[10px] block text-slate-500 tracking-wider font-semibold uppercase">
                COGNITIVE LAYER
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1">
            <a
              href="/dashboard"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all bg-amber-950/40 text-amber-200 border border-amber-900/30 shadow-inner"
            >
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Daily Briefing
            </a>
            <a
              href="/inbox"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all border border-transparent"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
              </svg>
              Inbox
            </a>
            <a
              href="/calendar"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all border border-transparent"
            >
              <svg className="w-5 h-5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar
            </a>
            <a
              href="/contacts"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all border border-transparent"
            >
              <svg className="w-5 h-5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Contacts
            </a>
            <a
              href="/admin/sync-debug"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-350 hover:bg-slate-900/40 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Sync Console
            </a>
          </nav>
        </div>

        {/* User Account Info */}
        <div className="p-4 border-t border-slate-800 bg-[#05070e]">
          {data ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-850 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                  {data.userName.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-slate-200 truncate">{data.userName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{data.userEmail}</p>
                </div>
              </div>
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all border border-slate-700/60 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
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
                    Sync Mail
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center">
              <div className="h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <AuroraBackground showRadialGradient={true} className="flex-1 flex flex-col overflow-y-auto w-full selection:bg-amber-900/50 selection:text-amber-200 bg-transparent">
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-amber-900/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-stone-950/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Header */}
        <header className="p-6 md:p-8 border-b border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 relative z-10">
          <div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-950/50 text-amber-300 border border-amber-900/30 font-bold uppercase tracking-wider mb-2.5 inline-block">
              Daily Briefing
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {data ? `${getGreeting()}, ${data.userName}` : "Executive Briefing"}
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 font-medium">{formatBriefingDate()}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchBriefing(true);
                fetchExecutiveBriefing(true);
              }}
              disabled={loading || briefingLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700/60 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {loading || briefingLoading ? (
                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                </svg>
              )}
              Refresh
            </button>
            <a
              href="/inbox"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 to-stone-600 hover:from-amber-500 hover:to-stone-500 text-white shadow-lg shadow-amber-950/20 transition-all active:scale-95"
            >
              Open Inbox
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="p-6 md:p-8 space-y-8 relative z-10 flex-1">
          {error && (
            <div className="p-4 rounded-xl border border-rose-900/30 bg-rose-950/15 text-rose-350 text-xs font-semibold flex items-center gap-2 animate-pulse">
              <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Executive Briefing Widget */}
          <ExecutiveBriefingWidget
            briefing={briefing}
            loading={briefingLoading}
            error={briefingError}
            cached={briefingCached}
            onRefresh={() => fetchExecutiveBriefing(true)}
            onCompleteAction={handleCompleteAction}
          />

          {/* Stats Grid */}
          <BentoGrid className="grid-cols-2 lg:grid-cols-5 md:auto-rows-[auto]">
            {loading ? (
              <>
                <ShimmerStatsCard />
                <ShimmerStatsCard />
                <ShimmerStatsCard />
                <ShimmerStatsCard />
                <ShimmerStatsCard />
              </>
            ) : data ? (
              <>
                {/* Pending Stat */}
                <SpotlightCard className="p-5 flex flex-col justify-between group h-full">
                  <div className="absolute top-0 right-0 p-3 text-amber-500/20 group-hover:text-amber-500/35 transition-colors">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Pending Promises</span>
                  <span className="text-3xl font-black mt-4 text-amber-400">{data.stats.pendingCount}</span>
                  <p className="text-[10px] text-slate-500 mt-2">Active obligations in progress</p>
                </SpotlightCard>

                {/* Completed Stat */}
                <SpotlightCard className="p-5 flex flex-col justify-between group h-full" spotlightColor="rgba(52, 211, 153, 0.15)">
                  <div className="absolute top-0 right-0 p-3 text-emerald-500/20 group-hover:text-emerald-500/35 transition-colors">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Completed Milestones</span>
                  <span className="text-3xl font-black mt-4 text-emerald-400">{data.stats.completedCount}</span>
                  <p className="text-[10px] text-slate-500 mt-2">Successfully closed out obligations</p>
                </SpotlightCard>

                {/* Overdue Stat */}
                <SpotlightCard className="p-5 flex flex-col justify-between group h-full" spotlightColor="rgba(244, 63, 94, 0.15)">
                  <div className="absolute top-0 right-0 p-3 text-rose-500/20 group-hover:text-rose-500/35 transition-colors">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Overdue Actions</span>
                    {data.stats.overdueCount > 0 && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                  <span className={`text-3xl font-black mt-4 ${data.stats.overdueCount > 0 ? "text-rose-400" : "text-slate-350"}`}>
                    {data.stats.overdueCount}
                  </span>
                  <p className={`text-[10px] mt-2 font-medium ${data.stats.overdueCount > 0 ? "text-rose-400" : "text-slate-500"}`}>
                    {data.stats.overdueCount > 0 ? "Requires urgent attention" : "No overdue deadlines"}
                  </p>
                </SpotlightCard>

                {/* Unread Mail Stat */}
                <SpotlightCard className="p-5 flex flex-col justify-between group h-full" spotlightColor="rgba(167, 139, 250, 0.15)">
                  <div className="absolute top-0 right-0 p-3 text-amber-500/20 group-hover:text-amber-500/35 transition-colors">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Unread Email Threads</span>
                  <span className="text-3xl font-black mt-4 text-amber-400">{data.unreadEmailCount}</span>
                  <p className="text-[10px] text-slate-500 mt-2">Active threads awaiting review</p>
                </SpotlightCard>

                {/* Upcoming Meetings Stat */}
                <SpotlightCard className="p-5 flex flex-col justify-between group h-full col-span-2 lg:col-span-1" spotlightColor="rgba(56, 189, 248, 0.15)">
                  <div className="absolute top-0 right-0 p-3 text-sky-500/20 group-hover:text-sky-500/35 transition-colors">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Today's Meetings</span>
                  <div className="mt-4 flex flex-col gap-1">
                    <span className="text-3xl font-black text-sky-400">{data.calendarStats?.todayEventCount || 0}</span>
                    {data.calendarStats?.nextEvent && (
                      <span className="text-xs text-slate-300 font-medium truncate w-full pr-8">
                        Next: {data.calendarStats.nextEvent.title}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] mt-2">
                    {(data.calendarStats?.conflictCount ?? 0) > 0 ? (
                      <span className="text-amber-400 font-bold">{data.calendarStats?.conflictCount} conflicts detected.</span>
                    ) : (
                      <span className="text-slate-500">Your schedule is clear of conflicts</span>
                    )}
                  </p>
                </SpotlightCard>
              </>
            ) : null}
          </BentoGrid>

          {/* Relationship Intelligence Section */}
          {!loading && data && data.relationships && data.relationships.totalContacts > 0 && (
            <div className="space-y-6">
              {/* Health Distribution Row */}
              <div className="glass-card p-6 rounded-2xl border border-slate-800/60">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="h-7 w-7 rounded-lg bg-stone-950/60 border border-stone-900/40 flex items-center justify-center">
                    <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Relationship Health</h2>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-full">
                    {data.relationships.totalContacts} Contacts
                  </span>
                </div>

                {/* Health distribution bars */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-900/25 text-center group hover:border-emerald-800/40 transition-all">
                    <span className="text-2xl font-black text-emerald-400">{data.relationships.strongCount}</span>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                      <span className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-wider">Strong</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/40 text-center group hover:border-slate-700/50 transition-all">
                    <span className="text-2xl font-black text-slate-300">{data.relationships.neutralCount}</span>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Neutral</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-900/25 text-center group hover:border-rose-800/40 transition-all">
                    <span className="text-2xl font-black text-rose-400">{data.relationships.atRiskCount}</span>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse"></span>
                      <span className="text-[10px] font-bold text-rose-300/80 uppercase tracking-wider">At Risk</span>
                    </div>
                  </div>
                </div>

                {/* Stacked bar visual */}
                {data.relationships.totalContacts > 0 && (
                  <div className="mt-4 h-2 rounded-full overflow-hidden flex bg-slate-900/60">
                    {data.relationships.strongCount > 0 && (
                      <div
                        className="bg-emerald-500 transition-all"
                        style={{ width: `${(data.relationships.strongCount / data.relationships.totalContacts) * 100}%` }}
                      />
                    )}
                    {data.relationships.neutralCount > 0 && (
                      <div
                        className="bg-slate-500 transition-all"
                        style={{ width: `${(data.relationships.neutralCount / data.relationships.totalContacts) * 100}%` }}
                      />
                    )}
                    {data.relationships.atRiskCount > 0 && (
                      <div
                        className="bg-rose-500 transition-all"
                        style={{ width: `${(data.relationships.atRiskCount / data.relationships.totalContacts) * 100}%` }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Key Relationships Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Top Contacts */}
                <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-6 rounded-lg bg-emerald-950/50 border border-emerald-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Top Relationships</h3>
                  </div>
                  <div className="space-y-3">
                    {data.relationships.topContacts.length === 0 ? (
                      <p className="text-[11px] text-slate-500 text-center py-6">No contacts scored yet.</p>
                    ) : (
                      data.relationships.topContacts.map((c) => (
                        <ContactCard key={c.id} contact={c} />
                      ))
                    )}
                  </div>
                </div>

                {/* At Risk Contacts */}
                <div className="glass-card p-5 rounded-2xl border border-slate-800/60">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-6 rounded-lg bg-rose-950/50 border border-rose-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Needs Attention</h3>
                  </div>
                  <div className="space-y-3">
                    {data.relationships.atRiskContacts.length === 0 ? (
                      <p className="text-[11px] text-slate-500 text-center py-6">All relationships are healthy!</p>
                    ) : (
                      data.relationships.atRiskContacts.map((c) => (
                        <ContactCard key={c.id} contact={c} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Focus Columns Board */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* COLUMN 1: UPCOMING DEADLINES */}
            <FocusColumn title="Upcoming Deadlines" icon={
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }>
              {loading ? (
                <ShimmerList />
              ) : !data || data.lists.upcomingDeadlines.length === 0 ? (
                <EmptyListState message="No upcoming deadlines. Take a breath!" />
              ) : (
                data.lists.upcomingDeadlines.map((c) => (
                  <BriefingItemCard
                    key={c.id}
                    commitment={c}
                    updatingId={updatingId}
                    onComplete={(id) => updateStatus(id, CommitmentStatus.COMPLETED)}
                    onSnooze={(id) => updateStatus(id, CommitmentStatus.SNOOZED)}
                    formatSender={formatSender}
                    formatDate={formatDate}
                    showDate={true}
                  />
                ))
              )}
            </FocusColumn>

            {/* COLUMN 2: HIGH CONFIDENCE OBLIGATIONS */}
            <FocusColumn title="Obligations Map (High Confidence)" icon={
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            }>
              {loading ? (
                <ShimmerList />
              ) : !data || data.lists.highConfidenceCommitments.length === 0 ? (
                <EmptyListState message="No high confidence commitments detected yet." />
              ) : (
                data.lists.highConfidenceCommitments.map((c) => (
                  <BriefingItemCard
                    key={c.id}
                    commitment={c}
                    updatingId={updatingId}
                    onComplete={(id) => updateStatus(id, CommitmentStatus.COMPLETED)}
                    onSnooze={(id) => updateStatus(id, CommitmentStatus.SNOOZED)}
                    formatSender={formatSender}
                    formatDate={formatDate}
                    showConfidence={true}
                  />
                ))
              )}
            </FocusColumn>

            {/* COLUMN 3: RECENT COMMITMENTS */}
            <FocusColumn title="Recent Extraction Insights" icon={
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }>
              {loading ? (
                <ShimmerList />
              ) : !data || data.lists.recentCommitments.length === 0 ? (
                <EmptyListState message="No recent commitments synced." />
              ) : (
                data.lists.recentCommitments.map((c) => (
                  <BriefingItemCard
                    key={c.id}
                    commitment={c}
                    updatingId={updatingId}
                    onComplete={(id) => updateStatus(id, CommitmentStatus.COMPLETED)}
                    onSnooze={(id) => updateStatus(id, CommitmentStatus.SNOOZED)}
                    formatSender={formatSender}
                    formatDate={formatDate}
                    showSourceSubject={true}
                  />
                ))
              )}
            </FocusColumn>
          </div>
        </div>
      </AuroraBackground>
    </div>
  );
}

// Subcomponents
function FocusColumn({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 bg-[#080a14]/65 border border-slate-900 rounded-2xl p-4 min-h-[480px]">
      <div className="flex items-center gap-2 border-b border-slate-900 pb-3 px-1">
        <div className="h-7 w-7 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">{title}</h2>
      </div>
      <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[580px] pr-1 scrollbar-none">
        {children}
      </div>
    </div>
  );
}

interface ItemCardProps {
  commitment: CommitmentDTO;
  updatingId: string | null;
  onComplete: (id: string) => Promise<void>;
  onSnooze: (id: string) => Promise<void>;
  formatSender: (val: string) => string;
  formatDate: (val: string) => string;
  showDate?: boolean;
  showConfidence?: boolean;
  showSourceSubject?: boolean;
}

function BriefingItemCard({
  commitment,
  updatingId,
  onComplete,
  onSnooze,
  formatSender,
  formatDate,
  showDate = false,
  showConfidence = false,
  showSourceSubject = false,
}: ItemCardProps) {
  const isUpdating = updatingId === commitment.id;
  const isPending = commitment.status === CommitmentStatus.PENDING;
  const isCompleted = commitment.status === CommitmentStatus.COMPLETED;
  const isSnoozed = commitment.status === CommitmentStatus.SNOOZED;

  const isOverdue =
    isPending &&
    commitment.dueDate &&
    new Date(commitment.dueDate) < new Date();

  const cardBorderClass = isPending
    ? commitment.riskLevel === "HIGH"
      ? "border-l-2 border-l-rose-500 bg-[#0e0a16]/40 hover:bg-[#120c1d]/50 shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)]"
      : commitment.riskLevel === "MEDIUM"
      ? "border-l-2 border-l-amber-500 bg-[#0e0f18]/40 hover:bg-[#131522]/50 shadow-[0_0_15px_-3px_rgba(245,158,11,0.08)]"
      : "border-l-2 border-l-slate-700 bg-[#0c0f1f]/35 hover:bg-[#0e1226]/50"
    : isCompleted
    ? "border-l-2 border-l-emerald-500/80 bg-[#0c0f1f]/20"
    : "border-l-2 border-l-slate-600/80 bg-[#0c0f1f]/20";

  return (
    <div className={`p-4 rounded-xl border border-slate-800/60 transition-all flex flex-col gap-3 group relative overflow-hidden ${cardBorderClass}`}>
      {/* Badges / Meta row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {commitment.direction === "INBOUND" ? (
            <span className="bg-blue-950/40 text-blue-300 border border-blue-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Inbound
            </span>
          ) : (
            <span className="bg-emerald-950/40 text-emerald-300 border border-emerald-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Outbound
            </span>
          )}

          {showConfidence && (
            <span className="bg-amber-950/40 text-amber-300 border border-amber-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
              Conf: {Math.round(commitment.confidence * 100)}%
            </span>
          )}

          {isPending && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
              commitment.riskLevel === "HIGH"
                ? "bg-rose-950/50 text-rose-300 border-rose-800/40 animate-pulse"
                : commitment.riskLevel === "MEDIUM"
                ? "bg-amber-950/40 text-amber-300 border-amber-900/30"
                : "bg-slate-900/60 text-slate-400 border-slate-800/60"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                commitment.riskLevel === "HIGH" ? "bg-rose-450" : commitment.riskLevel === "MEDIUM" ? "bg-amber-450" : "bg-slate-400"
              }`} />
              Risk: {commitment.riskScore}
            </span>
          )}

          {isOverdue && (
            <span className="bg-rose-950/40 text-rose-400 border border-rose-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
              Overdue
            </span>
          )}
        </div>

        {commitment.dueDate && (showDate || isOverdue) && (
          <span className={`text-[9px] font-bold ${isOverdue ? "text-rose-450" : "text-slate-450"}`}>
            Due {formatDate(commitment.dueDate)}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className={`text-xs font-semibold leading-relaxed break-words ${
        isCompleted ? "line-through text-slate-500" : "text-slate-200"
      }`}>
        {commitment.title}
      </h3>

      {/* Risk Reason (Explainable AI) */}
      {isPending && commitment.riskReason && commitment.riskReason !== "No significant risk factors active." && (
        <div className="text-[10px] text-slate-400 bg-slate-950/50 border border-slate-900/50 rounded-lg p-2 flex items-start gap-1.5">
          <span className="text-amber-500 shrink-0 text-[11px] leading-none">⚠️</span>
          <span className="leading-normal">{commitment.riskReason}</span>
        </div>
      )}

      {/* Extra source info */}
      {commitment.sourceEmail && (
        <div className="text-[10px] text-slate-500 border-t border-slate-900/50 pt-2.5 flex flex-col gap-0.5">
          {showSourceSubject && (
            <span className="truncate text-slate-400 font-medium">
              Subject: {commitment.sourceEmail.subject}
            </span>
          )}
          <span className="truncate">
            {commitment.direction === "INBOUND" ? "Sender" : "Recipient"}: {formatSender(commitment.sourceEmail.sender)}
          </span>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onComplete(commitment.id)}
            disabled={isUpdating}
            className="flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-emerald-950/20 cursor-pointer"
          >
            {isUpdating ? (
              <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Complete
              </>
            )}
          </button>
          <button
            onClick={() => onSnooze(commitment.id)}
            disabled={isUpdating}
            className="flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/40 flex items-center justify-center gap-1 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            {isUpdating ? (
              <div className="h-3 w-3 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Snooze
              </>
            )}
          </button>
        </div>
      )}

      {/* Completed / Snoozed Status Tag (If not pending) */}
      {!isPending && (
        <span className={`text-[9px] font-bold self-start px-2 py-0.5 rounded border mt-1 ${
          isCompleted
            ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/20"
            : "bg-slate-900 text-slate-400 border-slate-800"
        }`}>
          {commitment.status}
        </span>
      )}
    </div>
  );
}

function EmptyListState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-950/20 rounded-xl border border-dashed border-slate-900/40 py-10 my-4">
      <div className="h-10 w-10 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-450 mb-3 shadow-inner">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider leading-relaxed max-w-[180px]">
        {message}
      </p>
    </div>
  );
}

function ShimmerStatsCard() {
  return (
    <div className="p-5 rounded-2xl border border-slate-800/40 bg-[#0c0f1f]/20 animate-pulse flex flex-col justify-between h-28">
      <div className="h-3 w-24 bg-slate-800 rounded"></div>
      <div className="h-8 w-12 bg-slate-800 rounded mt-3"></div>
      <div className="h-2 w-32 bg-slate-800 rounded mt-3"></div>
    </div>
  );
}

function ShimmerList() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 rounded-xl border border-slate-800/40 bg-[#0c0f1f]/20 animate-pulse flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="h-3 w-16 bg-slate-800 rounded"></div>
            <div className="h-3 w-10 bg-slate-800 rounded"></div>
          </div>
          <div className="h-3.5 w-full bg-slate-800 rounded"></div>
          <div className="h-3 w-2/3 bg-slate-800 rounded"></div>
        </div>
      ))}
    </div>
  );
}

function ContactCard({ contact }: { contact: ContactDTO }) {
  const healthColor =
    contact.relationshipHealth === "Strong"
      ? "emerald"
      : contact.relationshipHealth === "At Risk"
      ? "rose"
      : "slate";

  const scoreColor =
    contact.relationshipScore >= 70
      ? "text-emerald-400"
      : contact.relationshipScore >= 35
      ? "text-amber-400"
      : "text-rose-400";

  const ringColor =
    contact.relationshipScore >= 70
      ? "border-emerald-500"
      : contact.relationshipScore >= 35
      ? "border-amber-500"
      : "border-rose-500";

  const initial = (contact.name || contact.email).charAt(0).toUpperCase();

  return (
    <div className="p-3.5 rounded-xl border border-slate-800/50 bg-[#0c0f1f]/30 hover:bg-[#0e1226]/50 hover:border-slate-700/50 transition-all group">
      <div className="flex items-start gap-3">
        {/* Avatar with score ring */}
        <div className={`h-9 w-9 rounded-full border-2 ${ringColor} flex items-center justify-center font-bold text-xs text-slate-200 bg-slate-900/80 shrink-0`}>
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + Score row */}
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">
              <span className="text-xs font-semibold text-slate-200 block truncate">
                {contact.name || contact.email.split("@")[0]}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">{contact.email}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-sm font-black ${scoreColor}`}>{contact.relationshipScore}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                healthColor === "emerald"
                  ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/30"
                  : healthColor === "rose"
                  ? "bg-rose-950/40 text-rose-300 border-rose-900/30"
                  : "bg-slate-900/60 text-slate-400 border-slate-800/60"
              }`}>
                {contact.relationshipHealth}
              </span>
            </div>
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              {contact.inboundCount}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {contact.outboundCount}
            </span>
            <span className="text-slate-600">|</span>
            <span>{contact.totalExchanges} exchanges</span>
            {contact.openCommitments > 0 && (
              <span className="text-amber-400">{contact.openCommitments} open</span>
            )}
            {contact.completedCommitments > 0 && (
              <span className="text-emerald-400">{contact.completedCommitments} done</span>
            )}
          </div>

          {/* Reason */}
          {contact.relationshipReason && (
            <p className="mt-2 text-[10px] text-slate-400/80 leading-relaxed bg-slate-950/40 rounded-lg px-2.5 py-1.5 border border-slate-900/40">
              {contact.relationshipReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface ExecutiveBriefingWidgetProps {
  briefing: ExecutiveBriefingDTO | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
  onRefresh: () => void;
  onCompleteAction: (id: string, refType: string, refId?: string) => void;
}

export function ExecutiveBriefingWidget({
  briefing,
  loading,
  error,
  cached,
  onRefresh,
  onCompleteAction,
}: ExecutiveBriefingWidgetProps) {
  if (loading) {
    return <ShimmerBriefing />;
  }

  if (error) {
    return (
      <div className="glass-card p-6 rounded-2xl border border-rose-900/30 bg-rose-950/10 text-slate-350 flex flex-col items-center justify-center gap-3 py-10">
        <div className="h-10 w-10 rounded-lg bg-rose-950/60 border border-rose-900/40 flex items-center justify-center text-rose-450 shadow-inner">
          <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-center max-w-md">{error}</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700/60 transition-all cursor-pointer"
        >
          Retry Briefing
        </button>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <SpotlightCard className="p-6 relative overflow-hidden shadow-2xl" spotlightColor="rgba(167, 139, 250, 0.15)">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-amber-900/10 rounded-full blur-[60px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-950/50 border border-amber-900/30 flex items-center justify-center text-amber-400 shadow-md">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <span className="text-[9px] block text-amber-400 font-extrabold uppercase tracking-widest">
              Executive Briefing Engine V1
            </span>
            <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
              Daily Intelligence Synthesis
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto sm:ml-0">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            cached 
              ? "bg-stone-950/40 text-stone-300 border-stone-900/30" 
              : "bg-emerald-950/40 text-emerald-300 border-emerald-900/30"
          }`}>
            {cached ? "Cached" : "Real-time"}
          </span>
          
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700/60 transition-all active:scale-95 cursor-pointer"
            title="Force refresh AI Daily Summary"
          >
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
            </svg>
            Sync AI
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {/* Left Column (Summary + Actions) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Executive Summary */}
          <div className="p-5 rounded-xl border border-slate-900 bg-slate-950/20">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Executive Summary
            </h3>
            <p className="text-slate-200 text-sm leading-relaxed font-medium">
              {briefing.executiveSummary}
            </p>
          </div>

          {/* Recommended Actions */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Recommended Actions
            </h3>
            <div className="space-y-2">
              {briefing.recommendedActions.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-900 rounded-xl">
                  No recommended actions today.
                </p>
              ) : (
                briefing.recommendedActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-3 rounded-xl border border-slate-800/40 bg-[#0c0f1f]/35 hover:bg-[#0e1226]/50 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => onCompleteAction(action.id, action.refType, action.refId)}
                        className="h-4.5 w-4.5 rounded-full border border-slate-700 hover:border-emerald-500 hover:bg-emerald-950/30 flex items-center justify-center transition-all shrink-0 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-transparent hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      
                      <span className="text-xs text-slate-250 font-semibold truncate leading-relaxed">
                        {action.action}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                        action.priority === "HIGH"
                          ? "bg-rose-950/35 text-rose-350 border-rose-900/35"
                          : action.priority === "MEDIUM"
                          ? "bg-amber-950/35 text-amber-350 border-amber-900/35"
                          : "bg-slate-900 text-slate-400 border-slate-800"
                      }`}>
                        {action.priority}
                      </span>
                      {action.refId && (
                        <a
                          href={action.refType === "email" ? `/inbox` : action.refType === "contact" ? `/dashboard` : `/dashboard`}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 transition-colors"
                        >
                          View
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Risks & Relationships) */}
        <div className="space-y-6">
          {/* Top Risks */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Top Risks
            </h3>
            <div className="space-y-2.5">
              {briefing.topRisks.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-900 rounded-xl">
                  No high-risk commitments identified.
                </p>
              ) : (
                briefing.topRisks.map((risk) => (
                  <div
                    key={risk.commitmentId}
                    className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                      risk.riskLevel === "HIGH"
                        ? "border-l-2 border-l-rose-500 border-slate-800 bg-[#0e0a16]/40 hover:bg-[#120c1d]/50"
                        : "border-l-2 border-l-amber-500 border-slate-800 bg-[#0e0f18]/40 hover:bg-[#131522]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200 truncate">
                        {risk.title}
                      </span>
                      <span className={`text-[8px] font-extrabold px-1 rounded-md ${
                        risk.riskLevel === "HIGH" ? "text-rose-450 bg-rose-950/20" : "text-amber-450 bg-amber-950/20"
                      }`}>
                        {risk.riskLevel}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-450 leading-relaxed font-medium">
                      {risk.reason}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Relationships Needing Attention */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Needs Attention
            </h3>
            <div className="space-y-2.5">
              {briefing.relationshipsAttention.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-900 rounded-xl">
                  All key relationships are healthy.
                </p>
              ) : (
                briefing.relationshipsAttention.map((rel) => (
                  <div
                    key={rel.contactId}
                    className="p-3 rounded-xl border border-slate-800/60 bg-[#0c0f1f]/30 hover:bg-[#0e1226]/50 transition-all flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200 truncate">
                        {rel.name || rel.email.split("@")[0]}
                      </span>
                      <span className="text-[9px] text-slate-500 truncate max-w-[120px]">
                        {rel.email}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-450 leading-relaxed font-medium bg-slate-950/30 p-1.5 rounded border border-slate-900/50">
                      {rel.reason}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

function ShimmerBriefing() {
  return (
    <div className="glass-card p-6 rounded-2xl border border-amber-900/20 bg-[#080a14]/65 animate-pulse flex flex-col gap-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
          <div className="space-y-2">
            <div className="h-2 w-24 bg-slate-800 rounded flex-shrink-0"></div>
            <div className="h-4 w-40 bg-slate-800 rounded flex-shrink-0"></div>
          </div>
        </div>
        <div className="h-6 w-16 bg-slate-800 rounded-full"></div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-xl border border-slate-900 bg-slate-950/20 space-y-2">
            <div className="h-2.5 w-1/3 bg-slate-800 rounded"></div>
            <div className="h-3.5 w-full bg-slate-800 rounded mt-4"></div>
            <div className="h-3.5 w-5/6 bg-slate-800 rounded"></div>
            <div className="h-3.5 w-4/5 bg-slate-800 rounded"></div>
          </div>
          
          <div className="space-y-3">
            <div className="h-2.5 w-24 bg-slate-800 rounded"></div>
            {[1, 2].map((i) => (
              <div key={i} className="h-12 w-full bg-slate-800/40 border border-slate-800 rounded-xl"></div>
            ))}
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="h-2.5 w-20 bg-slate-800 rounded"></div>
            <div className="h-20 w-full bg-slate-800/30 border border-slate-800 rounded-xl"></div>
          </div>
          
          <div className="space-y-3">
            <div className="h-2.5 w-24 bg-slate-800 rounded"></div>
            <div className="h-20 w-full bg-slate-800/30 border border-slate-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

