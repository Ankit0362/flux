import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { bootstrapSync } from "@/services/emailSync";
import { bootstrapCalendarSync } from "@/services/calendarSync";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // ── Auth guard ──────────────────────────────────────────────────────────
    // All admin operations require a matching ADMIN_SECRET header.
    // Set ADMIN_SECRET in your environment variables (min 16 chars).
    const adminSecret = process.env.ADMIN_SECRET;
    const providedSecret = request.headers.get("x-admin-key");

    if (!adminSecret || providedSecret !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ────────────────────────────────────────────────────────────────────────

    const { action, tenantId, email } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    if (action === "bootstrap") {
      if (!tenantId || !email) {
        return NextResponse.json({ error: "Missing parameters for bootstrap" }, { status: 400 });
      }
      const result = await bootstrapSync(tenantId, email);
      return NextResponse.json({ success: true, message: "Bootstrap sync executed successfully", ...result });
    }

    if (action === "bootstrap-calendar") {
      if (!tenantId || !email) {
        return NextResponse.json({ error: "Missing parameters for bootstrap" }, { status: 400 });
      }
      const result = await bootstrapCalendarSync(tenantId, email);
      return NextResponse.json({ success: true, message: "Bootstrap calendar sync executed successfully", ...result });
    }

    if (action === "incremental") {
      return NextResponse.json(
        { error: "Incremental sync is not supported. Use bootstrap instead." },
        { status: 400 }
      );
    }

    if (action === "reset") {
      // ── Extra safety guard: never allow reset in production ──────────────
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Database reset is not allowed in production." },
          { status: 403 }
        );
      }
      // Clear data for fresh testing cycles
      await prisma.$transaction([
        prisma.calendarEvent.deleteMany({}),
        prisma.commitment.deleteMany({}),
        prisma.emailMessage.deleteMany({}),
        prisma.emailThread.deleteMany({}),
        prisma.contact.deleteMany({}),
        prisma.user.deleteMany({}),
      ]);
      
      return NextResponse.json({ success: true, message: "Local database tables wiped successfully" });
    }

    return NextResponse.json({ error: "Unknown action parameter" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to run sync action:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

