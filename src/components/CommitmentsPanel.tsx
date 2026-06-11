import { useState, useEffect } from "react";
import { CommitmentDTO } from "@/types/commitments";
import { CommitmentStatus } from "@prisma/client";
import { parseEmailAddress } from "@/lib/emailUtils";

interface ThreadDetails {
  id: string;
  subject: string;
  messages: Array<{
    id: string;
    sender: string;
    recipients: string[];
    subject: string;
    body: string;
    bodyHtml: string | null;
    direction: "INBOUND" | "OUTBOUND";
    receivedAt: string;
  }>;
}

interface CommitmentsPanelProps {
  commitments: CommitmentDTO[];
  loading: boolean;
  updatingId: string | null;
  updateCommitmentStatus: (id: string, newStatus: CommitmentStatus) => Promise<void>;
  selectedThread: ThreadDetails | null;
  onClose?: () => void; // Optional close handler for mobile toggle
}

export function CommitmentsPanel({
  commitments,
  loading,
  updatingId,
  updateCommitmentStatus,
  selectedThread,
  onClose,
}: CommitmentsPanelProps) {
  const [activeTab, setActiveTab] = useState<"thread" | "all">("thread");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CommitmentStatus>("ALL");

  // Sync tab active state when selectedThread changes
  useEffect(() => {
    if (selectedThread) {
      setActiveTab("thread");
    } else {
      setActiveTab("all");
    }
  }, [selectedThread]);

  // Format confidence percentage safely
  const formatConfidence = (val: number) => {
    const pct = val <= 1.0 ? val * 100 : val;
    return `${Math.round(pct)}%`;
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  // Format sender helper
  const formatSender = (rawSender: string) => {
    const { name, email } = parseEmailAddress(rawSender);
    return name || email;
  };

  // 1. Filter commitments by tab (Selected Thread messages vs All Commitments)
  const tabFilteredCommitments = commitments.filter((c) => {
    if (activeTab === "thread") {
      if (!selectedThread || !c.sourceEmail) return false;
      // Check if commitment source message matches any message ID in the thread
      return selectedThread.messages.some((msg) => msg.id === c.sourceEmail?.id);
    }
    return true; // "all" tab returns everything
  });

  // 2. Filter by status
  const finalCommitments = tabFilteredCommitments.filter((c) => {
    if (statusFilter === "ALL") return true;
    return c.status === statusFilter;
  });

  // Count helper for badge display
  const getCount = (status: "ALL" | CommitmentStatus) => {
    return tabFilteredCommitments.filter((c) => {
      if (status === "ALL") return true;
      return c.status === status;
    }).length;
  };

  return (
    <section className="w-full lg:w-[380px] border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#060810] flex flex-col overflow-hidden shrink-0 h-full">
      {/* Panel Title / Header */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#070912] shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-amber-950/60 border border-amber-900/40 flex items-center justify-center text-amber-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-sm font-bold tracking-tight text-slate-100">Commitments</h2>
        </div>
        
        {/* Mobile close button */}
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all border border-slate-800"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="px-4 pt-3 shrink-0">
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-900">
          <button
            disabled={!selectedThread}
            onClick={() => setActiveTab("thread")}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              !selectedThread
                ? "opacity-40 cursor-not-allowed text-slate-500"
                : activeTab === "thread"
                ? "bg-amber-950/60 text-amber-200 border border-amber-900/30 shadow-inner"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>This Thread</span>
            {selectedThread && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-900/30 text-amber-300 font-bold border border-amber-800/30">
                {tabFilteredCommitments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "all"
                ? "bg-amber-950/60 text-amber-200 border border-amber-900/30 shadow-inner"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>All Mail</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-bold border border-slate-700/30">
              {activeTab === "all" ? tabFilteredCommitments.length : commitments.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="px-4 py-3 border-b border-slate-900 shrink-0 flex gap-1 overflow-x-auto scrollbar-none">
        {(["ALL", "PENDING", "COMPLETED", "SNOOZED"] as const).map((filter) => {
          const isActive = statusFilter === filter;
          const count = getCount(filter);
          return (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 transition-all flex items-center gap-1.5 ${
                isActive
                  ? "bg-amber-950/40 text-amber-300 border-amber-900/60"
                  : "bg-slate-900/10 text-slate-400 border-slate-800/50 hover:bg-slate-900/30 hover:text-slate-300"
              }`}
            >
              <span>
                {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </span>
              <span className={`text-[8px] px-1 rounded-full ${
                isActive ? "bg-amber-900/50 text-amber-200" : "bg-slate-850 text-slate-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-radial from-[#070912]/20 to-[#05070e]">
        {loading ? (
          <div className="space-y-3">
            <ShimmerCard />
            <ShimmerCard />
            <ShimmerCard />
          </div>
        ) : finalCommitments.length === 0 ? (
          <EmptyState
            message={
              activeTab === "thread"
                ? selectedThread
                  ? "No commitments identified in this conversation."
                  : "Select a thread to view its commitments."
                : "No commitments match your current status filters."
            }
          />
        ) : (
          finalCommitments.map((c) => {
            const isUpdating = updatingId === c.id;
            const isPending = c.status === CommitmentStatus.PENDING;
            const isCompleted = c.status === CommitmentStatus.COMPLETED;
            const isSnoozed = c.status === CommitmentStatus.SNOOZED;

            const cardBorderClass = isPending
              ? c.riskLevel === "HIGH"
                ? "border-l-2 border-l-rose-500 bg-[#0e0a16]/40 hover:bg-[#120c1d]/50 shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)]"
                : c.riskLevel === "MEDIUM"
                ? "border-l-2 border-l-amber-500 bg-[#0e0f18]/40 hover:bg-[#131522]/50 shadow-[0_0_15px_-3px_rgba(245,158,11,0.08)]"
                : "border-l-2 border-l-slate-700 bg-[#0c0f1f]/35 hover:bg-[#0e1226]/50"
              : isCompleted
              ? "border-l-2 border-l-emerald-500/80 bg-[#0c0f1f]/20"
              : "border-l-2 border-l-slate-600/80 bg-[#0c0f1f]/20";

            return (
              <div
                key={c.id}
                className={`p-4 rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all flex flex-col gap-3 group relative overflow-hidden ${cardBorderClass}`}
              >
                {/* Card Header metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Direction Badge */}
                    {c.direction === "INBOUND" ? (
                      <span className="bg-blue-950/40 text-blue-300 border border-blue-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        Inbound
                      </span>
                    ) : (
                      <span className="bg-emerald-950/40 text-emerald-300 border border-emerald-900/30 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                        Outbound
                      </span>
                    )}

                    {/* Confidence Index */}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                      c.confidence >= 0.8
                        ? "bg-amber-950/40 text-amber-300 border-amber-900/30"
                        : c.confidence >= 0.5
                        ? "bg-amber-950/40 text-amber-300 border-amber-900/30"
                        : "bg-rose-950/40 text-rose-300 border-rose-900/30"
                    }`}>
                      Conf: {formatConfidence(c.confidence)}
                    </span>

                    {/* Risk Badge */}
                    {isPending && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                        c.riskLevel === "HIGH"
                          ? "bg-rose-950/50 text-rose-300 border-rose-800/40 animate-pulse"
                          : c.riskLevel === "MEDIUM"
                          ? "bg-amber-950/40 text-amber-300 border-amber-900/30"
                          : "bg-slate-900/60 text-slate-400 border-slate-800/60"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          c.riskLevel === "HIGH" ? "bg-rose-400" : c.riskLevel === "MEDIUM" ? "bg-amber-400" : "bg-slate-400"
                        }`} />
                        Risk: {c.riskScore}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase border ${
                    isPending
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : isCompleted
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }`}>
                    {c.status}
                  </span>
                </div>

                {/* Commitment Title */}
                <h3 className={`text-xs font-semibold leading-relaxed break-words ${
                  isCompleted ? "line-through text-slate-500" : "text-slate-200"
                }`}>
                  {c.title}
                </h3>

                {/* Risk Reason (Explainable AI) */}
                {isPending && c.riskReason && c.riskReason !== "No significant risk factors active." && (
                  <div className="text-[10px] text-slate-450 bg-slate-950/50 border border-slate-900/50 rounded-lg p-2 flex items-start gap-1.5">
                    <span className="text-amber-500 shrink-0 text-[11px] leading-none">⚠️</span>
                    <span className="leading-normal">{c.riskReason}</span>
                  </div>
                )}

                {/* Due Date details */}
                {c.dueDate && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className={isPending && new Date(c.dueDate) < new Date() ? "text-rose-400 font-bold" : ""}>
                      Due {formatDate(c.dueDate)}
                      {isPending && new Date(c.dueDate) < new Date() && " (Overdue)"}
                    </span>
                  </div>
                )}

                {/* Email Context Info (Only displayed in "All Mail" tab to orient user) */}
                {c.sourceEmail && activeTab === "all" && (
                  <div className="text-[10px] text-slate-500 border-t border-slate-900/60 pt-2 flex flex-col gap-0.5">
                    <span className="truncate font-semibold text-slate-400">Subject: {c.sourceEmail.subject}</span>
                    <span className="truncate">Sender: {formatSender(c.sourceEmail.sender)}</span>
                  </div>
                )}

                {/* Action buttons (only visible if status is PENDING) */}
                {isPending && (
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => updateCommitmentStatus(c.id, CommitmentStatus.COMPLETED)}
                      disabled={isUpdating}
                      className="flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 transition-all disabled:opacity-50 shadow-md shadow-emerald-950/20 active:scale-95"
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
                      onClick={() => updateCommitmentStatus(c.id, CommitmentStatus.SNOOZED)}
                      disabled={isUpdating}
                      className="flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/40 flex items-center justify-center gap-1 transition-all disabled:opacity-50 active:scale-95"
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
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// Subcomponents helper to keep rendering neat
function ShimmerCard() {
  return (
    <div className="p-4 rounded-xl border border-slate-800/40 bg-[#0c0f1f]/20 animate-pulse flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="h-4 w-20 bg-slate-800 rounded-md"></div>
        <div className="h-4 w-12 bg-slate-800 rounded-md"></div>
      </div>
      <div className="h-3.5 w-full bg-slate-800 rounded-md"></div>
      <div className="h-3 w-2/3 bg-slate-800 rounded-md"></div>
      <div className="flex gap-2 mt-1">
        <div className="h-7 flex-1 bg-slate-800 rounded-lg"></div>
        <div className="h-7 flex-1 bg-slate-800 rounded-lg"></div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-950/20 rounded-2xl border border-dashed border-slate-800/40 my-8 py-12">
      <div className="h-12 w-12 rounded-xl bg-amber-950/30 border border-amber-900/30 flex items-center justify-center text-amber-450 mb-4 shadow-inner shadow-amber-900/10">
        <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <h3 className="text-xs font-bold text-slate-350 mb-1.5 uppercase tracking-wide">No commitments</h3>
      <p className="text-[11px] text-slate-500 max-w-[220px] leading-relaxed font-medium">{message}</p>
    </div>
  );
}
