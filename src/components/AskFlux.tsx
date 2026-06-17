"use client";

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AskResponse, Evidence, Action, WRITE_ACTION_TYPES, PendingPayload, SendEmailPayload, ReplyPayload, CreateEventPayload } from "@/types/ask";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTED_QUERIES = [
  "What should I focus on today?",
  "What commitments are overdue?",
  "Which relationships need attention?",
  "Who should I follow up with?",
  "Draft a follow-up to my most overdue commitment",
  "Schedule a sync with my most at-risk contact",
  "Reply to the thread with the most recent activity",
];

const THINKING_STEPS = [
  "Connecting to your inbox...",
  "Querying commitments database...",
  "Analyzing relationship intelligence...",
  "Evaluating risk signals...",
  "Synthesizing your briefing...",
];

// ─── Evidence Card ────────────────────────────────────────────────────────────

function EvidenceCard({ item }: { item: Evidence }) {
  const styleMap: Record<string, { cls: string; badge: string; badgeCls: string; icon: React.ReactNode }> = {
    commitment: {
      cls: "evidence-commitment",
      badge: "Commitment",
      badgeCls: "bg-amber-950/50 text-amber-300 border-amber-900/40",
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    relationship: {
      cls: "evidence-relationship",
      badge: "Relationship",
      badgeCls: "bg-blue-950/50 text-blue-300 border-blue-900/40",
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    followup: {
      cls: "evidence-followup",
      badge: "Follow-up",
      badgeCls: "bg-amber-950/50 text-amber-300 border-amber-900/40",
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    inbox: {
      cls: "evidence-inbox",
      badge: "Inbox",
      badgeCls: "bg-emerald-950/50 text-emerald-300 border-emerald-900/40",
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
        </svg>
      ),
    },
  };

  const style = styleMap[item.type] ?? styleMap.inbox;

  return (
    <div className={`p-3 rounded-xl border border-slate-800/50 ${style.cls} ask-fade-in`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0 h-5 w-5 rounded-md bg-slate-900/60 flex items-center justify-center text-slate-400">
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.badgeCls}`}>
              {style.badge}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-100 leading-snug truncate">{item.title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{item.context}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

type ActionButtonState = "idle" | "confirming" | "executing" | "done" | "error";

const WRITE_ACTION_META: Record<string, { icon: string; label: string; confirmLabel: string; color: string; border: string }> = {
  send_email: {
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    label: "📧 Send Email",
    confirmLabel: "Send Email ↗",
    color: "text-sky-400",
    border: "border-sky-900/40 bg-sky-950/20",
  },
  reply_to_thread: {
    icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
    label: "↩ Reply to Thread",
    confirmLabel: "Send Reply ↗",
    color: "text-violet-400",
    border: "border-violet-900/40 bg-violet-950/20",
  },
  create_calendar_event: {
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    label: "📅 Create Event",
    confirmLabel: "Create Event ↗",
    color: "text-emerald-400",
    border: "border-emerald-900/40 bg-emerald-950/20",
  },
  reschedule_calendar_event: {
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    label: "📅 Reschedule Event",
    confirmLabel: "Reschedule ↗",
    color: "text-amber-400",
    border: "border-amber-900/40 bg-amber-950/20",
  },
  create_commitment: {
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    label: "📝 Create Commitment",
    confirmLabel: "Create Task ↗",
    color: "text-pink-400",
    border: "border-pink-900/40 bg-pink-950/20",
  },
  update_commitment: {
    icon: "M5 13l4 4L19 7",
    label: "✅ Update Commitment",
    confirmLabel: "Update ↗",
    color: "text-emerald-400",
    border: "border-emerald-900/40 bg-emerald-950/20",
  },
  execute_negotiation: {
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    label: "⚡ Execute Negotiation",
    confirmLabel: "Schedule & Reply ↗",
    color: "text-amber-500",
    border: "border-amber-900/40 bg-amber-950/20",
  },
};

function WriteConfirmModal({
  action,
  onCancel,
  onConfirm,
  executing,
}: {
  action: Action;
  onCancel: () => void;
  onConfirm: (payload: PendingPayload) => void;
  executing: boolean;
}) {
  const p = action.pendingPayload;
  const meta = WRITE_ACTION_META[action.actionType];

  // Editable state per field
  const [body, setBody] = useState(
    (p as SendEmailPayload | ReplyPayload)?.body ?? ""
  );
  const [subject, setSubject] = useState((p as SendEmailPayload)?.subject ?? "");
  const [to, setTo] = useState(
    ((p as SendEmailPayload | ReplyPayload)?.to ?? []).join(", ")
  );

  if (!p || !meta) return null;

  const handleConfirm = () => {
    if (action.actionType === "send_email") {
      onConfirm({ kind: "send_email", to: to.split(",").map(e => e.trim()).filter(Boolean), subject, body });
    } else if (action.actionType === "reply_to_thread") {
      const rp = p as ReplyPayload;
      onConfirm({ kind: "reply_to_thread", threadId: rp.threadId, to: to.split(",").map(e => e.trim()).filter(Boolean), body });
    } else if (action.actionType === "create_calendar_event" || action.actionType === "reschedule_calendar_event" || action.actionType === "create_commitment" || action.actionType === "update_commitment" || action.actionType === "execute_negotiation") {
      onConfirm(p);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`mt-2 rounded-xl border p-3.5 space-y-3 ${meta.border}`}
    >
      <p className={`text-[10px] font-extrabold uppercase tracking-widest ${meta.color}`}>{meta.label}</p>

      {/* send_email / reply_to_thread fields */}
      {(action.actionType === "send_email" || action.actionType === "reply_to_thread") && (
        <>
          <div>
            <label className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">To</label>
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-slate-200 outline-none focus:border-white/20"
            />
          </div>
          {action.actionType === "send_email" && (
            <div>
              <label className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Subject</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-slate-200 outline-none focus:border-white/20"
              />
            </div>
          )}
          <div>
            <label className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-white/20 resize-none leading-relaxed"
            />
          </div>
        </>
      )}

      {/* create_calendar_event preview */}
      {action.actionType === "create_calendar_event" && (() => {
        const ep = p as CreateEventPayload;
        const start = new Date(ep.startAt);
        const end = new Date(ep.endAt);
        const fmt = (d: Date) => d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
        return (
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div><span className="text-slate-500 font-bold">Event: </span>{ep.title}</div>
            <div><span className="text-slate-500 font-bold">Start: </span>{fmt(start)}</div>
            <div><span className="text-slate-500 font-bold">End: </span>{fmt(end)}</div>
            {ep.attendees?.length > 0 && (
              <div><span className="text-slate-500 font-bold">Attendees: </span>{ep.attendees.join(", ")}</div>
            )}
            {ep.description && (
              <div><span className="text-slate-500 font-bold">Notes: </span>{ep.description}</div>
            )}
          </div>
        );
      })()}

      {/* reschedule_calendar_event preview */}
      {action.actionType === "reschedule_calendar_event" && (() => {
        const ep = p as any;
        const start = new Date(ep.startAt);
        const end = new Date(ep.endAt);
        const fmt = (d: Date) => d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
        return (
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div><span className="text-slate-500 font-bold">New Start: </span>{fmt(start)}</div>
            <div><span className="text-slate-500 font-bold">New End: </span>{fmt(end)}</div>
          </div>
        );
      })()}

      {/* create_commitment preview */}
      {action.actionType === "create_commitment" && (() => {
        const ep = p as any;
        return (
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div><span className="text-slate-500 font-bold">Task: </span>{ep.title}</div>
            {ep.dueDate && (
              <div><span className="text-slate-500 font-bold">Due: </span>{new Date(ep.dueDate).toLocaleDateString()}</div>
            )}
            {ep.contactEmail && (
              <div><span className="text-slate-500 font-bold">Contact: </span>{ep.contactEmail}</div>
            )}
          </div>
        );
      })()}
      
      {/* execute_negotiation preview */}
      {action.actionType === "execute_negotiation" && (() => {
        const ep = p as any;
        const start = new Date(ep.selectedSlot?.startAt);
        const fmt = (d: Date) => d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
        return (
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div><span className="text-slate-500 font-bold">Event: </span>{ep.title}</div>
            <div><span className="text-slate-500 font-bold">Time: </span>{fmt(start)}</div>
            <div><span className="text-slate-500 font-bold">Reply: </span>"{ep.replyBody?.slice(0, 50)}..."</div>
          </div>
        );
      })()}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={executing}
          className="flex-1 py-2 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={executing}
          className={`flex-1 py-2 rounded-lg text-[10px] font-bold text-white transition-all disabled:opacity-70 active:scale-95 ${
            action.actionType === "send_email" ? "bg-sky-600 hover:bg-sky-500" :
            action.actionType === "reply_to_thread" ? "bg-violet-600 hover:bg-violet-500" :
            "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {executing ? (
            <span className="flex items-center justify-center gap-1.5">
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="block w-3 h-3 border-2 border-white/40 border-t-white rounded-full" />
              Sending...
            </span>
          ) : meta.confirmLabel}
        </button>
      </div>
    </motion.div>
  );
}

function ActionButton({
  action,
  onMarkComplete,
}: {
  action: Action;
  onMarkComplete?: (id: string) => void;
}) {
  const [btnState, setBtnState] = useState<ActionButtonState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isWrite = WRITE_ACTION_TYPES.includes(action.actionType as any);

  const handleClick = async () => {
    if (action.actionType === "mark_complete" && onMarkComplete) {
      setBtnState("executing");
      try {
        await fetch(`/api/commitments/${action.targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "COMPLETED" }),
        });
        onMarkComplete(action.targetId);
        setBtnState("done");
      } catch {
        setBtnState("idle");
      }
      return;
    }
    if (action.actionType === "draft_email") {
      window.location.href = `mailto:?subject=Follow-up`;
      return;
    }
    // SEC-05: Validate href is a relative path before navigating
    const safeHref = action.href?.startsWith("/") ? action.href : null;
    if (action.actionType === "view_commitment" || action.actionType === "view_inbox") {
      window.location.href = safeHref ?? "/dashboard";
      return;
    }
    if (action.actionType === "view_contact") {
      window.location.href = safeHref ?? "/contacts";
      return;
    }
    if (isWrite) {
      setBtnState("confirming");
    }
  };

  const handleConfirm = async (editedPayload: PendingPayload) => {
    setBtnState("executing");
    try {
      const res = await fetch("/api/ask/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: action.actionType, payload: editedPayload }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed.");
      }
      setBtnState("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Action failed.");
      setBtnState("error");
    }
  };

  const iconMap: Record<string, React.ReactNode> = {
    draft_email: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    view_commitment: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    view_contact: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    mark_complete: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    view_inbox: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
      </svg>
    ),
    send_email: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    reply_to_thread: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
    create_calendar_event: (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  };

  if (btnState === "done") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-900/40">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Done
      </span>
    );
  }

  const writeActionStyle = isWrite
    ? "border-amber-700/60 bg-amber-950/30 hover:bg-amber-900/30 text-amber-200 hover:border-amber-600"
    : "bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-slate-200";

  return (
    <div className="w-full">
      <button
        id={`ask-action-${action.targetId}-${action.actionType}`}
        onClick={handleClick}
        className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${writeActionStyle}`}
      >
        {iconMap[action.actionType]}
        {action.label}
        {isWrite && btnState === "idle" && (
          <span className="ml-auto text-[8px] font-extrabold uppercase tracking-widest opacity-50">Review</span>
        )}
      </button>

      <AnimatePresence>
        {btnState === "confirming" && action.pendingPayload && (
          <WriteConfirmModal
            action={action}
            onCancel={() => setBtnState("idle")}
            onConfirm={handleConfirm}
            executing={false}
          />
        )}
        {btnState === "executing" && action.pendingPayload && (
          <WriteConfirmModal
            action={action}
            onCancel={() => {}}
            onConfirm={() => {}}
            executing={true}
          />
        )}
        {btnState === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 rounded-xl border border-rose-900/40 bg-rose-950/20 p-3 space-y-2"
          >
            <p className="text-[10px] text-rose-400 font-bold">Action failed</p>
            <p className="text-[10px] text-slate-400">{errorMsg}</p>
            <button
              onClick={() => setBtnState("confirming")}
              className="text-[10px] font-bold text-rose-300 hover:text-rose-200 px-3 py-1.5 rounded-lg border border-rose-900/40 hover:bg-rose-950/30 transition-all"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Thinking State ───────────────────────────────────────────────────────────

function ThinkingState({ step }: { step: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10">
      {/* Pulsing Flux orb */}
      <div className="relative">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-stone-500 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-amber-900/40">
          C
        </div>
        <span className="thinking-dot absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(167,139,250,0.5)]" />
      </div>

      {/* Animated step text */}
      <div className="text-center space-y-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="text-xs font-semibold text-amber-300"
          >
            {step}
          </motion.p>
        </AnimatePresence>
        <p className="text-[10px] text-slate-500">Ask Flux is thinking...</p>
      </div>

      {/* Premium Shimmer bar */}
      <div className="w-48 h-1 rounded-full bg-slate-800 overflow-hidden relative">
        <motion.div
          className="absolute h-full w-1/3 rounded-full bg-gradient-to-r from-amber-600 via-stone-400 to-amber-600"
          animate={{ x: ["-100%", "400%"] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

// ─── Answer View ──────────────────────────────────────────────────────────────

function AnswerView({
  response,
  onReset,
}: {
  response: AskResponse;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 ask-fade-in">
      {/* Answer text */}
      <div className="p-4 rounded-xl glass-card border border-slate-800/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-amber-600 to-stone-500 flex items-center justify-center font-extrabold text-white text-xs shadow">
            C
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Flux</span>
        </div>
        <p className="text-[12px] text-slate-200 leading-relaxed">{response.answer}</p>
      </div>

      {/* Evidence cards */}
      {response.evidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">
            Supporting Evidence
          </p>
          {response.evidence.map((item, i) => (
            <EvidenceCard key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
      )}

      {/* Action buttons */}
      {response.actions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">
            Recommended Actions
          </p>
          <div className="flex flex-col gap-2">
            {response.actions.map((action, i) => (
              <ActionButton key={`${action.targetId}-${i}`} action={action} />
            ))}
          </div>
        </div>
      )}

      {/* Ask another */}
      <button
        id="ask-flux-reset"
        onClick={onReset}
        className="mt-1 w-full py-2.5 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-slate-200 border border-dashed border-slate-800 hover:border-slate-700 hover:bg-slate-900/30 transition-all"
      >
        Ask another question
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AskFlux() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"idle" | "thinking" | "answered" | "error">("idle");
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thinkingStep, setThinkingStep] = useState(THINKING_STEPS[0]);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const placeholderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rotate placeholder text
  useEffect(() => {
    placeholderTimerRef.current = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % SUGGESTED_QUERIES.length);
    }, 3000);
    return () => {
      if (placeholderTimerRef.current) clearInterval(placeholderTimerRef.current);
    };
  }, []);

  // Listen for global custom event to open the AI assistant
  useEffect(() => {
    const openHandler = () => {
      setIsOpen(true);
    };
    window.addEventListener("flux:open-ai", openHandler);
    return () => window.removeEventListener("flux:open-ai", openHandler);
  }, []);

  // Escape shortcut to close AI panel
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when panel opens — stored in ref so it can be cleaned up
  useEffect(() => {
    if (isOpen && state === "idle") {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [isOpen, state]);

  // Rotate thinking steps while loading
  const startThinkingSteps = useCallback(() => {
    let i = 0;
    setThinkingStep(THINKING_STEPS[0]);
    thinkingTimerRef.current = setInterval(() => {
      i = (i + 1) % THINKING_STEPS.length;
      setThinkingStep(THINKING_STEPS[i]);
    }, 1200);
  }, []);

  const stopThinkingSteps = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
  }, []);

  const handleSubmit = useCallback(
    async (submittedQuery: string) => {
      const q = submittedQuery.trim();
      if (!q) return;

      setQuery(q);
      setState("thinking");
      setError(null);
      setResponse(null);
      startThinkingSteps();

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });

        stopThinkingSteps();

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to get a response.");
        }

        const data: AskResponse = await res.json();
        setResponse(data);
        setState("answered");
      } catch (err: unknown) {
        stopThinkingSteps();
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setState("error");
      }
    },
    [startThinkingSteps, stopThinkingSteps]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit(query);
    }
  };

  const handleReset = useCallback(() => {
    setState("idle");
    setQuery("");
    setResponse(null);
    setError(null);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      {/* ── Floating Trigger Button ─────────────────────────────── */}
      <button
        id="ask-flux-trigger"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-stone-600 hover:from-amber-500 hover:to-stone-500 text-white font-bold text-xs shadow-2xl shadow-amber-900/40 hover:shadow-amber-900/60 transition-all hover:-translate-y-0.5 active:scale-95 border border-amber-500/30 group"
        aria-label="Ask Flux"
      >
        {/* Pulse indicator */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>

        <span className="flex items-center gap-1.5">
          Ask Flux
          <kbd className="text-[8px] font-extrabold bg-white/15 px-1.5 py-0.5 rounded border border-white/20 tracking-wider hidden sm:block">
            ⌘K
          </kbd>
        </span>

        {/* AI sparkle icon */}
        <svg className="w-3.5 h-3.5 opacity-80 group-hover:opacity-100 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      </button>

      {/* ── Backdrop ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ── Panel ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-20 right-6 z-50 w-[480px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            style={{
              background:
                "linear-gradient(160deg, rgba(13,17,40,0.90) 0%, rgba(8,10,25,0.95) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
            role="dialog"
            aria-label="Ask Flux"
            aria-modal="true"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-amber-600 to-stone-500 flex items-center justify-center font-extrabold text-white text-xs shadow shadow-amber-900/40">
                  C
                </div>
                <div>
                  <p className="text-xs font-extrabold text-white tracking-tight">Ask Flux</p>
                  <p className="text-[9px] text-amber-400/80 font-semibold uppercase tracking-widest -mt-0.5">
                    AI Chief of Staff
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
                aria-label="Close"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence mode="wait">
                {state === "idle" && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {/* Suggested queries */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">
                        Suggested Questions
                      </p>
                      <div className="grid gap-1.5">
                        {SUGGESTED_QUERIES.map((q, i) => (
                          <button
                            key={i}
                            id={`ask-suggestion-${i}`}
                            onClick={() => handleSubmit(q)}
                            className="text-left text-[11px] font-medium text-slate-300 hover:text-white px-3 py-2.5 rounded-xl bg-slate-900/40 hover:bg-slate-800/60 border border-white/5 hover:border-white/10 transition-all flex items-center gap-2.5 group"
                          >
                            <svg className="w-3 h-3 text-amber-500 shrink-0 group-hover:text-amber-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {state === "thinking" && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ThinkingState step={thinkingStep} />
                  </motion.div>
                )}

                {state === "answered" && response && (
                  <motion.div
                    key="answered"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <AnswerView response={response} onReset={handleReset} />
                  </motion.div>
                )}

                {state === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 py-8"
                  >
                    <div className="h-12 w-12 rounded-xl bg-rose-950/30 border border-rose-900/40 flex items-center justify-center">
                      <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-rose-300 mb-1">Something went wrong</p>
                      <p className="text-[10px] text-slate-500 max-w-xs">{error}</p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 px-4 py-2 rounded-lg bg-amber-950/30 hover:bg-amber-950/50 border border-amber-900/40 transition-all"
                    >
                      Try Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Bar — always visible except during thinking */}
            <AnimatePresence>
              {state !== "thinking" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="shrink-0 px-4 py-3 border-t border-white/10 bg-black/20"
                >
                  <div className="flex gap-2.5 items-center">
                    <div className="flex-1 relative">
                      <input
                        ref={inputRef}
                        id="ask-flux-input"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={SUGGESTED_QUERIES[placeholderIdx]}
                        className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 px-4 py-2.5 text-[12px] text-white placeholder:text-slate-500 rounded-xl pr-10 outline-none transition-all"
                        aria-label="Ask Flux a question"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                    <button
                      id="ask-flux-submit"
                      onClick={() => handleSubmit(query)}
                      disabled={!query.trim()}
                      className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr from-amber-600 to-stone-500 hover:from-amber-500 hover:to-stone-400 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-amber-900/30"
                      aria-label="Submit question"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-600 mt-2 text-center">
                    Grounded in your live Flux data · Powered by Gemini
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
