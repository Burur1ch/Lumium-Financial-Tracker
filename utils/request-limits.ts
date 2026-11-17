import type { db } from "@/db";
import { requestLimits } from "@/db/schema";
import { lt, sql } from "drizzle-orm";

// The database is injected so API actions and integration tests share the same
// atomic limit, including across multiple application instances.
export async function takeRequestLimit(
  database: Pick<typeof db, "insert">,
  userId: string,
  kind: string,
  limit: number,
  seconds: number,
  now = new Date(),
) {
  const window = new Date(
    Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000,
  );
  const [claim] = await database
    .insert(requestLimits)
    .values({ user_id: userId, kind, window_start: window })
    .onConflictDoUpdate({
      target: [
        requestLimits.user_id,
        requestLimits.kind,
        requestLimits.window_start,
      ],
      set: { attempts: sql`${requestLimits.attempts} + 1` },
      setWhere: lt(requestLimits.attempts, limit),
    })
    .returning({ id: requestLimits.id });
  return Boolean(claim);
}
