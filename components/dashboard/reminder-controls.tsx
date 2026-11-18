"use client";

import { useEffect, useState } from "react";
import { getPushSettings, getReminderDay, updateReminderDay } from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";

export function ReminderControls({ enabled }: { enabled?: boolean }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(enabled ?? false);
  const [state, setState] = useState<"ready" | "done" | "snooze">("ready");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      let on = enabled;
      if (on === undefined) {
        const registration = await navigator.serviceWorker?.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        on = subscription ? (await getPushSettings(subscription.endpoint))?.enabled : false;
      }
      if (!active) return;
      setVisible(Boolean(on));
      if (!on) return;
      const day = await getReminderDay(Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (active) setState(day?.completed ? "done" : day?.snoozedUntil && new Date(day.snoozedUntil) > new Date() ? "snooze" : "ready");
    }
    const refresh = () => void load().catch(() => {});
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [enabled]);

  async function update(action: "done" | "snooze") {
    setBusy(true);
    setError(false);
    try {
      const result = await updateReminderDay(action, Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (!result.success) throw new Error();
      setState(action);
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  if (!visible) return null;
  return <div className="mt-4 space-y-2">
    {state !== "ready" && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{t(state === "done" ? "reminderCompleted" : "reminderSnoozed")}</p>}
    {state !== "done" && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void update("done")} className="min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">{t("reminderDone")}</button>
      {state !== "snooze" && <button type="button" disabled={busy} onClick={() => void update("snooze")} className="min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">{t("reminderSnooze")}</button>}
    </div>}
    {error && <p role="alert" className="text-xs text-red-600">{t("genericError")}</p>}
  </div>;
}
