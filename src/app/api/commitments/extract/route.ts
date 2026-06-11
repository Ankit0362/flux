import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { extractCommitmentsFromMessage } from "@/services/commitmentExtraction";
import { persistCommitments } from "@/services/commitmentPersistence";
import { CommitmentDTO } from "@/types/commitments";
import { updateUserCommitmentsRisk, parseCommitmentMetadata } from "@/services/commitmentRisk";

export async function POST(request: NextRequest) {
  try {
    // 1. Fetch the primary user (MVP single-user fallback)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { threadId } = body;
    if (!threadId) {
      return NextResponse.json({ error: "Missing 'threadId' field in request body" }, { status: 400 });
    }

    // 3. Find the thread and its messages
    const thread = await prisma.emailThread.findFirst({
      where: { id: threadId, userId: user.id },
      include: {
        messages: {
          orderBy: { receivedAt: "asc" },
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const allNewCommitments = [];

    // 4. Iterate over messages and extract commitments
    for (const message of thread.messages) {
      // Check if message was already processed for commitments (either has actual commitments or a sentinel)
      const existingCommitment = await prisma.commitment.findFirst({
        where: { emailMessageId: message.id },
      });

      if (existingCommitment) {
        // Skip already processed messages
        continue;
      }

      // Run extraction
      const candidates = await extractCommitmentsFromMessage({
        id: message.id,
        subject: message.subject,
        body: message.body,
        sender: message.sender,
        recipients: message.recipients,
        receivedAt: message.receivedAt,
      });

      // Persist extraction results (this also automatically generates sentinels if needed)
      const persisted = await persistCommitments(candidates, message, user.id);

      // Filter out sentinel records (NO_COMMITMENTS) from the API response list
      const actualCommitments = persisted.filter((c) => c.title !== "NO_COMMITMENTS");
      allNewCommitments.push(...actualCommitments);
    }

    // Recalculate risk scores if new commitments were persisted
    if (allNewCommitments.length > 0) {
      await updateUserCommitmentsRisk(user.id);

      // Re-fetch the commitments with updated risk scores
      const updatedCommitments = await prisma.commitment.findMany({
        where: {
          id: { in: allNewCommitments.map((c) => c.id) },
        },
      });

      allNewCommitments.splice(0, allNewCommitments.length, ...updatedCommitments);
    }

    // 5. Format outputs to match TypeScript DTOs
    const formattedCommitments: CommitmentDTO[] = allNewCommitments.map((c) => {
      const metadata = parseCommitmentMetadata(c.metadata);
      const confidence = typeof metadata.confidence === "number" ? metadata.confidence : 0.0;
      const direction = metadata.direction || "INBOUND";

      // Find original message details for SourceEmailDTO
      const sourceMsg = thread.messages.find((m) => m.id === c.emailMessageId);
      const sourceEmail = sourceMsg
        ? {
            id: sourceMsg.id,
            externalId: sourceMsg.externalId,
            sender: sourceMsg.sender,
            recipients: sourceMsg.recipients,
            subject: sourceMsg.subject,
            body: sourceMsg.body,
            receivedAt: sourceMsg.receivedAt.toISOString(),
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

    return NextResponse.json({
      success: true,
      commitments: formattedCommitments,
      count: formattedCommitments.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to extract commitments for thread:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
