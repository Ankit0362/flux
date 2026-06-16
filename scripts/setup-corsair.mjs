/**
 * scripts/setup-corsair.mjs
 * Creates the corsair_* tables in the database.
 * Run once after `prisma db push`: node scripts/setup-corsair.mjs
 */
import pg from "pg";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { setupCorsair } from "corsair/setup";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { DATABASE_URL, CORSAIR_KEK } = process.env;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env.local");
  process.exit(1);
}
if (!CORSAIR_KEK || CORSAIR_KEK.length < 32) {
  console.error("❌ CORSAIR_KEK is not set or too short in .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const corsair = createCorsair({
  multiTenancy: true,
  database: pool,
  kek: CORSAIR_KEK,
  plugins: [gmail(), googlecalendar()],
});

console.log("🔧 Running Corsair setup (creates corsair_* tables)...\n");

try {
  const output = await setupCorsair(corsair);
  console.log(output);
  console.log("\n✅ Corsair setup complete!");
} catch (err) {
  console.error("❌ Corsair setup failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
