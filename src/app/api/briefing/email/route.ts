import { getCurrentUser } from "@/lib/currentUser";
import { generateExecutiveBriefing } from "@/services/executiveBriefing";
import { isDemoMode } from "@/services/demoMode";
import { corsair } from "@/lib/corsair";
import { NextResponse } from "next/server";

/**
 * POST /api/briefing/email
 * Generates the executive briefing and sends it to the current user's inbox via Gmail.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user && !(await isDemoMode())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Demo mode — return a mock success without touching Gmail
    if (await isDemoMode()) {
      return NextResponse.json({
        success: true,
        demo: true,
        message: "Daily briefing email simulated (demo mode — no real email sent).",
      });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate the executive briefing
    const briefing = await generateExecutiveBriefing(user.id);

    // Format the email body
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const topRisksText = briefing.topRisks.length > 0
      ? briefing.topRisks.map((r, i) => `${i + 1}. [${r.riskLevel}] ${r.title} — ${r.reason}`).join("\n")
      : "No high-risk commitments today.";

    const actionsText = briefing.recommendedActions.length > 0
      ? briefing.recommendedActions.map((a, i) => `${i + 1}. [${a.priority}] ${a.action}`).join("\n")
      : "No recommended actions.";

    const relationshipsText = briefing.relationshipsAttention.length > 0
      ? briefing.relationshipsAttention.map((r) => `• ${r.name ?? r.email}: ${r.reason}`).join("\n")
      : "All relationships are healthy.";

    const emailBody = [
      `ChiefOS Daily Briefing — ${dateStr}`,
      "",
      "═══════════════════════════════════════",
      "EXECUTIVE SUMMARY",
      "═══════════════════════════════════════",
      briefing.executiveSummary,
      "",
      "═══════════════════════════════════════",
      "TOP RISKS",
      "═══════════════════════════════════════",
      topRisksText,
      "",
      "═══════════════════════════════════════",
      "RECOMMENDED ACTIONS",
      "═══════════════════════════════════════",
      actionsText,
      "",
      "═══════════════════════════════════════",
      "RELATIONSHIPS NEEDING ATTENTION",
      "═══════════════════════════════════════",
      relationshipsText,
      "",
      "─────────────────────────────────────────",
      "Sent by ChiefOS Cognitive Layer",
      `Generated at ${briefing.generatedAt}`,
    ].join("\n");

    // Build raw MIME email
    const subject = `ChiefOS Daily Briefing — ${dateStr}`;
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
    const sent = await client.gmail.api.messages.send({ raw });

    return NextResponse.json({
      success: true,
      messageId: sent?.id,
      subject,
      message: `Daily briefing sent to ${user.email}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[Briefing Email] Failed to send:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
