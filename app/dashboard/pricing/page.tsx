"use client";

import { Clock3, CreditCard } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

export default function PricingPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-950 dark:text-slate-50">
        {t("pricing")}
      </h1>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 dark:border-slate-800 dark:bg-slate-900">
        <CreditCard
          className="mb-6 h-10 w-10 text-slate-400"
          strokeWidth={1.5}
        />
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Clock3 className="h-3.5 w-3.5" />
          {t("comingSoon")}
        </span>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("billingComingSoonTitle")}
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
          {t("billingComingSoonDesc")}
        </p>
      </section>
    </div>
  );
}
