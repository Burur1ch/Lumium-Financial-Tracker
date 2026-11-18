"use client";
import { unsubscribePush } from "@/app/dashboard/actions";
import { clearOfflineSession } from "@/utils/offline-transactions";

export async function stopDeviceReminders() {
  clearOfflineSession();
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    const result = await unsubscribePush(subscription.endpoint);
    if (!result.success) throw new Error("Could not disable device reminders");
    await subscription.unsubscribe();
  }
}
