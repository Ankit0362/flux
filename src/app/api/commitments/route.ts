import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { CommitmentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { CommitmentDTO } from "@/types/commitments";
import { updateUserCommitmentsRisk, parseCommitmentMetadata } from "@/services/commitmentRisk";

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch the primary user (MVP single-user fallback)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    let status: CommitmentStatus | undefined = undefined;

    if (statusParam) {
      const upperStatus = statusParam.toUpperCase();
      if (
        upperStatus === CommitmentStatus.PENDING ||
        upperStatus === CommitmentStatus.COMPLETED ||
        upperStatus === CommitmentStatus.SNOOZED
      ) {
        status = upperStatus as CommitmentStatus;
      } else {
        return NextResponse.json(
          {
            error: `Invalid status parameter. Must be one of: PENDING, COMPLETED, SNOOZED. Received: '${statusParam}'`,
          },
          { status: 400 }
        );
      }
    }

    // 3. Recalculate risk scores dynamically for this user
    await updateUserCommitmentsRisk(user.id);

    // 4. Query commitments for this user (excluding NO_COMMITMENTS sentinel records)
    const commitments = await prisma.commitment.findMany({
      where: {
        userId: user.id,
        title: { not: "NO_COMMITMENTS" },
        ...(status ? { status } : {}),
      },
      include: {
        emailMessage: true,
      },
      orderBy: [
        { riskScore: "desc" },
        { createdAt: "desc" },
      ],
    });

    // 5. Format outputs to match TypeScript DTOs
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
            body: c.emailMessage.body,
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

    return NextResponse.json({ commitments: formattedCommitments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to fetch commitments:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
