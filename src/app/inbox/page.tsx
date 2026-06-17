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
            <section className="w-[420px] border-r border-[#E8ECF0] bg-white border border-[#E8ECF0] shadow-sm flex flex-col overflow-hidden shrink-0">
              {/* Toolbar */}
              <div className="p-4 border-b border-[#E8ECF0] flex justify-between items-center bg-[#FAFAF9]">
                <h2 className="text-base font-bold tracking-tight">Mailbox</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTriageMode((prev) => !prev)}
                    className={`text-[9px] font-bold transition-colors uppercase tracking-widest border px-1.5 py-0.5 rounded ${
                      triageMode
                        ? "text-emerald-300 border-emerald-900/50 bg-emerald-950/40"
                        : "text-[#57534E] hover:text-slate-350 border-slate-850 bg-slate-900/60"
                    }`}
                  >
                    Inbox Zero
                  </button>
                  <button
                    onClick={() => setShowShortcutsHelp(true)}
                    className="text-[9px] font-bold text-[#57534E] hover:text-slate-350 transition-colors uppercase tracking-widest border border-slate-850 px-1.5 py-0.5 rounded bg-slate-900/60"
                  >
                    Shortcuts (?)
                  </button>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-950/60 border border-amber-900/40 text-[#A16207] rounded-full">
                    {filteredThreads.length} Threads
                  </span>
                  <button
                    onClick={() => fetchInbox()}
                    className="p-1.5 rounded-lg hover:bg-[#FAFAF9] text-[#57534E] hover:text-[#0C0A09] transition-all border border-transparent hover:border-[#E8ECF0]/40"
                    title="Reload threads"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                    </svg>
                  </button>
                </div>
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
                  {/* Subject Header */}
                  <div className="p-6 border-b border-[#E8ECF0] bg-[#FAFAF9] shrink-0 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAFAF9] text-[#57534E] font-bold uppercase tracking-wider mb-2 inline-block">
                        Thread Conversation
                      </span>
                      <h1 className="text-lg font-bold text-[#0C0A09] leading-tight">
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
                    
                    <div className="flex items-center gap-2.5 shrink-0">
                      {triageMode && (
                        <div className="flex items-center gap-1.5 rounded-xl border border-emerald-900/40 bg-emerald-950/15 px-2 py-1.5">
                          <button
                            onClick={() => window.dispatchEvent(new CustomEvent("flux:open-reply", {
                              detail: {
                                to: [],
                                subject: selectedThread.subject.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread.subject}`,
                                threadId: selectedThread.id,
                              },
                            }))}
                            className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-900/80 text-[#0C0A09] border border-[#E8ECF0] hover:border-emerald-700"
                            title="Reply"
                          >
                            E Reply
                          </button>
                          <button
                            onClick={() => handleInboxAction("archive")}
                            className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-900/80 text-[#0C0A09] border border-[#E8ECF0] hover:border-emerald-700"
                            title="Archive"
                          >
                            A Archive
                          </button>
                          <button
                            onClick={handleMeetingNegotiation}
                            disabled={meetingActionLoading}
                            className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-900/80 text-[#0C0A09] border border-[#E8ECF0] hover:border-emerald-700 disabled:opacity-50"
                            title="Meeting"
                          >
                            M Meeting
                          </button>
                          <button
                            onClick={() => handleInboxAction("remind_later")}
                            className="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-900/80 text-[#0C0A09] border border-[#E8ECF0] hover:border-emerald-700"
                            title="Remind later"
                          >
                            R Remind
                          </button>
                        </div>
                      )}
                      {/* Extract Commitments Button */}
                      <button
                        onClick={handleExtractCommitments}
                        disabled={extractionState !== "idle"}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-inner active:scale-95 select-none ${
                          extractionState === "success"
                            ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/60 shadow-emerald-950/20"
                            : extractionState === "error"
                            ? "bg-rose-950/40 text-rose-300 border-rose-800/60 shadow-rose-950/20"
                            : "bg-gradient-to-r from-amber-900/50 to-stone-900/50 hover:from-amber-850 hover:to-stone-850 text-[#A16207] border-amber-800/50 hover:border-amber-700/55"
                        } disabled:opacity-90 disabled:cursor-default`}
                      >
                        {extractionState === "analyzing" || extractionState === "extracting" ? (
                          <>
                            <div className="h-3.5 w-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>
                              {extractionState === "analyzing" ? "Analyzing email..." : "Extracting commitments..."}
                            </span>
                          </>
                        ) : extractionState === "success" ? (
                          <>
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{extractedCount} {extractedCount === 1 ? 'commitment' : 'commitments'} extracted</span>
                          </>
                        ) : extractionState === "error" ? (
                          <>
                            <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>Extraction failed</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 text-[#A16207]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Extract Commitments</span>
                          </>
                        )}
                      </button>

                      {/* Toggle Commitments Panel Button */}
                      <button
                        onClick={() => setShowCommitments((prev) => !prev)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-inner active:scale-95 shrink-0 ${
                          showCommitments
                            ? "bg-[#FAFAF9] text-[#A16207] border-amber-900/60"
                            : "bg-slate-900/60 text-[#57534E] border-[#E8ECF0] hover:text-slate-350 hover:bg-[#FAFAF9]"
                        }`}
                        title="Toggle Commitments Panel"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="hidden sm:inline">Commitments</span>
                        {selectedThread && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                            showCommitments
                              ? "bg-amber-900/50 text-[#A16207]"
                              : "bg-[#FAFAF9] text-[#57534E]"
                          }`}>
                            {
                              commitments.filter(
                                (c) =>
                                  c.sourceEmail &&
                                  selectedThread.messages.some((msg) => msg.id === c.sourceEmail?.id)
                              ).length
                            }
                          </span>
                        )}
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
