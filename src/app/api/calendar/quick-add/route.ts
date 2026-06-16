import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { parseQuickAdd } from "@/services/availability";
import { createCalendarEvent } from "@/services/calendarSync";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = String(body.input ?? "").trim();
    const create = Boolean(body.create);

    if (!input) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const contacts = await prisma.contact.findMany({
      where: { userId: user.id },
      select: { email: true, name: true },
      take: 50,
    });
    const draft = await parseQuickAdd(user.id, input, contacts);

    if (!create) {
      return NextResponse.json({ draft });
    }

    try {
      const event = await createCalendarEvent(user.id, user.email, draft);
      return NextResponse.json({ draft, event }, { status: 201 });
    } catch (calErr: any) {
      // Corsair throws a descriptive error when the OAuth account is not yet connected
      if (
        calErr?.message?.includes("Account not found") ||
        calErr?.message?.includes("Make sure to create the account first")
      ) {
        return NextResponse.json(
          { error: "Google Calendar not connected", code: "calendar_not_connected" },
          { status: 403 }
        );
      }
      throw calErr;
    }
  } catch (err) {
    console.error("Calendar quick-add failed:", err);
    return NextResponse.json({ error: "Calendar quick-add failed" }, { status: 500 });
  }
}
