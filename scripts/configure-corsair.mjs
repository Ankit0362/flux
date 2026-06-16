/**
 * scripts/configure-corsair.mjs
 * Sets Google OAuth credentials on the Corsair gmail + googlecalendar integrations.
 * Run once after migrate-corsair.mjs: node scripts/configure-corsair.mjs
 */
import pg from "pg";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const {
  DATABASE_URL,
  CORSAIR_KEK,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_PUBSUB_TOPIC,
} = process.env;

if (!DATABASE_URL || !CORSAIR_KEK || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("❌ Missing required env vars. Check .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const corsair = createCorsair({
  multiTenancy: true,
  database: pool,
  kek: CORSAIR_KEK,
  plugins: [gmail(), googlecalendar()],
});

console.log("🔑 Configuring Corsair OAuth credentials...\n");

try {
  // Set Gmail credentials
  process.stdout.write("  → gmail.client_id... ");
  await corsair.keys.gmail.set_client_id(GOOGLE_CLIENT_ID);
  console.log("✅");

  process.stdout.write("  → gmail.client_secret... ");
  await corsair.keys.gmail.set_client_secret(GOOGLE_CLIENT_SECRET);
  console.log("✅");

  // topic_id is optional (needed for push notifications / webhooks)
  if (GOOGLE_PUBSUB_TOPIC) {
    process.stdout.write("  → gmail.topic_id... ");
    await corsair.keys.gmail.set_topic_id(GOOGLE_PUBSUB_TOPIC);
    console.log("✅");
  } else {
    console.log("  ℹ️  gmail.topic_id skipped (GOOGLE_PUBSUB_TOPIC not set — push notifications disabled)");
  }

  // Set Google Calendar credentials
  process.stdout.write("  → googlecalendar.client_id... ");
  await corsair.keys.googlecalendar.set_client_id(GOOGLE_CLIENT_ID);
  console.log("✅");

  process.stdout.write("  → googlecalendar.client_secret... ");
  await corsair.keys.googlecalendar.set_client_secret(GOOGLE_CLIENT_SECRET);
  console.log("✅");

  console.log("\n✅ Corsair credentials configured! You can now run the app.");
} catch (err) {
  console.error("\n❌ Failed to configure credentials:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
