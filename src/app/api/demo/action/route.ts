import { NextRequest, NextResponse } from "next/server";
import { demoStore } from "@/services/demoData";
import { isDemoMode } from "@/services/demoMode";

export async function POST(request: NextRequest) {
  try {
    if (!(await isDemoMode())) {
      return NextResponse.json({ error: "Demo Mode is not active" }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "reset") {
      demoStore.reset();
      return NextResponse.json({ message: "Demo data reset successfully" });
    } else if (action === "simulate_email") {
      demoStore.simulateNewClientMail();
      return NextResponse.json({ message: "Urgent email simulation triggered" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Demo action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
