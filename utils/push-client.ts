"use client";
import { unsubscribePush } from "@/app/dashboard/actions";

export async function stopDeviceReminders() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const result = await unsubscribePush(subscription.endpoint);
    if (!result.success) throw new Error("Could not disable device reminders");
    await subscription.unsubscribe();
  }
}
