"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useTransition } from "react";
import { useI18n } from "@/hooks/useI18n";

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
  const rawPeriod = searchParams.get("period");
  const current: Period = isValidPeriod(rawPeriod) ? rawPeriod : "30d";
  const [isPending, startTransition] = useTransition();
  const { t } = useI18n();

  const PERIODS = [
    { label: "7d", value: "7d" },
    { label: "30d", value: "30d" },
    { label: "3m", value: "3m" },
    { label: "1y", value: "1y" },
    { label: t("all"), value: "all" },
  ];

  // On mount: if no period in URL, restore from localStorage
  useEffect(() => {
    if (rawPeriod) {
      // URL already has a period — save it
      if (isValidPeriod(rawPeriod)) {
        localStorage.setItem(STORAGE_KEY, rawPeriod);
      }
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isValidPeriod(saved) && saved !== "30d") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", saved);
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (value: string) => {
    localStorage.setItem(STORAGE_KEY, value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    window.dispatchEvent(new Event("lumium:nav-start"));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => select(p.value)}
          disabled={isPending}
          className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 disabled:cursor-wait ${
            current === p.value
              ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          {p.label}
          {isPending && current === p.value && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
