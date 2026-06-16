/**
 * scripts/test-calendar-api.mjs
 * Tests the Google Calendar API directly with the configured tenant.
 */
import pg from "pg";
import { createCorsair } from "corsair";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { DATABASE_URL, CORSAIR_KEK } = process.env;
const pool = new pg.Pool({ connectionString: DATABASE_URL });

const corsair = createCorsair({
  multiTenancy: true,
  database: pool,
  kek: CORSAIR_KEK,
  plugins: [googlecalendar()],
});

async function test() {
  try {
    const res = await pool.query("SELECT * FROM corsair_accounts");
    console.log("Connected Corsair accounts & plugins:");
    console.table(res.rows);

    if (res.rows.length === 0) {
      console.log("No connected accounts found.");
      return;
    }

    // Usually corsair_accounts has plugin_id or similar. Let's find any row representing googlecalendar
    // Let's print out keys of the first row to be sure.
    console.log("Columns:", Object.keys(res.rows[0]));

    const calendarAccount = res.rows.find(row => 
      row.plugin_id === "googlecalendar" || 
      row.plugin === "googlecalendar" || 
      row.plugin_name === "googlecalendar"
    );
    
    if (!calendarAccount) {
      console.log("❌ No googlecalendar accounts found connected.");
      return;
    }

    const tenantId = calendarAccount.tenant_id;
    console.log(`Testing googlecalendar with tenantId: ${tenantId}`);

    const tc = corsair.withTenant(tenantId);
    
    console.log("Calling events.list()...");
    const response = await tc.googlecalendar.api.events.list({
      calendarId: "primary",
      maxResults: 10,
    });
    console.log("Events API OK! Returned events count:", response.items?.length || 0);

  } catch (err) {
    console.error("Calendar API Error:", err);
  } finally {
    await pool.end();
  }
}

test();
