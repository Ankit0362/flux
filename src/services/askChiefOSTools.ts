/**
 * Ask ChiefOS — Database Retrieval Tools
 *
 * These functions are the "tools" exposed to Gemini via function calling.
 * CRITICAL SECURITY: userId is ALWAYS injected server-side from the session.
 * It is NEVER accepted as an argument from the LLM.
 */

import { prisma } from "../lib/db";
import { corsair } from "../lib/corsair";
import { generateMeetingPrep, getUpcomingAgenda } from "./calendarEventIntelligence";
import { createCalendarEvent } from "./calendarSync";

// ─── Tool Return Types ───────────────────────────────────────────────────────

export interface CommitmentSummary {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  riskLevel: string;
  riskScore: number;
  riskReason: string | null;
  isOverdue: boolean;
  contactName: string | null;
  contactEmail: string | null;
}

export interface RelationshipSummary {
  id: string;
  name: string | null;
  email: string;
  relationshipHealth: string;
  relationshipScore: number | null;
  relationshipReason: string | null;
  daysSinceLastInteraction: number | null;
  openCommitments: number;
}

export interface FollowUpSummary {
  id: string;
  subject: string;
  followUpUrgency: string;
  followUpReason: string | null;
  lastMessageDirection: string | null;
  lastMessageAt: string | null;
}

export interface DailyFocusResult {
  highRiskCommitments: CommitmentSummary[];
  atRiskRelationships: RelationshipSummary[];
  criticalFollowUps: FollowUpSummary[];
  overdueCount: number;
  pendingCount: number;
}

// ─── Tool Implementations ────────────────────────────────────────────────────

/**
 * Fetches user commitments, optionally filtered by risk level and/or overdue status.
 */
export async function get_commitments(
  userId: string,
  args: { risk_level?: "HIGH" | "MEDIUM" | "LOW" | "ALL"; overdue_only?: boolean }
): Promise<CommitmentSummary[]> {
  const now = new Date();
  const { risk_level = "ALL", overdue_only = false } = args;

  const where: Record<string, unknown> = {
    userId,
    status: "PENDING",
    title: { not: "NO_COMMITMENTS" },
  };

  if (risk_level !== "ALL") {
    where.riskLevel = risk_level;
  }

  if (overdue_only) {
    where.dueDate = { lt: now };
  }

  const commitments = await prisma.commitment.findMany({
    where,
    include: {
      contact: { select: { name: true, email: true } },
    },
    orderBy: [{ riskScore: "desc" }, { dueDate: "asc" }],
    take: 10,
  });

  return commitments.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    riskLevel: c.riskLevel,
    riskScore: c.riskScore,
    riskReason: c.riskReason,
    isOverdue: c.dueDate ? new Date(c.dueDate) < now : false,
    contactName: c.contact?.name ?? null,
    contactEmail: c.contact?.email ?? null,
  }));
}

/**
 * Fetches user contacts, optionally filtered by relationship health.
 */
export async function get_relationships(
  userId: string,
  args: { health?: "At Risk" | "Neutral" | "Strong" | "ALL" }
): Promise<RelationshipSummary[]> {
  const now = new Date();
  const { health = "ALL" } = args;

  const where: Record<string, unknown> = { userId };
  if (health !== "ALL") {
    where.relationshipHealth = health;
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: [{ relationshipScore: "asc" }],
    take: 10,
  });

  return contacts.map((c) => {
    const daysSince = c.lastInteractionAt
      ? Math.floor((now.getTime() - c.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      relationshipHealth: c.relationshipHealth ?? "Neutral",
      relationshipScore: c.relationshipScore,
      relationshipReason: c.relationshipReason,
      daysSinceLastInteraction: daysSince,
      openCommitments: c.openCommitments,
    };
  });
}

/**
 * Fetches email threads that require follow-up, ordered by urgency.
 */
export async function get_follow_ups(
  userId: string,
  args: { urgency?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "ALL" }
): Promise<FollowUpSummary[]> {
  const { urgency = "ALL" } = args;

  const where: Record<string, unknown> = {
    userId,
    followUpNeeded: true,
  };

  if (urgency !== "ALL") {
    where.followUpUrgency = urgency;
  }

  const threads = await prisma.emailThread.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }],
    take: 10,
    select: {
      id: true,
      subject: true,
      followUpUrgency: true,
      followUpReason: true,
      lastMessageDirection: true,
      lastMessageAt: true,
    },
  });

  return threads.map((t) => ({
    id: t.id,
    subject: t.subject,
    followUpUrgency: t.followUpUrgency ?? "LOW",
    followUpReason: t.followUpReason,
    lastMessageDirection: t.lastMessageDirection,
    lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : null,
  }));
}

/**
 * Macro tool: Fetches a combined daily focus snapshot in a single call.
 * Used for "What should I focus on today?" type queries.
 */
export async function get_daily_focus(userId: string): Promise<DailyFocusResult> {
  const now = new Date();

  const [highRiskCommitments, atRiskRelationships, criticalFollowUps, pendingAll] =
    await Promise.all([
      get_commitments(userId, { risk_level: "HIGH" }),
      get_relationships(userId, { health: "At Risk" }),
      get_follow_ups(userId, { urgency: "ALL" }),
      prisma.commitment.count({
        where: { userId, status: "PENDING", title: { not: "NO_COMMITMENTS" } },
      }),
    ]);

  const overdueCount = await prisma.commitment.count({
    where: {
      userId,
      status: "PENDING",
      title: { not: "NO_COMMITMENTS" },
      dueDate: { lt: now },
    },
  });

  // Sort follow-ups: CRITICAL > HIGH > MEDIUM > LOW
  const urgencyOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedFollowUps = criticalFollowUps.sort(
    (a, b) => (urgencyOrder[a.followUpUrgency] ?? 9) - (urgencyOrder[b.followUpUrgency] ?? 9)
  );

  return {
    highRiskCommitments: highRiskCommitments.slice(0, 3),
    atRiskRelationships: atRiskRelationships.slice(0, 3),
    criticalFollowUps: sortedFollowUps.slice(0, 3),
    overdueCount,
    pendingCount: pendingAll,
  };
}

export async function get_calendar_events(
  userId: string,
  args: { days?: number }
) {
  const { days = 7 } = args;
  return getUpcomingAgenda(userId, days);
}

export async function get_meeting_prep(
  userId: string,
  args: { eventId: string }
) {
  const { eventId } = args;
  return generateMeetingPrep(userId, eventId);
}

export async function create_calendar_event_tool(
  userId: string,
  args: { title: string; startAt: string; endAt: string; description?: string; location?: string; attendees?: string[] }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  return createCalendarEvent(userId, user.email, args);
}

/**
 * Sends an email on behalf of the user via the Corsair Gmail API.
 * The LLM provides the recipient, subject, and body.
 * userId is ALWAYS injected server-side — never from LLM args.
 */
export async function send_email(
  userId: string,
  args: { to: string; subject: string; body: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const { to, subject, body } = args;

  // Basic sanity checks before touching the API
  if (!to?.trim()) throw new Error("Recipient email (to) is required.");
  if (!subject?.trim()) throw new Error("Subject is required.");
  if (!body?.trim()) throw new Error("Email body is required.");

  // Build a minimal MIME message (plain text)
  const mime = [
    `From: ${user.email}`,
    `To: ${to.trim()}`,
    `Subject: ${subject.trim()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body.trim(),
  ].join("\r\n");

  const raw = Buffer.from(mime).toString("base64url");
  const client = corsair.withTenant(userId) as any;
  const result = await client.gmail.api.messages.send({ raw });

  return { success: true, messageId: result?.id };
}

// ─── Gemini Function Declarations ────────────────────────────────────────────

/**
 * The tool schema passed to the Gemini SDK's `tools` parameter.
 */
export const CHIEFOS_TOOL_DECLARATIONS = [
  {
    name: "get_commitments",
    description:
      "Retrieves the user's commitments from the database. Use to answer questions about overdue commitments, high-risk items, pending obligations, or what the user owes to others.",
    parameters: {
      type: "OBJECT",
      properties: {
        risk_level: {
          type: "STRING",
          enum: ["HIGH", "MEDIUM", "LOW", "ALL"],
          description: "Filter by risk level. Use ALL to get all risk levels.",
        },
        overdue_only: {
          type: "BOOLEAN",
          description: "If true, only return commitments whose due date has passed.",
        },
      },
    },
  },
  {
    name: "get_relationships",
    description:
      "Retrieves the user's contacts and relationship health data. Use to answer questions about who needs attention, which relationships are at risk, or top contacts.",
    parameters: {
      type: "OBJECT",
      properties: {
        health: {
          type: "STRING",
          enum: ["At Risk", "Neutral", "Strong", "ALL"],
          description: "Filter contacts by relationship health status.",
        },
      },
    },
  },
  {
    name: "get_follow_ups",
    description:
      "Retrieves email threads that require follow-up from the user. Use to answer questions about who to follow up with, unanswered emails, or outbound emails waiting for a reply.",
    parameters: {
      type: "OBJECT",
      properties: {
        urgency: {
          type: "STRING",
          enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "ALL"],
          description: "Filter by follow-up urgency. Use ALL to get all urgency levels.",
        },
      },
    },
  },
  {
    name: "get_calendar_events",
    description: "Retrieves the user's upcoming calendar events. Use this to see what meetings or appointments are scheduled.",
    parameters: {
      type: "OBJECT",
      properties: {
        days: {
          type: "INTEGER",
          description: "Number of days ahead to fetch events for (default: 7).",
        },
      },
    },
  },
  {
    name: "get_meeting_prep",
    description: "Generates an AI-summarized briefing for a specific calendar event, pulling context from attendees, recent emails, and open commitments.",
    parameters: {
      type: "OBJECT",
      properties: {
        eventId: {
          type: "STRING",
          description: "The ID of the calendar event to prepare for.",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "create_calendar_event",
    description: "Creates a new event on the user's calendar.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: {
          type: "STRING",
          description: "The title of the event.",
        },
        startAt: {
          type: "STRING",
          description: "The start time in ISO 8601 format.",
        },
        endAt: {
          type: "STRING",
          description: "The end time in ISO 8601 format.",
        },
        description: {
          type: "STRING",
          description: "Optional description or agenda for the event.",
        },
        location: {
          type: "STRING",
          description: "Optional location for the event.",
        },
        attendees: {
          type: "ARRAY",
          items: {
            type: "STRING",
          },
          description: "Optional list of attendee email addresses.",
        },
      },
      required: ["title", "startAt", "endAt"],
    },
  },
  {
    name: "get_daily_focus",
    description:
      "A macro tool that retrieves a snapshot of the most critical items for today: high-risk commitments, at-risk relationships, and critical follow-ups. Use this when the user asks 'What should I do today?' or 'Give me my briefing'.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "send_email",
    description:
      "Sends an email on behalf of the user. Use ONLY when the user explicitly asks to send, write, or draft-and-send an email. Always confirm recipient, subject, and body before calling. Never fabricate email addresses — only use emails already retrieved from other tool results.",
    parameters: {
      type: "OBJECT",
      properties: {
        to: {
          type: "STRING",
          description: "The recipient's email address. Must be a real email found in tool results.",
        },
        subject: {
          type: "STRING",
          description: "The email subject line.",
        },
        body: {
          type: "STRING",
          description: "The full plain-text email body. Write professionally and concisely.",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
] as const;

// ─── Tool Dispatcher ─────────────────────────────────────────────────────────

type ToolName = "get_commitments" | "get_relationships" | "get_follow_ups" | "get_daily_focus" | "get_calendar_events" | "get_meeting_prep" | "create_calendar_event" | "send_email";

/**
 * Dispatcher: routes the tool call to the appropriate function.
 * userId is ALWAYS injected here — never from LLM args.
 */
export async function dispatchTool(
  userId: string,
  toolName: string,
  toolArgs: Record<string, unknown>
): Promise<unknown> {
  const { isDemoMode } = await import("./demoMode");
  const { demoStore } = await import("./demoData");

  if (await isDemoMode()) {
    const { CommitmentStatus } = await import("@prisma/client");
    const now = new Date();
    switch (toolName as ToolName) {
      case "get_commitments": {
        const args = (toolArgs ?? {}) as any;
        const { risk_level = "ALL", overdue_only = false } = args;
        let list = demoStore.commitments.filter((c: any) => c.status === CommitmentStatus.PENDING);
        if (risk_level !== "ALL") {
          list = list.filter((c: any) => c.riskLevel === risk_level);
        }
        if (overdue_only) {
          list = list.filter((c: any) => c.dueDate && new Date(c.dueDate) < now);
        }
        return list.map((c: any) => {
          const contact = demoStore.contacts.find((x: any) => x.id === c.contactId);
          return {
            id: c.id,
            title: c.title,
            status: c.status,
            dueDate: c.dueDate ? c.dueDate.toISOString() : null,
            riskLevel: c.riskLevel,
            riskScore: c.riskScore,
            riskReason: c.riskReason,
            isOverdue: c.dueDate ? new Date(c.dueDate) < now : false,
            contactName: contact?.name ?? null,
            contactEmail: contact?.email ?? null,
          };
        });
      }
      case "get_relationships": {
        const args = (toolArgs ?? {}) as any;
        const { health = "ALL" } = args;
        let list = demoStore.contacts;
        if (health !== "ALL") {
          list = list.filter((c: any) => c.relationshipHealth === health);
        }
        return list.map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          relationshipHealth: c.relationshipHealth,
          relationshipScore: c.relationshipScore,
          relationshipReason: c.relationshipReason,
          daysSinceLastInteraction: c.lastInteractionAt
            ? Math.floor((now.getTime() - new Date(c.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24))
            : null,
          openCommitments: c.openCommitments,
        }));
      }
      case "get_follow_ups": {
        const args = (toolArgs ?? {}) as any;
        const { urgency = "ALL" } = args;
        let list = demoStore.threads.filter((t: any) => t.followUpNeeded);
        if (urgency !== "ALL") {
          list = list.filter((t: any) => t.followUpUrgency === urgency);
        }
        return list.map((t: any) => ({
          id: t.id,
          subject: t.subject,
          followUpUrgency: t.followUpUrgency,
          followUpReason: t.followUpReason,
          lastMessageDirection: t.lastMessageDirection,
          lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : null,
        }));
      }
      case "get_daily_focus": {
        const highRisk = await dispatchTool(userId, "get_commitments", { risk_level: "HIGH" });
        const atRisk = await dispatchTool(userId, "get_relationships", { health: "At Risk" });
        const followUps = await dispatchTool(userId, "get_follow_ups", { urgency: "ALL" });
        const pendingCount = demoStore.commitments.filter((c: any) => c.status === CommitmentStatus.PENDING).length;
        const overdueCount = demoStore.commitments.filter(
          (c: any) => c.status === CommitmentStatus.PENDING && c.dueDate && new Date(c.dueDate) < now
        ).length;
        return {
          highRiskCommitments: (highRisk as any[]).slice(0, 3),
          atRiskRelationships: (atRisk as any[]).slice(0, 3),
          criticalFollowUps: (followUps as any[]).slice(0, 3),
          overdueCount,
          pendingCount,
        };
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  switch (toolName as ToolName) {
    case "get_commitments":
      return get_commitments(userId, toolArgs as Parameters<typeof get_commitments>[1]);
    case "get_relationships":
      return get_relationships(userId, toolArgs as Parameters<typeof get_relationships>[1]);
    case "get_follow_ups":
      return get_follow_ups(userId, toolArgs as Parameters<typeof get_follow_ups>[1]);
    case "get_daily_focus":
      return get_daily_focus(userId);
    case "get_calendar_events":
      return get_calendar_events(userId, toolArgs as any);
    case "get_meeting_prep":
      return get_meeting_prep(userId, toolArgs as any);
    case "create_calendar_event":
      return create_calendar_event_tool(userId, toolArgs as any);
    case "send_email":
      return send_email(userId, toolArgs as Parameters<typeof send_email>[1]);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
