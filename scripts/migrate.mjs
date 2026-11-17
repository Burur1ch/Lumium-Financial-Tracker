import nextEnv from "@next/env";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

nextEnv.loadEnvConfig(process.cwd());
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  // Serialize deploys and allow the release operator to hold this lock while
  // the old USD-based app drains before the one-time BYN conversion.
  console.log("Waiting for database migration lock...");
  await client.query("select pg_advisory_lock(hashtextextended('lumium:migrations', 0))");
  console.log("Database migration lock acquired.");
  const existing = await client.query(
    "select to_regclass('public.currency_migration_audit') as audit, to_regclass('public.transactions') as transactions",
  );
  let rate = 0;
  if (!existing.rows[0].audit && existing.rows[0].transactions) {
    const money = await client.query(
      `select exists(select 1 from transactions union all select 1 from budgets union all select 1 from quick_transaction_presets union all select 1 from recurring_transactions union all select 1 from savings_goals) as present`,
    );
    if (money.rows[0].present) {
      rate = Number(process.env.LEGACY_USD_TO_BYN_RATE ?? 0);
      if (!rate) {
        const response = await fetch(
          "https://api.nbrb.by/exrates/rates?periodicity=0",
          { signal: AbortSignal.timeout(15000) },
        );
        if (!response.ok)
          throw new Error(
            "Cannot obtain the migration exchange rate; no amounts were changed.",
          );
        const data = await response.json();
        const usd = Array.isArray(data)
          ? data.find((item) => item.Cur_Abbreviation === "USD")
          : null;
        rate = usd ? Number(usd.Cur_OfficialRate) / Number(usd.Cur_Scale) : 0;
      }
      if (!Number.isFinite(rate) || rate <= 0 || rate > 1000)
        throw new Error(
          "Invalid USD/BYN migration rate; no amounts were changed.",
        );
    }
  }
  // Drizzle uses this same connected client and runs the pending migrations in
  // one transaction. There is no approximate fallback for existing money.
  await client.query("select set_config('lumium.usd_to_byn_rate', $1, false)", [
    String(rate),
  ]);
  await migrate(drizzle(client), { migrationsFolder: "./db/migrations" });
  console.log("Database migrations completed (base currency BYN).");
} finally {
  await client.end();
}
