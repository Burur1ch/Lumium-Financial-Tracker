import { timingSafeEqual } from "node:crypto";
import { processRecurring } from "@/utils/recurring";
import { deliverReminders } from "@/utils/push";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requestLimits } from "@/db/schema";
import { lt } from "drizzle-orm";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const created = await processRecurring();
    const reminders = await deliverReminders();
    await db
      .delete(requestLimits)
      .where(lt(requestLimits.window_start, new Date(Date.now() - 86400000)));
    if (created) revalidatePath("/dashboard", "layout");
    return Response.json(
      { created, reminders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("Scheduled financial jobs failed; the next tick will retry.");
    return Response.json({ error: "Job failed" }, { status: 500 });
  }
}
