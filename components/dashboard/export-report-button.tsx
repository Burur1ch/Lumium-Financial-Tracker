"use client";

import { useState, useTransition } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportReportWorkbook } from "@/app/dashboard/actions";
import { PaywallModal } from "@/components/dashboard/paywall-modal";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import { canAccessAdvancedReports } from "@/utils/monetization/limits";
import type { PlanKey } from "@/utils/monetization/plans";

export function ExportReportButton({
  period,
  plan: serverPlan,
}: {
  period: string;
  plan?: PlanKey;
}) {
  const { t, language } = useI18n();
  const storedPlan = usePrefs((state) => state.plan);
  const plan = serverPlan ?? storedPlan;
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    if (!canAccessAdvancedReports(plan)) {
      setShowPaywall(true);
      return;
    }

    setHasError(false);
    startTransition(async () => {
      try {
        const result = await exportReportWorkbook(period, language);
        if (!result.success || !result.workbook || !result.filename) {
          setHasError(true);
          return;
        }

        const binary = Uint8Array.from(atob(result.workbook), (char) =>
          char.charCodeAt(0),
        );
        const blob = new Blob([binary], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        setHasError(true);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60"
      >
        {canAccessAdvancedReports(plan) ? (
          <Download className="w-4 h-4" />
        ) : (
          <FileSpreadsheet className="w-4 h-4 text-red-500" />
        )}
        {isPending ? t("exportingEllipsis") : t("exportExcel")}
      </button>
      {hasError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t("genericError")}
        </p>
      )}

      {showPaywall && (
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          title={t("exportLockedTitle")}
          description={t("reportExportLockedDesc")}
          featureLabel={t("exportExcel")}
        />
      )}
    </>
  );
}
