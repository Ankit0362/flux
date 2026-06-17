"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/Sidebar";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

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
  const [newEventDetails, setNewEventDetails] = useState("");
  const [creating, setCreating] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<any[]>([]);
  const [quickAddInput, setQuickAddInput] = useState("");
  const [quickAddDraft, setQuickAddDraft] = useState<any | null>(null);
  const [quickAdding, setQuickAdding] = useState(false);
  const [calendarNotConnected, setCalendarNotConnected] = useState(false);


  // Meeting Prep Drawer
  const [prepEventId, setPrepEventId] = useState<string | null>(null);
  const [prepData, setPrepData] = useState<any | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);

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
    } catch (err: unknown) {
      console.error("Error fetching calendar events:", err);
      setError((err instanceof Error ? err.message : String(err)) || "Failed to load calendar data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConnectionStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/status");
      if (res.ok) {
        const data = await res.json();
        setCalendarNotConnected(!data.connected);
      }
    } catch (err) {
      console.error("Failed to check calendar connection status:", err);
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
    fetchConnectionStatus();
  }, [fetchEvents, fetchUserData, fetchConnectionStatus]);

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
          description: newEventDetails,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create event");
      }
      
      // Reset form and reload events
      setIsDrawerOpen(false);
      setNewEventTitle("");
      setNewEventStart("");
      setNewEventEnd("");
      setNewEventAttendees("");
      setNewEventDetails("");
      await fetchEvents(false);
    } catch (err: unknown) {
      console.error("Failed to create event:", err);
      alert((err instanceof Error ? err.message : String(err)) || "Failed to create event. See console.");
    } finally {
      setCreating(false);
    }
  };

  const handleCalendarSync = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "incremental" }),
      });
      if (!res.ok) throw new Error("Calendar sync failed");
      await fetchEvents(false);
    } catch (err) {
      console.error("Calendar sync failed:", err);
      alert("Calendar sync failed. Check the console for details.");
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleFindAvailability = async () => {
    try {
      const res = await fetch("/api/calendar/availability?window=next%20week&durationMinutes=30");
      if (!res.ok) throw new Error("Failed to find availability");
      const data = await res.json();
      setAvailabilitySlots(data.slots || []);
    } catch (err) {
      console.error("Failed to find availability:", err);
    }
  };

  const handleOpenPrep = async (eventId: string) => {
    setPrepEventId(eventId);
    setPrepData(null);
    setPrepLoading(true);
    try {
      const res = await fetch(`/api/meeting/${eventId}/brief`);
      if (!res.ok) throw new Error("Failed to load meeting prep");
      const data = await res.json();
      setPrepData(data.brief);
    } catch (err) {
      console.error("Meeting prep failed:", err);
    } finally {
      setPrepLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      const res = await fetch(`/api/calendar/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete event");
      
      setPrepEventId(null);
      setPrepData(null);
      await fetchEvents(false);
    } catch (err) {
      console.error("Failed to delete event:", err);
      alert("Failed to delete event. See console for details.");
    }
  };

  const handleQuickAdd = async (create = false) => {
    if (!quickAddInput.trim()) return;
    setQuickAdding(true);
    try {
      const res = await fetch("/api/calendar/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: quickAddInput, create }),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.code === "calendar_not_connected") {
          setCalendarNotConnected(true);
          return;
        }
      }
      if (!res.ok) throw new Error("Quick add failed");
      const data = await res.json();
      setQuickAddDraft(data.draft);
      if (create) {
        setQuickAddInput("");
        setQuickAddDraft(null);
        await fetchEvents(false);
      }
    } catch (err) {
      console.error("Quick add failed:", err);
      alert("Quick add failed. Check the console.");
    } finally {
      setQuickAdding(false);
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
    <div className="flex h-screen w-full bg-[#FAFAF9] text-[#0C0A09] font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      {/* Sidebar Navigation */}
      <Sidebar
        activePage="calendar"
        userName={userData?.userName}
        userEmail={userData?.userEmail}
        syncing={syncingCalendar}
        onManualSync={handleCalendarSync}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-screen z-0">
        <header className="h-16 border-b border-[#E8ECF0] bg-white/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0 relative z-20">
          <h1 className="text-lg font-bold text-[#0C0A09] flex items-center gap-2">
            Upcoming Agenda
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCalendarSync}
              disabled={syncingCalendar}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#F3F4F6] hover:bg-[#F3F4F6] text-[#0C0A09] border border-[#E8ECF0] transition-all disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${syncingCalendar ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
              </svg>
              {syncingCalendar ? "Syncing" : "Sync"}
            </button>
            <button
              onClick={handleFindAvailability}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#0C0A09] border border-[#E8ECF0] transition-all"
            >
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3A9 9 0 113 12a9 9 0 0118 0z" />
              </svg>
              {availabilitySlots.length > 0 ? `${availabilitySlots.length} Suggestions` : 'Find Free Time'}
            </button>
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-stone-600 text-white shadow-lg shadow-amber-950/20 transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Event
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-4xl mx-auto mb-6">
            {availabilitySlots.length > 0 && (
              <div className="bg-white border border-emerald-200 shadow-sm rounded-2xl p-4 min-w-[260px]">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 mb-3">
                  Suggested slots
                </div>
                <div className="space-y-2">
                  {availabilitySlots.map((slot) => (
                    <button
                      key={slot.startAt}
                      onClick={() => {
                        setNewEventStart(slot.startAt.slice(0, 16));
                        setNewEventEnd(slot.endAt.slice(0, 16));
                        setIsDrawerOpen(true);
                      }}
                      className="block w-full text-left rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100 transition-all"
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {calendarNotConnected && (
            <div className="max-w-4xl mx-auto mb-6 flex items-center gap-4 rounded-2xl border border-amber-800/40 bg-amber-950/20 px-5 py-4">
              <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1">
                <div className="text-sm font-bold text-amber-200">Google Calendar not connected</div>
                <div className="text-xs text-amber-400/80 mt-0.5">Connect your Google Calendar to create events directly from Flux.</div>
              </div>
              <a
                href="/api/auth/google?plugin=googlecalendar"
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-[#0C0A09] transition-all shadow-lg shadow-amber-950/30"
              >
                Connect Calendar
              </a>
            </div>
          )}

          {error && (

            <div className="p-4 mb-6 rounded-xl border border-rose-900/30 bg-rose-950/15 text-rose-350 text-sm font-semibold">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 border-4 border-[#E8ECF0] border-t-amber-500 rounded-full animate-spin"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#57534E]">
              <svg className="w-16 h-16 mb-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg font-medium">No upcoming events</p>
              <p className="text-sm mt-1">Your schedule is clear</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-[#E8ECF0] p-4 shadow-sm">
              <style>{`
                .fc-theme-standard td, .fc-theme-standard th {
                  border-color: #E8ECF0 !important;
                }
                .fc-col-header-cell-cushion {
                  color: #0C0A09 !important;
                  font-weight: 600;
                  padding: 8px !important;
                }
                .fc-daygrid-day-number {
                  color: #57534E !important;
                }
                .fc-event {
                  background-color: #FEF3C7 !important; /* amber-100 */
                  border: 1px solid #FDE68A !important; /* amber-200 */
                  color: #78350F !important; /* amber-900 */
                  border-radius: 6px !important;
                  padding: 2px 4px;
                  font-size: 0.75rem;
                  font-weight: 600;
                  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                .fc-timegrid-slot-label-cushion {
                  color: #57534E !important;
                }
                .fc .fc-toolbar-title {
                  color: #0C0A09 !important;
                  font-weight: 700;
                  font-size: 1.25rem;
                }
                .fc .fc-button-primary {
                  background-color: #FAFAF9 !important;
                  border-color: #E8ECF0 !important;
                  color: #0C0A09 !important;
                  text-transform: capitalize;
                  font-weight: 600;
                }
                .fc .fc-button-primary:hover {
                  background-color: #F3F4F6 !important;
                }
                .fc .fc-button-primary:not(:disabled).fc-button-active, .fc .fc-button-primary:not(:disabled):active {
                  background-color: #e5e7eb !important;
                  border-color: #d1d5db !important;
                }
                .fc-v-event,
                .fc-v-event * {
                  background-color: #FEF3C7 !important;
                  border-color: #FDE68A !important;
                  color: #78350F !important;
                }
                .fc-v-event {
                  border-left: 3px solid #F59E0B !important;
                }
                .fc-event-main {
                  padding: 2px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  line-height: 1.2;
                }
              `}</style>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                displayEventTime={false}
                slotEventOverlap={false}
                events={events.map((e) => ({
                  id: e.id,
                  title: e.title,
                  start: e.startAt,
                  end: e.endAt,
                  extendedProps: { ...e },
                }))}
                eventClick={(info) => {
                  handleOpenPrep(info.event.id);
                }}
                height="700px"
                allDaySlot={false}
                slotMinTime="07:00:00"
                slotMaxTime="22:00:00"
                nowIndicator={true}
                editable={false}
              />
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60"
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 md:left-auto md:w-[500px] h-[85vh] bg-[#FAFAF9] border-t border-l border-[#E8ECF0] shadow-2xl z-70 flex flex-col md:rounded-tl-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-[#E8ECF0] flex justify-between items-center bg-[#FAFAF9]">
                <h2 className="text-lg font-bold text-[#0C0A09]">Create New Event</h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 text-[#57534E] hover:text-[#0C0A09] rounded-lg hover:bg-[#F3F4F6] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form id="create-event-form" onSubmit={handleCreateEvent} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-[#57534E] mb-1.5 uppercase tracking-wider">Event Title</label>
                    <input 
                      type="text" 
                      required
                      value={newEventTitle}
                      onChange={e => setNewEventTitle(e.target.value)}
                      className="bg-white border border-[#E8ECF0] shadow-sm w-full p-3 rounded-xl bg-[#F3F4F6] border border-[#E8ECF0] text-[#0C0A09] focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                      placeholder="E.g., Quarterly Review"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#57534E] mb-1.5 uppercase tracking-wider">Start Time</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={newEventStart}
                        onChange={e => setNewEventStart(e.target.value)}
                        className="bg-white border border-[#E8ECF0] shadow-sm w-full p-3 rounded-xl bg-[#F3F4F6] border border-[#E8ECF0] text-[#0C0A09] focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#57534E] mb-1.5 uppercase tracking-wider">End Time</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={newEventEnd}
                        onChange={e => setNewEventEnd(e.target.value)}
                        className="bg-white border border-[#E8ECF0] shadow-sm w-full p-3 rounded-xl bg-[#F3F4F6] border border-[#E8ECF0] text-[#0C0A09] focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#57534E] mb-1.5 uppercase tracking-wider">Attendees (comma-separated)</label>
                    <input 
                      type="text" 
                      value={newEventAttendees}
                      onChange={e => setNewEventAttendees(e.target.value)}
                      className="bg-white border border-[#E8ECF0] shadow-sm w-full p-3 rounded-xl bg-[#F3F4F6] text-[#0C0A09] focus:outline-none focus:border-amber-500/50"
                      placeholder="sarah@example.com, mike@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#57534E] mb-1.5 uppercase tracking-wider">Description / Details</label>
                    <textarea 
                      value={newEventDetails}
                      onChange={e => setNewEventDetails(e.target.value)}
                      className="bg-white border border-[#E8ECF0] shadow-sm w-full p-3 rounded-xl bg-[#F3F4F6] text-[#0C0A09] focus:outline-none focus:border-amber-500/50 min-h-[100px] resize-y"
                      placeholder="Agenda, goals, or meeting links..."
                    />
                  </div>
                </form>
              </div>

              <div className="p-4 border-t border-[#E8ECF0] bg-[#FAFAF9]">
                <button
                  type="submit"
                  form="create-event-form"
                  disabled={creating}
                  className="w-full py-3 rounded-xl font-bold text-[#0C0A09] bg-gradient-to-r from-amber-600 to-stone-600 hover:from-amber-500 hover:to-stone-500 shadow-lg shadow-amber-900/20 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
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

      {/* Meeting Prep Drawer */}
      <AnimatePresence>
        {prepEventId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60"
              onClick={() => { setPrepEventId(null); setPrepData(null); }}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-[#FAFAF9] border-l border-[#E8ECF0] shadow-2xl z-70 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-[#E8ECF0] bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-violet-950/60 border border-violet-900/40 flex items-center justify-center">
                    <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-widest text-violet-300">Meeting Prep</p>
                    <p className="text-sm font-bold text-[#0C0A09] truncate max-w-[280px]">{prepData?.title ?? "Loading..."}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setPrepEventId(null); setPrepData(null); }}
                  className="p-2 text-[#57534E] hover:text-[#0C0A09] rounded-lg hover:bg-[#F3F4F6] transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {prepLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <div className="h-8 w-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-[#57534E]">Generating meeting intel...</p>
                  </div>
                ) : prepData ? (
                  <>
                    {/* Countdown */}
                    {typeof prepData.meetingStartsInMinutes === "number" && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${
                        prepData.meetingStartsInMinutes < 0
                          ? "bg-rose-950/20 border-rose-900/40 text-rose-300"
                          : prepData.meetingStartsInMinutes < 60
                          ? "bg-amber-950/20 border-amber-900/40 text-amber-300"
                          : "bg-[#FAFAF9] border-[#E8ECF0] text-[#57534E]"
                      }`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {prepData.meetingStartsInMinutes < 0
                          ? `Started ${Math.abs(prepData.meetingStartsInMinutes)}m ago`
                          : prepData.meetingStartsInMinutes < 60
                          ? `Starts in ${prepData.meetingStartsInMinutes}m`
                          : `Starts in ${Math.round(prepData.meetingStartsInMinutes / 60)}h ${prepData.meetingStartsInMinutes % 60}m`}
                      </div>
                    )}

                    {/* Relationship Summary */}
                    {prepData.relationshipSummary && (
                      <div className="rounded-xl bg-indigo-950/15 border border-indigo-900/30 p-4">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 mb-2">Relationship Context</p>
                        <p className="text-xs text-[#57534E] leading-relaxed whitespace-pre-line">{prepData.relationshipSummary}</p>
                      </div>
                    )}

                    {/* Recent Conversations */}
                    {prepData.recentConversationSummary && (
                      <div className="rounded-xl bg-violet-950/15 border border-violet-900/30 p-4 mt-2">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-400 mb-2">Recent Threads</p>
                        <p className="text-xs text-[#57534E] leading-relaxed whitespace-pre-line">{prepData.recentConversationSummary}</p>
                      </div>
                    )}

                    {/* Risks Detected */}
                    {prepData.risks?.length > 0 && (
                      <div className="rounded-xl bg-rose-950/15 border border-rose-900/30 p-4 mt-2">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 mb-2">High Risks Detected</p>
                        <ul className="space-y-1.5">
                          {prepData.risks.map((r: any, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-[#57534E]">
                              <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-rose-900/50 border border-rose-800/40 flex items-center justify-center text-[8px] font-black text-rose-300">!</span>
                              <span><strong>{r.title}</strong>: {r.reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Talking Points */}
                    {prepData.suggestedTalkingPoints?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#57534E] mb-2 mt-2">Suggested Talking Points</p>
                        <ul className="space-y-1.5">
                          {prepData.suggestedTalkingPoints.map((pt: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-[#57534E]">
                              <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-violet-900/50 border border-violet-800/40 flex items-center justify-center text-[8px] font-black text-violet-300">{i + 1}</span>
                              {pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Recommendations */}
                    {prepData.actionRecommendations?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#57534E] mb-2 mt-2">Action Recommendations</p>
                        <ul className="space-y-1.5">
                          {prepData.actionRecommendations.map((pt: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-[#57534E]">
                              <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-emerald-900/50 border border-emerald-800/40 flex items-center justify-center text-[8px] font-black text-emerald-300">{i + 1}</span>
                              {pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Attendees */}
                    {prepData.attendees?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#57534E] mb-2 mt-2">Attendees</p>
                        <div className="space-y-2">
                          {prepData.attendees.map((a: any) => {
                            const health = a.relationshipHealth;
                            const ringColor = health === "Strong" ? "border-emerald-500 text-emerald-300" : health === "At Risk" ? "border-rose-500 text-rose-300" : "border-slate-600 text-[#57534E]";
                            return (
                              <div key={a.email} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#FAFAF9] border border-[#E8ECF0]">
                                <div className={`h-8 w-8 shrink-0 rounded-full border-2 ${ringColor} flex items-center justify-center font-bold text-xs bg-slate-950/60`}>
                                  {(a.name || a.email).charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-[#0C0A09] truncate">{a.name || a.email.split("@")[0]}</p>
                                  <p className="text-[10px] text-[#57534E] truncate">{a.email}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Open Commitments */}
                    {prepData.openCommitments?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#57534E] mb-2 mt-2">Open Commitments</p>
                        <div className="space-y-1.5">
                          {prepData.openCommitments.map((c: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-950/10 border border-amber-900/25">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-[#57534E] leading-snug">{c.title}</p>
                                {c.dueDate && (
                                  <p className="text-[10px] text-[#57534E] mt-0.5">Due: {new Date(c.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Delete Event Button */}
                    <div className="pt-4 mt-4 border-t border-[#E8ECF0]">
                      <button
                        onClick={() => prepEventId && handleDeleteEvent(prepEventId)}
                        className="w-full py-2.5 rounded-xl font-bold text-sm text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:text-rose-700 transition-all flex justify-center items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Event
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 gap-2">
                    <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-xs text-[#57534E]">Could not load meeting prep.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
