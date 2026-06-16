import { getCurrentUser } from "@/lib/currentUser";
import { buildWritingStyleProfile } from "@/services/writingStyle";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await buildWritingStyleProfile(user.id);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Failed to build writing style profile:", err);
    return NextResponse.json({ error: "Failed to build writing style profile" }, { status: 500 });
  }
}
