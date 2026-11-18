import "server-only";
import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { recurringTransactions, transactions } from "@/db/schema";
import { nextRecurringDate } from "@/utils/reminders";

export async function materializeRecurring(
  id: string,
  userId: string,
  automatic = false,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.user_id, userId),
        ),
      )
      .for("update");
    if (!item || !item.active || (automatic && !item.auto_create)
      || (item.frequency === "once" && item.last_created_at))
      return { found: false, createdCount: 0, transactionId: null };
    const today = now.toISOString().slice(0, 10);
    let date = item.next_date;
    let createdCount = 0;
    let transactionId: string | null = null;
    for (
      let count = 0;
      count < (automatic ? 52 : 1) && (!automatic || date <= today);
      count++
    ) {
      const [created] = await tx
        .insert(transactions)
        .values({
          user_id: item.user_id,
          category_id: item.category_id,
          description: item.name,
          amount: item.amount,
          type: item.type,
          status: "completed",
          review_status: "reviewed",
          recurring_transaction_id: item.id,
          idempotency_key: `recurring-${item.id}-${date}`,
          date: new Date(`${date}T12:00:00Z`),
        })
        .onConflictDoNothing({
          target: [transactions.user_id, transactions.idempotency_key],
        })
        .returning({ id: transactions.id });
      if (created) {
        createdCount++;
        transactionId = created.id;
      }
      if (item.frequency === "once") break;
      date = nextRecurringDate(date, item.frequency, item.anchor_date);
    }
    if (date !== item.next_date || item.frequency === "once")
      await tx
        .update(recurringTransactions)
        .set({ next_date: date, last_created_at: now, updated_at: now,
          ...(item.frequency === "once" ? { active: false } : {}),
        })
        .where(eq(recurringTransactions.id, item.id));
    return { found: true, createdCount, transactionId };
  });
}

export async function processRecurring(userId?: string, now = new Date()) {
  const due = await db
    .select({
      id: recurringTransactions.id,
      userId: recurringTransactions.user_id,
    })
    .from(recurringTransactions)
    .where(
      and(
        eq(recurringTransactions.active, true),
        eq(recurringTransactions.auto_create, true),
        lte(recurringTransactions.next_date, now.toISOString().slice(0, 10)),
        userId ? eq(recurringTransactions.user_id, userId) : undefined,
      ),
    )
    .orderBy(asc(recurringTransactions.next_date))
    .limit(100);
  let createdCount = 0;
  for (const item of due)
    createdCount += (
      await materializeRecurring(item.id, item.userId, true, now)
    ).createdCount;
  return createdCount;
}
