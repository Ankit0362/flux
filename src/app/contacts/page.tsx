"use client";

import { useEffect, useState, useCallback } from "react";
import { ContactListDTO } from "@/types/contacts";
import { Sidebar } from "@/components/Sidebar";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactListDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Strong" | "Neutral" | "At Risk">("All");

  // Sidebar User Account Info State
  const [userData, setUserData] = useState<{ userName: string; userEmail: string } | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);

  const fetchContacts = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts");
      if (!res.ok) {
        throw new Error("Failed to load contacts");
      }
      const data = await res.json();
      setContacts(data);
    } catch (err: unknown) {
      console.error("Error fetching contacts:", err);
      setError((err instanceof Error ? err.message : String(err)) || "Failed to load contacts dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    fetchContacts();
    fetchUserData();
  }, [fetchContacts, fetchUserData]);

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
        await fetchContacts(false);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // 1. Filter Contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesFilter = activeFilter === "All" || c.relationshipHealth === activeFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.company || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Health Stats Calculations
  const totalContacts = contacts.length;
  const strongCount = contacts.filter((c) => c.relationshipHealth === "Strong").length;
  const neutralCount = contacts.filter((c) => c.relationshipHealth === "Neutral").length;
  const atRiskCount = contacts.filter((c) => c.relationshipHealth === "At Risk").length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="flex h-screen w-full bg-[#FAFAF9] text-[#0C0A09] font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activePage="contacts"
        userName={userData?.userName}
        userEmail={userData?.userEmail}
        syncing={syncing}
        onManualSync={handleManualSync}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#FAFAF9] relative selection:bg-amber-500 selection:text-amber-200">
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-amber-50 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-stone-50 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Header */}
        <header className="p-6 md:p-8 border-b border-[#E8ECF0] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 relative z-10">
          <div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-950/50 text-amber-300 border border-amber-900/30 font-bold uppercase tracking-wider mb-2.5 inline-block">
              Relationship Engine
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#0C0A09]">
              Contact Intelligence
            </h1>
            <p className="text-[#57534E] text-sm mt-1.5 font-medium">Identify, manage, and nurture key professional relationships.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchContacts(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#FAFAF9] hover:bg-[#F3F4F6] text-[#0C0A09] border border-[#E8ECF0] hover:border-[#E8ECF0] transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {loading ? (
                <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                </svg>
              )}
              Recalculate Scores
            </button>
          </div>
        </header>

        {/* Main Section */}
        <div className="p-6 md:p-8 space-y-8 relative z-10 flex-1">
          {error && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-350 text-xs font-semibold flex items-center gap-2 animate-pulse">
              <svg className="w-4 h-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Health Distribution Widget */}
          <div className="bg-white border border-[#E8ECF0] shadow-sm p-6 rounded-2xl border border-[#E8ECF0]">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-7 w-7 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
                <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Relationship Health Distribution</h2>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-[#FAFAF9] border border-[#E8ECF0] text-[#57534E] rounded-full">
                {totalContacts} Mapped Contacts
              </span>
            </div>

            {/* Health Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center group hover:border-emerald-800/40 transition-all">
                <span className="text-2xl font-black text-emerald-400">{loading ? "..." : strongCount}</span>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  <span className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-wider">Strong</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-[#E8ECF0] text-center group hover:border-[#E8ECF0]/50 transition-all">
                <span className="text-2xl font-black text-slate-800">{loading ? "..." : neutralCount}</span>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                  <span className="text-[10px] font-bold text-[#57534E] uppercase tracking-wider">Neutral</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-center group hover:border-rose-800/40 transition-all">
                <span className="text-2xl font-black text-rose-400">{loading ? "..." : atRiskCount}</span>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-rose-300/80 uppercase tracking-wider">At Risk</span>
                </div>
              </div>
            </div>

            {/* Bar */}
            {!loading && totalContacts > 0 && (
              <div className="mt-4 h-2 rounded-full overflow-hidden flex bg-white">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(strongCount / totalContacts) * 100}%` }}
                />
                <div
                  className="bg-slate-500 transition-all"
                  style={{ width: `${(neutralCount / totalContacts) * 100}%` }}
                />
                <div
                  className="bg-rose-500 transition-all"
                  style={{ width: `${(atRiskCount / totalContacts) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Search, Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#57534E]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, company, or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E8ECF0] bg-white text-[#0C0A09] placeholder-slate-500 focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/30 transition-all text-sm"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-[#FAFAF9] border border-[#E8ECF0] self-start">
              {(["All", "Strong", "Neutral", "At Risk"] as const).map((filter) => {
                const isActive = activeFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-amber-600 text-[#0C0A09] shadow-lg shadow-amber-900/30"
                        : "text-[#57534E] hover:text-[#0C0A09]"
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contacts Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-5 rounded-2xl border border-[#E8ECF0] bg-[#0c0f1f]/20 animate-pulse flex flex-col gap-4 h-[180px]">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 bg-[#F3F4F6] rounded-full"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-3.5 w-1/2 bg-[#F3F4F6] rounded"></div>
                      <div className="h-3 w-1/3 bg-[#F3F4F6] rounded"></div>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-[#F3F4F6] rounded mt-2"></div>
                  <div className="h-8 w-full bg-[#F3F4F6]/50 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-20 bg-[#FAFAF9] rounded-2xl border border-dashed border-slate-850">
              <div className="h-12 w-12 rounded-xl bg-white border border-[#E8ECF0] flex items-center justify-center text-[#57534E] mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#57534E]">No contacts match your query.</p>
              <p className="text-xs text-[#57534E] mt-1 max-w-xs mx-auto">Try clearing search filters or importing new messages in the sidebar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredContacts.map((c) => {
                const healthColor =
                  c.relationshipHealth === "Strong"
                    ? "emerald"
                    : c.relationshipHealth === "At Risk"
                    ? "rose"
                    : "slate";

                const scoreColor =
                  c.relationshipScore >= 70
                    ? "text-emerald-400"
                    : c.relationshipScore >= 35
                    ? "text-amber-400"
                    : "text-rose-400";

                const ringColor =
                  c.relationshipScore >= 70
                    ? "border-emerald-500"
                    : c.relationshipScore >= 35
                    ? "border-amber-500"
                    : "border-rose-500";

                const initial = (c.name || c.email).charAt(0).toUpperCase();

                return (
                  <a
                    key={c.id}
                    href={`/contact/${c.id}`}
                    className="p-5 rounded-2xl border border-slate-805/50 bg-white hover:bg-[#F3F4F6] hover:border-[#E8ECF0] transition-all flex flex-col justify-between group h-fit cursor-pointer shadow-lg shadow-black/10 hover:shadow-amber-950/5 relative overflow-hidden"
                  >
                    {/* Hover highlights */}
                    <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-amber-900/0 group-hover:bg-amber-50 rounded-full blur-[20px] pointer-events-none transition-all duration-300" />

                    <div>
                      {/* Avatar / Health / Score Row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Initial icon */}
                          <div className={`h-11 w-11 rounded-full border-2 ${ringColor} flex items-center justify-center font-bold text-sm text-[#0C0A09] bg-[#FAFAF9]/80 shrink-0`}>
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-[#0C0A09] block truncate group-hover:text-amber-300 transition-colors">
                              {c.name || c.email.split("@")[0]}
                            </span>
                            {c.company && (
                              <span className="text-[10px] text-amber-400 font-semibold block truncate">
                                {c.company}
                              </span>
                            )}
                            <span className="text-[10px] text-[#57534E] block truncate leading-none mt-0.5">
                              {c.email}
                            </span>
                          </div>
                        </div>

                        {/* Health Badge */}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                          healthColor === "emerald"
                            ? "bg-emerald-950/40 text-emerald-300 border-emerald-200"
                            : healthColor === "rose"
                            ? "bg-rose-950/40 text-rose-300 border-rose-200"
                            : "bg-white text-[#57534E] border-[#E8ECF0]"
                        }`}>
                          {c.relationshipHealth}
                        </span>
                      </div>

                      {/* Health Progress Line */}
                      <div className="mt-5 space-y-1">
                        <div className="flex justify-between items-baseline text-[9px] text-[#57534E] uppercase font-bold tracking-wider">
                          <span>Relationship Score</span>
                          <span className={`font-black ${scoreColor}`}>{c.relationshipScore}/100</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              c.relationshipScore >= 70
                                ? "bg-emerald-500"
                                : c.relationshipScore >= 35
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${c.relationshipScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Explanation reason summary */}
                      {c.relationshipReason && (
                        <p className="mt-3.5 text-[10px] text-[#57534E] bg-[#FAFAF9] border border-[#E8ECF0] rounded-lg p-2 leading-relaxed">
                          {c.relationshipReason}
                        </p>
                      )}
                    </div>

                    {/* Stats footer row */}
                    <div className="mt-5 pt-3.5 border-t border-[#E8ECF0] flex items-center justify-between text-[10px] text-[#57534E] font-medium shrink-0">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1" title="Emails received / exchanges">
                          <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                          {c.totalExchanges}
                        </span>
                        {c.openCommitments > 0 && (
                          <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-950/20 text-amber-400 border border-amber-900/20 font-bold">
                            {c.openCommitments} pending
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px]">
                          Last active: <span className="text-[#57534E] font-semibold">{formatDate(c.lastInteractionAt)}</span>
                        </span>
                        {/* Follow Up Quick Action */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent("flux:open-compose", {
                              detail: { to: [c.email], subject: `Following up — ${c.name || c.email.split("@")[0]}` }
                            }));
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-[#FAFAF9] border border-[#E8ECF0] text-[#57534E] hover:text-[#A16207] hover:border-amber-500/40 hover:bg-amber-50 transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Follow Up
                        </button>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
