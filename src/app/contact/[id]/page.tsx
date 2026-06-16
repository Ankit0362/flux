"use client";

import { useEffect, useState, useCallback, use } from "react";
import { ContactDetailDTO, ContactInsightDTO, TimelineEvent } from "@/types/contacts";
import { CommitmentDTO } from "@/types/commitments";
import { CommitmentStatus } from "@prisma/client";

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Core details state
  const [detail, setDetail] = useState<ContactDetailDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // AI Insight state
  const [insight, setInsight] = useState<ContactInsightDTO | null>(null);
  const [insightLoading, setInsightLoading] = useState<boolean>(true);
  const [insightError, setInsightError] = useState<string | null>(null);

  // User details state (for sidebar sync control)
  const [userData, setUserData] = useState<{ userName: string; userEmail: string } | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Fetch contact core details
  const fetchDetails = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      if (!res.ok) {
        throw new Error("Failed to load contact details");
      }
      const data = await res.json();
      setDetail(data);
    } catch (err: unknown) {
      console.error("Error fetching contact details:", err);
      setError((err instanceof Error ? err.message : String(err)) || "Failed to load contact details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch AI Insight asynchronously (non-blocking)
  const fetchInsight = useCallback(async () => {
    setInsightLoading(true);
    setInsightError(null);
    try {
      const res = await fetch(`/api/contacts/${id}/insight`);
      if (!res.ok) {
        throw new Error("Failed to generate relationship insight");
      }
      const data = await res.json();
      setInsight(data);
    } catch (err: unknown) {
      console.error("Error generating insight:", err);
      setInsightError("Could not retrieve AI insights at this time.");
    } finally {
      setInsightLoading(false);
    }
  }, [id]);

  // Fetch user info for sidebar
  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/briefing");
      if (res.ok) {
        const briefingData = await res.json();
        setUserData({
          userName: briefingData.userName,
          userEmail: briefingData.userEmail,
        });
      }
    } catch (err) {
      console.error("Failed to load user account info:", err);
    }
  }, []);

  useEffect(() => {
    fetchDetails();
    fetchInsight();
    fetchUserData();
  }, [fetchDetails, fetchInsight, fetchUserData]);

  const handleManualSync = async () => {
    if (!userData) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bootstrap",
          email: userData.userEmail,
        }),
      });
      if (res.ok) {
        await fetchDetails(false);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateCommitment = async (commitmentId: string, status: CommitmentStatus) => {
    setUpdatingId(commitmentId);
    try {
      const res = await fetch(`/api/commitments/${commitmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Failed to update commitment status");
      }

      // Refresh list to pull updated data
      await fetchDetails(false);
    } catch (err: unknown) {
      console.error("Failed to update status:", err);
      alert((err instanceof Error ? err.message : String(err)) || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Compile timeline events dynamically
  const getTimelineEvents = (): TimelineEvent[] => {
    if (!detail) return [];
    const events: TimelineEvent[] = [];

    // Map commitments to timeline events
    detail.commitments.forEach((c) => {
      const date = c.sourceEmail?.receivedAt || c.dueDate || new Date().toISOString();
      events.push({
        id: `commitment-${c.id}`,
        type: "commitment",
        date,
        title: `Promise Extracted: "${c.title}"`,
        description: c.riskReason || `Status is currently ${c.status}.`,
        status: c.status,
        riskLevel: c.riskLevel,
      });
    });

    // Map email threads to timeline events
    detail.recentThreads.forEach((t) => {
      if (t.lastMessageAt) {
        events.push({
          id: `thread-${t.id}`,
          type: "email",
          date: t.lastMessageAt,
          title: `Email Thread: "${t.subject}"`,
          description: t.snippet || "No snippet available.",
          direction: "INBOUND",
        });
      }
    });

    // Sort descending by date
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const timelineEvents = getTimelineEvents();
  const openCommitmentsList = detail?.commitments.filter((c) => c.status === CommitmentStatus.PENDING) || [];
  const completedCommitmentsList = detail?.commitments.filter((c) => c.status === CommitmentStatus.COMPLETED) || [];
  const followUpThreadsList = detail?.recentThreads.filter((t) => t.followUpNeeded) || [];

  const getUrgencyBadgeColor = (urgency: string | null) => {
    if (!urgency) return "bg-slate-900 text-slate-450 border-slate-800";
    switch (urgency.toUpperCase()) {
      case "CRITICAL":
      case "HIGH":
        return "bg-rose-950/40 text-rose-350 border-rose-900/30";
      case "MEDIUM":
        return "bg-amber-950/40 text-amber-350 border-amber-900/30";
      default:
        return "bg-slate-900 text-slate-400 border-slate-850";
    }
  };

  const formatTimelineDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getInitial = () => {
    if (!detail) return "C";
    return (detail.name || detail.email).charAt(0).toUpperCase();
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
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all border border-transparent"
            >
              <svg className="w-5 h-5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all bg-amber-950/40 text-amber-200 border border-amber-900/30 shadow-inner"
            >
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Contacts
            </a>
            <a
              href="/admin/sync-debug"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-355 hover:bg-slate-900/40 transition-all border border-transparent"
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
          {userData ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-850 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                  {userData.userName.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-slate-200 truncate">{userData.userName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{userData.userEmail}</p>
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
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#05070e] relative selection:bg-amber-900/50 selection:text-amber-200">
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-amber-900/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-stone-950/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Header */}
        <header className="p-6 md:p-8 border-b border-slate-900 flex items-center gap-4 shrink-0 relative z-10">
          <a
            href="/contacts"
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
            title="Back to contacts list"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
          <div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-950/50 text-amber-300 border border-amber-900/30 font-bold uppercase tracking-wider mb-1.5 inline-block">
              Relationship Intel Profile
            </span>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
              {loading ? "Loading Contact Detail..." : detail?.name || detail?.email.split("@")[0]}
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-amber-500 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : error || !detail ? (
          <div className="p-8 text-center max-w-md mx-auto">
            <p className="text-rose-450 font-bold">{error || "Failed to load contact information"}</p>
            <a href="/contacts" className="text-xs text-amber-400 hover:underline mt-2 inline-block">Return to contacts list</a>
          </div>
        ) : (
          <div className="p-6 md:p-8 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Profile Info + Health Gauge + AI Insight */}
            <div className="lg:col-span-5 space-y-6">
              {/* Profile Card */}
              <div className="glass-card p-6 rounded-2xl border border-slate-805/50 bg-[#0c0f1f]/35 flex flex-col gap-5 relative overflow-hidden">
                <div className="flex items-center gap-4">
                  {/* Large Avatar */}
                  <div className={`h-16 w-16 rounded-full border-3 ${
                    detail.relationshipScore >= 70
                      ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      : detail.relationshipScore >= 35
                      ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      : "border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                  } flex items-center justify-center font-extrabold text-2xl text-slate-100 bg-slate-900/80`}>
                    {getInitial()}
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-white truncate leading-tight">
                      {detail.name || detail.email.split("@")[0]}
                    </h2>
                    {detail.company && (
                      <p className="text-xs text-amber-400 font-bold truncate mt-0.5">{detail.company}</p>
                    )}
                    <p className="text-xs text-slate-400 truncate mt-1 leading-none">{detail.email}</p>
                    {detail.phoneNumber && (
                      <p className="text-xs text-slate-500 truncate mt-1">{detail.phoneNumber}</p>
                    )}
                  </div>
                </div>

                {/* Score bar */}
                <div className="space-y-1.5 border-t border-slate-900/60 pt-4">
                  <div className="flex justify-between items-baseline text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    <span>Relationship Strength Score</span>
                    <span className={`text-base font-black ${
                      detail.relationshipScore >= 70
                        ? "text-emerald-400"
                        : detail.relationshipScore >= 35
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}>
                      {detail.relationshipScore}/100
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-950 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        detail.relationshipScore >= 70
                          ? "bg-emerald-500"
                          : detail.relationshipScore >= 35
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${detail.relationshipScore}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1">
                    <span className="text-[10px] text-slate-500">Status Rank:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${
                      detail.relationshipHealth === "Strong"
                        ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/30"
                        : detail.relationshipHealth === "At Risk"
                        ? "bg-rose-950/40 text-rose-300 border-rose-900/30 animate-pulse"
                        : "bg-slate-900/60 text-slate-400 border-slate-800/60"
                    }`}>
                      {detail.relationshipHealth === "At Risk" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
                      )}
                      {detail.relationshipHealth}
                    </span>
                  </div>
                </div>

                {/* Explainable AI block */}
                {detail.relationshipReason && (
                  <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-3 text-xs leading-relaxed text-slate-350">
                    <span className="font-semibold block text-[10px] uppercase text-slate-500 tracking-wide mb-1">Health Explanation</span>
                    {detail.relationshipReason}
                  </div>
                )}

                {/* Exchanges Grid */}
                <div className="grid grid-cols-3 gap-3 border-t border-slate-900/65 pt-4">
                  <div className="p-2.5 rounded-xl bg-slate-950/45 border border-slate-900/50 text-center">
                    <span className="text-lg font-black text-slate-200">{detail.totalExchanges}</span>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase mt-0.5">Exchanges</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/45 border border-slate-900/50 text-center">
                    <span className="text-lg font-black text-blue-400">{detail.inboundCount}</span>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase mt-0.5">Inbound</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/45 border border-slate-900/50 text-center">
                    <span className="text-lg font-black text-emerald-400">{detail.outboundCount}</span>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase mt-0.5">Outbound</span>
                  </div>
                </div>
              </div>

              {/* AI Relationship Insight Card */}
              <div className="glass-card p-6 rounded-2xl border border-amber-900/25 bg-[#080a14]/65 relative overflow-hidden shadow-2xl">
                {/* Background radial glow */}
                <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-amber-950/15 rounded-full blur-[40px] pointer-events-none" />

                {/* Title */}
                <div className="flex items-center justify-between border-b border-slate-900 pb-3.5 mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-amber-950/60 border border-amber-900/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-350">AI Relationship Insight</h3>
                  </div>

                  {!insightLoading && insight && (
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                      insight.relationshipRisk === "HIGH"
                        ? "bg-rose-950/40 text-rose-350 border-rose-900/30"
                        : insight.relationshipRisk === "MEDIUM"
                        ? "bg-amber-950/40 text-amber-350 border-amber-900/30"
                        : "bg-emerald-950/40 text-emerald-300 border-emerald-900/30"
                    }`}>
                      Risk: {insight.relationshipRisk}
                    </span>
                  )}
                </div>

                {insightLoading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-slate-800 rounded"></div>
                      <div className="h-3 w-5/6 bg-slate-800 rounded"></div>
                      <div className="h-3 w-4/5 bg-slate-800 rounded"></div>
                    </div>
                    <div className="pt-2 space-y-2">
                      <div className="h-2 w-20 bg-slate-800 rounded"></div>
                      <div className="h-8 w-full bg-slate-800/40 border border-slate-800 rounded-lg"></div>
                      <div className="h-8 w-full bg-slate-800/40 border border-slate-800 rounded-lg"></div>
                    </div>
                  </div>
                ) : insightError ? (
                  <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-900 rounded-xl">
                    {insightError}
                  </p>
                ) : insight ? (
                  <div className="space-y-4 relative z-10">
                    {/* Insight Summary text */}
                    <p className="text-slate-200 text-xs leading-relaxed font-medium">
                      {insight.insight}
                    </p>

                    {/* Actions list */}
                    {insight.recommendedActions.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-900">
                        <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Recommended Next Actions</h4>
                        <div className="space-y-2">
                          {insight.recommendedActions.map((action, index) => (
                            <div key={index} className="p-2.5 rounded-xl border border-slate-850 bg-slate-950/35 hover:bg-slate-950/50 transition-all flex items-start gap-2.5 text-xs text-slate-300">
                              <span className="h-4 w-4 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center font-bold text-[8px] text-amber-400 shrink-0 mt-0.5">
                                {index + 1}
                              </span>
                              <span className="leading-relaxed font-semibold">{action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* RIGHT COLUMN: Commitments + Follow-ups + Activity Timeline */}
            <div className="lg:col-span-7 space-y-6">
              {/* SECTION 1: ACTIVE COMMITMENTS */}
              <div className="glass-card p-5 rounded-2xl border border-slate-800/60 bg-[#080a14]/65">
                <div className="flex items-center gap-2 border-b border-slate-900 pb-3 mb-4">
                  <div className="h-6 w-6 rounded bg-slate-950/60 border border-slate-850 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Active Commitments ({openCommitmentsList.length})</h3>
                </div>

                <div className="space-y-3">
                  {openCommitmentsList.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-900 rounded-xl bg-slate-950/15">
                      No pending commitments with this contact.
                    </div>
                  ) : (
                    openCommitmentsList.map((c) => {
                      const isUpdating = updatingId === c.id;
                      const isOverdue = c.dueDate && new Date(c.dueDate) < new Date();

                      return (
                        <div key={c.id} className={`p-4 rounded-xl border border-slate-800/60 transition-all flex flex-col gap-3 group relative overflow-hidden bg-[#0c0f1f]/35 hover:bg-[#0e1226]/50 ${
                          c.riskLevel === "HIGH"
                            ? "border-l-2 border-l-rose-500"
                            : c.riskLevel === "MEDIUM"
                            ? "border-l-2 border-l-amber-500"
                            : "border-l-2 border-l-slate-700"
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {c.direction === "INBOUND" ? (
                                <span className="bg-blue-950/40 text-blue-300 border border-blue-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                                  Inbound
                                </span>
                              ) : (
                                <span className="bg-emerald-950/40 text-emerald-300 border border-emerald-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                                  Outbound
                                </span>
                              )}
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                                c.riskLevel === "HIGH"
                                  ? "bg-rose-950/50 text-rose-300 border-rose-800/40"
                                  : c.riskLevel === "MEDIUM"
                                  ? "bg-amber-950/40 text-amber-300 border-amber-900/30"
                                  : "bg-slate-900 text-slate-400 border-slate-800"
                              }`}>
                                Risk: {c.riskScore}
                              </span>
                              {isOverdue && (
                                <span className="bg-rose-950/40 text-rose-450 border border-rose-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                                  Overdue
                                </span>
                              )}
                            </div>
                            {c.dueDate && (
                              <span className={`text-[9px] font-bold ${isOverdue ? "text-rose-450" : "text-slate-550"}`}>
                                Due {new Date(c.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-semibold text-slate-200">{c.title}</h4>

                          {c.riskReason && c.riskReason !== "No significant risk factors active." && (
                            <div className="text-[10px] text-slate-400 bg-slate-950/50 border border-slate-900/50 rounded-lg p-2 flex items-start gap-1.5">
                              <span className="text-amber-500 leading-none">⚠️</span>
                              <span>{c.riskReason}</span>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateCommitment(c.id, CommitmentStatus.COMPLETED)}
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
                                  Mark Complete
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleUpdateCommitment(c.id, CommitmentStatus.SNOOZED)}
                              disabled={isUpdating}
                              className="py-1.5 px-3 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/40 flex items-center justify-center gap-1 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
                            >
                              Snooze
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SECTION 2: FOLLOW-UP RECOMMENDATIONS */}
              {followUpThreadsList.length > 0 && (
                <div className="glass-card p-5 rounded-2xl border border-slate-800/60 bg-[#080a14]/65 animate-fade-in">
                  <div className="flex items-center gap-2 border-b border-slate-900 pb-3 mb-4">
                    <div className="h-6 w-6 rounded bg-slate-950/60 border border-slate-850 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Follow-Up Recommendations</h3>
                  </div>

                  <div className="space-y-3">
                    {followUpThreadsList.map((t) => (
                      <div key={t.id} className="p-3 rounded-xl border border-slate-800/60 bg-[#0c0f1f]/30 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-slate-200 truncate leading-relaxed">
                            {t.subject}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getUrgencyBadgeColor(t.followUpUrgency)}`}>
                            {t.followUpUrgency} Priority
                          </span>
                        </div>
                        {t.followUpReason && (
                          <p className="text-[10px] text-slate-400 bg-slate-950/30 p-2.5 rounded border border-slate-900/50 leading-relaxed">
                            <span className="font-semibold text-slate-500 uppercase text-[9px] block mb-0.5">Recommendation Logic</span>
                            {t.followUpReason}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span>Last Activity: {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "Never"}</span>
                          <a href="/inbox" className="text-amber-400 font-bold hover:underline">Draft Reply &rarr;</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 3: ACTIVITY TIMELINE */}
              <div className="glass-card p-5 rounded-2xl border border-slate-800/60 bg-[#080a14]/65">
                <div className="flex items-center gap-2 border-b border-slate-900 pb-3 mb-6">
                  <div className="h-6 w-6 rounded bg-slate-950/60 border border-slate-850 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Activity Timeline</h3>
                </div>

                {timelineEvents.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-900 rounded-xl bg-slate-950/15">
                    No timeline records found.
                  </div>
                ) : (
                  <div className="relative border-l border-slate-800 ml-3.5 pl-6 space-y-6">
                    {timelineEvents.map((event) => {
                      const isCommitment = event.type === "commitment";
                      return (
                        <div key={event.id} className="relative group">
                          {/* Circle Icon Badge */}
                          <span className={`absolute -left-10 top-0.5 h-7 w-7 rounded-full border flex items-center justify-center text-xs shadow-md ${
                            isCommitment
                              ? event.status === CommitmentStatus.COMPLETED
                                ? "bg-emerald-950/80 border-emerald-900 text-emerald-400"
                                : event.riskLevel === "HIGH"
                                ? "bg-rose-950/80 border-rose-900 text-rose-450"
                                : "bg-amber-950/85 border-amber-900 text-amber-450"
                              : "bg-slate-900 border-slate-800 text-slate-300"
                          }`}>
                            {isCommitment ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            )}
                          </span>

                          {/* Event Details */}
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.2 rounded border ${
                                isCommitment
                                  ? "bg-amber-950/20 text-amber-450 border-amber-900/20"
                                  : "bg-blue-950/20 text-blue-400 border-blue-900/20"
                              }`}>
                                {isCommitment ? "Commitment" : "Email Message"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-semibold">
                                {formatTimelineDate(event.date)}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-200 mt-1.5 group-hover:text-amber-300 transition-colors">
                              {event.title}
                            </h4>
                            {event.description && (
                              <p className="text-[11px] text-slate-450 leading-relaxed font-medium mt-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 4: COMPLETED COMMITMENTS */}
              {completedCommitmentsList.length > 0 && (
                <div className="glass-card p-5 rounded-2xl border border-slate-800/60 bg-[#080a14]/65">
                  <div className="flex items-center gap-2 border-b border-slate-900 pb-3 mb-4">
                    <div className="h-6 w-6 rounded bg-slate-950/60 border border-slate-850 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Completed Commitments ({completedCommitmentsList.length})</h3>
                  </div>

                  <div className="space-y-2.5">
                    {completedCommitmentsList.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl border border-slate-900/60 bg-slate-950/20 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-400 line-through truncate leading-relaxed">
                            {c.title}
                          </h4>
                          {c.dueDate && (
                            <span className="text-[9px] text-slate-550 block mt-0.5">
                              Due {new Date(c.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/20 rounded-md uppercase tracking-wide">
                          Completed
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
