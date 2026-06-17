import { getCurrentUser } from "@/lib/currentUser";
import { archiveThread, remindLaterThread } from "@/services/inboxActions";
import { buildMeetingNegotiationDraft } from "@/services/availability";
import { isDemoMode } from "@/services/demoMode";
import { demoStore } from "@/services/demoData";
import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ActionSchema = z.object({
  threadId: z.string().min(1),
  action: z.enum(["archive", "remind_later", "reply", "meeting"]),
  remindAt: z.string().datetime().optional(),
  mode: z.enum(["fixed", "until_reply"]).optional(),
  note: z.string().max(500).optional(),
  // reply-specific
  body: z.string().max(20000).optional(),
  to: z.array(z.string().email()).optional(),
  subject: z.string().max(500).optional(),
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
    if (!user && !(await isDemoMode())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = ActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }

    const { threadId, action, remindAt, mode, note, body, to, subject } = parsed.data;

    if (await isDemoMode()) {
      const thread = demoStore.threads.find((t: any) => t.id === threadId);
      if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      if (action === "archive") {
        thread.labels = thread.labels.filter((label: string) => label !== "INBOX");
      } else if (action === "reply") {
        // Demo: simulate reply success
        return NextResponse.json({ success: true, action, threadId, messageId: "demo-msg-id" });
      } else if (action === "meeting") {
        // Demo: return stub slots
        const now = new Date();
        const slots = [1, 2, 3].map((i) => {
          const start = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
          start.setHours(10, 0, 0, 0);
          const end = new Date(start.getTime() + 30 * 60_000);
          return {
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            label: start.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
          };
        });
        return NextResponse.json({
          success: true, action, threadId,
          draft: { threadId, title: thread.subject, attendees: [], slots, replySubject: `Re: ${thread.subject}`, replyBody: "" },
        });
      } else {
        thread.metadata = {
          ...(thread.metadata ?? {}),
          fluxSnooze: {
            mode: mode ?? "fixed",
            remindAt: mode === "until_reply" ? null : remindAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            note: note ?? null,
            createdAt: new Date().toISOString(),
          },
        };
      }
      return NextResponse.json({ success: true, action, threadId });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "archive") {
      await archiveThread(user.id, threadId);
      return NextResponse.json({ success: true, action, threadId });
    }

    if (action === "remind_later") {
      await remindLaterThread(user.id, threadId, { mode, remindAt, note });
      return NextResponse.json({ success: true, action, threadId });
    }

    if (action === "reply") {
      if (!body?.trim()) {
        return NextResponse.json({ error: "body is required for reply action" }, { status: 400 });
      }
      const thread = await prisma.emailThread.findFirst({
        where: { id: threadId, userId: user.id },
        select: { externalId: true, subject: true },
      });
      if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });

      const replySubject = subject ?? (thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`);
      const recipients = to && to.length > 0 ? to : [];
      const client = corsair.withTenant(user.id) as any;
      const sent = await client.gmail.api.messages.send({
        raw: buildRawEmail(user.email, recipients, replySubject, body),
        threadId: thread.externalId,
      });
      return NextResponse.json({ success: true, action, threadId, messageId: sent?.id });
    }

    if (action === "meeting") {
      const draft = await buildMeetingNegotiationDraft(user.id, user.email, threadId, {
        window: "next week",
        durationMinutes: 30,
      });
      return NextResponse.json({ success: true, action, threadId, draft });
    }

    return NextResponse.json({ error: "Unhandled action" }, { status: 400 });
  } catch (err) {
    console.error("Inbox action failed:", err);
    return NextResponse.json({ error: "Inbox action failed" }, { status: 500 });
  }
}
