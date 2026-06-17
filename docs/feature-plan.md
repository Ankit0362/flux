# Flux Feature Build Plan

## Ground Rules

- Follow the local Next.js 16 docs in `node_modules/next/dist/docs`.
- Keep server-side secrets and integration clients inside route handlers/services.
- Reuse existing Prisma models where possible; store feature metadata in `metadata` until a first-class model is clearly needed.
- Make every judge-facing feature demoable from the UI and executable through API routes.
- Keep demo mode graceful so the product can be shown without live Google credentials.

## Tier 1

### 1. Google Calendar Integration

Current state:
- `CalendarEvent` exists in Prisma.
- `calendarSync.ts` already supports bootstrap, incremental sync, create, update, delete, and local persistence.
- `/api/calendar` lists and creates events.
- `/calendar` is present, but it needs stronger sync controls and quick creation flows.

Build:
- Add `/api/calendar/sync` to manually trigger bootstrap/incremental sync.
- Add `/api/calendar/availability` to return free slots for a requested window.
- Add `/api/calendar/quick-add` to parse natural language meeting text into an event draft or created event.
- Add calendar UI controls for sync, quick add, slot suggestions, and meeting prep entry points.
- Preserve local attendee relationship context on event cards.

Acceptance:
- User can sync Google Calendar.
- User can view events.
- User can create events.
- User can generate suggested free slots.
- User can create an invite from a chosen slot.

### 2. Meeting Negotiation Loop

Scenario:
- Email says: "Are you free next week?"
- Flux suggests 3 slots.
- User sends a reply.
- Calendar invite is created automatically.

Build:
- Add an availability service that finds three free business-hour slots.
- Add `/api/meeting/negotiation` to inspect a thread, infer participants, and return suggested slots plus a reply draft.
- Add a thread-level "Meeting" action in inbox that opens a negotiation drawer.
- On approval, call `/api/ask/action` or a dedicated route to send reply and create the calendar event.

Acceptance:
- Selected email thread can produce three slots.
- User can choose a slot and send the reply.
- Calendar event is created with attendees.

### 3. MCP Agent Actions

Current state:
- Ask Flux already supports tool calling and action execution for email and calendar.

Build:
- Add tools for availability suggestions, commitment update, and negotiation execution.
- Extend action endpoint to support combined actions: create event, send email, and optionally add/update a commitment.
- Return structured action receipts for UI confirmation.

Acceptance:
- "Schedule a meeting with recruiter next week and send confirmation" can produce and execute calendar plus email actions.

### 4. Triage Mode

Build:
- Add `/api/inbox/action` with `reply`, `archive`, `meeting`, and `remind_later`.
- Archive should call Gmail label mutation when connected and update local labels.
- Remind later should store snooze metadata on `EmailThread.metadata`.
- Add triage mode UI with keys: `E` reply, `A` archive, `M` meeting, `R` remind later.
- Keep existing `J/K/R/C//` shortcuts.

Acceptance:
- Inbox Zero mode shows a focused queue.
- Keyboard actions are visible, memorable, and update state.

## Tier 2

### 5. Thread to Meeting Context

Current state:
- `generateMeetingPrep` already gathers attendees, commitments, recent threads, and AI summary.

Build:
- Enrich prep with relationship score, open commitments, discussion topics, suggested talking points, and meeting-start proximity.
- Add `/api/calendar/[id]/prep` UI surface from calendar cards.

Acceptance:
- A meeting starting soon shows contact context, commitments, recent threads, and talking points.

### 6. Reply In Your Voice

Build:
- Add writing-style profile service based on recent outbound emails.
- Add `/api/email/style-profile`.
- Inject profile into reply-draft prompts.
- Add "Draft in my voice" button in reply/negotiation flows.

Acceptance:
- Drafts mention style signals such as greeting, brevity, tone, and sign-off.

### 7. Command Palette

Current state:
- Cmd/Ctrl+K palette exists with navigation, compose, meeting, and Ask Flux.

Build:
- Add commands for Inbox Zero, Calendar Sync, Quick Add, Find Availability, Meeting Context, and Draft in My Voice.
- Keep actions executable inline where possible.

Acceptance:
- Core workflows can be started from Cmd/Ctrl+K.

### 8. Keyboard Shortcuts

Current state:
- Inbox supports J, K, R, C, `/`, and `?`.

Build:
- Add E, A, M, and Shift+R/alternate reminder behavior for triage.
- Add shortcut hints to triage panel and command palette.

Acceptance:
- Keyboard-first demo works without explaining the app verbally.

## Tier 3

### 9. Daily Brief Email

Build:
- Add `/api/briefing/email` that sends the daily briefing via Gmail.
- Add optional `/api/cron/daily-brief` protected by a secret for scheduled runs.

Acceptance:
- User can send today’s briefing to themselves.

### 10. Calendar Natural Language Quick Add

Build:
- Parse text like "Lunch with recruiter Friday 1 PM".
- Prefer AI parsing when Gemini is configured; fallback to deterministic parsing for common patterns.
- Let user review before create unless explicitly requested.

Acceptance:
- Quick-add produces a correct event draft and can create it instantly.

### 11. Snooze Until Relevant

Build:
- Store snooze metadata on `EmailThread.metadata`.
- Support fixed snooze and "until they reply".
- Clear relevant snoozes when new inbound messages arrive.

Acceptance:
- Snoozed threads leave triage and return when relevant.
