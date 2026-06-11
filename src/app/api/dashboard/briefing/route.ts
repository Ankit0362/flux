import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { CommitmentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { CommitmentDTO } from "@/types/commitments";
import { updateUserCommitmentsRisk, parseCommitmentMetadata } from "@/services/commitmentRisk";
import { updateUserRelationships } from "@/services/relationshipIntelligence";
import { isDemoMode } from "@/services/demoMode";
import { demoStore } from "@/services/demoData";

export async function GET(request: NextRequest) {
  try {
    // Intercept if in Demo Mode
    if (await isDemoMode()) {
      return NextResponse.json(demoStore.getBriefingData());
    }
    // 1. Fetch the primary user (MVP single-user fallback)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch unread email threads count
    const unreadEmailCount = await prisma.emailThread.count({
      where: {
        userId: user.id,
        labels: { has: "UNREAD" },
      },
    });

    // 3. Recalculate risk scores and relationship intelligence in PARALLEL
    // (was sequential — this saves ~50% of dashboard cold-load time)
    await Promise.all([
      updateUserCommitmentsRisk(user.id),
      updateUserRelationships(user.id),
    ]);

    // 4. Fetch all commitments for the user (excluding sentinels)
    const commitments = await prisma.commitment.findMany({
      where: {
        userId: user.id,
        title: { not: "NO_COMMITMENTS" },
      },
      include: {
        emailMessage: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 5. Format commitments to CommitmentDTO objects
    const formattedCommitments: CommitmentDTO[] = commitments.map((c) => {
      const metadata = parseCommitmentMetadata(c.metadata);
      const confidence = typeof metadata.confidence === "number" ? metadata.confidence : 0.0;
      const direction = metadata.direction || "INBOUND";

      const sourceEmail = c.emailMessage
        ? {
            id: c.emailMessage.id,
            externalId: c.emailMessage.externalId,
            sender: c.emailMessage.sender,
            recipients: c.emailMessage.recipients,
            subject: c.emailMessage.subject,
            // PERF-03: Only return a snippet, not the full 100KB email body
            body: c.emailMessage.body.substring(0, 200),
            receivedAt: c.emailMessage.receivedAt.toISOString(),
          }
        : null;

      return {
        id: c.id,
        title: c.title,
        dueDate: c.dueDate ? c.dueDate.toISOString() : null,
        status: c.status,
        confidence,
        direction,
        sourceEmail,
        source: sourceEmail,
        riskScore: c.riskScore,
        riskLevel: c.riskLevel as "LOW" | "MEDIUM" | "HIGH",
        riskReason: c.riskReason,
      };
    });

    // 5. Compute counts
    const pending = formattedCommitments.filter((c) => c.status === CommitmentStatus.PENDING);
    const completed = formattedCommitments.filter((c) => c.status === CommitmentStatus.COMPLETED);
    const snoozed = formattedCommitments.filter((c) => c.status === CommitmentStatus.SNOOZED);

    const now = new Date();
    const overdue = pending.filter((c) => c.dueDate && new Date(c.dueDate) < now);

    // 6. Generate lists
    // Recent commitments: 5 latest created
    const recentCommitments = formattedCommitments.slice(0, 5);

    // High confidence commitments: confidence >= 0.8, sorted by confidence desc, max 5
    const highConfidenceCommitments = formattedCommitments
      .filter((c) => c.confidence >= 0.8)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    // Upcoming deadlines: pending commitments with due date in the future, sorted by due date asc, max 5
    const upcomingDeadlines = pending
      .filter((c) => c.dueDate && new Date(c.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);

    // 6.5. Fetch Calendar Stats
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingEvents = await prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        startAt: { gte: now, lte: weekEnd },
        status: { not: "CANCELLED" }
      },
      include: { attendees: true },
      orderBy: { startAt: "asc" }
    });

    const todayEvents = upcomingEvents.filter(e => e.startAt >= todayStart && e.startAt < todayEnd);
    const nextEvent = upcomingEvents.length > 0 ? {
      title: upcomingEvents[0].title,
      startAt: upcomingEvents[0].startAt.toISOString(),
      attendeeCount: upcomingEvents[0].attendees.length
    } : null;

    // A simple conflict count (events starting within the same hour)
    let conflictCount = 0;
    for (let i = 0; i < upcomingEvents.length - 1; i++) {
      if (upcomingEvents[i].endAt > upcomingEvents[i+1].startAt) {
        conflictCount++;
      }
    }

    const calendarStats = {
      todayEventCount: todayEvents.length,
      nextEvent,
      upcomingWeekCount: upcomingEvents.length,
      conflictCount
    };

    // 7. Fetch relationship intelligence data
    const allContacts = await prisma.contact.findMany({
      where: { userId: user.id },
      orderBy: { relationshipScore: "desc" },
    });

    const strongCount = allContacts.filter((c) => c.relationshipHealth === "Strong").length;
    const neutralCount = allContacts.filter((c) => c.relationshipHealth === "Neutral").length;
    const atRiskCount = allContacts.filter((c) => c.relationshipHealth === "At Risk").length;

    // Top 5 contacts by score, and up to 5 At Risk contacts
    const topContacts = allContacts.slice(0, 5).map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      relationshipScore: c.relationshipScore ?? 0,
      relationshipHealth: c.relationshipHealth ?? "Neutral",
      relationshipReason: c.relationshipReason ?? "",
      totalExchanges: c.totalExchanges,
      inboundCount: c.inboundCount,
      outboundCount: c.outboundCount,
      openCommitments: c.openCommitments,
      completedCommitments: c.completedCommitments,
      lastInteractionAt: c.lastInteractionAt ? c.lastInteractionAt.toISOString() : null,
    }));

    const atRiskContacts = allContacts
      .filter((c) => c.relationshipHealth === "At Risk")
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        relationshipScore: c.relationshipScore ?? 0,
        relationshipHealth: c.relationshipHealth ?? "At Risk",
        relationshipReason: c.relationshipReason ?? "",
        totalExchanges: c.totalExchanges,
        inboundCount: c.inboundCount,
        outboundCount: c.outboundCount,
        openCommitments: c.openCommitments,
        completedCommitments: c.completedCommitments,
        lastInteractionAt: c.lastInteractionAt ? c.lastInteractionAt.toISOString() : null,
      }));

    return NextResponse.json({
      userName: user.name || user.email.split("@")[0],
      userEmail: user.email,
      unreadEmailCount,
      stats: {
        pendingCount: pending.length,
        completedCount: completed.length,
        overdueCount: overdue.length,
        snoozedCount: snoozed.length,
        totalCount: formattedCommitments.length,
      },
      relationships: {
        totalContacts: allContacts.length,
        strongCount,
        neutralCount,
        atRiskCount,
        topContacts,
        atRiskContacts,
      },
      lists: {
        recentCommitments,
        highConfidenceCommitments,
        upcomingDeadlines,
      },
      calendarStats,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to fetch briefing data:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
