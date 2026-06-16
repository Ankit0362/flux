import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    const providedSecret = request.headers.get("x-admin-key");
    if (!adminSecret || providedSecret !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the primary user (MVP assumes single user)
    const user = await prisma.user.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const threadCount = await prisma.emailThread.count();
    const messageCount = await prisma.emailMessage.count();
    const contactCount = await prisma.contact.count();

    const latestMessages = await prisma.emailMessage.findMany({
      orderBy: { receivedAt: "desc" },
      take: 5,
      select: {
        id: true,
        sender: true,
        subject: true,
        receivedAt: true,
        direction: true,
      },
    });

    let isConnected = false;
    let email = null;
    let tenantId = "default-user";

    if (user) {
      email = user.email;
      tenantId = user.id;
      
      try {
        // Attempt to call labels.list through Corsair to verify connection validity
        const tenantClient = corsair.withTenant(user.id) as any;
        const labelsResult = await tenantClient.gmail.api.labels.list({ userId: "me" });
        if (labelsResult && labelsResult.labels) {
          isConnected = true;
        }
      } catch (err) {
        console.warn("User credentials not fully connected or active in Corsair:", err);
      }
    }

    return NextResponse.json({
      isConnected,
      email,
      tenantId,
      threadCount,
      messageCount,
      contactCount,
      latestMessages,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to fetch sync state:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
