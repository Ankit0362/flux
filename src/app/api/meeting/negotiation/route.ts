import { getCurrentUser } from "@/lib/currentUser";
import { buildMeetingNegotiationDraft } from "@/services/availability";
import { createCalendarEvent } from "@/services/calendarSync";
import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ExecuteSchema = z.object({
  threadId: z.string().min(1),
  selectedSlot: z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }),
  title: z.string().min(1).max(500),
  attendees: z.array(z.string().email()).min(1),
  replyBody: z.string().min(1).max(10000),
});

function buildRawEmail(from: string, to: string[], subject: string, body: string) {
  const raw = [
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");
  return Buffer.from(raw).toString("base64url");
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const threadId = String(body.threadId ?? "").trim();
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    const draft = await buildMeetingNegotiationDraft(user.id, user.email, threadId, {
      window: body.window ?? "next week",
      durationMinutes: Number(body.durationMinutes ?? 30),
    });

    return NextResponse.json({ draft });
  } catch (err) {
    console.error("Meeting negotiation draft failed:", err);
    return NextResponse.json({ error: "Meeting negotiation draft failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = ExecuteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }

    const { threadId, selectedSlot, title, attendees, replyBody } = parsed.data;
    const thread = await prisma.emailThread.findFirst({
      where: { id: threadId, userId: user.id },
      select: { externalId: true, subject: true, metadata: true },
    });
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const event = await createCalendarEvent(user.id, user.email, {
      title,
      startAt: selectedSlot.startAt,
      endAt: selectedSlot.endAt,
      attendees,
      description: `Scheduled from Flux negotiation loop for: ${thread.subject}`,
    });

    const subject = thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`;
    const client = corsair.withTenant(user.id) as any;
    const sent = await client.gmail.api.messages.send({
      raw: buildRawEmail(user.email, attendees, subject, replyBody),
      threadId: thread.externalId,
    });

    await prisma.emailThread.update({
      where: { id: threadId },
      data: {
        metadata: {
          ...(thread.metadata && typeof thread.metadata === "object" && !Array.isArray(thread.metadata)
            ? thread.metadata
            : {}),
          fluxNegotiation: {
            eventId: event?.id,
            sentMessageId: sent?.id,
            completedAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({ success: true, event, messageId: sent?.id });
  } catch (err) {
    console.error("Meeting negotiation execution failed:", err);
    return NextResponse.json({ error: "Meeting negotiation execution failed" }, { status: 500 });
  }
}
