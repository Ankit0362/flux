import { prisma } from "@/lib/db";
import { EventStatus } from "@prisma/client";

export interface SuggestedSlot {
  start: string;
  end: string;
  confidence: number;
}

export interface AvailabilityEngineResult {
  suggestedSlots: SuggestedSlot[];
}

/**
 * Calculates optimal available meeting slots based on existing calendar events.
 * 
 * Features:
 * - Analyzes a 14-day window.
 * - Excludes busy blocks and respects event startAt/endAt boundaries.
 * - Excludes CANCELLED events.
 * - Generates meeting slots strictly within business hours (9 AM–6 PM).
 * - Avoids adjacent (back-to-back) slots by applying a confidence penalty.
 * - Returns the top 3 optimal slots sorted by confidence and chronological order.
 * 
 * @param userId - The ID of the user scheduling the meeting.
 * @param durationMinutes - The requested meeting duration (default 30).
 */
export async function calculateBestSlots(
  userId: string,
  durationMinutes: number = 30
): Promise<AvailabilityEngineResult> {
  const now = new Date();
  
  // Calculate window boundaries: Start from the beginning of the next business day
  const startWindow = new Date(now);
  startWindow.setDate(startWindow.getDate() + 1);
  startWindow.setHours(0, 0, 0, 0);
  
  // Skip weekends to find the next business day
  while (startWindow.getDay() === 0 || startWindow.getDay() === 6) {
    startWindow.setDate(startWindow.getDate() + 1);
  }

  // 14-day analysis window
  const endWindow = new Date(startWindow);
  endWindow.setDate(startWindow.getDate() + 14);

  // Read CalendarEvent records from Prisma
  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      status: { not: EventStatus.CANCELLED },
      isAllDay: false,
      startAt: { lt: endWindow },
      endAt: { gt: startWindow },
    },
    orderBy: { startAt: "asc" },
    select: { startAt: true, endAt: true },
  });

  const candidateSlots: SuggestedSlot[] = [];
  const durationMs = durationMinutes * 60 * 1000;

  // Generate 30-minute interval slots from startWindow to endWindow
  const cursor = new Date(startWindow);

  while (cursor < endWindow) {
    // Exclude weekends
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    // Prefer business hours: 9 AM to 6 PM
    const hour = cursor.getHours();
    if (hour < 9) {
      cursor.setHours(9, 0, 0, 0);
      continue;
    }
    if (hour >= 18) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const candidateStart = new Date(cursor);
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);

    // If candidate end crosses 6 PM, skip to the next day
    if (candidateEnd.getHours() > 18 || (candidateEnd.getHours() === 18 && candidateEnd.getMinutes() > 0)) {
       cursor.setDate(cursor.getDate() + 1);
       cursor.setHours(0, 0, 0, 0);
       continue;
    }

    // Check overlap with existing events
    let hasConflict = false;
    let adjacentCount = 0;

    for (const event of events) {
      // Overlap condition: event starts before candidate ends AND event ends after candidate starts
      if (event.startAt < candidateEnd && event.endAt > candidateStart) {
        hasConflict = true;
        break; // Busy block found
      }

      // Adjacency check (back-to-back meetings)
      if (event.endAt.getTime() === candidateStart.getTime()) {
        adjacentCount++;
      }
      if (event.startAt.getTime() === candidateEnd.getTime()) {
        adjacentCount++;
      }
    }

    if (!hasConflict) {
      let confidence = 100;
      
      // Penalty: Avoid suggesting slots adjacent to meetings when possible (-15 points per adjacent edge)
      confidence -= (adjacentCount * 15);

      // Slight penalty for slots at the very end of the day (e.g. 5:00 PM - 6:00 PM)
      if (candidateStart.getHours() >= 17) {
        confidence -= 5;
      }

      candidateSlots.push({
        start: candidateStart.toISOString(),
        end: candidateEnd.toISOString(),
        confidence,
      });
    }

    // Advance cursor by 30 mins
    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  // Sort candidate slots by confidence descending, then by chronological order
  candidateSlots.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence; // Highest confidence first
    }
    return new Date(a.start).getTime() - new Date(b.start).getTime(); // Earliest first
  });

  // Generate top 3 available meeting slots
  return {
    suggestedSlots: candidateSlots.slice(0, 3)
  };
}
