import { prisma } from "../lib/db";
import { CommitmentStatus } from "@prisma/client";
import { getGenAIClient, callGeminiWithTimeout, safeParseJSON } from "../lib/gemini";
import { ExecutiveBriefingDTO } from "../types/briefing";


/**
 * Service function to aggregate user workspace data and synthesize an executive daily briefing.
 * 
 * @param userId The ID of the user.
 * @returns The synthesized daily briefing.
 */
export async function generateExecutiveBriefing(userId: string): Promise<ExecutiveBriefingDTO> {
  const now = new Date();

  // 1. Fetch unread emails
  const unreadMessages = await prisma.emailMessage.findMany({
    where: {
      thread: {
        userId,
        labels: { has: "UNREAD" },
      },
    },
    orderBy: { receivedAt: "desc" },
    take: 10,
    select: {
      id: true,
      sender: true,
      subject: true,
      body: true,
      receivedAt: true,
    },
  });

  // 2. Fetch pending commitments (including their risk metrics)
  const commitments = await prisma.commitment.findMany({
    where: {
      userId,
      status: CommitmentStatus.PENDING,
      title: { not: "NO_COMMITMENTS" },
    },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [
      { riskScore: "desc" },
      { createdAt: "desc" },
    ],
  });

  // 3. Fetch At Risk contacts
  const atRiskContacts = await prisma.contact.findMany({
    where: {
      userId,
      relationshipHealth: "At Risk",
    },
    orderBy: { relationshipScore: "asc" },
    take: 5,
    select: {
      id: true,
      name: true,
      email: true,
      relationshipScore: true,
      relationshipReason: true,
      lastInteractionAt: true,
    },
  });

  // 3.5. Fetch Upcoming Calendar Events
  const endOfDayThirdDay = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const calendarEvents = await prisma.calendarEvent.findMany({
    where: {
      userId,
      startAt: { gte: now, lte: endOfDayThirdDay },
      status: { not: "CANCELLED" }
    },
    include: { attendees: true },
    orderBy: { startAt: "asc" },
    take: 10,
  });
  // 4. Summarize and format context for the Gemini model
  const unreadEmailsContext = unreadMessages
    .map((msg, i) => {
      // Truncate email body to keep prompt size reasonable
      const truncatedBody = msg.body.length > 300 ? msg.body.substring(0, 300) + "..." : msg.body;
      return `[Email #${i + 1}]
ID: ${msg.id}
From: ${msg.sender}
Subject: ${msg.subject}
Received: ${msg.receivedAt.toISOString()}
Snippet: <email_content>${truncatedBody.replace(/\s+/g, " ").trim()}</email_content>`;
    })
    .join("\n\n");

  const commitmentsContext = commitments.map((c, i) => {
    const dueDateStr = c.dueDate ? c.dueDate.toISOString().split("T")[0] : "None";
    const contactInfo = c.contact ? `${c.contact.name || "Unknown"} (${c.contact.email})` : "None";
    const metadata = (c.metadata || {}) as any;
    const direction = metadata.direction || "INBOUND";
    return `[Commitment #${i + 1}]
ID: ${c.id}
Title: ${c.title}
Status: ${c.status}
Due Date: ${dueDateStr}
Direction: ${direction}
Related Contact: ${contactInfo}
Risk Score: ${c.riskScore}
Risk Level: ${c.riskLevel}
Risk Reason: ${c.riskReason || "None"}`;
  }).join("\n\n");

  const relationshipsContext = atRiskContacts.map((contact, i) => {
    const lastInteraction = contact.lastInteractionAt 
      ? contact.lastInteractionAt.toISOString().split("T")[0] 
      : "Never";
    return `[At Risk Contact #${i + 1}]
ID: ${contact.id}
Name: ${contact.name || "Unknown"}
Email: ${contact.email}
Relationship Score: ${contact.relationshipScore}
Last Interaction: ${lastInteraction}
Reason: ${contact.relationshipReason || "None"}`;
  }).join("\n\n");

  const calendarContext = calendarEvents.map((e, i) => {
    return `[Calendar Event #${i + 1}]
ID: ${e.id}
Title: ${e.title}
Start: ${e.startAt.toISOString()}
Attendees: ${e.attendees.map(a => a.email).join(", ") || "None"}`;
  }).join("\n\n");

  // Determine counts
  const pendingCount = commitments.length;
  const overdueCount = commitments.filter(c => c.dueDate && new Date(c.dueDate) < now).length;

  const prompt = `
You are an elite executive Chief of Staff. Synthesize the user's workspace context into a highly actionable, concise daily briefing.

CURRENT TIME: ${now.toISOString()}
PENDING COMMITMENTS COUNT: ${pendingCount}
OVERDUE COMMITMENTS COUNT: ${overdueCount}

--- UNREAD EMAILS ---
${unreadEmailsContext || "No unread emails."}

--- PENDING & OVERDUE COMMITMENTS ---
${commitmentsContext || "No pending commitments."}

--- AT RISK RELATIONSHIPS ---
${relationshipsContext || "No relationships currently flagged as At Risk."}

--- UPCOMING CALENDAR EVENTS ---
${calendarContext || "No upcoming meetings scheduled for the next 3 days."}

INSTRUCTIONS:
1. Generate an narrative "executiveSummary" under 250 words. Synthesize today's workspace state: note if there are critical unread threads, highlight overdue or high-risk commitments, summarize relationship issues, mention any critical follow-ups needed, and summarize key upcoming meetings (conflicts, important attendees). It must be professional, punchy, and highly readable.
2. Select the top risks (up to 3) from the commitments context. For each risk, reference the commitment ID, its title, its risk level, and a concise explanation of why it is a risk.
3. Select up to 3 relationships needing attention. For each contact, include their contact ID, name/email, and a concise explanation of what action or lack thereof is causing the relationship to be at risk.
4. Provide a list of "recommendedActions" (up to 5). These should be highly actionable tasks (e.g. "Draft reply to Sarah Jenkins regarding Product Roadmap review", "Complete overdue mockup delivery", "Prepare for upcoming board meeting").
   - Assign a priority ("HIGH", "MEDIUM", "LOW").
   - Populate "refType" ("email", "commitment", "contact", "event", "general").
   - Populate "refId" with the matching ID from the context (e.g., message ID, commitment ID, or contact ID) to enable in-app linking.
5. All text fields should be clean, clear, and professional.
`;

  const ai = getGenAIClient();

  try {
    const text = await callGeminiWithTimeout(
      ai,
      {
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              executiveSummary: {
                type: "STRING",
                description: "A cohesive narrative summary of the day's focus, critical unread emails, and overdue tasks (strictly under 250 words).",
              },
              topRisks: {
                type: "ARRAY",
                description: "List of the most critical commitment risks currently outstanding.",
                items: {
                  type: "OBJECT",
                  properties: {
                    commitmentId: { type: "STRING", description: "The ID of the commitment associated with the risk." },
                    title: { type: "STRING", description: "The title of the commitment." },
                    riskLevel: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
                    reason: { type: "STRING", description: "A concise explanation of why this commitment is risky." },
                  },
                  required: ["commitmentId", "title", "riskLevel", "reason"],
                },
              },
              relationshipsAttention: {
                type: "ARRAY",
                description: "List of relationships that are at risk or need immediate touchpoints.",
                items: {
                  type: "OBJECT",
                  properties: {
                    contactId: { type: "STRING", description: "The ID of the contact." },
                    name: { type: "STRING", description: "The display name of the contact.", nullable: true },
                    email: { type: "STRING", description: "The email address of the contact." },
                    reason: { type: "STRING", description: "A short reason why this contact needs attention (e.g. no replies in 30 days)." },
                  },
                  required: ["contactId", "email", "reason"],
                },
              },
              recommendedActions: {
                type: "ARRAY",
                description: "Top recommended actions for the user to execute immediately.",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING", description: "A unique identifier for the action item." },
                    action: { type: "STRING", description: "The specific actionable task instruction." },
                    priority: { type: "STRING", enum: ["HIGH", "MEDIUM", "LOW"] },
                    refType: { type: "STRING", enum: ["email", "commitment", "contact", "general"] },
                    refId: { type: "STRING", description: "The related entity ID to link to.", nullable: true },
                  },
                  required: ["id", "action", "priority", "refType"],
                },
              },
            },
            required: ["executiveSummary", "topRisks", "relationshipsAttention", "recommendedActions"],
          },
        },
      },
      25_000 // 25 second timeout for this more complex query
    );

    const parsed = safeParseJSON<{
      executiveSummary: string;
      topRisks: ExecutiveBriefingDTO["topRisks"];
      relationshipsAttention: ExecutiveBriefingDTO["relationshipsAttention"];
      recommendedActions: ExecutiveBriefingDTO["recommendedActions"];
    }>(text, "executiveBriefing");

    if (!parsed) {
      // Graceful degradation: return a minimal briefing if AI response is malformed
      return {
        executiveSummary: "Unable to generate briefing at this time. Please try refreshing.",
        topRisks: [],
        relationshipsAttention: [],
        recommendedActions: [],
        generatedAt: now.toISOString(),
      };
    }

    return {
      executiveSummary: parsed.executiveSummary || "",
      topRisks: parsed.topRisks || [],
      relationshipsAttention: parsed.relationshipsAttention || [],
      recommendedActions: parsed.recommendedActions || [],
      generatedAt: now.toISOString(),
    };
  } catch (error: unknown) {
    console.error("Error during executive briefing generation with Gemini:", error);
    throw error;
  }
}
