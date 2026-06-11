import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { updateUserRelationships } from "@/services/relationshipIntelligence";
import { ContactListDTO } from "@/types/contacts";
import { isDemoMode } from "@/services/demoMode";
import { demoStore } from "@/services/demoData";

export async function GET(request: NextRequest) {
  try {
    // Intercept if in Demo Mode
    if (await isDemoMode()) {
      return NextResponse.json(demoStore.getContactsList());
    }
    // 1. Resolve user (MVP single-user fallback)
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Ensure relationships scores are calculated and fresh
    try {
      await updateUserRelationships(user.id);
    } catch (e) {
      console.error("Failed to update user relationships during list fetch:", e);
      // Non-fatal, continue with existing scores
    }

    // 3. Query all contacts sorted by Health (At Risk first) and Score
    // DB-07: WARNING: This sort relies on alphabetical ordering where "At Risk" comes before
    // "Neutral" and "Strong". If the health string values change, this sort will break!
    // A proper fix would be adding a numeric healthWeight column.
    const contacts = await prisma.contact.findMany({
      where: { userId: user.id },
      orderBy: [
        { relationshipHealth: "asc" }, // Relies on "At Risk" < "Neutral" < "Strong"
        { relationshipScore: "asc" },  // Then sort by worst score first
      ],
    });

    // 4. Map to ContactListDTO format
    const formattedContacts: ContactListDTO[] = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.company,
      avatarUrl: c.avatarUrl,
      relationshipScore: c.relationshipScore ?? 0,
      relationshipHealth: (c.relationshipHealth as "Strong" | "Neutral" | "At Risk") ?? "Neutral",
      relationshipReason: c.relationshipReason,
      totalExchanges: c.totalExchanges,
      openCommitments: c.openCommitments,
      completedCommitments: c.completedCommitments,
      lastInteractionAt: c.lastInteractionAt ? c.lastInteractionAt.toISOString() : null,
    }));

    return NextResponse.json(formattedContacts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Failed to fetch contacts:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
