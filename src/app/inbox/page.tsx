"use client";

import { useEffect, useState } from "react";
import { parseEmailAddress } from "@/lib/emailUtils";
import { useCommitments } from "@/hooks/useCommitments";
import { CommitmentsPanel } from "@/components/CommitmentsPanel";
import { CommitmentsDashboard } from "@/components/CommitmentsDashboard";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";

interface ThreadSummary {
  id: string;
  externalId: string;
  subject: string;
  snippet: string;
  labels: string[];
  lastSyncedAt: string;
  messageCount: number;
  latestMessageDate: string;
  latestSender: string;
}

interface EmailMessage {
  id: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  bodyHtml: string | null;
  direction: "INBOUND" | "OUTBOUND";
  receivedAt: string;
}

interface ThreadDetails {
  id: string;
  subject: string;
  messages: EmailMessage[];
}

interface ThreadContactDTO {
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

export default function InboxPage() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<ThreadDetails | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"inbox" | "commitments">("inbox");
  const [messageHtmlView, setMessageHtmlView] = useState<Record<string, boolean>>({});
  const [showCommitments, setShowCommitments] = useState(true);
  const [extractionState, setExtractionState] = useState<"idle" | "analyzing" | "extracting" | "success" | "error">("idle");
  const [extractedCount, setExtractedCount] = useState<number>(0);
  const [threadContacts, setThreadContacts] = useState<ThreadContactDTO[]>([]);
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [triageMode, setTriageMode] = useState(false);
  const [triageStatus, setTriageStatus] = useState<string | null>(null);
  const [meetingDraft, setMeetingDraft] = useState<any | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [meetingActionLoading, setMeetingActionLoading] = useState(false);

  const {
    commitments,
    loading: commitmentsLoading,
    updatingId,
    updateCommitmentStatus,
    refresh: refreshCommitments,
    extractCommitments,
  } = useCommitments();

  const fetchInbox = async (selectFirst = false) => {
    try {
      const res = await fetch("/api/inbox");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
        setIsConnected(data.isConnected);
        setEmail(data.email);
        setUserId(data.userId);

        if (selectFirst && data.threads && data.threads.length > 0) {
          handleSelectThread(data.threads[0].id);
        }
        
        refreshCommitments();
      }
    } catch (err) {
      console.error("Failed to load inbox:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectThread = async (id: string) => {
    setSelectedThreadId(id);
    setThreadLoading(true);
    setExtractionState("idle");
    setExtractedCount(0);
    setThreadContacts([]);
    setExpandedContactId(null);
    try {
      const res = await fetch(`/api/inbox?threadId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedThread(data.thread);
        setThreadContacts(data.contacts || []);
        setShowCommitments(true);
        refreshCommitments();
      }
    } catch (err) {
      console.error("Failed to load thread details:", err);
    } finally {
      setThreadLoading(false);
    }
  };

  const handleExtractCommitments = async () => {
    if (!selectedThread || extractionState !== "idle") return;

    setExtractionState("analyzing");
    setExtractedCount(0);

    // Setup timer to transition from "analyzing" to "extracting" after 1500ms
    const timer = setTimeout(() => {
      setExtractionState("extracting");
    }, 1500);

    try {
      const count = await extractCommitments(selectedThread.id);
      clearTimeout(timer);
      setExtractedCount(count);
      setExtractionState("success");
      
      // Auto-hide success state after 4 seconds
      setTimeout(() => {
        setExtractionState("idle");
      }, 4000);
    } catch (err: unknown) {
      clearTimeout(timer);
      setExtractionState("error");
      
      // Auto-hide error state after 4 seconds
      setTimeout(() => {
        setExtractionState("idle");
      }, 4000);
    }
  };

  const handleManualSync = async () => {
    if (!isConnected || !email || !userId) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bootstrap",
          tenantId: userId,
          email,
        }),
      });
      if (res.ok) {
        await fetchInbox();
        refreshCommitments();
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const removeThreadFromQueue = (threadId: string) => {
    setThreads((prev) => {
      const next = prev.filter((thread) => thread.id !== threadId);
      if (selectedThreadId === threadId) {
        const replacement = next[0];
        if (replacement) {
          handleSelectThread(replacement.id);
        } else {
          setSelectedThreadId(null);
          setSelectedThread(null);
        }
      }
      return next;
    });
  };

  const handleInboxAction = async (action: "archive" | "remind_later") => {
    if (!selectedThreadId) return;
    setTriageStatus(action === "archive" ? "Archiving thread..." : "Snoozing thread...");
    try {
      const res = await fetch("/api/inbox/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThreadId,
          action,
          mode: action === "remind_later" ? "until_reply" : undefined,
        }),
      });
      if (!res.ok) throw new Error("Inbox action failed");
      removeThreadFromQueue(selectedThreadId);
      setTriageStatus(action === "archive" ? "Archived" : "Snoozed until they reply");
      setTimeout(() => setTriageStatus(null), 2000);
    } catch (err) {
      console.error("Inbox action failed:", err);
      setTriageStatus("Action failed");
    }
  };

  const handleMeetingNegotiation = async () => {
    if (!selectedThreadId) return;
    setMeetingActionLoading(true);
    setTriageStatus("Finding 3 free slots...");
    try {
      const res = await fetch("/api/meeting/negotiation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: selectedThreadId, window: "next week", durationMinutes: 30 }),
      });
      if (!res.ok) throw new Error("Meeting negotiation failed");
      const data = await res.json();
      setMeetingDraft(data.draft);
      setSelectedSlotIndex(0);
      setTriageStatus(null);
    } catch (err) {
      console.error("Meeting negotiation failed:", err);
      setTriageStatus("Meeting negotiation failed");
    } finally {
      setMeetingActionLoading(false);
    }
  };

  const handleSendNegotiation = async () => {
    if (!meetingDraft) return;
    const selectedSlot = meetingDraft.slots[selectedSlotIndex];
    if (!selectedSlot) return;
    setMeetingActionLoading(true);
    setTriageStatus("Creating invite and sending reply...");
    try {
      const res = await fetch("/api/meeting/negotiation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: meetingDraft.threadId,
          selectedSlot,
          title: meetingDraft.title,
          attendees: meetingDraft.attendees,
          replyBody: meetingDraft.replyBody,
        }),
      });
      if (!res.ok) throw new Error("Failed to send negotiation");
      setMeetingDraft(null);
      removeThreadFromQueue(meetingDraft.threadId);
      setTriageStatus("Invite created and reply sent");
      setTimeout(() => setTriageStatus(null), 2500);
    } catch (err) {
      console.error("Failed to send negotiation:", err);
      setTriageStatus("Meeting send failed");
    } finally {
      setMeetingActionLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = `/api/auth/google?tenantId=${userId || "default-user"}`;
  };

  useEffect(() => {
    fetchInbox(true);
  }, []);

  useEffect(() => {
    const openTriage = () => {
      setActiveTab("inbox");
      setTriageMode(true);
    };
    window.addEventListener("flux:triage-mode", openTriage);
    return () => window.removeEventListener("flux:triage-mode", openTriage);
  }, []);

  const filteredThreads = threads.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (t.subject || "").toLowerCase().includes(query) ||
      (t.latestSender || "").toLowerCase().includes(query) ||
      (t.snippet || "").toLowerCase().includes(query)
    );
  });

  // Global keydown handler for Superhuman shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        if (e.key === "Escape" && target.id === "inbox-search-input") {
          e.preventDefault();
          target.blur();
        }
        return;
      }

      if (activeTab !== "inbox") return;

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        if (filteredThreads.length === 0) return;
        const currentIdx = filteredThreads.findIndex((t) => t.id === selectedThreadId);
        const nextIdx = Math.min(filteredThreads.length - 1, currentIdx + 1);
        if (filteredThreads[nextIdx]) {
          handleSelectThread(filteredThreads[nextIdx].id);
        }
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        if (filteredThreads.length === 0) return;
        const currentIdx = filteredThreads.findIndex((t) => t.id === selectedThreadId);
        const prevIdx = Math.max(0, currentIdx - 1);
        if (filteredThreads[prevIdx]) {
          handleSelectThread(filteredThreads[prevIdx].id);
        }
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("flux:open-compose"));
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (triageMode && e.shiftKey) {
          handleInboxAction("remind_later");
          return;
        }
        if (!selectedThread) return;

        const recipients = new Set<string>();
        selectedThread.messages.forEach((msg) => {
          const { email: senderEmail } = parseEmailAddress(msg.sender);
          if (senderEmail && senderEmail.toLowerCase() !== email?.toLowerCase()) {
            recipients.add(senderEmail);
          }
          msg.recipients.forEach((r) => {
            const { email: rEmail } = parseEmailAddress(r);
            if (rEmail && rEmail.toLowerCase() !== email?.toLowerCase()) {
              recipients.add(rEmail);
            }
          });
        });

        const subject = selectedThread.subject.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread.subject}`;
        window.dispatchEvent(
          new CustomEvent("flux:open-reply", {
            detail: {
              to: Array.from(recipients),
              subject,
              threadId: selectedThread.id,
            },
          })
        );
      } else if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.getElementById("inbox-search-input") as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === "e" || e.key === "E") {
        if (!triageMode) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("flux:open-reply", {
          detail: {
            to: [],
            subject: selectedThread?.subject?.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread?.subject || ""}`,
            threadId: selectedThreadId,
          },
        }));
      } else if (e.key === "a" || e.key === "A") {
        if (!triageMode) return;
        e.preventDefault();
        handleInboxAction("archive");
      } else if (e.key === "m" || e.key === "M") {
        if (!triageMode) return;
        e.preventDefault();
        handleMeetingNegotiation();
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsHelp((prev) => !prev);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowShortcutsHelp(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredThreads, selectedThreadId, selectedThread, email, activeTab, triageMode]);

  // Auto scroll highlighted thread into view
  useEffect(() => {
    if (selectedThreadId) {
      const activeEl = document.querySelector(`[data-thread-id="${selectedThreadId}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedThreadId]);

  const formatSender = (rawSender: string) => {
    const { name, email } = parseEmailAddress(rawSender);
    return name || email;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    
    // Check if today
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    
    // Check if this year
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    
    return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  };

  const toggleHtmlView = (msgId: string) => {
    setMessageHtmlView((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  return (
    <div className="flex h-screen w-full bg-[#FAFAF9] text-[#0C0A09] font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activePage={activeTab}
        userEmail={email}
        userName={email?.split("@")[0]}
        isConnected={isConnected}
        syncing={syncing}
        onManualSync={handleManualSync}
        onConnect={handleConnect}
        onTabChange={setActiveTab}
      />

      {/* Main Split Layout */}
      <main className="flex-1 flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#FAFAF9]">
            <svg className="animate-spin h-8 w-8 text-amber-500 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-[#57534E] text-sm">Synchronizing dashboard...</p>
          </div>
        ) : !isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FAFAF9] w-full">
            <div className="h-16 w-16 rounded-2xl bg-white border border-[#E8ECF0] flex items-center justify-center text-[#0C0A09] mb-6 shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-[#0C0A09] mb-2 tracking-tight">Your Inbox is Offline</h2>
            <p className="text-[#57534E] text-sm max-w-sm mb-6 leading-relaxed">
              Connect your Google Developer Account to load your emails, track promises, and keep follow-ups from slipping through the cracks.
            </p>
            <button
              onClick={handleConnect}
              className="py-3 px-8 rounded-xl font-bold bg-[#0C0A09] hover:bg-slate-800 text-white shadow-md transform hover:-translate-y-0.5 transition-all"
            >
              Link Google Account
            </button>
          </div>
        ) : activeTab === "commitments" ? (
          <CommitmentsDashboard
            commitments={commitments}
            loading={commitmentsLoading}
            updatingId={updatingId}
            updateCommitmentStatus={updateCommitmentStatus}
            onRefresh={refreshCommitments}
            onGoToInbox={() => setActiveTab("inbox")}
          />
        ) : (
          <>
            {/* Threads List Pane */}
            <section className="w-[420px] border-r border-[#E8ECF0] bg-white flex flex-col overflow-hidden shrink-0">
              {/* ── Tab Switcher ── */}
              <div className="px-4 pt-4 pb-3 border-b border-[#E8ECF0] bg-[#FAFAF9] shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-[#E8ECF0] flex-1">
                    <button
                      onClick={() => setActiveTab("inbox")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                        activeTab === "inbox"
                          ? "bg-[#A16207] text-white shadow-sm"
                          : "text-[#57534E] hover:text-[#0C0A09]"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
                      </svg>
                      Inbox
                      {filteredThreads.length > 0 && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${activeTab === "inbox" ? "bg-white/20 text-white" : "bg-amber-500/15 text-[#A16207]"}`}>{filteredThreads.length}</span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab("commitments")}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                        (activeTab as string) === "commitments"
                          ? "bg-[#A16207] text-white shadow-sm"
                          : "text-[#57534E] hover:text-[#0C0A09]"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Commitments
                    </button>
                  </div>
                  <button
                    onClick={() => fetchInbox()}
                    className="p-2 rounded-lg hover:bg-white text-[#57534E] hover:text-[#0C0A09] transition-all border border-[#E8ECF0]"
                    title="Reload"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                    </svg>
                  </button>
                </div>

                {/* ── Triage Mode Toggle ── */}
                <button
                  onClick={() => setTriageMode((prev) => !prev)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    triageMode
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-[#E8ECF0] text-[#57534E] hover:text-[#0C0A09] hover:border-amber-500/40"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${triageMode ? "border-emerald-500 bg-emerald-500" : "border-[#57534E]"}`}>
                    {triageMode && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span>{triageMode ? "Inbox Zero Active — E Reply · A Archive · M Meet · R Remind" : "Enable Inbox Zero Mode"}</span>
                  {!triageMode && <kbd className="ml-auto text-[9px] font-bold bg-[#FAFAF9] border border-[#E8ECF0] px-1.5 py-0.5 rounded text-[#57534E]">?</kbd>}
                </button>
              </div>

              {/* Local Search input */}
              <div className="px-4 py-2 border-b border-[#E8ECF0] bg-slate-950/20 flex items-center relative shrink-0">
                <input
                  id="inbox-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search inbox... (Press '/' to focus)"
                  className="w-full bg-[#FAFAF9] border border-[#E8ECF0] focus:border-amber-500/50 p-2 pl-8 text-xs text-[#0C0A09] rounded-lg outline-none placeholder:text-slate-650 transition-all"
                />
                <div className="absolute left-7 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-7 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#57534E] hover:text-slate-355 bg-slate-950 border border-[#E8ECF0] px-1.5 py-0.5 rounded uppercase"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Thread list scroll area */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60">
                {filteredThreads.length === 0 ? (
                  <div className="p-8 text-center text-[#57534E] text-sm">
                    No matching threads found.
                  </div>
                ) : (
                  filteredThreads.map((t) => {
                    const isSelected = selectedThreadId === t.id;
                    return (
                      <div
                        key={t.id}
                        data-thread-id={t.id}
                        onClick={() => handleSelectThread(t.id)}
                        className={`p-4 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-[#FAFAF9] border-l-2 border-amber-500 pl-3.5"
                            : "hover:bg-[#FAFAF9] border-l-2 border-transparent"
                        }`}
                      >
                        <div className="flex justify-between items-baseline gap-2 mb-1">
                          <span className="font-bold text-xs text-[#0C0A09] truncate">
                            {formatSender(t.latestSender)}
                          </span>
                          <span className="text-[10px] text-[#57534E] shrink-0 font-medium">
                            {formatDate(t.latestMessageDate)}
                          </span>
                        </div>
                        <h4 className={`text-xs font-semibold mb-1 truncate ${isSelected ? "text-[#A16207]" : "text-[#0C0A09]"}`}>
                          {t.subject || "No Subject"}
                        </h4>
                        <p className="text-[11px] text-[#57534E] line-clamp-2 leading-relaxed">
                          {t.snippet}
                        </p>
                        
                        {/* Labels / Message counts */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {t.messageCount > 1 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#FAFAF9] text-[#57534E] rounded">
                              {t.messageCount} messages
                            </span>
                          )}
                          {t.labels.filter(l => !l.startsWith("CATEGORY_")).slice(0, 2).map((label) => (
                            <span
                              key={label}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                label === "INBOX"
                                  ? "bg-amber-950/60 text-[#A16207] border border-[#E8ECF0]"
                                  : label === "UNREAD"
                                  ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900/30"
                                  : "bg-[#FAFAF9]/80 text-[#57534E]"
                              }`}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Thread Details Pane */}
            <section className="flex-1 bg-white border border-[#E8ECF0] shadow-sm flex flex-col overflow-hidden">
              {threadLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-amber-500 mb-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-[#57534E] text-xs">Loading thread message chain...</p>
                </div>
              ) : selectedThread ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Subject Header + Persistent Action Bar */}
                  <div className="border-b border-[#E8ECF0] bg-[#FAFAF9] shrink-0">
                    {/* Subject + Contacts */}
                    <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h1 className="text-base font-bold text-[#0C0A09] leading-tight truncate">
                          {selectedThread.subject || "No Subject"}
                        </h1>

                      {threadContacts.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {threadContacts.map((c) => {
                            const isExpanded = expandedContactId === c.id;
                            const healthBg =
                              c.relationshipHealth === "Strong"
                                ? "bg-emerald-950/40 border-emerald-900/30 text-emerald-300"
                                : c.relationshipHealth === "At Risk"
                                ? "bg-rose-950/40 border-rose-900/30 text-rose-300"
                                : "bg-slate-900/60 border-[#E8ECF0]/60 text-[#57534E]";
                            const ringColor =
                              c.relationshipScore >= 70
                                ? "border-emerald-500"
                                : c.relationshipScore >= 35
                                ? "border-amber-500"
                                : "border-rose-500";
                            const initial = (c.name || c.email).charAt(0).toUpperCase();

                            return (
                              <div key={c.id} className="relative">
                                <button
                                  onClick={() => setExpandedContactId(isExpanded ? null : c.id)}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${healthBg} hover:brightness-125`}
                                >
                                  <div className={`h-5 w-5 rounded-full border-[1.5px] ${ringColor} flex items-center justify-center text-[9px] font-bold bg-slate-900/80 text-[#0C0A09]`}>
                                    {initial}
                                  </div>
                                  <span className="truncate max-w-[100px]">{c.name || c.email.split("@")[0]}</span>
                                  <span className="font-black">{c.relationshipScore}</span>
                                </button>

                                {/* Expanded tooltip card */}
                                {isExpanded && (
                                  <div className="absolute top-full left-0 mt-1.5 z-50 w-[280px] p-4 rounded-xl glass-card border border-[#E8ECF0]/50 shadow-2xl shadow-black/40 animate-in fade-in">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className={`h-8 w-8 rounded-full border-2 ${ringColor} flex items-center justify-center font-bold text-xs text-[#0C0A09] bg-slate-900/80`}>
                                        {initial}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-[#0C0A09] truncate">{c.name || c.email.split("@")[0]}</p>
                                        <p className="text-[10px] text-[#57534E] truncate">{c.email}</p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                      <div className="text-center p-2 rounded-lg bg-slate-950/60 border border-[#E8ECF0]/40">
                                        <span className="text-sm font-black text-[#0C0A09]">{c.totalExchanges}</span>
                                        <span className="block text-[8px] text-[#57534E] font-bold uppercase">Exchanges</span>
                                      </div>
                                      <div className="text-center p-2 rounded-lg bg-slate-950/60 border border-[#E8ECF0]/40">
                                        <span className="text-sm font-black text-blue-400">{c.inboundCount}</span>
                                        <span className="block text-[8px] text-[#57534E] font-bold uppercase">Inbound</span>
                                      </div>
                                      <div className="text-center p-2 rounded-lg bg-slate-950/60 border border-[#E8ECF0]/40">
                                        <span className="text-sm font-black text-emerald-400">{c.outboundCount}</span>
                                        <span className="block text-[8px] text-[#57534E] font-bold uppercase">Outbound</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-[10px] text-[#57534E] mb-3">
                                      {c.openCommitments > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-[#FAFAF9] text-[#A16207] border border-[#E8ECF0] font-bold">
                                          {c.openCommitments} open
                                        </span>
                                      )}
                                      {c.completedCommitments > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-900/30 font-bold">
                                          {c.completedCommitments} done
                                        </span>
                                      )}
                                      {c.lastInteractionAt && (
                                        <span className="text-[#57534E]">
                                          Last: {new Date(c.lastInteractionAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                                        </span>
                                      )}
                                    </div>

                                    {c.relationshipReason && (
                                      <p className="text-[10px] text-[#57534E]/80 leading-relaxed bg-slate-950/50 rounded-lg px-2.5 py-1.5 border border-[#E8ECF0]/40">
                                        {c.relationshipReason}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    </div>

                    {/* ── Persistent Action Bar ── */}
                    <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                      {/* Reply */}
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent("flux:open-reply", {
                          detail: {
                            to: [],
                            subject: selectedThread.subject.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread.subject}`,
                            threadId: selectedThread.id,
                          },
                        }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8ECF0] bg-white hover:bg-[#F3F4F6] text-[#0C0A09] text-xs font-semibold transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Reply
                        <kbd className="text-[9px] bg-[#FAFAF9] border border-[#E8ECF0] px-1 rounded text-[#57534E]">R</kbd>
                      </button>

                      {/* Extract Commitments */}
                      <button
                        onClick={handleExtractCommitments}
                        disabled={extractionState !== "idle"}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          extractionState === "success"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : extractionState === "error"
                            ? "bg-rose-50 border-rose-200 text-rose-700"
                            : extractionState !== "idle"
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-white border-[#E8ECF0] text-[#0C0A09] hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700"
                        } disabled:cursor-default`}
                      >
                        {extractionState === "analyzing" || extractionState === "extracting" ? (
                          <div className="h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        ) : extractionState === "success" ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        )}
                        {extractionState === "analyzing" ? "Analyzing..." : extractionState === "extracting" ? "Extracting..." : extractionState === "success" ? `${extractedCount} extracted` : extractionState === "error" ? "Failed" : "Extract Commitments"}
                      </button>

                      {/* Schedule Meeting */}
                      <button
                        onClick={handleMeetingNegotiation}
                        disabled={meetingActionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8ECF0] bg-white hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 text-[#0C0A09] text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        {meetingActionLoading ? (
                          <div className="h-3.5 w-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        )}
                        Schedule Meeting
                        <kbd className="text-[9px] bg-[#FAFAF9] border border-[#E8ECF0] px-1 rounded text-[#57534E]">M</kbd>
                      </button>

                      {/* Archive */}
                      <button
                        onClick={() => handleInboxAction("archive")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8ECF0] bg-white hover:bg-[#F3F4F6] text-[#57534E] text-xs font-semibold transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                        Archive
                        <kbd className="text-[9px] bg-[#FAFAF9] border border-[#E8ECF0] px-1 rounded text-[#57534E]">A</kbd>
                      </button>

                      {/* Remind Later */}
                      <button
                        onClick={() => handleInboxAction("remind_later")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8ECF0] bg-white hover:bg-[#F3F4F6] text-[#57534E] text-xs font-semibold transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Remind Later
                        <kbd className="text-[9px] bg-[#FAFAF9] border border-[#E8ECF0] px-1 rounded text-[#57534E]">Shift+R</kbd>
                      </button>

                      {/* Toggle Commitments Panel */}
                      <button
                        onClick={() => setShowCommitments((prev) => !prev)}
                        className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          showCommitments
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-white border-[#E8ECF0] text-[#57534E] hover:bg-[#F3F4F6]"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        {showCommitments ? "Hide Panel" : "Commitments"}
                      </button>
                    </div>
                  </div>

                  {(triageStatus || meetingDraft) && (
                    <div className="border-b border-[#E8ECF0] bg-slate-950/40 px-6 py-3 shrink-0">
                      {triageStatus && (
                        <div className="text-xs font-semibold text-emerald-300 mb-2">{triageStatus}</div>
                      )}
                      {meetingDraft && (
                        <div className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#A16207]">
                                Meeting negotiation
                              </div>
                              <div className="text-sm font-bold text-[#0C0A09] mt-1">{meetingDraft.title}</div>
                              <div className="text-xs text-[#57534E] mt-1">{meetingDraft.attendees.join(", ")}</div>
                            </div>
                            <button
                              onClick={() => setMeetingDraft(null)}
                              className="text-xs text-[#57534E] hover:text-[#0C0A09]"
                            >
                              Close
                            </button>
                          </div>
                          <div className="grid gap-2 md:grid-cols-3 mt-3">
                            {meetingDraft.slots.map((slot: any, index: number) => (
                              <button
                                key={slot.startAt}
                                onClick={() => setSelectedSlotIndex(index)}
                                className={`rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                                  selectedSlotIndex === index
                                    ? "border-amber-500 bg-amber-500/10 text-amber-100"
                                    : "border-[#E8ECF0] bg-slate-950/50 text-[#0C0A09] hover:border-[#E8ECF0]"
                                }`}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={meetingDraft.replyBody}
                            onChange={(e) => setMeetingDraft({ ...meetingDraft, replyBody: e.target.value })}
                            rows={4}
                            className="mt-3 w-full rounded-xl border border-[#E8ECF0] bg-slate-950/70 p-3 text-xs text-[#0C0A09] outline-none focus:border-amber-500/60"
                          />
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={handleSendNegotiation}
                              disabled={meetingActionLoading}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-[#0C0A09] bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
                            >
                              Send Reply + Create Invite
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message chain scroll area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-radial from-[#090b17]/40 to-[#05070f]">
                    {selectedThread.messages.map((msg) => {
                      const showHtml = messageHtmlView[msg.id] || false;
                      const hasHtml = !!msg.bodyHtml;
                      return (
                        <article
                          key={msg.id}
                          className="glass-card rounded-2xl overflow-hidden"
                        >
                          {/* Message Header */}
                          <div className="p-4 bg-slate-900/30 border-b border-[#E8ECF0]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[#0C0A09]">
                                  {formatSender(msg.sender)}
                                </span>
                                <span className="text-xs text-[#57534E] truncate">
                                  &lt;{parseEmailAddress(msg.sender).email}&gt;
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#57534E]">
                                <span>to {msg.recipients.map(r => r.split("<")[0] || r).join(", ")}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  msg.direction === "OUTBOUND" ? "bg-emerald-950/60 text-emerald-300 border border-emerald-900/30" : "bg-blue-950/60 text-blue-300 border border-blue-900/30"
                                }`}>
                                  {msg.direction}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-[#57534E] font-medium">
                                {formatDate(msg.receivedAt)}
                              </span>
                              {hasHtml && (
                                <button
                                  onClick={() => toggleHtmlView(msg.id)}
                                  className="text-[10px] font-bold px-2 py-1 bg-[#FAFAF9] hover:bg-slate-700 text-[#0C0A09] rounded-lg border border-[#E8ECF0]/60 transition-all"
                                >
                                  {showHtml ? "Show Plain" : "Show Rendered"}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Message Body */}
                          <div className="p-6">
                            {showHtml && msg.bodyHtml ? (
                              <div className="bg-white border border-[#E8ECF0] shadow-sm rounded-xl p-4 overflow-x-auto min-h-[150px]">
                                <iframe
                                  srcDoc={msg.bodyHtml}
                                  title="Rendered HTML Email"
                                  className="w-full border-0 min-h-[350px]"
                                  sandbox="allow-popups allow-same-origin"
                                />
                              </div>
                            ) : (
                              <pre className="text-[#0C0A09] text-sm font-sans leading-relaxed whitespace-pre-wrap break-words">
                                {msg.body || "No message body text."}
                              </pre>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-[#57534E] p-8">
                  <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-xs">Select a thread from the list to view conversation history.</p>
                </div>
              )}
            </section>

            {/* Shortcuts Helper Cheat Sheet */}
            <AnimatePresence>
              {showShortcutsHelp && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
                    onClick={() => setShowShortcutsHelp(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="fixed bottom-6 left-6 z-50 w-72 p-4 rounded-2xl border border-[#E8ECF0] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                    style={{
                      background: "linear-gradient(160deg, rgba(13,17,40,0.95) 0%, rgba(8,10,25,0.98) 100%)",
                      backdropFilter: "blur(40px)",
                    }}
                  >
                    <div className="flex justify-between items-center border-b border-[#E8ECF0] pb-2 mb-3">
                      <span className="text-[11px] font-extrabold text-[#0C0A09] uppercase tracking-wider">Superhuman Shortcuts</span>
                      <button
                        onClick={() => setShowShortcutsHelp(false)}
                        className="text-[#57534E] hover:text-[#0C0A09] text-xs font-bold transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#57534E]">Next thread</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-[#E8ECF0] text-[10px] text-[#A16207] font-extrabold shadow-sm text-[9px]">J</kbd>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#57534E]">Previous thread</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-[#E8ECF0] text-[10px] text-[#A16207] font-extrabold shadow-sm text-[9px]">K</kbd>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#57534E]">Reply to thread</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-[#E8ECF0] text-[10px] text-[#A16207] font-extrabold shadow-sm text-[9px]">R</kbd>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#57534E]">Compose new email</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-[#E8ECF0] text-[10px] text-[#A16207] font-extrabold shadow-sm text-[9px]">C</kbd>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#57534E]">Focus search filter</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-[#E8ECF0] text-[10px] text-[#A16207] font-extrabold shadow-sm text-[9px]">/</kbd>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#57534E]">Show keyboard help</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-900 border border-[#E8ECF0] text-[10px] text-[#A16207] font-extrabold shadow-sm text-[9px]">?</kbd>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#57534E]">Dismiss search / help</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-[#E8ECF0] text-[9px] text-slate-450 font-extrabold shadow-sm">ESC</kbd>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Commitments Panel */}
            {showCommitments && (
              <div className="absolute inset-y-0 right-0 z-40 lg:relative lg:inset-auto lg:block w-full sm:w-[380px] lg:w-[380px] h-full shadow-2xl lg:shadow-none border-l border-[#E8ECF0]">
                <CommitmentsPanel
                  commitments={commitments}
                  loading={commitmentsLoading}
                  updatingId={updatingId}
                  updateCommitmentStatus={updateCommitmentStatus}
                  selectedThread={selectedThread}
                  onClose={() => setShowCommitments(false)}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
