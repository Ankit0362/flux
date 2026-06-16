import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Fail loudly at startup if DATABASE_URL is not configured.
// Never fall back to a hardcoded credential in any environment.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
    "Create a .env file based on .env.example and set DATABASE_URL."
  );
}

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  prisma: PrismaClient | undefined;
};

// max:2 is safe for serverless — each cold-start gets at most 2 connections.
// Use a connection pooler (pgBouncer / Supabase Pooler) in front of Postgres
// if you scale beyond a handful of concurrent users.
export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForDb.prisma ??
  new PrismaClient({
    adapter,
  });

// Store singleton in globalThis in ALL environments (not just development).
// This ensures Vercel serverless invocations that share a warm container
// reuse the same pool rather than creating a new one per request.
globalForDb.pool = pool;
globalForDb.prisma = prisma;
