import { getCurrentUser } from "@/lib/currentUser";
import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/calendar/status
 *
 * Returns whether the current user has a connected Google Calendar account.
 * Queries the Corsair `corsair_accounts` + `corsair_integrations` tables directly
 * via the shared pg pool to avoid a round-trip through the Corsair SDK.
 *
 * Response: { connected: boolean }
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up whether a Corsair account record exists for this tenant + googlecalendar integration.
    // A row in corsair_accounts (joined to the integration by name) means OAuth is complete.
    const result = await pool.query<{ id: string }>(
      `SELECT ca.id
       FROM corsair_accounts ca
       JOIN corsair_integrations ci ON ca.integration_id = ci.id
       WHERE ca.tenant_id = $1
         AND ci.name = 'googlecalendar'
       LIMIT 1`,
      [user.id]
    );

    const connected = result.rows.length > 0;

    return NextResponse.json({ connected });
  } catch (err: unknown) {
    console.error("Failed to check calendar connection status:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
