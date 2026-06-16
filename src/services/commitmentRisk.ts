import { prisma } from "../lib/db";
import { CommitmentStatus, EmailDirection } from "@prisma/client";

// TS-02: Typed interface for commitment metadata stored in the JSON column.
// Replaces all (c.metadata || {}) as any casts.
export interface CommitmentMetadata {
  confidence?: number;
  direction?: "INBOUND" | "OUTBOUND";
  fingerprint?: string;
  sentinel?: boolean;
  rawSnippet?: string;
  priority?: "low" | "medium" | "high";
  reasoning?: string;
}

export function parseCommitmentMetadata(raw: unknown): CommitmentMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as CommitmentMetadata;
}

export interface RiskOutput {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskReason: string | null;
}

/**
 * Calculates risk score, level, and reasons list for a commitment based on 5 risk factors.
 *
 * @param commitment The commitment details including status, dueDate, createdAt, and metadata.
 * @param threadMessages The list of email messages associated with the related thread.
 * @param now The current time (defaults to new Date()).
 * @returns The computed risk attributes.
 */
export function calculateCommitmentRisk(
  commitment: {
    status: CommitmentStatus;
    dueDate: Date | null;
    createdAt: Date;
    metadata: unknown; // Use unknown instead of any for type safety
  },
  threadMessages: Array<{
    direction: EmailDirection;
    receivedAt: Date;
  }>,
  now: Date = new Date()
): RiskOutput {
  if (commitment.status !== CommitmentStatus.PENDING) {
    return {
      riskScore: 0,
      riskLevel: "LOW",
      riskReason: "Commitment is not pending.",
    };
  }

  let score = 0;
  const reasons: string[] = [];

  // 1. Overdue due date (Weight: 40)
  if (commitment.dueDate && new Date(commitment.dueDate) < now) {
    score += 40;
    reasons.push("Due date is overdue");
  } 
  // 2. Due date approaching within 24h (Weight: 30)
  else if (commitment.dueDate) {
    const dueTime = new Date(commitment.dueDate).getTime();
    const nowTime = now.getTime();
    const diffHours = (dueTime - nowTime) / (1000 * 60 * 60);
    if (diffHours >= 0 && diffHours <= 24) {
      score += 30;
      reasons.push("Due date is approaching within 24h");
    }
  }

  // 3. High confidence commitment (Weight: 10)
  const metadata = parseCommitmentMetadata(commitment.metadata);
  const confidence = typeof metadata.confidence === "number" ? metadata.confidence : 0.0;
  if (confidence >= 0.8) {
    score += 10;
    reasons.push("High confidence commitment");
  }

  // Sort thread messages in descending order (newest first)
  const sortedMessages = [...threadMessages].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );

  // 4. Multiple inbound emails without response (Weight: 20)
  let consecutiveInbound = 0;
  for (const msg of sortedMessages) {
    if (msg.direction === "INBOUND") {
      consecutiveInbound++;
    } else if (msg.direction === "OUTBOUND") {
      break;
    }
  }
  if (consecutiveInbound >= 2) {
    score += 20;
    reasons.push(`${consecutiveInbound} inbound emails without reply`);
  }

  // 5. No activity after commitment creation (Weight: 15)
  // Flagged if commitment created > 48h ago and no message received/sent in thread after creation
  const ageInHours = (now.getTime() - new Date(commitment.createdAt).getTime()) / (1000 * 60 * 60);
  if (ageInHours > 48) {
    const hasActivity = sortedMessages.some(
      (msg) => new Date(msg.receivedAt).getTime() > new Date(commitment.createdAt).getTime()
    );
    if (!hasActivity) {
      score += 15;
      reasons.push("No thread activity since creation");
    }
  }

  // Cap the score at 100
  const finalScore = Math.min(100, score);

  // Determine the risk level
  let level: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (finalScore >= 70) {
    level = "HIGH";
  } else if (finalScore >= 35) {
    level = "MEDIUM";
  }

  return {
    riskScore: finalScore,
    riskLevel: level,
    riskReason: reasons.length > 0 ? reasons.join(", ") : "No significant risk factors active.",
  };
}

/**
 * Service function to recalculate and update risk parameters for all commitments of a user.
 * Usually called prior to returning commitments to ensure data matches current time.
 * 
 * @param userId The ID of the user.
 */
export async function updateUserCommitmentsRisk(userId: string): Promise<void> {
  // 1. Fetch all PENDING commitments for this user with thread messages
  const pendingCommitments = await prisma.commitment.findMany({
    where: {
      userId,
      status: CommitmentStatus.PENDING,
      title: { not: "NO_COMMITMENTS" },
    },
    include: {
      emailThread: {
        include: {
          messages: {
            select: {
              direction: true,
              receivedAt: true,
            },
          },
        },
      },
    },
  });

  const now = new Date();

  // 2. Batch recalculations and collect updates
  const riskUpdates: ReturnType<typeof prisma.commitment.update>[] = [];

  for (const c of pendingCommitments) {
    const messages = c.emailThread?.messages || [];
    const risk = calculateCommitmentRisk(c, messages, now);

    // Only queue update if any risk metrics have changed
    if (
      c.riskScore !== risk.riskScore ||
      c.riskLevel !== risk.riskLevel ||
      c.riskReason !== risk.riskReason
    ) {
      riskUpdates.push(
        prisma.commitment.update({
          where: { id: c.id },
          data: {
            riskScore: risk.riskScore,
            riskLevel: risk.riskLevel,
            riskReason: risk.riskReason,
          },
        })
      );
    }
  }

  // Execute all risk updates in chunks without transaction to avoid timeouts
  if (riskUpdates.length > 0) {
    const chunkSize = 10;
    for (let i = 0; i < riskUpdates.length; i += chunkSize) {
      const chunk = riskUpdates.slice(i, i + chunkSize);
      await Promise.all(chunk);
    }
  }

  // 3. Reset risk for any COMPLETED or SNOOZED commitments if they don't already match defaults
  await prisma.commitment.updateMany({
    where: {
      userId,
      status: { not: CommitmentStatus.PENDING },
      OR: [
        { riskScore: { not: 0 } },
        { riskLevel: { not: "LOW" } },
      ],
    },
    data: {
      riskScore: 0,
      riskLevel: "LOW",
      riskReason: "Commitment is not pending.",
    },
  });
}
