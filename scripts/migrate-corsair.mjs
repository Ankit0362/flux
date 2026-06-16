/**
 * scripts/migrate-corsair.mjs
 * Creates the 5 corsair_* tables that Corsair requires.
 * Run once: node scripts/migrate-corsair.mjs
 */
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const migrations = [
  {
    name: "corsair_integrations",
    sql: `
      CREATE TABLE IF NOT EXISTS corsair_integrations (
        id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        name        TEXT        NOT NULL UNIQUE,
        config      JSONB       NOT NULL DEFAULT '{}',
        dek         TEXT
      );
    `,
  },
  {
    name: "corsair_accounts",
    sql: `
      CREATE TABLE IF NOT EXISTS corsair_accounts (
        id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        tenant_id       TEXT        NOT NULL,
        integration_id  TEXT        NOT NULL REFERENCES corsair_integrations(id) ON DELETE CASCADE,
        config          JSONB       NOT NULL DEFAULT '{}',
        dek             TEXT,
        UNIQUE (tenant_id, integration_id)
      );
    `,
  },
  {
    name: "corsair_entities",
    sql: `
      CREATE TABLE IF NOT EXISTS corsair_entities (
        id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        account_id  TEXT        NOT NULL REFERENCES corsair_accounts(id) ON DELETE CASCADE,
        entity_id   TEXT        NOT NULL,
        entity_type TEXT        NOT NULL,
        version     TEXT        NOT NULL,
        data        JSONB       NOT NULL DEFAULT '{}',
        UNIQUE (account_id, entity_id, entity_type)
      );
    `,
  },
  {
    name: "corsair_events",
    sql: `
      CREATE TABLE IF NOT EXISTS corsair_events (
        id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        account_id  TEXT        NOT NULL REFERENCES corsair_accounts(id) ON DELETE CASCADE,
        event_type  TEXT        NOT NULL,
        payload     JSONB       NOT NULL DEFAULT '{}',
        status      TEXT        DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed'))
      );
    `,
  },
  {
    name: "corsair_permissions",
    sql: `
      CREATE TABLE IF NOT EXISTS corsair_permissions (
        id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        token       TEXT        NOT NULL UNIQUE,
        plugin      TEXT        NOT NULL,
        endpoint    TEXT        NOT NULL,
        args        TEXT        NOT NULL,
        tenant_id   TEXT        NOT NULL DEFAULT '',
        status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','executing','completed','denied','expired','failed')),
        expires_at  TEXT        NOT NULL,
        error       TEXT
      );
    `,
  },
];

console.log("🔧 Creating Corsair tables...\n");

const client = await pool.connect();
try {
  for (const { name, sql } of migrations) {
    process.stdout.write(`  → ${name}... `);
    await client.query(sql);
    console.log("✅");
  }
  console.log("\n✅ All Corsair tables created successfully!");
} catch (err) {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
