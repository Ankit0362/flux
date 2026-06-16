import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { detectSchedulingIntentFromMessage } from "@/services/schedulingIntent";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Find the thread and its latest message
    const thread = await prisma.emailThread.findFirst({
      where: { id: threadId, userId: user.id },
      include: {
        messages: {
          orderBy: { receivedAt: "desc" },
          take: 1, // Only analyze the latest message for scheduling intent
        },
      },
    });

    if (!thread || thread.messages.length === 0) {
      return NextResponse.json({ error: "Thread or messages not found" }, { status: 404 });
    }

    const latestMessage = thread.messages[0];

    // Run intent detection
    const intent = await detectSchedulingIntentFromMessage({
      id: latestMessage.id,
      subject: latestMessage.subject,
      body: latestMessage.body,
      sender: latestMessage.sender,
      recipients: latestMessage.recipients,
      receivedAt: latestMessage.receivedAt,
    });

    if (!intent) {
      return NextResponse.json({ error: "Failed to parse scheduling intent from AI" }, { status: 500 });
    }

    // Store in thread metadata
    const existingMetadata =
      thread.metadata && typeof thread.metadata === "object" && !Array.isArray(thread.metadata)
        ? (thread.metadata as Record<string, unknown>)
        : {};

    const updatedMetadata = {
      ...existingMetadata,
      schedulingIntent: intent as any,
    };

    await prisma.emailThread.update({
      where: { id: threadId },
      data: { metadata: updatedMetadata },
    });

    return NextResponse.json({
      success: true,
      intent,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to detect scheduling intent for thread:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
