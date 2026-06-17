import { prisma } from "@/lib/db";
import { generateMeetingBrief } from "@/services/meetingBrief";
import { corsair } from "@/lib/corsair";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Auth check — require CRON_SECRET bearer token
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 15 * 60_000); // 15 mins from now
  const windowEnd = new Date(now.getTime() + 45 * 60_000); // 45 mins from now

  // Find upcoming meetings
  const upcomingEvents = await prisma.calendarEvent.findMany({
    where: {
      startAt: {
        gte: windowStart,
        lte: windowEnd
      },
      status: { not: "CANCELLED" },
      isAllDay: false
    },
    include: {
      user: true
    }
  });

  const results: Array<{ eventId: string; userId: string; email: string; success: boolean; error?: string }> = [];

  for (const event of upcomingEvents) {
    // Check if we already sent a brief
    const metadata = event.metadata as any;
    if (metadata && metadata.meetingBriefSent) {
      continue;
    }

    try {
      const brief = await generateMeetingBrief(event.userId, event.id);

      const timeString = new Date(brief.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      const emailBody = [
        `Flux Meeting Brief: ${brief.meetingTitle}`,
        `Starts at: ${timeString}`,
        "",
        "══════════════════════════════════════",
        "RELATIONSHIP SUMMARY",
        "══════════════════════════════════════",
        brief.relationshipSummary,
        "",
        "══════════════════════════════════════",
        "RECENT CONVERSATIONS",
        "══════════════════════════════════════",
        brief.recentConversationSummary,
        "",
        "══════════════════════════════════════",
        "RISKS DETECTED",
        "══════════════════════════════════════",
        brief.risks.length > 0
          ? brief.risks.map((r, i) => `${i + 1}. [${r.riskLevel}] ${r.title} — ${r.reason}`).join("\n")
          : "No major risks detected.",
        "",
        "══════════════════════════════════════",
        "SUGGESTED TALKING POINTS",
        "══════════════════════════════════════",
        brief.suggestedTalkingPoints.length > 0
          ? brief.suggestedTalkingPoints.map((pt, i) => `${i + 1}. ${pt}`).join("\n")
          : "None.",
        "",
        "══════════════════════════════════════",
        "ACTION RECOMMENDATIONS",
        "══════════════════════════════════════",
        brief.actionRecommendations.length > 0
          ? brief.actionRecommendations.map((ar, i) => `${i + 1}. ${ar}`).join("\n")
          : "None.",
        "",
        "──────────────────────────────────────",
        "Sent by Flux Cognitive Layer",
      ].join("\n");

      const subject = `Meeting Briefing: ${brief.meetingTitle}`;
      const mime = [
        `From: ${event.user.email}`,
        `To: ${event.user.email}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        emailBody,
      ].join("\r\n");
      
      const raw = Buffer.from(mime).toString("base64url");
      const client = corsair.withTenant(event.userId) as any;
      await client.gmail.api.messages.send({ raw });

      // Mark as sent
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...(metadata || {}),
            meetingBriefSent: true
          }
        }
      });

      results.push({ eventId: event.id, userId: event.userId, email: event.user.email, success: true });
      console.info(`[Cron] Meeting brief sent to ${event.user.email} for event ${event.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Cron] Failed to send meeting brief for ${event.user.email} (event ${event.id}):`, err);
      results.push({ eventId: event.id, userId: event.userId, email: event.user.email, success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return NextResponse.json({
    ok: true,
    processed: results.length,
    successCount,
    failCount,
    results,
  });
}
