import { prisma } from "@/lib/db";
import { getGenAIClient, callGeminiWithTimeout, safeParseJSON } from "@/lib/gemini";
import { parseEmailAddress } from "@/lib/emailUtils";
import { EventStatus } from "@prisma/client";

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  label: string;
}

export interface NegotiationDraft {
  threadId: string;
  title: string;
  attendees: string[];
  slots: AvailabilitySlot[];
  replySubject: string;
  replyBody: string;
}

interface QuickAddDraft {
  title: string;
  startAt: string;
  endAt: string;
  attendees: string[];
  description?: string;
  location?: string;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextBusinessDay(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function resolveWindow(window: string | undefined) {
  const now = new Date();
  const start = nextBusinessDay(now);
  const end = new Date(start);

  if (window?.toLowerCase().includes("next week")) {
    const day = now.getDay();
    const daysUntilNextMonday = ((8 - day) % 7) || 7;
    start.setDate(now.getDate() + daysUntilNextMonday);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 5);
    return { start, end };
  }

  end.setDate(start.getDate() + 7);
  return { start, end };
}

export async function suggestAvailabilitySlots(
  userId: string,
  options: { window?: string; durationMinutes?: number; limit?: number } = {}
): Promise<AvailabilitySlot[]> {
  const durationMinutes = options.durationMinutes ?? 30;
  const limit = options.limit ?? 3;
  const { start, end } = resolveWindow(options.window);

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      status: { not: EventStatus.CANCELLED },
      isAllDay: false,
      startAt: { lt: end },
      endAt: { gt: start },
    },
    orderBy: { startAt: "asc" },
    select: { startAt: true, endAt: true },
  });

  const slots: AvailabilitySlot[] = [];
  const cursor = new Date(start);
  cursor.setHours(9, 0, 0, 0);

  while (cursor < end && slots.length < limit) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(17, 0, 0, 0);

      while (cursor < dayEnd && slots.length < limit) {
        const candidateEnd = new Date(cursor.getTime() + durationMinutes * 60_000);
        const conflicts = events.some(
          (event) => event.startAt < candidateEnd && event.endAt > cursor
        );

        if (!conflicts && cursor > new Date()) {
          slots.push({
            startAt: cursor.toISOString(),
            endAt: candidateEnd.toISOString(),
            label: cursor.toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
          });
        }

        cursor.setMinutes(cursor.getMinutes() + 30);
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(9, 0, 0, 0);
  }

  return slots;
}

export async function buildMeetingNegotiationDraft(
  userId: string,
  userEmail: string,
  threadId: string,
  options: { window?: string; durationMinutes?: number } = {}
): Promise<NegotiationDraft> {
  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, userId },
    include: { messages: { orderBy: { receivedAt: "asc" } } },
  });

  if (!thread) throw new Error("Thread not found");

  const attendees = new Set<string>();
  for (const message of thread.messages) {
    const sender = parseEmailAddress(message.sender).email.toLowerCase();
    if (sender && sender !== userEmail.toLowerCase()) attendees.add(sender);
    for (const recipient of message.recipients) {
      const email = parseEmailAddress(recipient).email.toLowerCase();
      if (email && email !== userEmail.toLowerCase()) attendees.add(email);
    }
  }

  const slots = await suggestAvailabilitySlots(userId, {
    window: options.window ?? "next week",
    durationMinutes: options.durationMinutes ?? 30,
    limit: 3,
  });

  const slotLines = slots.map((slot, index) => `${index + 1}. ${slot.label}`).join("\n");
  const _latest = thread.messages[thread.messages.length - 1]?.body || thread.snippet || "";
  const subject = thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`;

  return {
    threadId,
    title: thread.subject.replace(/^re:\s*/i, "").slice(0, 120) || "Meeting",
    attendees: Array.from(attendees),
    slots,
    replySubject: subject,
    replyBody:
      `Hi,\n\nI can make any of these times work:\n\n${slotLines}\n\n` +
      `If one of these works for you, I will send a calendar invite.\n\nBest,\n${userEmail.split("@")[0]}`,
  };
}

export async function parseQuickAdd(
  userId: string,
  input: string,
  contacts: Array<{ email: string; name: string | null }> = []
): Promise<QuickAddDraft> {
  const now = new Date();
  const fallbackStart = nextBusinessDay(now);
  fallbackStart.setHours(13, 0, 0, 0);
  const fallbackEnd = new Date(fallbackStart.getTime() + 30 * 60_000);

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = getGenAIClient();
      const text = await callGeminiWithTimeout(ai, {
        model: "gemini-2.5-flash",
        contents: `Parse this calendar quick-add request into JSON only.
Current date: ${now.toISOString()}
Known contacts: ${JSON.stringify(contacts.slice(0, 20))}
Request: ${input}
Schema: {"title":"string","startAt":"ISO datetime","endAt":"ISO datetime","attendees":["email"],"description":"optional string","location":"optional string"}`,
      });
      const parsed = safeParseJSON<QuickAddDraft>(text, "quick-add");
      if (parsed?.title && parsed.startAt && parsed.endAt) {
        return { ...parsed, attendees: parsed.attendees ?? [] };
      }
    } catch (error) {
      console.warn("[QuickAdd] Gemini parse failed, using fallback parser.", error);
    }
  }

  const matchedContact = contacts.find((contact) =>
    input.toLowerCase().includes((contact.name || contact.email).toLowerCase().split(" ")[0])
  );

  return {
    title: input.trim().replace(/\s+/g, " ").slice(0, 120) || "New meeting",
    startAt: fallbackStart.toISOString(),
    endAt: fallbackEnd.toISOString(),
    attendees: matchedContact ? [matchedContact.email] : [],
  };
}
