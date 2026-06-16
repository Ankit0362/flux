/**
 * scripts/test-gmail-api.mjs
 * Tests the Gmail API directly with the configured tenant.
 */
import pg from "pg";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { DATABASE_URL, CORSAIR_KEK } = process.env;
const pool = new pg.Pool({ connectionString: DATABASE_URL });

const corsair = createCorsair({
  multiTenancy: true,
  database: pool,
  kek: CORSAIR_KEK,
  plugins: [gmail()],
});

async function test() {
  try {
    const res = await pool.query("SELECT tenant_id FROM corsair_accounts LIMIT 1");
    if (res.rows.length === 0) {
      console.log("No connected accounts found.");
      return;
    }
    const tenantId = res.rows[0].tenant_id;
    console.log(`Testing with tenantId: ${tenantId}`);

    const tc = corsair.withTenant(tenantId);
    
    console.log("Calling labels.list()...");
    const labels = await tc.gmail.api.labels.list({ userId: "me" });
    console.log("Labels OK:", labels.labels?.length);

    console.log("Calling threads.list()...");
    const threads = await tc.gmail.api.threads.list({ maxResults: 1 });
    console.log("Threads OK:", threads.threads?.length);

  } catch (err) {
    console.error("API Error:", err);
  } finally {
    await pool.end();
  }
}

test();
