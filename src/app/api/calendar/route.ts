import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { createCalendarEvent } from "@/services/calendarSync";
import { EventStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days") || "7";
    const days = parseInt(daysParam, 10);

    const now = new Date();
    const startDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day behind
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        startAt: { gte: startDate, lte: endDate },
        status: { not: EventStatus.CANCELLED },
      },
      include: {
        attendees: {
          select: {
            id: true,
            name: true,
            email: true,
            relationshipHealth: true,
            openCommitments: true,
          }
        },
        commitments: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
          }
        }
      },
      orderBy: { startAt: "asc" },
    });

    return NextResponse.json({ events });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to fetch calendar events:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json();

    if (!payload.title || !payload.startAt || !payload.endAt) {
      return NextResponse.json(
        { error: "Missing required fields: title, startAt, endAt" },
        { status: 400 }
      );
    }

    const createdEvent = await createCalendarEvent(user.id, user.email, {
      title: payload.title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      description: payload.description,
      location: payload.location,
      attendees: payload.attendees,
    });

    return NextResponse.json({ event: createdEvent }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to create calendar event:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
