import { prisma } from "@/lib/db";
import { CommitmentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { CommitmentDTO } from "@/types/commitments";
import { parseCommitmentMetadata } from "@/services/commitmentRisk";
import { getCurrentUser } from "@/lib/currentUser";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Await params in Next.js 15+
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing commitment ID in path" }, { status: 400 });
    }

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // TS-05: Validate status is a string before calling .toUpperCase()
    if (!body || typeof body !== "object" || !("status" in body)) {
      return NextResponse.json({ error: "Missing 'status' field in request body" }, { status: 400 });
    }
    const { status } = body as Record<string, unknown>;
    if (typeof status !== "string") {
      return NextResponse.json({ error: "'status' must be a string" }, { status: 400 });
    }

    const targetStatus = status.toUpperCase();

    // 3. Validate target status is allowed
    if (
      targetStatus !== CommitmentStatus.COMPLETED &&
      targetStatus !== CommitmentStatus.SNOOZED
    ) {
      return NextResponse.json(
        {
          error: `Invalid target status. Only COMPLETED or SNOOZED are allowed. Received: '${status}'`,
        },
        { status: 400 }
      );
    }

    // Intercept if in Demo Mode
    const { isDemoMode } = await import("@/services/demoMode");
    const { demoStore } = await import("@/services/demoData");
    if (await isDemoMode()) {
      demoStore.updateCommitmentStatus(id, targetStatus as CommitmentStatus);
      const c = demoStore.commitments.find((x) => x.id === id);
      if (!c) {
        return NextResponse.json({ error: `Commitment not found: '${id}'` }, { status: 404 });
      }
      return NextResponse.json({
        commitment: {
          id: c.id,
          title: c.title,
          dueDate: c.dueDate ? c.dueDate.toISOString() : null,
          status: c.status,
          confidence: c.confidence,
          direction: c.direction,
          sourceEmail: null,
          source: null,
          riskScore: c.riskScore,
          riskLevel: c.riskLevel as "LOW" | "MEDIUM" | "HIGH",
          riskReason: c.riskReason,
        },
      });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 4. Fetch existing commitment
    const commitment = await prisma.commitment.findFirst({
      where: { id, userId: user.id },
      include: {
        emailMessage: true,
      },
    });

    if (!commitment) {
      return NextResponse.json({ error: `Commitment not found with ID: '${id}'` }, { status: 404 });
    }

    // 5. Enforce transition constraint: current status must be PENDING
    if (commitment.status !== CommitmentStatus.PENDING) {
      return NextResponse.json(
        {
          error: `Only commitments in PENDING status can be updated. Current status: '${commitment.status}'`,
        },
        { status: 400 }
      );
    }

    // 6. Update status in database
    const updated = await prisma.commitment.update({
      where: { id, userId: user.id },
      data: {
        status: targetStatus as CommitmentStatus,
        completedAt: targetStatus === CommitmentStatus.COMPLETED ? new Date() : null,
        riskScore: 0,
        riskLevel: "LOW",
        riskReason: targetStatus === CommitmentStatus.COMPLETED ? "Commitment is not pending." : "Commitment is not pending.",
      },
      include: {
        emailMessage: true,
      },
    });

    // 7. Format updated commitment to match CommitmentDTO
    const metadata = parseCommitmentMetadata(updated.metadata);
    const confidence = typeof metadata.confidence === "number" ? metadata.confidence : 0.0;
    const direction = metadata.direction || "INBOUND";

    const sourceEmail = updated.emailMessage
      ? {
          id: updated.emailMessage.id,
          externalId: updated.emailMessage.externalId,
          sender: updated.emailMessage.sender,
          recipients: updated.emailMessage.recipients,
          subject: updated.emailMessage.subject,
          body: updated.emailMessage.body,
          receivedAt: updated.emailMessage.receivedAt.toISOString(),
        }
      : null;

    const formattedCommitment: CommitmentDTO = {
      id: updated.id,
      title: updated.title,
      dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
      status: updated.status,
      confidence,
      direction,
      sourceEmail,
      source: sourceEmail,
      riskScore: updated.riskScore,
      riskLevel: updated.riskLevel as "LOW" | "MEDIUM" | "HIGH",
      riskReason: updated.riskReason,
    };

    return NextResponse.json({ commitment: formattedCommitment });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to update commitment status:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
