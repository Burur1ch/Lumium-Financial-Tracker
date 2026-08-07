"use client";

import { useI18n } from "@/hooks/useI18n";

export default function DashboardHeader() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
        {t("dashboard")}
      </h1>
      <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-1">
        {t("welcomeBack")}
      </p>
    </div>
  );
}
