import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { DATABASE_URL } = process.env;
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function inspect() {
  try {
    const integrations = await pool.query("SELECT * FROM corsair_integrations");
    console.log("Corsair Integrations:");
    console.table(integrations.rows);

    const accounts = await pool.query("SELECT * FROM corsair_accounts");
    console.log("Corsair Accounts:");
    console.table(accounts.rows);

    const users = await pool.query("SELECT id, email, name, \"calendarSyncToken\", \"gmailHistoryId\" FROM \"User\"");
    console.log("Users in DB:");
    console.table(users.rows);

    const events = await pool.query("SELECT COUNT(*) FROM \"CalendarEvent\"");
    console.log("Calendar Events Count:", events.rows[0].count);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

inspect();
