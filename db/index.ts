import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });