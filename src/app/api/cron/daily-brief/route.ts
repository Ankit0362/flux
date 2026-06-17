import { prisma } from "@/lib/db";
import { generateExecutiveBriefing } from "@/services/executiveBriefing";
import { corsair } from "@/lib/corsair";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/daily-brief
 *
 * Protected cron endpoint: iterates all users and sends each one a daily
 * briefing email via their connected Gmail account.
 *
 * Protect this with an Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Set CRON_SECRET in your .env file and in your cron scheduler.
 * Example Vercel cron config (vercel.json):
 *   { "crons": [{ "path": "/api/cron/daily-brief", "schedule": "0 7 * * 1-5" }] }
 */
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

  // Fetch all users with connected Gmail accounts
  const users = await prisma.user.findMany({
    where: { email: { not: "" } },
    select: { id: true, email: true, name: true },
  });

  const results: Array<{ userId: string; email: string; success: boolean; error?: string }> = [];

  for (const user of users) {
    try {
      const briefing = await generateExecutiveBriefing(user.id);

      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

      const topRisksText = briefing.topRisks.length > 0
        ? briefing.topRisks.map((r, i) => `${i + 1}. [${r.riskLevel}] ${r.title} — ${r.reason}`).join("\n")
        : "No high-risk commitments today.";

      const actionsText = briefing.recommendedActions.length > 0
        ? briefing.recommendedActions.map((a, i) => `${i + 1}. [${a.priority}] ${a.action}`).join("\n")
        : "No recommended actions.";

      const emailBody = [
        `Flux Daily Briefing — ${dateStr}`,
        "",
        "══════════════════════════════════════",
        "EXECUTIVE SUMMARY",
        "══════════════════════════════════════",
        briefing.executiveSummary,
        "",
        "══════════════════════════════════════",
        "TOP RISKS",
        "══════════════════════════════════════",
        topRisksText,
        "",
        "══════════════════════════════════════",
        "RECOMMENDED ACTIONS",
        "══════════════════════════════════════",
        actionsText,
        "",
        "──────────────────────────────────────",
        "Sent by Flux Cognitive Layer",
        `Generated at ${briefing.generatedAt}`,
      ].join("\n");

      const subject = `Flux Daily Briefing — ${dateStr}`;
      const mime = [
        `From: ${user.email}`,
        `To: ${user.email}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        emailBody,
      ].join("\r\n");
      const raw = Buffer.from(mime).toString("base64url");

      const client = corsair.withTenant(user.id) as any;
      await client.gmail.api.messages.send({ raw });

      results.push({ userId: user.id, email: user.email, success: true });
      console.info(`[Cron] Daily brief sent to ${user.email}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Cron] Failed to send daily brief for ${user.email}:`, err);
      results.push({ userId: user.id, email: user.email, success: false, error: message });
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
