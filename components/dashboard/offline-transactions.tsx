"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccountPreferences, getCategories } from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";
import { isCurrency } from "@/utils/currency";
import { cacheOfflineAccount, cachedOfflineAccount, flushTransactions, pendingTransactions, removePendingTransaction } from "@/utils/offline-transactions";

export function OfflineTransactions() {
  const { t, fmt } = useI18n();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ReturnType<typeof pendingTransactions>>([]);

  useEffect(() => {
    let active = true;
    let running = false;
    const countItems = () => {
      const account = cachedOfflineAccount();
      if (active) {
        const pending = account ? pendingTransactions(account.userId) : [];
        setItems(pending);
        setCount(pending.length);
      }
    };
    async function sync() {
      if (running || !navigator.onLine) return;
      running = true;
      if (active) setBusy(true);
      try {
        const account = await getAccountPreferences();
        if (!account || !active) return;
        const categories = await getCategories();
        if (!active) return;
        cacheOfflineAccount({ userId: account.userId, categories });
        const result = await flushTransactions(account.userId);
        setFailed(result.failed);
        if (result.sent) router.refresh();
      } catch {
        if (active) setFailed(true);
      } finally {
        running = false;
        if (active) setBusy(false);
        countItems();
      }
    }
    const networkStatus = () => navigator.serviceWorker?.controller?.postMessage({ type: "network-status", online: navigator.onLine });
    const requestSync = () => { networkStatus(); void sync(); };
    countItems();
    void navigator.serviceWorker?.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        registration.active?.postMessage({ type: "network-status", online: navigator.onLine });
        if (navigator.onLine) registration.active?.postMessage("prepare-offline");
      }).catch(() => {});
    void sync();
    const interval = setInterval(requestSync, 30000);
    window.addEventListener("online", requestSync);
    window.addEventListener("offline", networkStatus);
    window.addEventListener("focus", requestSync);
    window.addEventListener("lumium:retry-queue", requestSync);
    window.addEventListener("lumium:queue-changed", countItems);
    window.addEventListener("storage", countItems);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("online", requestSync);
      window.removeEventListener("offline", networkStatus);
      window.removeEventListener("focus", requestSync);
      window.removeEventListener("lumium:retry-queue", requestSync);
      window.removeEventListener("lumium:queue-changed", countItems);
      window.removeEventListener("storage", countItems);
    };
  }, [router]);

  if (!count) return null;
  return <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
    <div className="flex items-center justify-between gap-3">
      <span role="status">{t(failed ? "offlineSyncFailed" : "offlinePending")} {count}</span>
      <button type="button" disabled={busy} onClick={() => window.dispatchEvent(new Event("lumium:retry-queue"))} className="min-h-11 shrink-0 font-semibold underline disabled:opacity-50">{t(busy ? "savingEllipsis" : "retrySync")}</button>
    </div>
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center underline">{t("viewPending")}</summary>
      <ul className="max-h-52 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const entry = item.kind === "manual" ? item.fields : item.input;
          const amount = fmt(Number(entry.amount), { noConvert: true, currency: isCurrency(entry.currency) ? entry.currency : "BYN" });
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 py-2 dark:border-amber-900">
              <span className="min-w-0 break-words">{entry.description} · {amount}</span>
              <div className="flex gap-2">
                {item.kind === "manual" && item.error && item.error !== "UNAUTHORIZED" && (
                  <button type="button" disabled={busy} className="min-h-11 font-semibold underline"
                    onClick={() => window.dispatchEvent(new CustomEvent("lumium:open-add-transaction", { detail: item.fields }))}>
                    {t("edit")}
                  </button>
                )}
                <button type="button" disabled={busy} className="min-h-11 font-semibold underline"
                  onClick={() => {
                    if (window.confirm(t("removeQueuedConfirm"))) removePendingTransaction(item.userId, item.id);
                  }}>
                  {t("deleteTransaction")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  </div>;
}
