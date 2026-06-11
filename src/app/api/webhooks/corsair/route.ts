import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { processWebhook } from "corsair";
import { bootstrapSync, incrementalGmailSync } from "@/services/emailSync";
import { incrementalCalendarSync } from "@/services/calendarSync";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const headersObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  const bodyText = await request.text();
  const searchParams = request.nextUrl.searchParams;
  const queryObj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    queryObj[key] = value;
  });

  try {
    // Process the webhook payload through Corsair (which handles signature checks and Pub/Sub decoding)
    const result = await processWebhook(corsair, headersObj, bodyText, queryObj);

    if (result.plugin === "gmail") {
      const data = (result as any).data;
      console.log("[Webhook] Gmail event received:", data?.type, data?.emailAddress);

      if (data && data.emailAddress) {
        const email = data.emailAddress;
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          const incomingHistoryId: string | undefined = data.historyId;
          const message = data.message; // The full changed message from Corsair

          if (incomingHistoryId && message) {
            // ── Incremental path ───────────────────────────────────────────
            // Corsair has already decoded the Pub/Sub payload and resolved the
            // changed message for us. We use the message + historyId to perform
            // a targeted, single-thread sync instead of a full re-bootstrap.
            incrementalGmailSync(user.id, email, message, incomingHistoryId).catch(
              (err: unknown) => {
                console.error(`[Webhook] Incremental Gmail sync failed for ${email}:`, err);
              }
            );
          } else {
            // ── Fallback: missing historyId or message in event ────────────
            // This should not happen in normal operation but guards against
            // malformed or unexpected event shapes.
            console.warn(
              `[Webhook] Gmail event for ${email} missing historyId or message — ` +
                `falling back to bootstrapSync.`
            );
            bootstrapSync(user.id, email).catch((err: unknown) => {
              console.error(`[Webhook] Bootstrap fallback sync failed for ${email}:`, err);
            });
          }
        } else {
          console.warn(
            `[Webhook] Gmail event for ${email} — no matching User found in DB.`
          );
        }
      }
    } else if (result.plugin === "googlecalendar") {
      const data = (result as any).data;
      console.log("[Webhook] Google Calendar event received:", data);

      if (data && data.channelId) {
        const tenantId = (result as any).tenantId;
        if (tenantId) {
          const user = await prisma.user.findUnique({ where: { id: tenantId } });
          if (user) {
            incrementalCalendarSync(user.id, user.email).catch((err: unknown) => {
              console.error(
                `[Webhook] Background calendar sync failed for ${user.email}:`,
                err
              );
            });
          }
        }
      }
    }

    // Prepare response metadata
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...((result as any).responseHeaders || {}),
    };
    const status = (result as any).response?.statusCode || 200;
    const responseBody = (result as any).response?.returnToSender || { success: true };

    return new NextResponse(JSON.stringify(responseBody), {
      status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    
    // Log structured error for observability systems
    console.error(JSON.stringify({
      level: "error",
      message: "[Webhook] Failed to process incoming webhook",
      error: msg,
      stack,
      // include the body size or shape to debug malformed payloads
      bodyLength: bodyText.length,
    }));

    // Return 500 (not 200) so Google Pub/Sub retries this message.
    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
