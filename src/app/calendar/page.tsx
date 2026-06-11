"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sidebar User Account Info State
  const [userData, setUserData] = useState<{ userName: string; userEmail: string } | null>(null);
  
  // Event Creation Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [newEventAttendees, setNewEventAttendees] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchEvents = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar?days=14");
      if (!res.ok) {
        throw new Error("Failed to load calendar events");
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err: any) {
      console.error("Error fetching calendar events:", err);
      setError(err.message || "Failed to load calendar data.");
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
    fetchEvents();
    fetchUserData();
  }, [fetchEvents, fetchUserData]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventStart || !newEventEnd) return;
    
    setCreating(true);
    try {
      const attendees = newEventAttendees
        .split(",")
        .map(a => a.trim())
        .filter(a => a.includes("@"));

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEventTitle,
          startAt: newEventStart,
          endAt: newEventEnd,
          attendees,
        }),
      });

      if (!res.ok) throw new Error("Failed to create event");
      
      // Reset form and reload events
      setIsDrawerOpen(false);
      setNewEventTitle("");
      setNewEventStart("");
      setNewEventEnd("");
      setNewEventAttendees("");
      await fetchEvents(false);
    } catch (err) {
      console.error("Failed to create event:", err);
      alert("Failed to create event. See console.");
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // Group events by day
  const groupedEvents: Record<string, any[]> = {};
  events.forEach(event => {
    const day = formatDate(event.startAt);
    if (!groupedEvents[day]) groupedEvents[day] = [];
    groupedEvents[day].push(event);
  });

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
          <nav className="p-4 space-y-1.5">
            <a
              href="/dashboard"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition-all border border-transparent"
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
              <svg className="w-5 h-5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
              </svg>
              Inbox
            </a>
            <a
              href="/calendar"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all bg-amber-950/40 text-amber-200 border border-amber-900/30 shadow-inner"
            >
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          </nav>
        </div>

        {/* User Account Info */}
        <div className="p-4 border-t border-slate-800/80 m-4 rounded-2xl bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
              {userData?.userName?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-semibold truncate text-slate-200">
                {userData?.userName || "User"}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {userData?.userEmail || "Loading..."}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-screen z-0">
        <header className="h-16 border-b border-slate-800/60 bg-[#080a14]/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0 relative z-20">
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Upcoming Agenda
          </h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-stone-600 hover:from-amber-500 hover:to-stone-500 text-white shadow-lg shadow-amber-950/20 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Event
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {error && (
            <div className="p-4 mb-6 rounded-xl border border-rose-900/30 bg-rose-950/15 text-rose-350 text-sm font-semibold">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <svg className="w-16 h-16 mb-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">No upcoming events</p>
              <p className="text-sm mt-1">Your schedule is clear</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-10">
              {Object.entries(groupedEvents).map(([day, dayEvents]) => (
                <div key={day} className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-[#05070f]/90 backdrop-blur py-2 z-10">
                    {day}
                  </h2>
                  <div className="space-y-3">
                    {dayEvents.map((event) => {
                      // Determine border color based on health/commitments
                      let borderColor = "border-slate-800";
                      let indicator = null;
                      
                      const hasAtRisk = event.attendees?.some((a: any) => a.relationshipHealth === "At Risk");
                      const allStrong = event.attendees?.length > 0 && event.attendees?.every((a: any) => a.relationshipHealth === "Strong");
                      
                      if (hasAtRisk) {
                        borderColor = "border-rose-900/50";
                        indicator = <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse"></div>;
                      } else if (allStrong) {
                        borderColor = "border-emerald-900/50";
                      } else if (event.commitments?.length > 0) {
                        borderColor = "border-amber-900/50";
                      }

                      return (
                        <div 
                          key={event.id}
                          className={`glass-card p-4 rounded-2xl border ${borderColor} hover:border-amber-500/50 transition-all group relative cursor-pointer`}
                        >
                          {indicator}
                          <div className="flex gap-4">
                            <div className="w-20 shrink-0 text-right pt-1">
                              <div className="text-sm font-bold text-slate-200">{formatTime(event.startAt)}</div>
                              <div className="text-xs text-slate-500">{formatTime(event.endAt)}</div>
                            </div>
                            <div className="flex-1 border-l border-slate-800 pl-4">
                              <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                                {event.title}
                              </h3>
                              {event.location && (
                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {event.location}
                                </div>
                              )}
                              
                              {/* Attendees */}
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {event.attendees.map((attendee: any) => {
                                    let badgeColor = "bg-slate-900 border-slate-800 text-slate-300";
                                    if (attendee.relationshipHealth === "At Risk") badgeColor = "bg-rose-950/40 border-rose-900/50 text-rose-300";
                                    if (attendee.relationshipHealth === "Strong") badgeColor = "bg-emerald-950/40 border-emerald-900/50 text-emerald-300";
                                    
                                    return (
                                      <span key={attendee.id} className={`text-xs px-2 py-1 rounded-md border ${badgeColor} flex items-center gap-1.5`}>
                                        <div className="w-4 h-4 rounded-full bg-black/40 flex items-center justify-center font-bold text-[8px] uppercase">
                                          {(attendee.name || attendee.email).charAt(0)}
                                        </div>
                                        {attendee.name || attendee.email.split('@')[0]}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Event Creation Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 md:left-auto md:w-[500px] h-[85vh] bg-[#0c0f1d] border-t border-l border-slate-800 shadow-2xl z-50 flex flex-col md:rounded-tl-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0a0d18]">
                <h2 className="text-lg font-bold text-slate-100">Create New Event</h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form id="create-event-form" onSubmit={handleCreateEvent} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Event Title</label>
                    <input 
                      type="text" 
                      required
                      value={newEventTitle}
                      onChange={e => setNewEventTitle(e.target.value)}
                      className="glass-input w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                      placeholder="E.g., Quarterly Review"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Start Time</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={newEventStart}
                        onChange={e => setNewEventStart(e.target.value)}
                        className="glass-input w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">End Time</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={newEventEnd}
                        onChange={e => setNewEventEnd(e.target.value)}
                        className="glass-input w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Attendees (comma-separated)</label>
                    <input 
                      type="text" 
                      value={newEventAttendees}
                      onChange={e => setNewEventAttendees(e.target.value)}
                      className="glass-input w-full p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-white focus:outline-none focus:border-amber-500/50"
                      placeholder="sarah@example.com, mike@example.com"
                    />
                  </div>
                </form>
              </div>

              <div className="p-4 border-t border-slate-800 bg-[#0a0d18]">
                <button
                  type="submit"
                  form="create-event-form"
                  disabled={creating}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-600 to-stone-600 hover:from-amber-500 hover:to-stone-500 shadow-lg shadow-amber-900/20 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : "Create Calendar Event"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
