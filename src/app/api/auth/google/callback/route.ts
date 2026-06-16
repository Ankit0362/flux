import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";
import { processOAuthCallback } from "corsair/oauth";
import { bootstrapSync } from "@/services/emailSync";
import { bootstrapCalendarSync } from "@/services/calendarSync";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!(session?.user as any)?.id) {
    return NextResponse.json({ error: "Unauthorized - Please log in first" }, { status: 401 });
  }

  const userId = (session!.user as any).id;

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state parameters" },
      { status: 400 }
    );
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    const { plugin, tenantId } = await processOAuthCallback(corsair, {
      code,
      state,
      redirectUri,
    });

    if (tenantId !== userId) {
      console.warn(`Tenant ID mismatch: Corsair returned ${tenantId}, session is ${userId}`);
      return NextResponse.redirect(`${origin}/inbox?error=tenant_mismatch`);
    }

    console.info(`OAuth successful. Connected ${plugin} for tenant ${userId}.`);

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error("User record not found in database.");
    }

    if (plugin === "gmail") {
      // Trigger bootstrap sync asynchronously
      bootstrapSync(user.id, user.email).catch((err) => {
        console.error("Background bootstrap sync failed:", err);
      });
      return NextResponse.redirect(`${origin}/inbox`);
    } else if (plugin === "googlecalendar") {
      // Trigger calendar bootstrap sync asynchronously
      bootstrapCalendarSync(user.id, user.email).catch((err) => {
        console.error("Background calendar bootstrap sync failed:", err);
      });
      return NextResponse.redirect(`${origin}/calendar`);
    }

    return NextResponse.redirect(`${origin}/inbox`);
  } catch (err: unknown) {
    // SEC-06: Log the real error server-side but NEVER expose internal error
    // messages (Prisma errors, stack traces) in the redirect URL — they appear
    // in browser history, referrer headers, and any analytics scripts on the page.
    console.error("OAuth callback failed:", err);
    return NextResponse.redirect(
      `${origin}/inbox?error=auth_failed`
    );
  }
}
