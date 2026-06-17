import { prisma } from "@/lib/db";
import { getGenAIClient, callGeminiWithTimeout } from "@/lib/gemini";

export interface MeetingBrief {
  eventId: string;
  meetingTitle: string;
  startAt: string;
  meetingStartsInMinutes: number;
  attendees: Array<{
    name: string | null;
    email: string;
    relationshipHealth: string | null;
  }>;
  relationshipSummary: string;
  openCommitments: Array<{ title: string; dueDate: string | null; status: string; riskLevel: string }>;
  recentConversationSummary: string;
  risks: Array<{ title: string; reason: string; riskLevel: string }>;
  suggestedTalkingPoints: string[];
  actionRecommendations: string[];
}

export async function generateMeetingBrief(userId: string, eventId: string): Promise<MeetingBrief> {
  const now = new Date();

  // 1. Fetch Event & Base Data
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

  const meetingStartsInMinutes = Math.round((event.startAt.getTime() - now.getTime()) / 60_000);

  // 2. Attendee Data
  const attendeeEmails = event.attendees.map(a => a.email);
  const attendees = event.attendees.map(a => ({
    name: a.name,
    email: a.email,
    relationshipHealth: a.relationshipHealth,
    relationshipScore: a.relationshipScore,
    openCommitments: a.openCommitments,
  }));

  // 3. Open Commitments tied to attendees OR the event
  const relatedCommitments = await prisma.commitment.findMany({
    where: {
      userId,
      status: "PENDING",
      OR: [
        { calendarEventId: eventId },
        { contact: { email: { in: attendeeEmails } } }
      ]
    }
  });

  // Deduplicate commitments in case some overlap
  const commitmentMap = new Map<string, typeof relatedCommitments[0]>();
  for (const c of event.commitments) commitmentMap.set(c.id, c as any);
  for (const c of relatedCommitments) commitmentMap.set(c.id, c);
  const allCommitments = Array.from(commitmentMap.values());

  const risks = allCommitments
    .filter(c => c.riskLevel === "HIGH" || c.riskScore > 60)
    .map(c => ({
      title: c.title,
      reason: c.riskReason || "Elevated risk detected",
      riskLevel: c.riskLevel
    }));

  const openCommitments = allCommitments.map(c => ({
    title: c.title,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    status: c.status,
    riskLevel: c.riskLevel
  }));

  // 4. Recent Threads
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
    select: { subject: true, snippet: true }
  });

  // 5. Build AI Prompt
  const genAI = getGenAIClient();
  const prompt = `You are Flux, an executive assistant preparing a pre-meeting briefing for an executive.
Return JSON only matching this exact schema:
{
  "relationshipSummary": "string (Brief summary of relationship health with attendees, max 100 words)",
  "recentConversationSummary": "string (Brief summary of what was discussed recently in emails, max 100 words)",
  "suggestedTalkingPoints": ["string (3-5 items)"],
  "actionRecommendations": ["string (2-4 items)"]
}

Meeting: ${event.title}
Time: ${event.startAt.toISOString()}

Attendees:
${JSON.stringify(attendees, null, 2)}

Open Commitments:
${JSON.stringify(openCommitments, null, 2)}

Risks:
${JSON.stringify(risks, null, 2)}

Recent Threads:
${JSON.stringify(recentThreads, null, 2)}`;

  let relationshipSummary = "No relationship data available.";
  let recentConversationSummary = "No recent emails found.";
  let suggestedTalkingPoints: string[] = [];
  let actionRecommendations: string[] = [];

  try {
    const text = await callGeminiWithTimeout(genAI, {
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    const cleaned = (text || "").trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    
    if (parsed?.relationshipSummary) relationshipSummary = parsed.relationshipSummary;
    if (parsed?.recentConversationSummary) recentConversationSummary = parsed.recentConversationSummary;
    if (Array.isArray(parsed?.suggestedTalkingPoints)) suggestedTalkingPoints = parsed.suggestedTalkingPoints;
    if (Array.isArray(parsed?.actionRecommendations)) actionRecommendations = parsed.actionRecommendations;
  } catch (error) {
    console.error("Failed to generate meeting brief with Gemini", error);
  }

  const brief: MeetingBrief = {
    eventId: event.id,
    meetingTitle: event.title,
    startAt: event.startAt.toISOString(),
    meetingStartsInMinutes,
    attendees: attendees.map(a => ({ name: a.name, email: a.email, relationshipHealth: a.relationshipHealth })),
    relationshipSummary,
    openCommitments,
    recentConversationSummary,
    risks,
    suggestedTalkingPoints,
    actionRecommendations,
  };

  // Cache it in the event's metadata
  const metadataObj = (event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata))
    ? (event.metadata as Record<string, any>)
    : {};
  const updatedMetadata = {
    ...metadataObj,
    meetingBrief: brief
  };

  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { metadata: updatedMetadata as any }
  });

  return brief;
}
