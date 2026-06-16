import { getCurrentUser } from "@/lib/currentUser";
import { NextRequest, NextResponse } from "next/server";
import { generateMeetingBrief } from "@/services/meetingBrief";

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
    const brief = await generateMeetingBrief(user.id, id);
    return NextResponse.json({ brief });
  } catch (err: unknown) {
    console.error("Failed to generate meeting brief:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
