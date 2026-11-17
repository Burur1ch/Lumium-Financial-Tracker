"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { exportAccountData } from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";

export function AccountExport() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function download() {
    setBusy(true);
    setError(false);
    try {
      const result = await exportAccountData();
      if (!result.success) throw new Error();
      const prefs = usePrefs.getState();
      const body = {
        ...result.data,
        preferences: {
          currency: prefs.currency,
          language: prefs.language,
          dateFormat: prefs.dateFormat,
          avatarColor: prefs.avatarColor,
          avatarIcon: prefs.avatarIcon,
          avatarPreset: prefs.avatarPreset,
        },
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `lumium-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
        {t("accountExportTitle")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {t("accountExportHint")}
      </p>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
      >
        <Download className="h-4 w-4" />
        {t(busy ? "exportingEllipsis" : "accountExportButton")}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {t("genericError")}
        </p>
      )}
    </section>
  );
}
