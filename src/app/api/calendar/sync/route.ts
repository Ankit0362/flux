import { getCurrentUser } from "@/lib/currentUser";
import { bootstrapCalendarSync, incrementalCalendarSync } from "@/services/calendarSync";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "bootstrap" ? "bootstrap" : "incremental";
    const result =
      mode === "bootstrap"
        ? await bootstrapCalendarSync(user.id, user.email)
        : await incrementalCalendarSync(user.id, user.email);

    return NextResponse.json({ success: true, mode, ...result });
  } catch (err) {
    console.error("Calendar sync failed:", err);
    return NextResponse.json({ error: "Calendar sync failed" }, { status: 500 });
  }
}
