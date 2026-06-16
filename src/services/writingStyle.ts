import { prisma } from "@/lib/db";
import { getGenAIClient, callGeminiWithTimeout, safeParseJSON } from "@/lib/gemini";

export interface WritingStyleProfile {
  tone: string;
  greeting: string;
  signoff: string;
  sentenceStyle: string;
  commonPhrases: string[];
  promptSnippet: string;
}

export async function buildWritingStyleProfile(userId: string): Promise<WritingStyleProfile> {
  const messages = await prisma.emailMessage.findMany({
    where: {
      direction: "OUTBOUND",
      thread: { userId },
      body: { not: "" },
    },
    orderBy: { receivedAt: "desc" },
    take: 20,
    select: { body: true },
  });

  const fallback: WritingStyleProfile = {
    tone: "concise, warm, and professional",
    greeting: "Hi",
    signoff: "Best",
    sentenceStyle: "short paragraphs with direct asks",
    commonPhrases: [],
    promptSnippet:
      "Write in a concise, warm, professional voice. Use short paragraphs, a clear ask, and a simple sign-off.",
  };

  if (messages.length < 3 || !process.env.GEMINI_API_KEY) {
    return fallback;
  }

  try {
    const ai = getGenAIClient();
    const text = await callGeminiWithTimeout(ai, {
      model: "gemini-2.5-flash",
      contents: `Analyze these sent emails and return JSON only.
Do not copy sensitive specifics. Summarize reusable style traits.
Emails:
${messages.map((m, i) => `EMAIL ${i + 1}:\n${m.body.slice(0, 1200)}`).join("\n\n")}
Schema: {"tone":"string","greeting":"string","signoff":"string","sentenceStyle":"string","commonPhrases":["string"],"promptSnippet":"string"}`,
    });
    const parsed = safeParseJSON<WritingStyleProfile>(text, "writing-style");
    return parsed?.promptSnippet ? parsed : fallback;
  } catch (error) {
    console.warn("[WritingStyle] Profile generation failed:", error);
    return fallback;
  }
}
