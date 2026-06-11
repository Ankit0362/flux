import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ContactInsightDTO } from "@/types/contacts";

const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Intercept if in Demo Mode
    const { isDemoMode } = await import("@/services/demoMode");
    const { demoStore } = await import("@/services/demoData");
    if (await isDemoMode()) {
      const insight = demoStore.getContactInsight(id);
      if (!insight) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
      return NextResponse.json(insight);
    }

    // 1. Resolve user (MVP single-user fallback)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch Contact details
    const contact = await prisma.contact.findFirst({
      where: { id, userId: user.id },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // 3. Fetch Commitments for this contact
    const commitments = await prisma.commitment.findMany({
      where: { contactId: id, userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // 4. Fetch recent messages involving this contact's email
    const messages = await prisma.emailMessage.findMany({
      where: {
        thread: { userId: user.id },
        OR: [
          { sender: { contains: contact.email } },
          { recipients: { has: contact.email } },
        ],
      },
      orderBy: { receivedAt: "desc" },
      take: 10,
    });

    // 5. Generate prompt context
    const commitmentsContext = commitments
      .map((c, i) => {
        return `[Commitment #${i + 1}] Title: ${c.title} | Status: ${c.status} | Risk Level: ${c.riskLevel} | Due Date: ${
          c.dueDate ? c.dueDate.toISOString().split("T")[0] : "None"
        }`;
      })
      .join("\n");

    const messagesContext = messages
      .map((m, i) => {
        const direction = m.direction;
        const date = m.receivedAt.toISOString().split("T")[0];
        const subject = m.subject;
        const truncatedBody = m.body.length > 300 ? m.body.substring(0, 300) + "..." : m.body;
        return `[Message #${i + 1}] Direction: ${direction} | Date: ${date} | Subject: ${subject}\nBody Snippet: ${truncatedBody.replace(/\s+/g, " ").trim()}`;
      })
      .join("\n\n");

    const prompt = `
You are an elite Chief of Staff AI. Analyze the relationship between the user and this contact:
Contact Name: ${contact.name || "Unknown"}
Contact Email: ${contact.email}
Contact Company: ${contact.company || "Unknown"}
Relationship Health: ${contact.relationshipHealth || "Neutral"}
Relationship Score: ${contact.relationshipScore || 0}
Reasoning behind health: ${contact.relationshipReason || "None"}

--- ASSOCIATED COMMITMENTS ---
${commitmentsContext || "No commitments recorded for this contact."}

--- RECENT COMMUNICATIONS ---
${messagesContext || "No email communication history."}

INSTRUCTIONS:
1. Synthesize this data to produce a relationship "insight" (strictly under 180 words). Focus on what has been accomplished, what is currently outstanding, potential bottlenecks, and the general communication tone/recency.
2. Provide a list of "recommendedActions" (up to 3). These should be highly actionable tasks (e.g. "Send reply to check on the Q3 roadmap mockups", "Mark the overdue feedback promise completed").
3. Assess the "relationshipRisk" level ("LOW", "MEDIUM", "HIGH").
`;

    // 6. Call Gemini
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            insight: {
              type: "STRING",
              description: "A synthesized briefing of the relationship dynamic and outstanding matters (strictly under 180 words).",
            },
            recommendedActions: {
              type: "ARRAY",
              description: "Highly actionable steps for the user to maintain or improve this relationship.",
              items: { type: "STRING" },
            },
            relationshipRisk: {
              type: "STRING",
              enum: ["LOW", "MEDIUM", "HIGH"],
              description: "The risk level representing the current status and pending deliverables.",
            },
          },
          required: ["insight", "recommendedActions", "relationshipRisk"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response received from Gemini.");
    }

    const parsed = JSON.parse(text);
    const result: ContactInsightDTO = {
      insight: parsed.insight || "",
      recommendedActions: parsed.recommendedActions || [],
      relationshipRisk: parsed.relationshipRisk || "LOW",
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to generate contact relationship insight:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
