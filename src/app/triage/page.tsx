"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface TriagePayload {
  thread: any;
  intelligence: {
    aiSummary: string;
    riskScore: number;
    averageRelationshipScore: number;
    openCommitments: any[];
    schedulingIntent: any;
    contacts: any[];
  };
}

export default function TriagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TriagePayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const fetchNextThread = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/triage/next");
      const json = await res.json();
      if (json.thread) {
        setData(json);
      } else {
        setData(null);
        setMessage(json.message || "Inbox Zero reached!");
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to load next thread.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNextThread();
  }, [fetchNextThread]);

  const handleAction = useCallback(async (actionType: "archive" | "remind_later" | "reply" | "meeting") => {
    if (!data?.thread) return;

    setActionStatus(`Executing ${actionType}...`);

    try {
      if (actionType === "archive" || actionType === "remind_later") {
        await fetch("/api/inbox/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: data.thread.id,
            action: actionType,
            mode: actionType === "remind_later" ? "until_reply" : undefined,
          }),
        });
        await fetchNextThread();
      } else if (actionType === "reply") {
        // Trigger generic reply logic (in MVP we can just archive it to simulate handling it)
        // Ideally this opens a reply composer
        alert("Reply modal would open here. Archiving for triage flow...");
        await handleAction("archive");
      } else if (actionType === "meeting") {
        // Trigger meeting negotiation
        await fetch("/api/meeting/negotiation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: data.thread.id, window: "next week", durationMinutes: 30 }),
        });
        alert("Meeting negotiation started. Archiving for triage flow...");
        await handleAction("archive");
      }
    } catch (err) {
      console.error(err);
      setActionStatus("Action failed.");
    } finally {
      setActionStatus(null);
    }
  }, [data, fetchNextThread]);

  // Global Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      
      if (!data) {
        if (e.key === "Escape") router.push("/inbox");
        return;
      }

      switch (e.key.toLowerCase()) {
        case "e":
          e.preventDefault();
          handleAction("reply");
          break;
        case "a":
          e.preventDefault();
          handleAction("archive");
          break;
        case "m":
          e.preventDefault();
          handleAction("meeting");
          break;
        case "r":
          e.preventDefault();
          handleAction("remind_later");
          break;
        case "escape":
          e.preventDefault();
          router.push("/inbox");
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data, handleAction, router]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center text-[#57534E]">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-amber-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading next thread...
        </div>
      </div>
    );
  }

  if (message || !data) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-[#0C0A09] mb-4">Inbox Zero</h1>
        <p className="text-[#57534E] mb-8">{message}</p>
        <button onClick={() => router.push("/inbox")} className="px-6 py-2 bg-[#0C0A09] text-white font-bold rounded-lg hover:bg-slate-800">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#FAFAF9] text-[#0C0A09]">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[#E8ECF0] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/inbox")} className="p-2 -ml-2 text-[#57534E] hover:text-[#0C0A09]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <span className="font-bold text-lg tracking-tight uppercase text-[#A16207]">Triage Mode</span>
        </div>
        {actionStatus && <span className="text-xs font-bold text-amber-600 animate-pulse">{actionStatus}</span>}
      </header>

      {/* Main Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Email Thread */}
        <div className="flex-1 flex flex-col border-r border-[#E8ECF0] overflow-hidden bg-white">
          <div className="p-6 border-b border-amber-200/50 bg-amber-50/30">
            <h3 className="text-[10px] font-black uppercase text-amber-700 tracking-wider mb-2">AI Summary</h3>
            <p className="text-sm font-medium text-[#0C0A09] leading-relaxed">
              {data.intelligence.aiSummary}
            </p>
          </div>
          
          <div className="p-6 border-b border-[#E8ECF0]">
            <h2 className="text-xl font-bold mb-2">{data.thread.subject}</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {data.thread.messages.map((m: any) => (
              <div key={m.id} className="border border-[#E8ECF0] rounded-xl p-4 bg-[#FAFAF9]">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-sm">{m.sender}</span>
                  <span className="text-xs text-[#57534E]">{new Date(m.receivedAt).toLocaleString()}</span>
                </div>
                <div className="text-sm text-[#0C0A09] whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Intelligence Dashboard */}
        <div className="w-[380px] bg-[#FAFAF9] p-6 overflow-y-auto">
          <h3 className="text-xs font-black uppercase text-[#57534E] tracking-wider mb-6">Intelligence Signals</h3>
          
          {/* Risk Score */}
          <div className="mb-6 bg-white p-4 rounded-xl border border-[#E8ECF0] shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase text-[#57534E]">Commitment Risk</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded ${data.intelligence.riskScore > 60 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {data.intelligence.riskScore}
              </span>
            </div>
          </div>

          {/* Relationship Health */}
          <div className="mb-6 bg-white p-4 rounded-xl border border-[#E8ECF0] shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase text-[#57534E]">Avg Relationship</span>
              <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                {Math.round(data.intelligence.averageRelationshipScore)}
              </span>
            </div>
            {data.intelligence.contacts.length > 0 && (
              <div className="text-[10px] text-[#57534E] mt-2">
                Participants: {data.intelligence.contacts.map((c: any) => c.email.split("@")[0]).join(", ")}
              </div>
            )}
          </div>

          {/* Scheduling Intent */}
          {data.intelligence.schedulingIntent?.isMeetingRequest && (
            <div className="mb-6 bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm">
              <h4 className="text-xs font-black uppercase text-amber-700 mb-2">Scheduling Intent Detected</h4>
              <p className="text-[11px] text-amber-900">{data.intelligence.schedulingIntent.reasoning}</p>
              {data.intelligence.schedulingIntent.candidateTimes?.length > 0 && (
                <div className="mt-2 text-[10px] text-amber-800 font-bold">
                  Proposed: {data.intelligence.schedulingIntent.candidateTimes.join(" | ")}
                </div>
              )}
            </div>
          )}

          {/* Open Commitments */}
          {data.intelligence.openCommitments.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-black uppercase text-[#57534E] mb-3">Open Commitments</h4>
              {data.intelligence.openCommitments.map((c: any) => (
                <div key={c.id} className="bg-white p-3 rounded-lg border border-[#E8ECF0] mb-2 text-xs">
                  {c.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Bar */}
      <footer className="px-6 py-4 bg-[#0C0A09] text-white flex justify-center gap-6 shrink-0">
        <kbd className="px-3 py-1.5 bg-slate-800 rounded font-bold text-sm tracking-widest"><span className="text-emerald-400">E</span> Reply</kbd>
        <kbd className="px-3 py-1.5 bg-slate-800 rounded font-bold text-sm tracking-widest"><span className="text-emerald-400">A</span> Archive</kbd>
        <kbd className="px-3 py-1.5 bg-slate-800 rounded font-bold text-sm tracking-widest"><span className="text-emerald-400">M</span> Meeting</kbd>
        <kbd className="px-3 py-1.5 bg-slate-800 rounded font-bold text-sm tracking-widest"><span className="text-emerald-400">R</span> Remind</kbd>
      </footer>
    </div>
  );
}
