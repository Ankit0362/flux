import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { extractBodies, getHeader, parseEmailAddress } from "@/lib/emailUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncResult {
  synced: number;
  errors: number;
}

// Shape of the decoded Gmail webhook message (from Corsair event data).
// Corsair's messageChanged webhook provides the changed message directly.
interface GmailWebhookMessage {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  payload?: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Persists a complete thread fetched from the Gmail API into the database.
 * All writes are upserts — safe to call multiple times.
 */
export async function persistThreadDetails(
  userId: string,
  userEmail: string,
  thread: any
) {
  if (!thread.id) return;

  const messages = thread.messages || [];
  if (messages.length === 0) return;

  const firstMessage = messages[0];
  const headers = firstMessage.payload?.headers || [];
  const subject = getHeader(headers, "Subject") || "No Subject";
  const snippet = thread.snippet || firstMessage.snippet || "";
  const labels = firstMessage.labelIds || [];
  const historyId = thread.historyId || firstMessage.historyId || null;

  await prisma.$transaction(async (tx: any) => {
    // 1. Upsert the EmailThread
    const dbThread = await tx.emailThread.upsert({
      where: { externalId: thread.id },
      create: {
        userId,
        externalId: thread.id,
        subject,
        snippet,
        labels,
        historyId,
        lastSyncedAt: new Date(),
      },
      update: {
        subject,
        snippet,
        labels,
        historyId,
        lastSyncedAt: new Date(),
      },
    });

    // 2. Process all messages in the thread
    for (const msg of messages) {
      if (!msg.id) continue;

      const msgHeaders = msg.payload?.headers || [];
      const msgSubject = getHeader(msgHeaders, "Subject") || subject;
      const senderRaw = getHeader(msgHeaders, "From") || "";
      const toRaw = getHeader(msgHeaders, "To") || "";
      const ccRaw = getHeader(msgHeaders, "Cc") || "";

      const { email: senderEmail, name: senderName } = parseEmailAddress(senderRaw);

      // Upsert Contact for sender (skip if it's the user themselves)
      if (senderEmail && senderEmail.toLowerCase() !== userEmail.toLowerCase()) {
        await tx.contact.upsert({
          where: { userId_email: { userId, email: senderEmail } },
          create: { userId, email: senderEmail, name: senderName },
          update: { name: senderName },
        });
      }

      // Parse all recipients (To + CC)
      const recipients: string[] = [];
      const recipientStrings = [toRaw, ccRaw].filter(Boolean).join(", ");
      if (recipientStrings) {
        const parts = recipientStrings.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        for (const part of parts) {
          const { email: recEmail, name: recName } = parseEmailAddress(part);
          if (recEmail) {
            recipients.push(recEmail);
            if (recEmail.toLowerCase() !== userEmail.toLowerCase()) {
              await tx.contact.upsert({
                where: { userId_email: { userId, email: recEmail } },
                create: { userId, email: recEmail, name: recName },
                update: { name: recName },
              });
            }
          }
        }
      }

      const bodies = extractBodies(msg.payload || {});
      const direction =
        senderEmail.toLowerCase() === userEmail.toLowerCase() ? "OUTBOUND" : "INBOUND";

      const dateRaw = getHeader(msgHeaders, "Date");
      let receivedAt = new Date();
      if (dateRaw) {
        const parsedDate = new Date(dateRaw);
        if (!isNaN(parsedDate.getTime())) receivedAt = parsedDate;
      } else if (msg.internalDate) {
        receivedAt = new Date(Number(msg.internalDate));
      }

      await tx.emailMessage.upsert({
        where: { externalId: msg.id },
        create: {
          threadId: dbThread.id,
          externalId: msg.id,
          sender: senderRaw,
          recipients,
          subject: msgSubject,
          body: bodies.text || msg.snippet || "",
          bodyHtml: bodies.html || null,
          direction,
          receivedAt,
        },
        update: {
          subject: msgSubject,
          body: bodies.text || msg.snippet || "",
          bodyHtml: bodies.html || null,
        },
      });
    }
  });
}

// ─── Bootstrap Sync ───────────────────────────────────────────────────────────

/**
 * Syncs the latest 50 threads from the user's mailbox into the database.
 * Idempotent — safe to call multiple times (all writes are upserts).
 *
 * After syncing, persists the final historyId from the Gmail profile to the
 * User record, anchoring future incremental syncs.
 *
 * Returns a summary of { synced, errors }.
 */
export async function bootstrapSync(
  userId: string,
  email: string
): Promise<SyncResult> {
  console.log(`[GmailSync] Starting bootstrap sync for user ${userId} (${email})...`);
  const tenantClient = corsair.withTenant(userId) as any;

  let synced = 0;
  let errors = 0;

  const threadsResult = await tenantClient.gmail.api.threads.list({
    maxResults: 50,
  });

  const threads: Array<{ id?: string }> = threadsResult.threads || [];
  console.log(`[GmailSync] Found ${threads.length} threads. Fetching details...`);

  for (const t of threads) {
    if (!t.id) continue;
    try {
      const threadDetails = await tenantClient.gmail.api.threads.get({
        id: t.id,
        format: "full",
      });
      await persistThreadDetails(userId, email, threadDetails);
      synced++;
    } catch (err) {
      console.error(`[GmailSync] Failed to sync thread ${t.id}:`, err);
      errors++;
    }
  }

  // ── Anchor the historyId cursor ───────────────────────────────────────────
  // After bootstrap, fetch the current profile historyId and save it so that
  // the next webhook-triggered sync can use it as the starting cursor instead
  // of triggering another full bootstrap.
  try {
    const profile = await tenantClient.gmail.api.users.getProfile({ userId: "me" });
    if (profile?.historyId) {
      await prisma.user.update({
        where: { id: userId },
        data: { gmailHistoryId: profile.historyId },
      });
      console.log(
        `[GmailSync] Anchored gmailHistoryId=${profile.historyId} for user ${userId}`
      );
    }
  } catch (err) {
    // Non-fatal: the next webhook will fall back to re-bootstrap if the cursor
    // is missing, which is safe.
    console.error(`[GmailSync] Failed to fetch/save historyId after bootstrap:`, err);
  }

  console.log(`[GmailSync] Bootstrap sync complete. synced=${synced} errors=${errors}`);
  return { synced, errors };
}

// ─── Incremental Sync ─────────────────────────────────────────────────────────

/**
 * Performs a targeted, incremental Gmail sync triggered by a webhook event.
 *
 * Strategy:
 * - The Corsair Gmail webhook already provides the full changed message and its
 *   threadId in the event payload (no `history.list` needed).
 * - We fetch the full thread for any changed threadId and upsert it.
 * - After processing, we advance the stored gmailHistoryId cursor to the latest
 *   historyId from the webhook event (always move forward, never backward).
 *
 * Expiry / fallback:
 * - If the user has no stored gmailHistoryId (bootstrap never ran, or DB was
 *   wiped), we fall back to a full bootstrap instead.
 * - This handles the "expired historyId" scenario — if we ever receive an event
 *   with a historyId far ahead of our cursor (gap > expected), the fallback
 *   bootstrap re-establishes a correct state.
 *
 * @param userId   - Internal ChiefOS user ID
 * @param email    - User's email (used for contact attribution)
 * @param message  - The changed message from the Corsair webhook event
 * @param incomingHistoryId - The historyId carried by the webhook event
 */
export async function incrementalGmailSync(
  userId: string,
  email: string,
  message: GmailWebhookMessage,
  incomingHistoryId: string
): Promise<SyncResult> {
  console.log(
    `[GmailSync] Incremental sync triggered for user ${userId}, historyId=${incomingHistoryId}`
  );

  // 1. Fetch the current cursor from the DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailHistoryId: true },
  });

  // 2. Fallback: if no cursor exists, run a full bootstrap to establish state
  if (!user?.gmailHistoryId) {
    console.warn(
      `[GmailSync] No gmailHistoryId cursor found for user ${userId}. ` +
        `Falling back to bootstrapSync to establish a fresh baseline.`
    );
    return bootstrapSync(userId, email);
  }

  const currentCursor = BigInt(user.gmailHistoryId);
  const incomingCursor = BigInt(incomingHistoryId);

  // 3. Guard: if the incoming event is older than our cursor, it's a duplicate
  //    or a replayed message — skip it.
  if (incomingCursor <= currentCursor) {
    console.log(
      `[GmailSync] Skipping stale event: incoming=${incomingHistoryId} <= stored=${user.gmailHistoryId}`
    );
    return { synced: 0, errors: 0 };
  }

  const tenantClient = corsair.withTenant(userId) as any;
  let synced = 0;
  let errors = 0;

  // 4. The webhook already contains the changed message. Fetch its parent
  //    thread to get the full message list and upsert everything.
  const threadId = message.threadId;
  if (!threadId) {
    console.warn(`[GmailSync] Webhook message has no threadId, skipping.`);
    return { synced: 0, errors: 0 };
  }

  try {
    const threadDetails = await tenantClient.gmail.api.threads.get({
      id: threadId,
      format: "full",
    });
    await persistThreadDetails(userId, email, threadDetails);
    synced++;
    console.log(
      `[GmailSync] Incremental: synced thread ${threadId} for user ${userId}`
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // 4a. Handle hard-expired historyId: Gmail returns a 404 or "historyId is
    //     too old" error when the history has been garbage-collected. In that
    //     case, fall back to a full bootstrap to re-establish state.
    const isExpiredHistory =
      errMsg.toLowerCase().includes("history") ||
      errMsg.toLowerCase().includes("invalid") ||
      errMsg.toLowerCase().includes("404");

    if (isExpiredHistory) {
      console.warn(
        `[GmailSync] historyId appears expired or invalid for user ${userId}. ` +
          `Clearing cursor and falling back to bootstrapSync.`
      );
      // Clear the cursor so future webhooks don't keep hitting this branch
      await prisma.user.update({
        where: { id: userId },
        data: { gmailHistoryId: null },
      });
      return bootstrapSync(userId, email);
    }

    console.error(`[GmailSync] Failed to sync thread ${threadId}:`, err);
    errors++;
  }

  // 5. Advance the cursor — always store the maximum (never regress)
  if (synced > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { gmailHistoryId: incomingHistoryId },
    });
    console.log(
      `[GmailSync] Advanced gmailHistoryId to ${incomingHistoryId} for user ${userId}`
    );
  }

  return { synced, errors };
}
