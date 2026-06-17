/**
 * POST /api/ask/action
 *
 * The mutation endpoint for Ask Flux write actions.
 * Executes user-approved proposals (send_email, reply_to_thread, create_calendar_event).
 *
 * SECURITY: userId is ALWAYS injected from the server-side DB session.
 * The request body is fully re-validated before any external API call.
 */

import { prisma } from "@/lib/db";
import { corsair } from "@/lib/corsair";
import { createCalendarEvent } from "@/services/calendarSync";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

// ─── Zod Schemas for Sanitization ─────────────────────────────────────────────

const SendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1).max(10),
  subject: z.string().min(1).max(998),
  body: z.string().min(1).max(10000),
});

const ReplyThreadSchema = z.object({
  threadId: z.string().min(1).max(255),
  to: z.array(z.string().email()).min(1).max(10),
  body: z.string().min(1).max(10000),
});

const CreateEventSchema = z.object({
  title: z.string().min(1).max(500),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  attendees: z.array(z.string().email()).max(50).default([]),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
}).refine((data) => new Date(data.endAt) > new Date(data.startAt), {
  message: "endAt must be after startAt",
  path: ["endAt"],
}).refine((data) => (new Date(data.endAt).getTime() - new Date(data.startAt).getTime()) <= 24 * 60 * 60 * 1000, {
  message: "Event duration cannot exceed 24 hours",
  path: ["endAt"],
});

const CreateEventAndSendEmailSchema = CreateEventSchema.extend({
  to: z.array(z.string().email()).min(1).max(10),
  subject: z.string().min(1).max(998),
  body: z.string().min(1).max(10000),
  commitmentId: z.string().optional(),
});

const RescheduleEventSchema = z.object({
  eventId: z.string().min(1).max(255),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

const CreateCommitmentSchema = z.object({
  title: z.string().min(1).max(500),
  dueDate: z.string().datetime().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
});

// ─── MIME helpers ─────────────────────────────────────────────────────────────

function buildMIMEMessage(opts: {
  from: string;
  to: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}): string {
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to.join(", ")}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
  ];
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push("", opts.body);
  const raw = lines.join("\r\n");
  return Buffer.from(raw).toString("base64url");
}

// ─── Action Handlers ──────────────────────────────────────────────────────────

async function handleSendEmail(
  userId: string,
  userEmail: string,
  rawPayload: unknown
): Promise<NextResponse> {
  const parseResult = SendEmailSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
  }

  const { to, subject, body } = parseResult.data;

  const raw = buildMIMEMessage({ from: userEmail, to, subject, body });
  const client = corsair.withTenant(userId) as any;
  const result = await client.gmail.api.messages.send({ raw });

  console.info(`[AskAction] send_email sent for user ${userId}, messageId=${result?.id}`);
  return NextResponse.json({ success: true, messageId: result?.id });
}

async function handleReplyToThread(
  userId: string,
  userEmail: string,
  rawPayload: unknown
): Promise<NextResponse> {
  const parseResult = ReplyThreadSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
  }

  const { threadId, to, body } = parseResult.data;

  // Resolve the DB thread to get the Gmail externalId and subject for reply headers
  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, userId },
    select: {
      externalId: true,
      subject: true,
      messages: {
        orderBy: { receivedAt: "desc" },
        take: 1,
        select: { externalId: true },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const lastMessageId = thread.messages[0]?.externalId;
  const subject = thread.subject?.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`;

  const raw = buildMIMEMessage({
    from: userEmail,
    to,
    subject,
    body,
    inReplyTo: lastMessageId,
    references: lastMessageId,
  });

  const client = corsair.withTenant(userId) as any;
  const result = await client.gmail.api.messages.send({
    raw,
    threadId: thread.externalId,
  });

  console.info(`[AskAction] reply_to_thread sent for user ${userId}, threadId=${thread.externalId}`);
  return NextResponse.json({ success: true, messageId: result?.id });
}

async function handleCreateCalendarEvent(
  userId: string,
  userEmail: string,
  rawPayload: unknown
): Promise<NextResponse> {
  const parseResult = CreateEventSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
  }

  const { title, startAt, endAt, attendees, description, location } = parseResult.data;

  const event = await createCalendarEvent(userId, userEmail, {
    title,
    startAt,
    endAt,
    attendees,
    description,
    location,
  });

  console.info(`[AskAction] create_calendar_event for user ${userId}, eventId=${event?.id}`);
  if (!event) {
    return NextResponse.json({ error: "Failed to create calendar event." }, { status: 500 });
  }
  return NextResponse.json({ success: true, event });
}

async function handleCreateEventAndSendEmail(
  userId: string,
  userEmail: string,
  rawPayload: unknown
): Promise<NextResponse> {
  const parseResult = CreateEventAndSendEmailSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
  }

  const { title, startAt, endAt, attendees, description, location, to, subject, body, commitmentId } = parseResult.data;
  const event = await createCalendarEvent(userId, userEmail, {
    title,
    startAt,
    endAt,
    attendees,
    description,
    location,
  });

  const raw = buildMIMEMessage({ from: userEmail, to, subject, body });
  const client = corsair.withTenant(userId) as any;
  const sent = await client.gmail.api.messages.send({ raw });

  if (commitmentId) {
    await prisma.commitment.updateMany({
      where: { id: commitmentId, userId },
      data: { calendarEventId: event?.id, updatedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true, event, messageId: sent?.id });
}

async function handleRescheduleCalendarEvent(
  userId: string,
  userEmail: string,
  rawPayload: unknown
): Promise<NextResponse> {
  const parseResult = RescheduleEventSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
  }

  const { eventId, startAt, endAt } = parseResult.data;

  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, userId }
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const client = corsair.withTenant(userId) as any;
  await client.calendar.api.events.patch({
    calendarId: "primary",
    eventId: event.externalId,
    requestBody: {
      start: { dateTime: startAt },
      end: { dateTime: endAt },
    }
  });

  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { startAt: new Date(startAt), endAt: new Date(endAt) }
  });

  return NextResponse.json({ success: true, eventId });
}

async function handleCreateCommitment(
  userId: string,
  rawPayload: unknown
): Promise<NextResponse> {
  const parseResult = CreateCommitmentSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid payload", details: parseResult.error.format() }, { status: 400 });
  }

  const { title, dueDate, contactEmail } = parseResult.data;

  let contactId = null;
  if (contactEmail) {
    const contact = await prisma.contact.findFirst({ where: { userId, email: contactEmail.toLowerCase() } });
    contactId = contact?.id;
  }

  const commitment = await prisma.commitment.create({
    data: {
      userId,
      title,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: "PENDING",
      contactId,
      riskLevel: "MEDIUM",
      riskScore: 50
    }
  });

  return NextResponse.json({ success: true, commitment });
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Resolve user from server-side session
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session!.user as any).id;
    
    // We need the user's email to send emails correctly
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User record not found." }, { status: 404 });
    }

    // 2. Parse request
    const { actionType, payload } = await request.json();

    if (!actionType || !payload) {
      return NextResponse.json({ error: "actionType and payload are required." }, { status: 400 });
    }

    // 3. Dispatch to the appropriate handler
    switch (actionType) {
      case "send_email":
        return await handleSendEmail(userId, user.email, payload);
      case "reply_to_thread":
        return await handleReplyToThread(userId, user.email, payload);
      case "create_calendar_event":
        return await handleCreateCalendarEvent(userId, user.email, payload);
      case "create_event_and_send_email":
        return await handleCreateEventAndSendEmail(userId, user.email, payload);
      case "reschedule_calendar_event":
        return await handleRescheduleCalendarEvent(userId, user.email, payload);
      case "create_commitment":
        return await handleCreateCommitment(userId, payload);
      default:
        return NextResponse.json({ error: `Unknown actionType: ${actionType}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    console.error("[AskAction] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
