"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import { PaywallModal } from "@/components/dashboard/paywall-modal";
import {
  canAccessPeriod,
  getAccessiblePeriods,
} from "@/utils/monetization/limits";

const STORAGE_KEY = "lumium_period";
const VALID_PERIODS = ["7d", "30d", "3m", "1y", "all"] as const;
type Period = (typeof VALID_PERIODS)[number];

function isValidPeriod(v: string | null): v is Period {
  return VALID_PERIODS.includes(v as Period);
}

export default function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { plan } = usePrefs();
  const rawPeriod = searchParams.get("period");
  const current: Period = isValidPeriod(rawPeriod) ? rawPeriod : "30d";
  const [isPending, startTransition] = useTransition();
  const [showPaywall, setShowPaywall] = useState(false);
  const { t } = useI18n();
  const accessiblePeriods = getAccessiblePeriods(plan);

  const PERIODS = [
    { label: "7d", value: "7d" },
    { label: "30d", value: "30d" },
    { label: "3m", value: "3m" },
    { label: "1y", value: "1y" },
    { label: t("all"), value: "all" },
  ];

  // On mount: if no period in URL, restore from localStorage
  useEffect(() => {
    if (rawPeriod && !canAccessPeriod(plan, rawPeriod)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", "30d");
      router.replace(`${pathname}?${params.toString()}`);
      localStorage.setItem(STORAGE_KEY, "30d");
      return;
    }

    if (rawPeriod) {
      // URL already has a period — save it
      if (isValidPeriod(rawPeriod)) {
        localStorage.setItem(STORAGE_KEY, rawPeriod);
      }
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (
      isValidPeriod(saved) &&
      saved !== "30d" &&
      canAccessPeriod(plan, saved)
    ) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", saved);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [pathname, plan, rawPeriod, router, searchParams]);

  const select = (value: string) => {
    if (!canAccessPeriod(plan, value)) {
      setShowPaywall(true);
      return;
    }
    localStorage.setItem(STORAGE_KEY, value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    window.dispatchEvent(new Event("lumium:nav-start"));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex min-w-max items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
      {PERIODS.map((p) => {
        const locked = !accessiblePeriods.includes(p.value as Period);

        return (
          <button
            key={p.value}
            onClick={() => select(p.value)}
            disabled={isPending}
            className={`relative min-h-10 min-w-11 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-150 disabled:cursor-wait ${
              current === p.value
                ? "bg-red-500 text-white shadow-sm shadow-red-500/20"
                : locked
                  ? "text-slate-400 dark:text-slate-600 hover:text-red-500"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
            title={locked ? t("upgradeToPro") : undefined}
          >
            {p.label}
            {isPending && current === p.value && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              </span>
            )}
            {locked && !isPending && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        );
      })}

      {showPaywall && (
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          title={t("periodLockedTitle")}
          description={t("periodLockedDesc")}
          featureLabel={t("unlockLongerPeriods")}
        />
      )}
    </div>
  );
}
