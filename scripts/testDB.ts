import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env' });
}

async function run() {
  const { pool } = await import('../src/lib/db');
  try {
    const res = await pool.query("SELECT * FROM corsair_accounts LIMIT 5");
    console.log("Accounts:", res.rows);
    const res2 = await pool.query("SELECT * FROM corsair_integrations LIMIT 5");
    console.log("Integrations:", res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
