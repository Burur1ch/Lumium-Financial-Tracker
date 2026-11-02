"use client";

import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/store/translations";

export function DashboardPageTitle({
  titleKey,
  subtitleKey,
}: {
  titleKey: TranslationKey;
  subtitleKey?: TranslationKey;
}) {
  const { t } = useI18n();

  return (
    <div className="hidden lg:block">
      <h1 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-50 md:text-3xl">
        {t(titleKey)}
      </h1>
      {subtitleKey && (
        <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500 dark:text-slate-400">
          {t(subtitleKey)}
        </p>
      )}
    </div>
  );
}
