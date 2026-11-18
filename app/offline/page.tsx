"use client";

import { useEffect, useSyncExternalStore } from "react";
import AddExpenseModal from "@/components/dashboard/add-expense-modal";
import { OfflineTransactions } from "@/components/dashboard/offline-transactions";
import { useI18n } from "@/hooks/useI18n";
import { cachedOfflineAccount, readTransactionDraft } from "@/utils/offline-transactions";

export default function OfflinePage() {
  const { t } = useI18n();
  const ready = useSyncExternalStore(
    (changed) => {
      window.addEventListener("storage", changed);
      window.addEventListener("lumium:account-cached", changed);
      return () => {
        window.removeEventListener("storage", changed);
        window.removeEventListener("lumium:account-cached", changed);
      };
    },
    () => Boolean(cachedOfflineAccount()),
    () => false,
  );
  useEffect(() => {
    const timer = readTransactionDraft() ? setTimeout(() => window.dispatchEvent(new Event("lumium:open-add-transaction")), 100) : undefined;
    const reconnect = () => {
      navigator.serviceWorker.controller?.postMessage({ type: "network-status", online: true });
      window.location.replace("/dashboard");
    };
    window.addEventListener("online", reconnect);
    return () => { clearTimeout(timer); window.removeEventListener("online", reconnect); };
  }, []);
  return <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-5 py-10">
    <h1 className="text-2xl font-bold">Lumium</h1>
    <p className="text-sm leading-6 text-slate-500">{t(ready ? "offlineHint" : "offlineFirstVisit")}</p>
    {ready && <AddExpenseModal />}
    <OfflineTransactions />
    <a href="/dashboard" className="inline-flex min-h-11 items-center text-sm font-semibold underline">{t("returnToDashboard")}</a>
  </main>;
}
