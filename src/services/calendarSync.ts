import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { parseEmailAddress } from "@/lib/emailUtils";
import { EventStatus } from "@prisma/client";

/**
 * Persists a Google Calendar event to the local database,
 * resolving attendees to Contact records and linking them.
 */
export async function persistCalendarEvent(
  userId: string,
  userEmail: string,
  event: any,
  calendarId: string = "primary"
) {
  if (!event.id) return;

  const title = event.summary || "Untitled Event";
  const description = event.description || null;
  const location = event.location || null;
  
  // Parse start and end times, handling all-day events
  const isAllDay = !!event.start?.date;
  
  // Use either the specific date-time or the all-day date
  const startAtRaw = event.start?.dateTime || event.start?.date;
  const endAtRaw = event.end?.dateTime || event.end?.date;
  
  // If we can't parse a valid date, skip persistence
  if (!startAtRaw || !endAtRaw) return;
  
  const startAt = new Date(startAtRaw);
  const endAt = new Date(endAtRaw);
  
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return;

  // Map Google event status to Prisma EventStatus enum
  let status: EventStatus = EventStatus.CONFIRMED;
  if (event.status === "cancelled") {
    status = EventStatus.CANCELLED;
  } else if (event.status === "tentative") {
    status = EventStatus.TENTATIVE;
  }

  await prisma.$transaction(async (tx: any) => {
    // 1. Process attendees
    const attendeeEmails: string[] = [];
    const attendeeMetadata: Record<string, string> = {}; // email -> responseStatus

    if (event.attendees && Array.isArray(event.attendees)) {
      for (const attendee of event.attendees) {
        if (!attendee.email) continue;
        
        const attendeeEmail = attendee.email.toLowerCase();
        attendeeEmails.push(attendeeEmail);
        attendeeMetadata[attendeeEmail] = attendee.responseStatus || "needsAction";

        // Upsert Contact for attendee (skip if it's the user themselves)
        if (attendeeEmail !== userEmail.toLowerCase()) {
          const displayName = attendee.displayName || parseEmailAddress(attendee.email).name;
          
          await tx.contact.upsert({
            where: { userId_email: { userId, email: attendeeEmail } },
            create: { userId, email: attendeeEmail, name: displayName },
            update: { name: displayName }, // update name if they added a display name
          });
        }
      }
    }

    // 2. Find Contacts for connection
    const contactRecords = await tx.contact.findMany({
      where: {
        userId,
        email: { in: attendeeEmails.filter(e => e !== userEmail.toLowerCase()) }
      },
      select: { id: true }
    });

    const contactIds = contactRecords.map((c: any) => ({ id: c.id }));

    // 3. Construct rich metadata
    const metadata = {
      attendeeStatus: attendeeMetadata,
      hangoutLink: event.hangoutLink || null,
      htmlLink: event.htmlLink || null,
      recurringEventId: event.recurringEventId || null,
      creator: event.creator?.email || null,
      organizer: event.organizer?.email || null,
    };

    // 4. Upsert CalendarEvent
    await tx.calendarEvent.upsert({
      where: { 
        externalId_calendarId: { 
          externalId: event.id, 
          calendarId 
        } 
      },
      create: {
        userId,
        externalId: event.id,
        calendarId,
        title,
        description,
        location,
        startAt,
        endAt,
        isAllDay,
        status,
        metadata,
        attendees: {
          connect: contactIds
        }
      },
      update: {
        title,
        description,
        location,
        startAt,
        endAt,
        isAllDay,
        status,
        metadata,
        attendees: {
          set: contactIds // replaces the existing connections
        }
      }
    });
  });
}

/**
 * Bootstrap sync: fetches upcoming and recent events from Google Calendar.
 * After a successful run, saves the current timestamp as the incremental sync cursor.
 */
export async function bootstrapCalendarSync(
  userId: string,
  email: string
): Promise<{ synced: number; errors: number }> {
  console.log(`Starting bootstrap calendar sync for user ${userId} (${email})...`);
  const tenantClient = corsair.withTenant(userId) as any;

  let synced = 0;
  let errors = 0;

  // Fetch from 14 days ago to 30 days in the future
  const now = new Date();
  const syncStartedAt = now.toISOString();
  const timeMin = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let pageToken: string | undefined = undefined;
  let hadError = false;

  do {
    try {
      const response: any = await tenantClient.googlecalendar.api.events.getMany({
        calendarId: "primary",
        timeMin,
        timeMax,
        maxResults: 250,
        singleEvents: true, // Expand recurring events
        orderBy: "startTime",
        pageToken,
      });

      const events = response.items || [];
      console.log(`Fetched ${events.length} events from Google Calendar...`);

      for (const event of events) {
        try {
          await persistCalendarEvent(userId, email, event);
          synced++;
        } catch (err) {
          console.error(`Failed to persist calendar event ${event.id}:`, err);
          errors++;
        }
      }

      pageToken = response.nextPageToken;
    } catch (err) {
      console.error("Failed to fetch events from Google Calendar API:", err);
      errors++;
      hadError = true;
      break;
    }
  } while (pageToken);

  // Save the sync cursor timestamp so future incremental syncs only fetch
  // events modified after this point (via updatedMin).
  if (!hadError) {
    await prisma.user.update({
      where: { id: userId },
      data: { calendarSyncToken: syncStartedAt },
    });
  }

  console.log(`Bootstrap calendar sync complete. synced=${synced} errors=${errors}`);
  return { synced, errors };
}

/**
 * Incremental sync: fetches only events modified since the last successful sync.
 * Uses updatedMin (ISO timestamp cursor stored in calendarSyncToken) to fetch
 * only changed events, avoiding a full re-fetch on every webhook trigger.
 */
export async function incrementalCalendarSync(
  userId: string,
  email: string
): Promise<{ synced: number; errors: number }> {
  console.log(`Starting incremental calendar sync for user ${userId} (${email})...`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarSyncToken: true },
  });

  if (!user || !user.calendarSyncToken) {
    console.log("No sync cursor found, falling back to bootstrap sync...");
    return bootstrapCalendarSync(userId, email);
  }

  const tenantClient = corsair.withTenant(userId) as any;
  let synced = 0;
  let errors = 0;
  let pageToken: string | undefined = undefined;

  // Record the timestamp before fetching so we don't miss events that change
  // during the sync window.
  const syncStartedAt = new Date().toISOString();

  // updatedMin filters to events modified after our last sync cursor.
  const updatedMin = user.calendarSyncToken;

  try {
    do {
      const response: any = await tenantClient.googlecalendar.api.events.getMany({
        calendarId: "primary",
        updatedMin,
        showDeleted: true, // Include cancelled events so we can mark them locally
        pageToken,
      });

      const events = response.items || [];
      console.log(`Fetched ${events.length} changed events from Google Calendar (since ${updatedMin})...`);

      for (const event of events) {
        try {
          if (event.status === "cancelled") {
            // Mark locally as CANCELLED if the event exists
            await prisma.calendarEvent.updateMany({
              where: { externalId: event.id, calendarId: "primary", userId },
              data: { status: EventStatus.CANCELLED },
            });
          } else {
            await persistCalendarEvent(userId, email, event);
          }
          synced++;
        } catch (err) {
          console.error(`Failed to update calendar event ${event.id}:`, err);
          errors++;
        }
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    // Advance the sync cursor to the start of this run so the next incremental
    // sync only fetches events modified after now.
    await prisma.user.update({
      where: { id: userId },
      data: { calendarSyncToken: syncStartedAt },
    });
  } catch (err: unknown) {
    console.error("Failed incremental calendar sync:", err);
    errors++;
  }

  return { synced, errors };
}

export interface CreateEventPayload {
  title: string;
  startAt: string | Date;
  endAt: string | Date;
  description?: string;
  location?: string;
  attendees?: string[]; // list of emails
}

/**
 * Creates an event on Google Calendar, then persists locally (write-through)
 */
export async function createCalendarEvent(
  userId: string,
  userEmail: string,
  payload: CreateEventPayload
) {
  const tenantClient = corsair.withTenant(userId) as any;
  
  const startAt = new Date(payload.startAt);
  const endAt = new Date(payload.endAt);
  
  const requestBody: any = {
    summary: payload.title,
    start: { dateTime: startAt.toISOString() },
    end: { dateTime: endAt.toISOString() },
  };
  
  if (payload.description) requestBody.description = payload.description;
  if (payload.location) requestBody.location = payload.location;
  if (payload.attendees && payload.attendees.length > 0) {
    requestBody.attendees = payload.attendees.map(email => ({ email }));
  }

  // Write to Google Calendar
  const response = await tenantClient.googlecalendar.api.events.create({
    calendarId: "primary",
    sendUpdates: "all", // Notify attendees
    event: requestBody
  });
  
  // Persist locally
  await persistCalendarEvent(userId, userEmail, response);
  
  // Return the created event from DB
  return prisma.calendarEvent.findUnique({
    where: {
      externalId_calendarId: {
        externalId: response.id,
        calendarId: "primary"
      }
    },
    include: { attendees: true }
  });
}

export interface UpdateEventPayload {
  title?: string;
  startAt?: string | Date;
  endAt?: string | Date;
  description?: string;
  location?: string;
  attendees?: string[];
}

export async function updateCalendarEvent(
  userId: string,
  userEmail: string,
  eventId: string,
  payload: UpdateEventPayload
) {
  const tenantClient = corsair.withTenant(userId) as any;
  const dbEvent = await prisma.calendarEvent.findUnique({
    where: { id: eventId, userId }
  });

  if (!dbEvent) throw new Error("Event not found");

  const requestBody: any = {};
  if (payload.title) requestBody.summary = payload.title;
  if (payload.startAt) requestBody.start = { dateTime: new Date(payload.startAt).toISOString() };
  if (payload.endAt) requestBody.end = { dateTime: new Date(payload.endAt).toISOString() };
  if (payload.description !== undefined) requestBody.description = payload.description;
  if (payload.location !== undefined) requestBody.location = payload.location;
  
  if (payload.attendees) {
    requestBody.attendees = payload.attendees.map(email => ({ email }));
  }

  const response = await tenantClient.googlecalendar.api.events.update({
    id: dbEvent.externalId,
    calendarId: "primary",
    sendUpdates: "all",
    event: requestBody
  });

  await persistCalendarEvent(userId, userEmail, response);

  return prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: { attendees: true }
  });
}

export async function deleteCalendarEvent(userId: string, eventId: string) {
  const tenantClient = corsair.withTenant(userId) as any;
  const dbEvent = await prisma.calendarEvent.findUnique({
    where: { id: eventId, userId }
  });

  if (!dbEvent) throw new Error("Event not found");

  try {
    await tenantClient.googlecalendar.api.events.delete({
      id: dbEvent.externalId,
      calendarId: "primary",
      sendUpdates: "all"
    });
  } catch (err: unknown) {
    // If already deleted on Google Calendar, ignore the error and proceed to delete locally
    const error = err as any;
    if (error.status !== 410 && error.status !== 404) {
      throw err;
    }
  }

  await prisma.calendarEvent.delete({
    where: { id: eventId }
  });
}

