import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { parseEmailAddress } from "@/lib/emailUtils";
import { getGenAIClient, callGeminiWithTimeout, safeParseJSON } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Fetch next unprocessed thread (has INBOX or UNREAD, is not snoozed or archived)
    // For simplicity we will just grab the oldest updated thread with "INBOX"
    const threads = await prisma.emailThread.findMany({
      where: {
        userId: user.id,
        labels: { has: "INBOX" }
      },
      include: {
        messages: { orderBy: { receivedAt: "asc" } },
        commitments: true,
      },
      orderBy: {
        updatedAt: "asc"
      }
    });

    // Filter out snoozed threads
    const nextThread = threads.find(t => {
      const meta = (t.metadata as Record<string, any>) || {};
      if (meta.fluxSnooze) return false;
      return true;
    });

    if (!nextThread) {
      return NextResponse.json({ thread: null, message: "Inbox Zero reached." });
    }

    // 2. Compute Triage Intelligence
    const latestMessage = nextThread.messages[nextThread.messages.length - 1];

    // Gather unique participants to get Relationship Health
    const participantEmails = new Set<string>();
    for (const msg of nextThread.messages) {
      const { email: senderEmail } = parseEmailAddress(msg.sender);
      if (senderEmail && senderEmail.toLowerCase() !== user.email.toLowerCase()) {
        participantEmails.add(senderEmail.toLowerCase());
      }
      for (const r of msg.recipients) {
        const { email: rEmail } = parseEmailAddress(r);
        if (rEmail && rEmail.toLowerCase() !== user.email.toLowerCase()) {
          participantEmails.add(rEmail.toLowerCase());
        }
      }
    }

    const contacts = await prisma.contact.findMany({
      where: {
        userId: user.id,
        email: { in: Array.from(participantEmails) },
      },
    });

    const averageRelationshipScore = contacts.length > 0 
      ? contacts.reduce((sum, c) => sum + (c.relationshipScore || 50), 0) / contacts.length
      : 50;

    // AI Summary using Gemini
    let aiSummary = "No summary available.";
    try {
      const messageHistory = nextThread.messages
        .slice(-4) 
        .map(m => `From: ${m.sender}\nBody: ${m.body.slice(0, 500)}`)
        .join("\n\n");

      const ai = getGenAIClient();
      const prompt = `Provide a 2-sentence executive summary of the following email thread:\n\n${messageHistory}`;
      
      const summaryText = await callGeminiWithTimeout(ai, {
        model: "gemini-2.0-flash",
        contents: prompt
      }, 10_000);
      
      aiSummary = summaryText || aiSummary;
    } catch (e) {
      console.warn("Failed to generate AI summary for triage:", e);
    }

    // Risk Score (Use max risk score from commitments, or fallback)
    const openCommitments = nextThread.commitments.filter((c: any) => c.status === "PENDING");
    let riskScore = 0;
    if (openCommitments.length > 0) {
      riskScore = Math.max(...openCommitments.map(c => c.riskScore || 0));
    }

    // Scheduling Intent (From Metadata)
    const meta = (nextThread.metadata as Record<string, any>) || {};
    const schedulingIntent = meta.schedulingIntent || null;

    const payload = {
      thread: nextThread,
      intelligence: {
        aiSummary,
        riskScore,
        averageRelationshipScore,
        openCommitments,
        schedulingIntent,
        contacts
      }
    };

    return NextResponse.json(payload);

  } catch (err: unknown) {
    console.error("Triage next error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
