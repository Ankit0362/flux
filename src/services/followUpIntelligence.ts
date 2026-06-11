import { prisma } from "../lib/db";
import { EmailDirection } from "@prisma/client";
import { callGeminiWithTimeout, safeParseJSON, getGenAIClient } from "../lib/gemini";

export async function analyzeFollowUpsForUser(userId: string): Promise<number> {
  const ai = getGenAIClient();
  const now = new Date();
  let updatedCount = 0;

  // 1. Fetch recent threads (last 30 days) with their messages
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const threads = await prisma.emailThread.findMany({
    where: {
      userId,
      updatedAt: { gte: thirtyDaysAgo },
    },
    include: {
      messages: {
        orderBy: { receivedAt: "desc" },
      },
    },
  });

  // Process threads concurrently in chunks of 5 to avoid overwhelming the API
  const chunkSize = 5;
  for (let i = 0; i < threads.length; i += chunkSize) {
    const chunk = threads.slice(i, i + chunkSize);

    await Promise.all(
      chunk.map(async (thread) => {
        if (thread.messages.length === 0) return;

        const latestMessage = thread.messages[0];
        const latestMessageDate = new Date(latestMessage.receivedAt);

        // Only re-analyze if the thread has new messages since our last analysis
        if (thread.lastMessageAt && thread.lastMessageAt.getTime() === latestMessageDate.getTime()) {
          return;
        }

        // Prepare context for Gemini
        const messagesContext = thread.messages
          .map((msg, i) => {
            const truncatedBody =
              msg.body.length > 500 ? msg.body.substring(0, 500) + "..." : msg.body;
            return `[Message #${i + 1}]
Direction: ${msg.direction}
Date: ${msg.receivedAt.toISOString()}
Sender: ${msg.sender}
Snippet: <<<EMAIL_CONTENT_START>>>${truncatedBody
              .replace(/\s+/g, " ")
              .trim()}<<<EMAIL_CONTENT_END>>>`;
          })
          .join("\n\n");

        const prompt = `
You are an elite executive assistant analyzing an email thread to determine if a follow-up is required.

CURRENT TIME: ${now.toISOString()}
THREAD SUBJECT: ${thread.subject}

--- MESSAGES (Newest First) ---
${messagesContext}

INSTRUCTIONS:
Determine if the user (who owns this mailbox) needs to follow up on this thread.
A follow-up is typically needed if:
- The user sent the last message (OUTBOUND) days ago and there is no reply, AND the context implies a reply was expected or requested.
- The user received a message (INBOUND) that requires a response, but they haven't replied yet.

1. Determine "lastMessageDirection" ("INBOUND" or "OUTBOUND").
2. Calculate "daysSinceLastResponse" based on the newest message date and the current time.
3. Decide "followUpNeeded" (boolean).
4. Assign "followUpUrgency" ("LOW", "MEDIUM", "HIGH", "CRITICAL"). If followUpNeeded is false, set it to "LOW".
5. Provide a short "reason" (under 20 words) explaining why (e.g., "Outbound email sent 8 days ago with no reply.").
`;

        try {
          const responseText = await callGeminiWithTimeout(ai, {
            model: "gemini-2.0-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  lastMessageDirection: { type: "STRING", enum: ["INBOUND", "OUTBOUND"] },
                  daysSinceLastResponse: { type: "INTEGER" },
                  followUpNeeded: { type: "BOOLEAN" },
                  followUpUrgency: {
                    type: "STRING",
                    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                  },
                  reason: {
                    type: "STRING",
                    description: "Short explanation under 20 words.",
                  },
                },
                required: [
                  "lastMessageDirection",
                  "daysSinceLastResponse",
                  "followUpNeeded",
                  "followUpUrgency",
                  "reason",
                ],
              },
            },
          });

          if (responseText) {
            interface FollowUpResponse {
              lastMessageDirection: string;
              daysSinceLastResponse: number;
              followUpNeeded: boolean;
              followUpUrgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
              reason: string;
            }
            
            const parsed = safeParseJSON<FollowUpResponse>(responseText);

            if (parsed) {
              await prisma.emailThread.update({
                where: { id: thread.id },
                data: {
                  followUpNeeded: parsed.followUpNeeded,
                  followUpUrgency: parsed.followUpUrgency,
                  followUpReason: parsed.reason,
                  lastMessageDirection: parsed.lastMessageDirection as EmailDirection,
                  lastMessageAt: latestMessageDate,
                },
              });
              updatedCount++;
            }
          }
        } catch (err) {
          console.error(`Failed to analyze follow-up for thread ${thread.id}:`, err);
        }
      })
    );
  }

  return updatedCount;
}
