import "server-only";
import * as webpush from "web-push";
import { and, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, pushDeliveries, reminderDays, transactions } from "@/db/schema";
import { localDate, reminderSlot } from "@/utils/reminders";
import { translations } from "@/store/translations";

export type DevicePush = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
const pushHosts = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "wns.windows.com",
  "notify.windows.com",
];
export function validPushSubscription(input: unknown): input is DevicePush {
  if (!input || typeof input !== "object") return false;
  const value = input as Partial<DevicePush>;
  if (typeof value.endpoint !== "string" || value.endpoint.length > 2048)
    return false;
  try {
    const url = new URL(value.endpoint);
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      !pushHosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    )
      return false;
  } catch {
    return false;
  }
  return (
    typeof value.keys?.p256dh === "string" &&
    /^[A-Za-z0-9_-]{87}$/.test(value.keys.p256dh) &&
    Buffer.from(value.keys.p256dh, "base64url")[0] === 4 &&
    typeof value.keys?.auth === "string" &&
    /^[A-Za-z0-9_-]{22}$/.test(value.keys.auth)
  );
}

export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.NEXT_PUBLIC_APP_URL;
  return publicKey && privateKey && subject
    ? { publicKey, privateKey, subject }
    : null;
}

export async function sendDevicePush(
  device: DevicePush,
  language: string,
  tag: string,
  timezone = "Europe/Minsk",
) {
  const config = pushConfiguration();
  if (!config) throw new Error("PUSH_NOT_CONFIGURED");
  const locale =
    language === "ru" || language === "de" || language === "fr"
      ? language
      : "en";
  return webpush.sendNotification(
    device,
    JSON.stringify({
      title: translations[locale].pushReminderTitle,
      body: translations[locale].pushReminderBody,
      tag,
      url: "/dashboard?add=expense",
      timezone,
      actions: [
        { action: "done", title: translations[locale].reminderDone },
        { action: "snooze", title: translations[locale].reminderSnooze },
      ],
    }),
    { vapidDetails: config, TTL: 900, urgency: "normal", timeout: 8000 },
  );
}

export async function deliverReminders(now = new Date()) {
  if (!pushConfiguration()) return { sent: 0, failed: 0 };
  const devices = await db.select().from(pushSubscriptions);
  let sent = 0,
    failed = 0;
  for (const device of devices) {
    const date = localDate(now, device.timezone);
    const [day] = await db.select().from(reminderDays).where(and(
      eq(reminderDays.user_id, device.user_id), eq(reminderDays.local_date, date),
    )).limit(1);
    if (day?.completed) continue;
    const [postponed] = await db.select({ until: reminderDays.snoozed_until }).from(reminderDays).where(and(
      eq(reminderDays.user_id, device.user_id), eq(reminderDays.completed, false),
      gte(reminderDays.snoozed_until, new Date(now.getTime() - 900000)),
    )).orderBy(desc(reminderDays.snoozed_until)).limit(1);
    const snooze = postponed?.until;
    if (snooze && snooze > now) continue;
    const dueSnooze = snooze && now.getTime() - snooze.getTime() < 900000;
    const slot = dueSnooze ? { date, hour: Math.floor(snooze.getTime() / 60000) } : reminderSlot(now, device.timezone);
    if (!slot) continue;
    const [recent] = await db.select({ id: transactions.id }).from(transactions).where(and(
      eq(transactions.user_id, device.user_id), eq(transactions.type, "expense"),
      isNull(transactions.recurring_transaction_id),
      eq(transactions.status, "completed"), gte(transactions.created_at, new Date(now.getTime() - 3600000)),
      lte(transactions.created_at, now),
    )).limit(1);
    if (recent && !dueSnooze) continue;
    await db
      .insert(pushDeliveries)
      .values({
        subscription_id: device.id,
        local_date: slot.date,
        slot: slot.hour,
        retry_at: now,
      })
      .onConflictDoNothing();
    // Atomic lease prevents two workers from sending the same slot concurrently.
    const [claim] = await db
      .update(pushDeliveries)
      .set({
        attempts: sql`${pushDeliveries.attempts} + 1`,
        retry_at: new Date(now.getTime() + 120000),
      })
      .where(
        and(
          eq(pushDeliveries.subscription_id, device.id),
          eq(pushDeliveries.local_date, slot.date),
          eq(pushDeliveries.slot, slot.hour),
          isNull(pushDeliveries.sent_at),
          lte(pushDeliveries.retry_at, now),
          lt(pushDeliveries.attempts, 3),
        ),
      )
      .returning({ id: pushDeliveries.id });
    if (!claim) continue;
    try {
      await sendDevicePush(
        {
          endpoint: device.endpoint,
          keys: { auth: device.auth, p256dh: device.p256dh },
        },
        device.language,
        `lumium-${slot.date}-${slot.hour}`,
        device.timezone,
      );
      await db
        .update(pushDeliveries)
        .set({ sent_at: now })
        .where(eq(pushDeliveries.id, claim.id));
      sent++;
    } catch (error) {
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (status === 404 || status === 410)
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, device.id));
      failed++;
    }
  }
  await db
    .delete(pushDeliveries)
    .where(
      lt(
        pushDeliveries.local_date,
        new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10),
      ),
    );
  await db.delete(reminderDays).where(lt(reminderDays.local_date, new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)));
  return { sent, failed };
}
