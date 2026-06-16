import { prisma } from "@/lib/db";
import { getGenAIClient, callGeminiWithTimeout, safeParseJSON } from "@/lib/gemini";
import { parseEmailAddress } from "@/lib/emailUtils";
import { EventStatus, CommitmentStatus, EmailDirection } from "@prisma/client";

export interface SlotMatchResult {
  isConfirmed: boolean;
  selectedStartAt: string | null;
  selectedEndAt: string | null;
  confidence: number;
}

export interface ConfirmationReplyResult {
  subject: string;
  body: string;
}

/**
 * Auto Event Creation & Confirmation Workflow
 * Handles the complete process when a recipient replies to a meeting proposal.
 * 
 * @param userId - The ID of the primary user
 * @param threadId - The ID of the thread being processed
 */
export async function processMeetingConfirmation(
  userId: string,
  threadId: string
): Promise<{ success: boolean; phaseReached: number; message?: string }> {
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
    return { success: false, phaseReached: 0, message: "Meeting already confirmed for this thread." };
  }

  const latestMessage = thread.messages[thread.messages.length - 1];

  // --------------------------------------------------------------------------------
  // PHASE 1: Detect Confirmation & Match Slots
  // --------------------------------------------------------------------------------
  
  const proposedSlots = metadata.proposedSlots || []; // Expected to be an array of ISO strings or objects
  const messageHistory = thread.messages
    .slice(-4) 
    .map(m => `From: ${m.sender}\nDate: ${m.receivedAt.toISOString()}\nBody:\n${m.body}`)
    .join("\n\n---\n\n");

  const detectionPrompt = `
You are an AI assistant parsing an email thread. Your task is to determine if the LATEST reply in the thread constitutes a confirmation of a proposed meeting time.

PREVIOUSLY PROPOSED SLOTS (Context):
${JSON.stringify(proposedSlots)}

EMAIL THREAD HISTORY:
${messageHistory}

INSTRUCTIONS:
1. Look at the final message in the thread. Did the sender agree to one of the previously proposed times?
2. If yes, set "isConfirmed" to true and extract the agreed-upon start and end times in ISO 8601 format. Match it strictly against the context if possible. If duration isn't specified in the reply, look at the proposal's duration to infer the end time.
3. If the final message is just a proposal from them, a rejection, or unrelated, set "isConfirmed" to false.
4. Provide a confidence score from 0 to 100.
`;

  const ai = getGenAIClient();
  const detectionText = await callGeminiWithTimeout(ai, {
    model: "gemini-2.0-flash",
    contents: detectionPrompt,
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

  const matchResult = safeParseJSON<SlotMatchResult>(detectionText, "slotMatch");

  if (!matchResult || !matchResult.isConfirmed || matchResult.confidence < 75 || !matchResult.selectedStartAt || !matchResult.selectedEndAt) {
    // Store negotiation metadata on EmailThread (Phase 1 Requirement)
    await prisma.emailThread.update({
      where: { id: thread.id },
      data: { 
        metadata: {
          ...metadata,
          lastNegotiationState: "PENDING_OR_REJECTED",
          lastNegotiationConfidence: matchResult?.confidence || 0,
        }
      }
    });
    return { success: false, phaseReached: 1, message: "No explicit meeting confirmation detected." };
  }

  // --------------------------------------------------------------------------------
  // PHASE 2: Create CalendarEvent, Persist Attendees, Link Contacts
  // --------------------------------------------------------------------------------

  // Resolve Attendees
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
        name: parseEmailAddress(email).name,
      }
    });
    attendeeContactIds.push(contact.id);
  }

  // Create Calendar Event
  const calendarEvent = await prisma.calendarEvent.create({
    data: {
      userId,
      calendarId: "primary",
      externalId: `chiefos-auto-${crypto.randomUUID()}`,
      title: thread.subject.replace(/^re:\s*/i, "").slice(0, 120) || "Scheduled Meeting",
      startAt: new Date(matchResult.selectedStartAt),
      endAt: new Date(matchResult.selectedEndAt),
      status: EventStatus.CONFIRMED,
      attendees: {
        connect: attendeeContactIds.map(id => ({ id }))
      }
    }
  });

  // Update Thread Metadata
  const updatedMetadata = {
    ...metadata,
    isMeetingConfirmed: true,
    confirmedEventId: calendarEvent.id,
    confirmedStartAt: matchResult.selectedStartAt,
    confirmedEndAt: matchResult.selectedEndAt,
    lastNegotiationState: "CONFIRMED",
  };

  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { metadata: updatedMetadata }
  });

  // --------------------------------------------------------------------------------
  // PHASE 3: Generate & Send Confirmation Email, Create Commitment
  // --------------------------------------------------------------------------------

  const confirmationPrompt = `
You are an AI assistant helping an executive confirm a meeting.
The recipient just agreed to a meeting time: ${new Date(matchResult.selectedStartAt).toLocaleString()}.
Write a short, polite confirmation email reply. Do NOT add placeholders like [Your Name].

Output strictly valid JSON with "subject" and "body".
`;

  const confirmationText = await callGeminiWithTimeout(ai, {
    model: "gemini-2.0-flash",
    contents: confirmationPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          subject: { type: "STRING" },
          body: { type: "STRING" },
        },
        required: ["subject", "body"],
      },
    },
  }, 15_000);

  const replyDraft = safeParseJSON<ConfirmationReplyResult>(confirmationText, "confirmationReply");

  // Create Commitment Record
  const commitment = await prisma.commitment.create({
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

  // Send Confirmation Email (Mocked)
  if (replyDraft) {
    console.log(`[MeetingConfirmation] Phase 3: Simulating outbound confirmation email for Thread ${thread.id}`);
    await prisma.emailMessage.create({
      data: {
        threadId: thread.id,
        externalId: `chiefos-mock-sent-${crypto.randomUUID()}`,
        sender: user.email,
        recipients: Array.from(uniqueEmails),
        subject: replyDraft.subject || `Re: ${thread.subject.replace(/^re:\s*/i, "")}`,
        body: replyDraft.body,
        direction: EmailDirection.OUTBOUND,
        receivedAt: new Date(),
      }
    });
  }

  return { 
    success: true, 
    phaseReached: 3,
    message: `Meeting fully confirmed, Event ${calendarEvent.id} and Commitment ${commitment.id} created.` 
  };
}
