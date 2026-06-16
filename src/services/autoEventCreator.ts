import { prisma } from "@/lib/db";
import { getGenAIClient, callGeminiWithTimeout, safeParseJSON } from "@/lib/gemini";
import { parseEmailAddress } from "@/lib/emailUtils";
import { EventStatus, CommitmentStatus, EmailDirection } from "@prisma/client";

export interface ConfirmationDetectionResult {
  isConfirmed: boolean;
  selectedStartAt: string | null;
  selectedEndAt: string | null;
  confidence: number;
}

/**
 * Service to process an incoming email on an active scheduling thread,
 * detect if the recipient confirmed a meeting slot, and automatically
 * provision the CalendarEvent and Commitment if they did.
 * 
 * @param userId - The ID of the primary user
 * @param threadId - The ID of the thread being processed
 */
export async function handleAutoEventCreation(
  userId: string,
  threadId: string
): Promise<{ success: boolean; eventId?: string; message?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) throw new Error("User not found");

  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, userId },
    include: { messages: { orderBy: { receivedAt: "asc" } } },
  });

  if (!thread || thread.messages.length === 0) {
    throw new Error("Thread not found or empty");
  }

  const metadata = (thread.metadata && typeof thread.metadata === "object" && !Array.isArray(thread.metadata))
    ? (thread.metadata as Record<string, any>)
    : {};
  
  if (metadata.isMeetingConfirmed) {
    return { success: false, message: "Meeting already confirmed for this thread." };
  }

  // Use the last 4 messages to give the AI context of the proposal and the reply
  const messageHistory = thread.messages
    .slice(-4) 
    .map(m => `From: ${m.sender}\nDate: ${m.receivedAt.toISOString()}\nBody:\n${m.body}`)
    .join("\n\n---\n\n");

  const prompt = `
You are an AI assistant parsing an email thread. Your task is to determine if the LATEST reply in the thread constitutes a confirmation of a proposed meeting time.

EMAIL THREAD HISTORY:
${messageHistory}

INSTRUCTIONS:
1. Look at the final message in the thread. Did the sender agree to one of the previously proposed times?
2. If yes, set "isConfirmed" to true and extract the agreed-upon start and end times in ISO 8601 format. (Assume the year/month/date contextually from the earlier messages). If duration isn't specified in the reply, look at the proposal's duration (usually 30 mins) to infer the end time.
3. If the final message is just a proposal from them, a rejection, or unrelated, set "isConfirmed" to false.
4. Provide a confidence score from 0 to 100.
`;

  const ai = getGenAIClient();
  const text = await callGeminiWithTimeout(ai, {
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          isConfirmed: {
            type: "BOOLEAN",
            description: "True if the latest message confirms a meeting slot.",
          },
          selectedStartAt: {
            type: "STRING",
            description: "The agreed start time in ISO 8601 format, or null if not confirmed.",
          },
          selectedEndAt: {
            type: "STRING",
            description: "The agreed end time in ISO 8601 format, or null if not confirmed.",
          },
          confidence: {
            type: "NUMBER",
            description: "Confidence score (0 to 100).",
          },
        },
        required: ["isConfirmed", "confidence"],
      },
    },
  }, 20_000);

  const parsed = safeParseJSON<ConfirmationDetectionResult>(text, "confirmationDetection");

  if (!parsed || !parsed.isConfirmed || parsed.confidence < 70 || !parsed.selectedStartAt || !parsed.selectedEndAt) {
    return { success: false, message: "No meeting confirmation detected with sufficient confidence." };
  }

  // Meeting Confirmed! Proceed with provisioning.
  const latestMessage = thread.messages[thread.messages.length - 1];
  
  // 1. Resolve Attendees
  const rawEmails = [latestMessage.sender, ...latestMessage.recipients];
  const uniqueEmails = new Set<string>();
  
  rawEmails.forEach(raw => {
    const parsedEmail = parseEmailAddress(raw).email.toLowerCase();
    if (parsedEmail && parsedEmail !== user.email.toLowerCase()) {
      uniqueEmails.add(parsedEmail);
    }
  });

  const attendeeContactIds: string[] = [];
  for (const email of uniqueEmails) {
    const contact = await prisma.contact.upsert({
      where: { userId_email: { userId, email } },
      update: { lastInteractionAt: new Date() },
      create: {
        userId,
        email,
        name: parseEmailAddress(email).name, // Try to extract name if possible
      }
    });
    attendeeContactIds.push(contact.id);
  }

  // 2. Create Calendar Event
  const calendarEvent = await prisma.calendarEvent.create({
    data: {
      userId,
      calendarId: "primary",
      externalId: `chiefos-auto-${crypto.randomUUID()}`, // Dummy ID since we aren't pushing to Google Calendar yet
      title: thread.subject.replace(/^re:\s*/i, "").slice(0, 120) || "Scheduled Meeting",
      startAt: new Date(parsed.selectedStartAt),
      endAt: new Date(parsed.selectedEndAt),
      status: EventStatus.CONFIRMED,
      attendees: {
        connect: attendeeContactIds.map(id => ({ id }))
      }
    }
  });

  // 3. Create Commitment Record
  await prisma.commitment.create({
    data: {
      userId,
      title: `Meeting: ${calendarEvent.title}`,
      status: CommitmentStatus.PENDING,
      dueDate: calendarEvent.startAt,
      emailThreadId: thread.id,
      calendarEventId: calendarEvent.id,
      fingerprint: `meet-${calendarEvent.id}`,
    }
  });

  // 4. Update Thread Metadata
  const updatedMetadata = {
    ...metadata,
    isMeetingConfirmed: true,
    confirmedEventId: calendarEvent.id,
  };

  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { metadata: updatedMetadata }
  });

  // 5. Send Confirmation Email (Mocked)
  // In a full implementation, we would use the corsair client to send the outbound email.
  console.log(`[AutoEventCreator] Meeting confirmed. Simulating outbound confirmation email for Thread ${thread.id}`);
  await prisma.emailMessage.create({
    data: {
      threadId: thread.id,
      externalId: `chiefos-mock-sent-${crypto.randomUUID()}`,
      sender: user.email,
      recipients: Array.from(uniqueEmails),
      subject: `Re: ${thread.subject.replace(/^re:\s*/i, "")}`,
      body: `Perfect, I have scheduled this for ${new Date(parsed.selectedStartAt).toLocaleString()}. I will send over a calendar invite shortly. Looking forward to it!`,
      direction: EmailDirection.OUTBOUND,
      receivedAt: new Date(),
    }
  });

  return { 
    success: true, 
    eventId: calendarEvent.id,
    message: "Meeting confirmed, CalendarEvent created, and mocked confirmation email sent." 
  };
}
