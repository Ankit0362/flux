import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { pool } from "./db";

// Fail loudly at startup if CORSAIR_KEK is not configured.
// This key encrypts OAuth tokens at rest — NEVER use a hardcoded fallback.
const kek = process.env.CORSAIR_KEK;
if (!kek || kek.length < 32) {
  throw new Error(
    "CORSAIR_KEK environment variable is not set or is too short (must be 32+ chars). " +
    "Create a .env file based on .env.example and set CORSAIR_KEK."
  );
}

const globalForCorsair = globalThis as unknown as {
  corsair: ReturnType<typeof createCorsair> | undefined;
};

export const corsair =
  globalForCorsair.corsair ??
  createCorsair({
    multiTenancy: true,
    database: pool,
    kek,
    plugins: [gmail(), googlecalendar()],
  });

// Store singleton in globalThis in ALL environments.
globalForCorsair.corsair = corsair;
