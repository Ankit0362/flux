// ============================================================
// Ask ChiefOS — Shared Types
// ============================================================

export type EvidenceType = "commitment" | "relationship" | "inbox" | "followup";

export type ReadActionType =
  | "draft_email"
  | "view_commitment"
  | "view_contact"
  | "mark_complete"
  | "view_inbox";

export type WriteActionType =
  | "send_email"
  | "reply_to_thread"
  | "create_calendar_event";

export type ActionType = ReadActionType | WriteActionType;

export const WRITE_ACTION_TYPES: WriteActionType[] = [
  "send_email",
  "reply_to_thread",
  "create_calendar_event",
];

// ─── Pending Payloads (for write actions) ─────────────────────────────────────

export interface SendEmailPayload {
  kind: "send_email";
  to: string[];
  subject: string;
  body: string;
}

export interface ReplyPayload {
  kind: "reply_to_thread";
  threadId: string;
  to: string[];
  body: string;
}

export interface CreateEventPayload {
  kind: "create_calendar_event";
  title: string;
  startAt: string;
  endAt: string;
  attendees: string[];
  description?: string;
  location?: string;
}

export type PendingPayload = SendEmailPayload | ReplyPayload | CreateEventPayload;

// ─── Core interfaces ──────────────────────────────────────────────────────────

export interface Evidence {
  type: EvidenceType;
  id: string;
  title: string;
  context: string;
  /** Optional rich metadata for rendering cards */
  metadata?: Record<string, unknown>;
}

export interface Action {
  actionType: ActionType;
  targetId: string;
  label: string;
  /** Optional pre-built href for navigation actions */
  href?: string;
  /** Only present on write actions — the LLM-generated proposal for user review */
  pendingPayload?: PendingPayload;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskRequest {
  query: string;
  history?: ChatTurn[];
}

export interface AskResponse {
  answer: string;
  evidence: Evidence[];
  actions: Action[];
  /** Steps shown during the loading animation */
  thinkingSteps?: string[];
}
