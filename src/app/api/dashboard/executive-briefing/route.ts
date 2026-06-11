import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getCachedBriefing, setCachedBriefing, invalidateBriefingCache } from "@/lib/briefingCache";
import { generateExecutiveBriefing } from "@/services/executiveBriefing";
import { isDemoMode } from "@/services/demoMode";
import { demoStore } from "@/services/demoData";

export async function GET(request: NextRequest) {
  try {
    // Intercept if in Demo Mode
    if (await isDemoMode()) {
      return NextResponse.json(demoStore.getExecutiveBriefingData());
    }
    // 1. Fetch the primary user (MVP single-user fallback)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const forceParam = searchParams.get("force");
    const isForce = forceParam === "true";

    if (isForce) {
      invalidateBriefingCache(user.id);
    } else {
      // 3. Try to get from cache
      const cached = getCachedBriefing(user.id);
      if (cached) {
        return NextResponse.json({ briefing: cached, cached: true });
      }
    }

    // 4. Generate new briefing
    const briefing = await generateExecutiveBriefing(user.id);

    // 5. Store in cache
    setCachedBriefing(user.id, briefing);

    return NextResponse.json({ briefing, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error during briefing generation";
    console.error("Failed to generate/fetch executive briefing:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
