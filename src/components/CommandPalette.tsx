"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface CommandItem {
  id: string;
  name: string;
  description: string;
  group: "Navigation" | "Actions" | "AI";
  icon: React.ReactNode;
  keywords: string[];
  action: (
    router: any,
    setView: (view: "list" | "compose" | "meeting" | "sending" | "success") => void,
    closePalette: () => void
  ) => void;
}

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeView, setActiveView] = useState<"list" | "compose" | "meeting" | "sending" | "success">("list");
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  
  // Action payloads
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingStart, setMeetingStart] = useState("");
  const [meetingEnd, setMeetingEnd] = useState("");
  const [meetingAttendees, setMeetingAttendees] = useState("");
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  const commands: CommandItem[] = [
    {
      id: "inbox",
      name: "Inbox",
      description: "View your email inbox & commitments",
      group: "Navigation",
      icon: (
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
        </svg>
      ),
      keywords: ["mail", "message", "email", "inbox", "threads"],
      action: (r, _, close) => {
        close();
        startTransition(() => {
          r.push("/inbox");
        });
      },
    },
    {
      id: "dashboard",
      name: "Dashboard",
      description: "Go to your daily briefing dashboard",
      group: "Navigation",
      icon: (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      keywords: ["briefing", "home", "overview", "summary", "dashboard"],
      action: (r, _, close) => {
        close();
        startTransition(() => {
          r.push("/dashboard");
        });
      },
    },
    {
      id: "contacts",
      name: "Contacts",
      description: "Manage relationships & intelligence",
      group: "Navigation",
      icon: (
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      keywords: ["relations", "network", "health", "people", "contacts"],
      action: (r, _, close) => {
        close();
        startTransition(() => {
          r.push("/contacts");
        });
      },
    },
    {
      id: "calendar",
      name: "Calendar",
      description: "Check schedules & upcoming agenda",
      group: "Navigation",
      icon: (
        <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      keywords: ["meetings", "schedule", "events", "agenda", "calendar"],
      action: (r, _, close) => {
        close();
        startTransition(() => {
          r.push("/calendar");
        });
      },
    },
    {
      id: "compose_email",
      name: "Compose Email",
      description: "Draft and send a Gmail email",
      group: "Actions",
      icon: (
        <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      keywords: ["write", "draft", "send", "email", "compose"],
      action: (_, setView, __) => {
        setView("compose");
      },
    },
    {
      id: "create_meeting",
      name: "Create Meeting",
      description: "Schedule a Google Calendar event",
      group: "Actions",
      icon: (
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      keywords: ["invite", "schedule", "calendar", "event", "meeting", "create"],
      action: (_, setView, __) => {
        setView("meeting");
      },
    },
    {
      id: "ask_chiefos",
      name: "Ask ChiefOS",
      description: "Query your AI Chief of Staff",
      group: "AI",
      icon: (
        <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      keywords: ["assistant", "help", "chat", "gemini", "ai", "chiefos"],
      action: (_, __, close) => {
        close();
        window.dispatchEvent(new CustomEvent("chiefos:open-ai"));
      },
    },
  ];

  // Handle global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // Listen for open-compose event
  useEffect(() => {
    const handleOpenCompose = () => {
      setIsOpen(true);
      setActiveView("compose");
      setErrorMessage(null);
    };
    window.addEventListener("chiefos:open-compose", handleOpenCompose);
    return () => window.removeEventListener("chiefos:open-compose", handleOpenCompose);
  }, []);

  // Listen for open-reply event
  useEffect(() => {
    const handleOpenReply = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      setIsOpen(true);
      setActiveView("compose");
      setErrorMessage(null);
      setEmailTo(detail.to.join(", "));
      setEmailSubject(detail.subject);
      setReplyThreadId(detail.threadId);
      setEmailBody("");
    };
    window.addEventListener("chiefos:open-reply", handleOpenReply);
    return () => window.removeEventListener("chiefos:open-reply", handleOpenReply);
  }, []);

  // Filtered items based on search query
  const filteredCommands = commands.filter((cmd) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      cmd.keywords.some((k) => k.includes(query))
    );
  });

  // Keep index in range of filtered results
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (filteredCommands.length === 0) return 0;
      if (prev >= filteredCommands.length) return filteredCommands.length - 1;
      return prev;
    });
  }, [searchQuery, filteredCommands.length]);

  // Focus input when palette opens or when resetting view
  useEffect(() => {
    if (isOpen && activeView === "list") {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, activeView]);

  // Automatically scroll list to keep selected element in view
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Keyboard navigation within the palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeView === "list") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((idx) => (idx + 1) % Math.max(1, filteredCommands.length));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((idx) => (idx - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action(router, setActiveView, handleClose);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          handleClose();
        }
      } else if (activeView === "compose" || activeView === "meeting") {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          if (activeView === "compose") {
            handleSendEmail();
          } else {
            handleCreateMeeting();
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setActiveView("list");
        }
      } else if (activeView === "success") {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          handleClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeView, selectedIndex, filteredCommands]);

  const handleClose = () => {
    setIsOpen(false);
    // Reset views and payloads
    setSearchQuery("");
    setSelectedIndex(0);
    setActiveView("list");
    setErrorMessage(null);
    setEmailTo("");
    setEmailSubject("");
    setEmailBody("");
    setMeetingTitle("");
    setMeetingStart("");
    setMeetingEnd("");
    setMeetingAttendees("");
    setReplyThreadId(null);
  };

  // API Call: Send Email
  const handleSendEmail = async () => {
    const isReply = !!replyThreadId;
    if (!emailTo.trim() || (!isReply && !emailSubject.trim()) || !emailBody.trim()) {
      setErrorMessage("Please fill out all fields.");
      return;
    }
    setErrorMessage(null);
    setActiveView("sending");
    
    try {
      const payload = isReply
        ? {
            kind: "reply_to_thread",
            threadId: replyThreadId,
            to: emailTo.split(",").map((e) => e.trim()).filter(Boolean),
            body: emailBody.trim(),
          }
        : {
            kind: "send_email",
            to: emailTo.split(",").map((e) => e.trim()).filter(Boolean),
            subject: emailSubject.trim(),
            body: emailBody.trim(),
          };

      const res = await fetch("/api/ask/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: isReply ? "reply_to_thread" : "send_email",
          payload,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }

      setActiveView("success");
      setTimeout(() => handleClose(), 2000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send email");
      setActiveView("compose");
    }
  };

  // API Call: Create Calendar Event
  const handleCreateMeeting = async () => {
    if (!meetingTitle.trim() || !meetingStart || !meetingEnd) {
      setErrorMessage("Please fill out event title, start time, and end time.");
      return;
    }
    setErrorMessage(null);
    setActiveView("sending");

    try {
      const res = await fetch("/api/ask/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "create_calendar_event",
          payload: {
            kind: "create_calendar_event",
            title: meetingTitle.trim(),
            startAt: new Date(meetingStart).toISOString(),
            endAt: new Date(meetingEnd).toISOString(),
            attendees: meetingAttendees.split(",").map((e) => e.trim()).filter(Boolean),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create meeting event");
      }

      setActiveView("success");
      setTimeout(() => handleClose(), 2000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create meeting");
      setActiveView("meeting");
    }
  };

  // Group filtered items
  const grouped: Record<string, CommandItem[]> = {};
  filteredCommands.forEach((cmd) => {
    if (!grouped[cmd.group]) {
      grouped[cmd.group] = [];
    }
    grouped[cmd.group].push(cmd);
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Palette Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="relative w-full max-w-[560px] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-[0_32px_96px_rgba(0,0,0,0.8)] z-10"
            style={{
              background: "linear-gradient(160deg, rgba(13,17,40,0.94) 0%, rgba(8,10,25,0.98) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
          >
            {activeView === "list" && (
              <>
                {/* Search Header */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 shrink-0">
                  <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dashboard, run email actions..."
                    className="w-full bg-transparent text-[13px] text-white placeholder:text-slate-500 outline-none pr-8"
                  />
                  <div className="text-[10px] font-bold text-slate-500 bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded uppercase tracking-wider shrink-0 select-none">
                    ESC
                  </div>
                </div>

                {/* Commands List */}
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto p-2 space-y-4 max-h-[45vh] custom-scrollbar"
                >
                  {filteredCommands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
                      <svg className="w-10 h-10 mb-2 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs font-semibold text-slate-400">No matches found</p>
                      <p className="text-[10px] mt-0.5">Try searching for inbox, compose, calendar, etc.</p>
                    </div>
                  ) : (
                    Object.entries(grouped).map(([groupName, items]) => (
                      <div key={groupName} className="space-y-1">
                        <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500/80 px-3 py-1">
                          {groupName}
                        </div>
                        <div className="space-y-0.5">
                          {items.map((cmd) => {
                            const globalIndex = filteredCommands.findIndex((c) => c.id === cmd.id);
                            const isSelected = globalIndex === selectedIndex;

                            return (
                              <button
                                key={cmd.id}
                                data-selected={isSelected}
                                onClick={() => cmd.action(router, setActiveView, handleClose)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl border border-transparent flex items-center gap-3 transition-all outline-none ${
                                  isSelected
                                    ? "bg-white/8 border-white/10 text-white shadow-md shadow-black/10 border-l-amber-500 border-l-[3px]"
                                    : "hover:bg-white/5 text-slate-350"
                                }`}
                              >
                                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isSelected ? "bg-slate-900/60" : "bg-slate-950/40"
                                }`}>
                                  {cmd.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-bold tracking-tight">{cmd.name}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{cmd.description}</p>
                                </div>
                                {isSelected && (
                                  <div className="text-[9px] font-extrabold uppercase text-amber-400/80 tracking-widest mr-2 select-none">
                                    ↩ ENTER
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Footer instructions */}
                <div className="px-4 py-2 bg-black/20 border-t border-white/5 flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase tracking-wider shrink-0 select-none">
                  <div className="flex gap-4">
                    <span>↑↓ Navigate</span>
                    <span>↵ Select</span>
                  </div>
                  <span>Ctrl+K to close</span>
                </div>
              </>
            )}

            {/* Inline Compose Email View */}
            {activeView === "compose" && (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setErrorMessage(null);
                        setActiveView("list");
                      }}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      aria-label="Go back"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[12px] font-extrabold text-white uppercase tracking-wider">Compose Email</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded">
                    ESC to cancel
                  </span>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto max-h-[48vh] custom-scrollbar">
                  {errorMessage && (
                    <div className="p-3 rounded-lg border border-rose-900/30 bg-rose-950/15 text-[11px] text-rose-300 font-medium leading-relaxed">
                      {errorMessage}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">To</label>
                    <input
                      type="text"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="sarah@example.com, developer@gmail.com"
                      className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 p-2.5 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Follow-up on project roadmap"
                      disabled={!!replyThreadId}
                      className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 p-2.5 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Message Body</label>
                    <textarea
                      rows={5}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Hi Sarah, Just wanted to check in regarding..."
                      className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 p-2.5 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="px-4 py-3 bg-black/20 border-t border-white/5 flex items-center justify-between shrink-0 select-none">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    ⌘+↵ to send
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveView("list")}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-900/30 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSendEmail}
                      className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white bg-gradient-to-tr from-amber-600 to-stone-550 hover:from-amber-500 hover:to-stone-500 shadow-md shadow-amber-950/20 active:scale-95 transition-all"
                    >
                      Send Email ↗
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Create Meeting View */}
            {activeView === "meeting" && (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setErrorMessage(null);
                        setActiveView("list");
                      }}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                      aria-label="Go back"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[12px] font-extrabold text-white uppercase tracking-wider">Create Calendar Event</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded">
                    ESC to cancel
                  </span>
                </div>

                <div className="p-4 space-y-3 overflow-y-auto max-h-[48vh] custom-scrollbar">
                  {errorMessage && (
                    <div className="p-3 rounded-lg border border-rose-900/30 bg-rose-950/15 text-[11px] text-rose-300 font-medium leading-relaxed">
                      {errorMessage}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Event Title</label>
                    <input
                      type="text"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="Quarterly Business Review"
                      className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 p-2.5 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-all"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Start Time</label>
                      <input
                        type="datetime-local"
                        value={meetingStart}
                        onChange={(e) => setMeetingStart(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 p-2.5 rounded-xl text-xs text-white outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">End Time</label>
                      <input
                        type="datetime-local"
                        value={meetingEnd}
                        onChange={(e) => setMeetingEnd(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 p-2.5 rounded-xl text-xs text-white outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">Attendees (comma-separated)</label>
                    <input
                      type="text"
                      value={meetingAttendees}
                      onChange={(e) => setMeetingAttendees(e.target.value)}
                      placeholder="sarah@example.com, mike@example.com"
                      className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 p-2.5 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="px-4 py-3 bg-black/20 border-t border-white/5 flex items-center justify-between shrink-0 select-none">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    ⌘+↵ to create
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveView("list")}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-900/30 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCreateMeeting}
                      className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white bg-gradient-to-tr from-amber-600 to-stone-550 hover:from-amber-500 hover:to-stone-500 shadow-md shadow-amber-950/20 active:scale-95 transition-all"
                    >
                      Create Event ↗
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading / Sending View */}
            {activeView === "sending" && (
              <div className="flex flex-col items-center justify-center py-16 px-4 space-y-6">
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-stone-500 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-amber-900/40">
                    C
                  </div>
                  <span className="thinking-dot absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(167,139,250,0.5)]" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-amber-300">Processing action...</p>
                  <p className="text-[10px] text-slate-500">Contacting Corsair integrations API</p>
                </div>
                <div className="w-48 h-1 rounded-full bg-slate-800 overflow-hidden relative">
                  <motion.div
                    className="absolute h-full w-1/3 rounded-full bg-gradient-to-r from-amber-600 via-stone-400 to-amber-600"
                    animate={{ x: ["-100%", "400%"] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  />
                </div>
              </div>
            )}

            {/* Success View */}
            {activeView === "success" && (
              <div className="flex flex-col items-center justify-center py-16 px-4 space-y-4">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="h-12 w-12 rounded-full bg-emerald-950/50 border border-emerald-900/40 flex items-center justify-center text-emerald-400"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-emerald-400">Success!</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Action executed successfully</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
