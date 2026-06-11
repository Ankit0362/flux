import { getCurrentUser } from "@/lib/currentUser";
import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { parseEmailAddress } from "@/lib/emailUtils";
import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/services/demoMode";
import { demoStore } from "@/services/demoData";

export async function GET(request: NextRequest) {
  try {
    // Intercept if in Demo Mode
    if (await isDemoMode()) {
      const { searchParams } = new URL(request.url);
      const threadId = searchParams.get("threadId");
      if (threadId) {
        const details = demoStore.getThreadDetails(threadId);
        if (!details) {
          return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }
        return NextResponse.json(details);
      }
      return NextResponse.json(demoStore.getInboxThreads());
    }
    // 1. Fetch the primary user (MVP single-user fallback)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let isConnected = false;
    let email = null;
    let userId = user.id;

    if (user) {
      email = user.email;

      try {
        const tenantClient = corsair.withTenant(user.id) as any;
        const profile = await tenantClient.gmail.api.users.getProfile({ userId: "me" });
        if (profile && profile.emailAddress) {
          isConnected = true;
        }
      } catch (err) {
        console.warn("User credentials not fully connected or active in Corsair:", err);
      }
    }

    // 2. Check for threadId query param to return single thread detail
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (threadId) {
      const thread = await prisma.emailThread.findFirst({
        where: { id: threadId, userId: userId || undefined },
        include: {
          messages: {
            orderBy: { receivedAt: "asc" },
          },
        },
      });

      if (!thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }

      // Resolve contact relationship data for all participants in this thread
      const participantEmails = new Set<string>();
      for (const msg of thread.messages) {
        const { email: senderEmail } = parseEmailAddress(msg.sender);
        if (senderEmail && senderEmail.toLowerCase() !== (email || "").toLowerCase()) {
          participantEmails.add(senderEmail.toLowerCase());
        }
        for (const r of msg.recipients) {
          const rLower = r.toLowerCase();
          if (rLower !== (email || "").toLowerCase()) {
            participantEmails.add(rLower);
          }
        }
      }

      const contacts = userId
        ? await prisma.contact.findMany({
            where: {
              userId,
              email: { in: Array.from(participantEmails) },
            },
          })
        : [];

      const contactDTOs = contacts.map((c) => ({
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

      return NextResponse.json({
        thread,
        contacts: contactDTOs,
        isConnected,
        email,
      });
    }

    // 3. Return paginated threads for the user
    // PERF: Without pagination this fetches ALL threads with ALL messages — potentially MBs of data.
    const { searchParams: listParams } = new URL(request.url);
    const page = Math.max(0, parseInt(listParams.get("page") || "0", 10));
    const PAGE_SIZE = 50;

    const threads = await prisma.emailThread.findMany({
      where: { userId: userId || undefined },
      select: {
        id: true,
        externalId: true,
        subject: true,
        snippet: true,
        labels: true,
        lastSyncedAt: true,
        updatedAt: true,
        createdAt: true,
        // Only fetch the latest message metadata (not body) for list view
        messages: {
          orderBy: { receivedAt: "desc" },
          take: 1, // Only need the most recent message for preview
          select: {
            sender: true,
            receivedAt: true,
            body: true, // Used for snippet fallback — truncated below
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    });

    // Format threads for list view
    const formattedThreads = threads.map((t) => {
      const latestMessage = t.messages[0];
      return {
        id: t.id,
        externalId: t.externalId,
        subject: t.subject,
        snippet: t.snippet || latestMessage?.body.substring(0, 100) || "",
        labels: t.labels,
        lastSyncedAt: t.lastSyncedAt,
        messageCount: t.messages.length,
        latestMessageDate: latestMessage ? latestMessage.receivedAt : t.createdAt,
        latestSender: latestMessage ? latestMessage.sender : "Unknown",
      };
    }).sort((a, b) => new Date(b.latestMessageDate).getTime() - new Date(a.latestMessageDate).getTime());

    return NextResponse.json({
      threads: formattedThreads,
      isConnected,
      email,
      userId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to fetch inbox state:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
