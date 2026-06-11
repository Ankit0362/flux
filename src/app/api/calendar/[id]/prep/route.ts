import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { generateMeetingPrep } from "@/services/calendarEventIntelligence";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const prep = await generateMeetingPrep(user.id, id);
    return NextResponse.json({ prep });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to generate meeting prep:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
