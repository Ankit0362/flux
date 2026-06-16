import { prisma } from "../lib/db";
import { parseEmailAddress } from "../lib/emailUtils";
import { CommitmentStatus } from "@prisma/client";

export interface ContactMetrics {
  totalExchanges: number;
  inboundCount: number;
  outboundCount: number;
  openCommitments: number;
  completedCommitments: number;
  calendarMeetings: number;
  lastInteractionAt: Date | null;
}

export interface RelationshipIntelligence {
  score: number;
  health: "Strong" | "Neutral" | "At Risk";
  reason: string;
  metrics: ContactMetrics;
}

/**
 * Pure function to calculate relationship score, health, and reason for a contact.
 */
export function calculateRelationship(
  contactEmail: string,
  messages: Array<{ direction: string; sender: string; recipients: string[]; receivedAt: Date }>,
  commitments: Array<{ status: CommitmentStatus; dueDate: Date | null; createdAt: Date }>,
  calendarEvents: Array<{ startAt: Date; attendees: Array<{ email: string }> }> = []
): RelationshipIntelligence {
  const normalizedContactEmail = contactEmail.toLowerCase();

  // 1. Calculate exchanges
  let inboundCount = 0;
  let outboundCount = 0;
  let lastInteractionAt: Date | null = null;

  for (const msg of messages) {
    let matches = false;
    if (msg.direction === "INBOUND") {
      const { email: senderEmail } = parseEmailAddress(msg.sender);
      if (senderEmail === normalizedContactEmail) {
        inboundCount++;
        matches = true;
      }
    } else if (msg.direction === "OUTBOUND") {
      if (msg.recipients.some((r) => r.toLowerCase() === normalizedContactEmail)) {
        outboundCount++;
        matches = true;
      }
    }

    if (matches) {
      const msgDate = new Date(msg.receivedAt);
      if (!lastInteractionAt || msgDate > lastInteractionAt) {
        lastInteractionAt = msgDate;
      }
    }
  }

  // Count calendar meetings
  let calendarMeetings = 0;
  for (const event of calendarEvents) {
    if (event.attendees.some(a => a.email.toLowerCase() === normalizedContactEmail)) {
      calendarMeetings++;
      const eventDate = new Date(event.startAt);
      if (!lastInteractionAt || eventDate > lastInteractionAt) {
        lastInteractionAt = eventDate;
      }
    }
  }

  const totalExchanges = inboundCount + outboundCount + (calendarMeetings * 2); // Meetings carry double weight

  // 2. Calculate commitments
  let openCommitments = 0;
  let completedCommitments = 0;
  let overdueCommitments = 0;

  const now = new Date();

  for (const c of commitments) {
    if (c.status === CommitmentStatus.PENDING) {
      openCommitments++;
      if (c.dueDate && new Date(c.dueDate) < now) {
        overdueCommitments++;
      }
    } else if (c.status === CommitmentStatus.COMPLETED) {
      completedCommitments++;
    }
  }

  // 3. Score calculation (0-100)
  let score = 0;

  // A. Interaction frequency (up to 50 points)
  if (totalExchanges > 10) {
    score += 50;
  } else if (totalExchanges >= 6) {
    score += 40;
  } else if (totalExchanges >= 3) {
    score += 30;
  } else if (totalExchanges >= 1) {
    score += 15;
  }

  // B. Recency score (up to 30 points)
  let daysSinceLastInteraction: number | null = null;
  if (lastInteractionAt) {
    daysSinceLastInteraction = Math.floor(
      (now.getTime() - lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastInteraction <= 7) {
      score += 30;
    } else if (daysSinceLastInteraction <= 14) {
      score += 20;
    } else if (daysSinceLastInteraction <= 30) {
      score += 10;
    }
  }

  // C. Commitment score (up to 20 points)
  const totalAssociatedCommitments = openCommitments + completedCommitments;
  if (totalAssociatedCommitments === 0) {
    // Communication bonus for contacts without open/completed commitments
    score += 10;
  } else {
    // Reward completed commitments
    score += Math.min(20, completedCommitments * 10);
  }

  // D. Overdue penalty
  score -= Math.min(40, overdueCommitments * 20);

  // Clamp score
  const finalScore = Math.max(0, Math.min(100, score));

  // 4. Health determination
  let health: "Strong" | "Neutral" | "At Risk" = "Neutral";

  if (overdueCommitments > 0) {
    health = "At Risk";
  } else if (daysSinceLastInteraction !== null && daysSinceLastInteraction > 30) {
    health = "At Risk";
  } else if (totalExchanges === 0) {
    health = "At Risk"; // No exchanges is At Risk for lack of connection
  } else if (finalScore >= 70 && totalExchanges >= 3 && overdueCommitments === 0) {
    health = "Strong";
  }

  // 5. Explainable reasons
  let reason = "";
  if (health === "Strong") {
    reason = "Frequent recent interactions";
    if (calendarMeetings > 0) reason += " and scheduled meetings.";
    else if (completedCommitments > 0) reason += " and strong follow-through on commitments.";
    else reason += ".";
  } else if (health === "At Risk") {
    if (overdueCommitments > 0) {
      reason = "Overdue commitments require urgent attention.";
    } else if (daysSinceLastInteraction && daysSinceLastInteraction > 30) {
      reason = "Relationship is fading due to lack of recent contact.";
    } else {
      reason = "Low interaction frequency or imbalanced communication.";
    }
  } else {
    reason = "Moderate interaction frequency and open action items.";
  }

  return {
    score,
    health,
    reason,
    metrics: {
      totalExchanges,
      inboundCount,
      outboundCount,
      openCommitments,
      completedCommitments,
      calendarMeetings,
      lastInteractionAt,
    },
  };
}

/**
 * Service function to recalculate and update relationship metrics for all contacts of a user.
 */
export async function updateUserRelationships(userId: string): Promise<void> {
  // 1. Fetch all contacts for this user
  const contacts = await prisma.contact.findMany({
    where: { userId },
  });

  if (contacts.length === 0) return;

  // 2. Fetch all email messages for this user (via their threads)
  const messages = await prisma.emailMessage.findMany({
    where: {
      thread: { userId },
    },
    select: {
      direction: true,
      sender: true,
      recipients: true,
      receivedAt: true,
    },
  });

  // 3. Fetch all commitments for this user (excluding sentinels)
  const commitments = await prisma.commitment.findMany({
    where: {
      userId,
      title: { not: "NO_COMMITMENTS" },
    },
    select: {
      status: true,
      dueDate: true,
      createdAt: true,
      contactId: true,
    },
  });

  // 3.5 Fetch calendar events
  const calendarEvents = await prisma.calendarEvent.findMany({
    where: { userId },
    select: {
      startAt: true,
      attendees: { select: { email: true } },
    },
  });

  // 4. Recalculate each contact's relationship stats in-memory
  const updates: ReturnType<typeof prisma.contact.update>[] = [];

  for (const contact of contacts) {
    const contactCommitments = commitments.filter((c) => c.contactId === contact.id);

    const rel = calculateRelationship(contact.email, messages, contactCommitments, calendarEvents);

    // Only add to update batch if any fields have changed
    const hasChanged =
      contact.relationshipScore !== rel.score ||
      contact.relationshipHealth !== rel.health ||
      contact.relationshipReason !== rel.reason ||
      contact.totalExchanges !== rel.metrics.totalExchanges ||
      contact.inboundCount !== rel.metrics.inboundCount ||
      contact.outboundCount !== rel.metrics.outboundCount ||
      contact.openCommitments !== rel.metrics.openCommitments ||
      contact.completedCommitments !== rel.metrics.completedCommitments ||
      (contact.lastInteractionAt?.getTime() ?? 0) !== (rel.metrics.lastInteractionAt?.getTime() ?? 0);

    if (hasChanged) {
      updates.push(
        prisma.contact.update({
          where: { id: contact.id },
          data: {
            relationshipScore: rel.score,
            relationshipHealth: rel.health,
            relationshipReason: rel.reason,
            totalExchanges: rel.metrics.totalExchanges,
            inboundCount: rel.metrics.inboundCount,
            outboundCount: rel.metrics.outboundCount,
            openCommitments: rel.metrics.openCommitments,
            completedCommitments: rel.metrics.completedCommitments,
            lastInteractionAt: rel.metrics.lastInteractionAt,
          },
        })
      );
    }
  }

  // Execute all updates in chunks without transaction to avoid timeouts
  if (updates.length > 0) {
    const chunkSize = 10;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      await Promise.all(chunk);
    }
  }
}
