import { corsair } from "@/lib/corsair";
import { generateOAuthUrl } from "corsair/oauth";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!(session?.user as any)?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = (session!.user as any).id;
  const plugin = request.nextUrl.searchParams.get("plugin") || "gmail";
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    const { url } = await generateOAuthUrl(corsair, plugin, {
      tenantId,
      redirectUri,
    });
    
    return NextResponse.redirect(url);
  } catch (err: unknown) {
    console.error("Failed to generate OAuth URL:", err);
    return NextResponse.json(
      { error: "Failed to generate authorization URL" },
      { status: 500 }
    );
  }
}
