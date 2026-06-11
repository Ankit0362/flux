import { CommitmentDTO } from "@/types/commitments";
import { CommitmentStatus } from "@prisma/client";
import { parseEmailAddress } from "@/lib/emailUtils";

interface CommitmentsDashboardProps {
  commitments: CommitmentDTO[];
  loading: boolean;
  updatingId: string | null;
  updateCommitmentStatus: (id: string, newStatus: CommitmentStatus) => Promise<void>;
  onRefresh: () => void;
  onGoToInbox: () => void;
}

export function CommitmentsDashboard({
  commitments,
  loading,
  updatingId,
  updateCommitmentStatus,
  onRefresh,
  onGoToInbox,
}: CommitmentsDashboardProps) {
  // Enums/Filters helper
  const pendingCommitments = commitments
    .filter((c) => c.status === CommitmentStatus.PENDING)
    .sort((a, b) => b.riskScore - a.riskScore);
  const completedCommitments = commitments.filter((c) => c.status === CommitmentStatus.COMPLETED);
  const snoozedCommitments = commitments.filter((c) => c.status === CommitmentStatus.SNOOZED);

  const formatConfidence = (val: number) => {
    const pct = val <= 1.0 ? val * 100 : val;
    return `${Math.round(pct)}%`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const formatSender = (rawSender: string) => {
    const { name, email } = parseEmailAddress(rawSender);
    return name || email;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#05070f] overflow-y-auto p-6 md:p-8 space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white bg-gradient-to-r from-amber-400 to-stone-200 bg-clip-text text-transparent">
            Commitments Intelligence
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Track, snooze, and complete commitments extracted from your conversation history.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700/60 transition-all disabled:opacity-50 active:scale-95"
          >
            {loading ? (
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
              </svg>
            )}
            Refresh
          </button>
          
          <button
            onClick={onGoToInbox}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-tr from-amber-600 to-stone-500 hover:from-amber-500 hover:to-stone-400 text-white shadow-lg shadow-amber-950/20 transition-all active:scale-95"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Back to Mail
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Tracked", val: commitments.length, iconColor: "text-amber-400", bg: "from-amber-950/20 to-amber-900/10 border-amber-900/30" },
          { label: "Pending Promises", val: pendingCommitments.length, iconColor: "text-amber-400", bg: "from-amber-950/20 to-amber-900/10 border-amber-900/20" },
          { label: "Completed Items", val: completedCommitments.length, iconColor: "text-emerald-400", bg: "from-emerald-950/20 to-emerald-900/10 border-emerald-900/20" },
          { label: "Snoozed/Parked", val: snoozedCommitments.length, iconColor: "text-slate-400", bg: "from-slate-900/40 to-slate-900/20 border-slate-800" },
        ].map((stat, idx) => (
          <div key={idx} className={`p-5 rounded-2xl border bg-gradient-to-br ${stat.bg} flex flex-col justify-between shadow-inner`}>
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">{stat.label}</span>
            <span className={`text-2xl font-extrabold mt-2 ${stat.iconColor}`}>{loading ? "..." : stat.val}</span>
          </div>
        ))}
      </div>

      {/* Columns Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start">
        {/* PENDING COLUMN */}
        <BoardColumn
          title="Pending Commitments"
          count={pendingCommitments.length}
          colorClass="text-amber-400 bg-amber-950/30 border-amber-900/30"
        >
          {loading ? (
            <ShimmerList />
          ) : pendingCommitments.length === 0 ? (
            <EmptyColumnState message="No pending commitments. Excellent job!" />
          ) : (
            pendingCommitments.map((c) => (
              <CommitmentCard
                key={c.id}
                commitment={c}
                updatingId={updatingId}
                updateCommitmentStatus={updateCommitmentStatus}
                formatConfidence={formatConfidence}
                formatDate={formatDate}
                formatSender={formatSender}
              />
            ))
          )}
        </BoardColumn>

        {/* COMPLETED COLUMN */}
        <BoardColumn
          title="Completed Commitments"
          count={completedCommitments.length}
          colorClass="text-emerald-400 bg-emerald-950/30 border-emerald-900/30"
        >
          {loading ? (
            <ShimmerList />
          ) : completedCommitments.length === 0 ? (
            <EmptyColumnState message="No completed commitments yet." />
          ) : (
            completedCommitments.map((c) => (
              <CommitmentCard
                key={c.id}
                commitment={c}
                updatingId={updatingId}
                updateCommitmentStatus={updateCommitmentStatus}
                formatConfidence={formatConfidence}
                formatDate={formatDate}
                formatSender={formatSender}
              />
            ))
          )}
        </BoardColumn>

        {/* SNOOZED COLUMN */}
        <BoardColumn
          title="Snoozed Commitments"
          count={snoozedCommitments.length}
          colorClass="text-slate-400 bg-slate-900/40 border-slate-800"
        >
          {loading ? (
            <ShimmerList />
          ) : snoozedCommitments.length === 0 ? (
            <EmptyColumnState message="No snoozed commitments." />
          ) : (
            snoozedCommitments.map((c) => (
              <CommitmentCard
                key={c.id}
                commitment={c}
                updatingId={updatingId}
                updateCommitmentStatus={updateCommitmentStatus}
                formatConfidence={formatConfidence}
                formatDate={formatDate}
                formatSender={formatSender}
              />
            ))
          )}
        </BoardColumn>
      </div>
    </div>
  );
}

// Stats & Columns helper components
function BoardColumn({
  title,
  count,
  colorClass,
  children,
}: {
  title: string;
  count: number;
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 bg-[#080a14]/65 border border-slate-900 rounded-2xl p-4 min-h-[450px]">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-350">{title}</h2>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
          {count}
        </span>
      </div>
      <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
        {children}
      </div>
    </div>
  );
}

function CommitmentCard({
  commitment,
  updatingId,
  updateCommitmentStatus,
  formatConfidence,
  formatDate,
  formatSender,
}: {
  commitment: CommitmentDTO;
  updatingId: string | null;
  updateCommitmentStatus: (id: string, newStatus: CommitmentStatus) => Promise<void>;
  formatConfidence: (val: number) => string;
  formatDate: (val: string) => string;
  formatSender: (val: string) => string;
}) {
  const isUpdating = updatingId === commitment.id;
  const isPending = commitment.status === CommitmentStatus.PENDING;
  const isCompleted = commitment.status === CommitmentStatus.COMPLETED;

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
    <div className={`p-4 rounded-xl border border-slate-800/80 transition-all flex flex-col gap-3 group relative overflow-hidden ${cardBorderClass}`}>
      {/* Confidence + direction badges + risk score */}
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
          
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
            commitment.confidence >= 0.8
              ? "bg-amber-950/40 text-amber-300 border-amber-900/30"
              : commitment.confidence >= 0.5
              ? "bg-amber-950/40 text-amber-300 border-amber-900/30"
              : "bg-rose-950/40 text-rose-300 border-rose-900/30"
          }`}>
            {formatConfidence(commitment.confidence)}
          </span>

          {isPending && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
              commitment.riskLevel === "HIGH"
                ? "bg-rose-950/50 text-rose-300 border-rose-800/40 animate-pulse"
                : commitment.riskLevel === "MEDIUM"
                ? "bg-amber-950/40 text-amber-300 border-amber-900/30"
                : "bg-slate-900/60 text-slate-400 border-slate-800/60"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                commitment.riskLevel === "HIGH" 
                  ? "bg-rose-400" 
                  : commitment.riskLevel === "MEDIUM" 
                  ? "bg-amber-400" 
                  : "bg-slate-400"
              }`} />
              Risk: {commitment.riskScore}
            </span>
          )}
        </div>
        
        {commitment.dueDate && (
          <span className={`text-[9px] font-semibold text-slate-450 ${
            isPending && new Date(commitment.dueDate) < new Date() ? "text-rose-450 font-bold" : ""
          }`}>
            {formatDate(commitment.dueDate)}
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

      {/* Source Email Info */}
      {commitment.sourceEmail && (
        <div className="text-[10px] text-slate-500 border-t border-slate-900/50 pt-2 flex flex-col gap-0.5">
          <span className="truncate text-slate-400 font-medium">Subject: {commitment.sourceEmail.subject}</span>
          <span className="truncate">From: {formatSender(commitment.sourceEmail.sender)}</span>
        </div>
      )}

      {/* Interactive Actions for pending items */}
      {isPending && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => updateCommitmentStatus(commitment.id, CommitmentStatus.COMPLETED)}
            disabled={isUpdating}
            className="flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-emerald-950/20"
          >
            {isUpdating ? (
              <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Complete
              </>
            )}
          </button>
          <button
            onClick={() => updateCommitmentStatus(commitment.id, CommitmentStatus.SNOOZED)}
            disabled={isUpdating}
            className="flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/40 flex items-center justify-center gap-1 transition-all disabled:opacity-50 active:scale-95"
          >
            {isUpdating ? (
              <div className="h-3 w-3 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
}

function EmptyColumnState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-950/10 rounded-xl border border-dashed border-slate-800/20 py-8">
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{message}</p>
    </div>
  );
}

function ShimmerList() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="p-4 rounded-xl border border-slate-800/40 bg-[#0c0f1f]/20 animate-pulse flex flex-col gap-3">
          <div className="h-3.5 w-16 bg-slate-800 rounded"></div>
          <div className="h-3.5 w-full bg-slate-800 rounded"></div>
          <div className="h-3.5 w-2/3 bg-slate-800 rounded"></div>
        </div>
      ))}
    </div>
  );
}
