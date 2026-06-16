import { getCurrentUser } from "@/lib/currentUser";
import { suggestAvailabilitySlots } from "@/services/availability";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const window = searchParams.get("window") ?? "next week";
    const durationMinutes = Number(searchParams.get("durationMinutes") ?? 30);
    const limit = Number(searchParams.get("limit") ?? 3);
    const slots = await suggestAvailabilitySlots(user.id, {
      window,
      durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 30,
      limit: Number.isFinite(limit) ? limit : 3,
    });

    return NextResponse.json({ slots });
  } catch (err) {
    console.error("Failed to suggest availability:", err);
    return NextResponse.json({ error: "Failed to suggest availability" }, { status: 500 });
  }
}
