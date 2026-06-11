import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { ContactDetailDTO, ThreadSummary } from "@/types/contacts";
import { CommitmentDTO } from "@/types/commitments";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Intercept if in Demo Mode
    const { isDemoMode } = await import("@/services/demoMode");
    const { demoStore } = await import("@/services/demoData");
    if (await isDemoMode()) {
      const details = demoStore.getContactDetail(id);
      if (!details) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
      return NextResponse.json(details);
    }

    // 1. Resolve user (MVP single-user fallback)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch Contact details
    const contact = await prisma.contact.findFirst({
      where: { id, userId: user.id },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // 3. Fetch Commitments for this contact
    const commitments = await prisma.commitment.findMany({
      where: { contactId: id, userId: user.id },
      include: { emailMessage: true },
      orderBy: [
        { status: "asc" }, // pending first
        { dueDate: "asc" },
      ],
    });

    // Format commitments to CommitmentDTO objects
    const formattedCommitments: CommitmentDTO[] = commitments.map((c) => {
      const metadata = (c.metadata || {}) as any;
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

    // 4. Fetch associated Email Threads involving this contact's email
    const threads = await prisma.emailThread.findMany({
      where: {
        userId: user.id,
        messages: {
          some: {
            OR: [
              { sender: { contains: contact.email } },
              { recipients: { has: contact.email } },
            ],
          },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 10,
    });

    const formattedThreads: ThreadSummary[] = threads.map((t) => ({
      id: t.id,
      subject: t.subject,
      lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : null,
      followUpNeeded: t.followUpNeeded ?? false,
      followUpUrgency: t.followUpUrgency,
      followUpReason: t.followUpReason,
      snippet: t.snippet,
    }));

    // 5. Combine and return
    const detailDTO: ContactDetailDTO = {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      company: contact.company,
      avatarUrl: contact.avatarUrl,
      phoneNumber: contact.phoneNumber,
      relationshipScore: contact.relationshipScore ?? 0,
      relationshipHealth: (contact.relationshipHealth as "Strong" | "Neutral" | "At Risk") ?? "Neutral",
      relationshipReason: contact.relationshipReason,
      totalExchanges: contact.totalExchanges,
      inboundCount: contact.inboundCount,
      outboundCount: contact.outboundCount,
      openCommitments: contact.openCommitments,
      completedCommitments: contact.completedCommitments,
      lastInteractionAt: contact.lastInteractionAt ? contact.lastInteractionAt.toISOString() : null,
      commitments: formattedCommitments,
      recentThreads: formattedThreads,
    };

    return NextResponse.json(detailDTO);
  } catch (error: any) {
    console.error("Failed to fetch contact details:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
