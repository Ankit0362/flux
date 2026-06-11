import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Health check endpoint.
 *
 * Used by Vercel, load balancers, and monitoring tools to verify the app is
 * serving traffic and the database is reachable.
 *
 * GET /api/health
 * Response: 200 { status: "ok", db: "connected" }
 *           503 { status: "error", db: "disconnected", error: "..." }
 */
export async function GET() {
  try {
    // Lightweight connectivity check — SELECT 1 is fast and doesn't lock
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "connected", ts: new Date().toISOString() },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("[Health Check] Database connection failed:", err);
    return NextResponse.json(
      { status: "error", db: "disconnected" },
      { status: 503 }
    );
  }
}
