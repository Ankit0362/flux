import { prisma } from "@/lib/db";
import { getGenAIClient, callGeminiWithTimeout, safeParseJSON } from "@/lib/gemini";
import { calculateBestSlots } from "@/services/availabilityEngine";
import { parseEmailAddress } from "@/lib/emailUtils";

export interface MeetingReplyDraft {
  subject: string;
  body: string;
  tone: "formal" | "neutral" | "friendly";
  confidence: number;
}

/**
 * Service to automatically generate a professional meeting scheduling reply.
 * Pulls context from the original thread, the detected scheduling intent, 
 * the Availability Engine, and the user's relationship with the sender.
 * 
 * @param userId - The ID of the primary user.
 * @param userEmail - The email address of the primary user.
 * @param threadId - The internal ID of the EmailThread to reply to.
 */
export async function generateMeetingReply(
  userId: string,
  userEmail: string,
  threadId: string
): Promise<MeetingReplyDraft> {
  // 1. Fetch thread and messages
  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, userId },
    include: { messages: { orderBy: { receivedAt: "asc" } } },
  });

  if (!thread || thread.messages.length === 0) {
    throw new Error("Thread not found or empty");
  }

  // 2. Extract scheduling intent metadata
  const metadata = (thread.metadata && typeof thread.metadata === "object" && !Array.isArray(thread.metadata))
    ? (thread.metadata as Record<string, any>)
    : {};
  const schedulingIntent = metadata.schedulingIntent;
  
  if (!schedulingIntent?.isMeetingRequest) {
    console.warn("[ReplyGenerator] Generating a meeting reply for a thread without explicit scheduling intent.");
  }

  // 3. Fetch Relationship Context
  const latestMessage = thread.messages[thread.messages.length - 1];
  const { email: senderEmail } = parseEmailAddress(latestMessage.sender);
  
  let relationshipContext = "Unknown (Neutral/Standard business relationship)";
  if (senderEmail && senderEmail.toLowerCase() !== userEmail.toLowerCase()) {
    const contact = await prisma.contact.findUnique({
      where: { userId_email: { userId, email: senderEmail.toLowerCase() } },
    });
    if (contact) {
      relationshipContext = `Health: ${contact.relationshipHealth || "Neutral"}, Score: ${contact.relationshipScore || 50}/100`;
      if (contact.relationshipReason) {
        relationshipContext += `, Notes: ${contact.relationshipReason}`;
      }
    }
  }

  // 4. Get Availability Slots from the Availability Engine
  // Defaulting to 30 mins, but future enhancements could parse duration from the intent
  const availability = await calculateBestSlots(userId, 30);
  const slots = availability.suggestedSlots;

  if (slots.length === 0) {
    throw new Error("No available slots found in the next 14 days.");
  }

  // Format slots into a human-readable list for the AI
  const formattedSlots = slots.map((s, i) => {
    const start = new Date(s.start);
    const end = new Date(s.end);
    
    // Formatting e.g., "Tue, Jun 16 from 2:00 PM to 2:30 PM"
    const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const startTimeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTimeStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    return `${i + 1}. ${dateStr} from ${startTimeStr} to ${endTimeStr}`;
  }).join("\n");

  // 5. Build context payload for Gemini
  // Send the last 3 messages so Gemini understands the flow
  const messageHistory = thread.messages
    .slice(-3) 
    .map(m => `From: ${m.sender}\nDate: ${m.receivedAt.toISOString()}\nBody:\n${m.body}`)
    .join("\n\n---\n\n");

  const prompt = `
You are an AI executive assistant generating an email reply to schedule a meeting on behalf of your principal.
Read the recent email history, understand the context and intent, and seamlessly propose the provided available time slots.

CONTEXT:
- Principal's Email: ${userEmail}
- Target Recipient: ${senderEmail}
- Relationship Profile: ${relationshipContext}
- Identified Scheduling Intent: ${JSON.stringify(schedulingIntent || {})}

AVAILABLE SLOTS TO PROPOSE:
${formattedSlots}

EMAIL HISTORY:
${messageHistory}

INSTRUCTIONS:
1. Write a natural, professional email reply directly from the principal to the recipient.
2. The reply MUST propose the available slots listed above. Present them clearly (e.g. using bullet points).
3. Determine the best tone ("formal", "neutral", or "friendly") based on the Relationship Profile. 
   - If Health is "Strong" or Score > 70, use a "friendly" and warm tone. 
   - If Health is "At Risk" or Score < 40, use a "formal" and careful tone. 
   - Otherwise, use a "neutral" professional tone.
4. Keep the email concise and directly address the scheduling request. Do NOT add placeholder text (like [Your Name]), sign off with just the principal's first name (inferred from email).
5. Create an appropriate Subject line (typically prefixing "Re: " to the original subject: "${thread.subject}").
6. Output MUST be valid JSON matching the exact schema. Assign a confidence score from 0 to 100.
`;

  const ai = getGenAIClient();
  
  try {
    const text = await callGeminiWithTimeout(ai, {
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            subject: {
              type: "STRING",
              description: "The subject line for the reply email.",
            },
            body: {
              type: "STRING",
              description: "The plaintext body of the email.",
            },
            tone: {
              type: "STRING",
              enum: ["formal", "neutral", "friendly"],
              description: "The tone adopted based on the relationship context.",
            },
            confidence: {
              type: "NUMBER",
              description: "Confidence score in the generated response (0 to 100).",
            },
          },
          required: ["subject", "body", "tone", "confidence"],
        },
      },
    }, 20_000);

    const parsed = safeParseJSON<MeetingReplyDraft>(text, "meetingReply");
    if (!parsed) {
      throw new Error("Failed to parse AI response into meeting reply draft schema.");
    }

    return parsed;
  } catch (error: unknown) {
    console.error("[ReplyGenerator] Error generating meeting reply:", error);
    throw error;
  }
}
