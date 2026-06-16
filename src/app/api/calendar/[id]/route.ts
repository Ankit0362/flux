import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { updateCalendarEvent, deleteCalendarEvent } from "@/services/calendarSync";

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
    const event = await prisma.calendarEvent.findUnique({
      where: { id, userId: user.id },
      include: {
        attendees: true,
        commitments: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (err: unknown) {
    console.error("Failed to fetch calendar event:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json();
    const { id } = await params;
    const updatedEvent = await updateCalendarEvent(user.id, user.email, id, payload);

    return NextResponse.json({ event: updatedEvent });
  } catch (err: unknown) {
    console.error("Failed to update calendar event:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteCalendarEvent(user.id, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Failed to delete calendar event:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
