"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import {
  getPushSettings,
  subscribePush,
  unsubscribePush,
  testPush,
} from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "="),
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function PushSettings() {
  const { t, language } = useI18n();
  const [status, setStatus] = useState<
    | "loading"
    | "unsupported"
    | "install"
    | "blocked"
    | "unavailable"
    | "off"
    | "on"
  >("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [timezone, setTimezone] = useState("Europe/Minsk");
  useEffect(() => {
    let active = true;
    const zone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Minsk";
    async function load() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (active) setStatus("unsupported");
        return;
      }
      const ios =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (
        ios &&
        !window.matchMedia("(display-mode: standalone)").matches &&
        !("standalone" in navigator && navigator.standalone)
      ) {
        if (active) setStatus("install");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setStatus("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const subscription = await registration.pushManager.getSubscription();
      const settings = await getPushSettings(subscription?.endpoint);
      if (!active) return;
      setTimezone(zone);
      setStatus(
        !settings?.publicKey
          ? "unavailable"
          : settings.enabled && subscription
            ? "on"
            : "off",
      );
      if (subscription && settings?.enabled)
        await subscribePush(
          subscription.toJSON() as {
            endpoint: string;
            keys: { auth: string; p256dh: string };
          },
          zone,
          language,
        );
    }
    void load().catch(() => {
      if (active) setStatus("unavailable");
    });
    return () => {
      active = false;
    };
  }, [language]);

  async function toggle() {
    setBusy(true);
    setError(false);
    setTestSent(false);
    try {
      if (status === "on") {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          if (!(await unsubscribePush(subscription.endpoint)).success)
            throw new Error();
          await subscription.unsubscribe();
        }
        setStatus("off");
      } else {
        // Permission must be requested directly from the user's click on iOS.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "blocked" : "off");
          return;
        }
        const settings = await getPushSettings();
        if (!settings?.publicKey) throw new Error();
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationKey(settings.publicKey),
          }));
        const input = subscription.toJSON();
        if (!input.endpoint || !input.keys?.auth || !input.keys.p256dh)
          throw new Error();
        if (
          !(
            await subscribePush(
              {
                endpoint: input.endpoint,
                keys: { auth: input.keys.auth, p256dh: input.keys.p256dh },
              },
              timezone,
              language,
            )
          ).success
        ) {
          await subscription.unsubscribe();
          throw new Error();
        }
        setStatus("on");
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(false);
    setTestSent(false);
    try {
      const subscription = await (
        await navigator.serviceWorker.ready
      ).pushManager.getSubscription();
      if (!subscription || !(await testPush(subscription.endpoint)).success)
        throw new Error();
      setTestSent(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={t("pushSettingsTitle")}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-1 h-5 w-5 shrink-0 text-slate-500" />
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {t("pushSettingsTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t("pushSettingsHint")}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            14:00 · 21:00 · {timezone}
          </p>
        </div>
      </div>
      {status === "loading" ? (
        <LoaderCircle
          aria-label={t("pushSettingsTitle")}
          className="mt-4 h-5 w-5 animate-spin text-slate-400"
        />
      ) : status === "on" || status === "off" ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {status === "on" ? (
              <BellOff className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {t(status === "on" ? "pushDisable" : "pushEnable")}
          </button>
          {status === "on" && (
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
            >
              {t("pushTest")}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          {t(
            status === "install"
              ? "pushInstallHint"
              : status === "blocked"
                ? "pushBlockedHint"
                : status === "unsupported"
                  ? "pushUnsupportedHint"
                  : "pushUnavailableHint",
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {t("genericError")}
        </p>
      )}
      {testSent && (
        <p role="status" className="mt-3 text-sm text-emerald-600">
          {t("pushTestSent")}
        </p>
      )}
    </section>
  );
}
