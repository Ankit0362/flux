import { prisma } from "@/lib/db";
import { getGenAIClient, callGeminiWithTimeout } from "@/lib/gemini";
import { EventStatus } from "@prisma/client";

export interface MeetingPrepDTO {
  eventId: string;
  title: string;
  startAt: string;
  attendees: Array<{
    name: string | null;
    email: string;
    relationshipHealth: string | null;
    openCommitments: number;
  }>;
  relevantCommitments: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
  }>;
  recentThreads: Array<{
    subject: string;
    lastMessageAt: string | null;
    followUpNeeded: boolean | null;
  }>;
  aiSummary: string;
}

export interface AgendaItemDTO {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  attendeeCount: number;
  relationshipHealthSummary: {
    strong: number;
    neutral: number;
    atRisk: number;
  };
  linkedCommitmentsCount: number;
}

export interface ConflictDTO {
  timeBlock: string;
  events: Array<{ id: string; title: string }>;
}

export async function generateMeetingPrep(userId: string, eventId: string): Promise<MeetingPrepDTO> {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId, userId },
    include: {
      attendees: true,
      commitments: {
        where: { status: "PENDING" }
      }
    }
  });

  if (!event) throw new Error("Event not found");

  // Gather attendee context
  const attendeeContext = event.attendees.map(a => ({
    name: a.name,
    email: a.email,
    relationshipHealth: a.relationshipHealth,
    openCommitments: a.openCommitments
  }));

  // Find recent email threads with these attendees
  const attendeeEmails = event.attendees.map(a => a.email);
  const recentThreads = await prisma.emailThread.findMany({
    where: {
      userId,
      messages: {
        some: {
          OR: [
            { sender: { in: attendeeEmails } },
            { recipients: { hasSome: attendeeEmails } }
          ]
        }
      }
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 5,
    select: { subject: true, lastMessageAt: true, followUpNeeded: true, snippet: true }
  });

  // Generate AI Summary using Gemini
  const genAI = getGenAIClient();

  const prompt = `
You are ChiefOS, an executive assistant preparing a meeting brief.
Meeting Title: ${event.title}
Time: ${event.startAt.toISOString()}

Attendees:
${JSON.stringify(attendeeContext, null, 2)}

Open Commitments with these attendees:
${JSON.stringify(event.commitments.map(c => ({ title: c.title, dueDate: c.dueDate })), null, 2)}

Recent related email threads:
${JSON.stringify(recentThreads, null, 2)}

Write a concise, 3-bullet-point briefing for this meeting. Include:
1. Context on who the user is meeting with (note any at-risk relationships).
2. Key action items or commitments to review.
3. Relevant context from recent emails if any.
Keep it strictly under 150 words.
`;

  let aiSummary = "Could not generate AI summary at this time.";
  try {
    const text = await callGeminiWithTimeout(genAI, {
      model: "gemini-2.5-flash",
      contents: prompt
    });
    aiSummary = text || aiSummary;
  } catch (error) {
    console.error("Failed to generate meeting prep summary with Gemini", error);
  }

  return {
    eventId: event.id,
    title: event.title,
    startAt: event.startAt.toISOString(),
    attendees: attendeeContext,
    relevantCommitments: event.commitments.map(c => ({
      id: c.id,
      title: c.title,
      status: c.status,
      dueDate: c.dueDate ? c.dueDate.toISOString() : null
    })),
    recentThreads: recentThreads.map(t => ({
      subject: t.subject,
      lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : null,
      followUpNeeded: t.followUpNeeded
    })),
    aiSummary
  };
}

export async function detectConflicts(userId: string): Promise<ConflictDTO[]> {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcomingEvents = await prisma.calendarEvent.findMany({
    where: {
      userId,
      startAt: { gte: now, lte: weekEnd },
      status: { not: EventStatus.CANCELLED },
      isAllDay: false
    },
    orderBy: { startAt: "asc" },
    select: { id: true, title: true, startAt: true, endAt: true }
  });

  const conflicts: ConflictDTO[] = [];
  
  for (let i = 0; i < upcomingEvents.length - 1; i++) {
    const current = upcomingEvents[i];
    const next = upcomingEvents[i+1];

    if (current.endAt > next.startAt) {
      conflicts.push({
        timeBlock: `${current.startAt.toLocaleTimeString()} - ${current.endAt.toLocaleTimeString()}`,
        events: [
          { id: current.id, title: current.title },
          { id: next.id, title: next.title }
        ]
      });
    }
  }

  return conflicts;
}

export async function getUpcomingAgenda(userId: string, days: number = 7): Promise<AgendaItemDTO[]> {
  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      startAt: { gte: now, lte: endDate },
      status: { not: EventStatus.CANCELLED }
    },
    include: { attendees: true, _count: { select: { commitments: true } } },
    orderBy: { startAt: "asc" }
  });

  return events.map(e => {
    let strong = 0, neutral = 0, atRisk = 0;
    e.attendees.forEach(a => {
      if (a.relationshipHealth === "Strong") strong++;
      else if (a.relationshipHealth === "At Risk") atRisk++;
      else neutral++;
    });

    return {
      id: e.id,
      title: e.title,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt.toISOString(),
      location: e.location,
      attendeeCount: e.attendees.length,
      relationshipHealthSummary: { strong, neutral, atRisk },
      linkedCommitmentsCount: e._count.commitments
    };
  });
}
