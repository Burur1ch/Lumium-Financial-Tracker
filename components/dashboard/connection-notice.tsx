"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";

export function ConnectionNotice() {
  const { t, currency } = useI18n();
  const source = usePrefs((state) => state.exchangeRateSource);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online && (currency === "BYN" || source !== "fallback")) return null;
  return (
    <p
      role="status"
      className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      {t(online ? "exchangeFallbackHint" : "offlineHint")}
    </p>
  );
}

export function PushEntry() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("add") !== "expense") return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("lumium:open-add-transaction"));
      url.searchParams.delete("add");
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
