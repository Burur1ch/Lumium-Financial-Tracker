"use client";

import { useMemo, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const LOCALES = {
  en: "en-US",
  ru: "ru-RU",
  de: "de-DE",
  fr: "fr-FR",
} as const;

export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonthKey(value: string | null): value is string {
  return Boolean(value && MONTH_PATTERN.test(value));
}

export function monthKeyToDate(value: string) {
  const match = MONTH_PATTERN.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, 1, 12);
}

function shiftMonth(value: string, offset: number) {
  const date = monthKeyToDate(value);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthSelector({
  onSelect,
  variant = "grid",
}: {
  onSelect?: () => void;
  variant?: "grid" | "stepper";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { language } = usePrefs();
  const [isPending, startTransition] = useTransition();
  const currentMonth = getCurrentMonthKey();
  const rawMonth = searchParams.get("month");
  const selectedMonth = isValidMonthKey(rawMonth) ? rawMonth : currentMonth;
  const locale = LOCALES[language];

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    [locale],
  );
  const shortFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short" }),
    [locale],
  );
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => shiftMonth(currentMonth, -index)),
    [currentMonth],
  );

  const select = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", value);
    params.delete("period");
    window.dispatchEvent(new Event("lumium:nav-start"));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
    onSelect?.();
  };

  const previousMonth = shiftMonth(selectedMonth, -1);
  const nextMonth = shiftMonth(selectedMonth, 1);
  const canGoNext = nextMonth <= currentMonth;

  if (variant === "stepper") {
    return (
      <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => select(previousMonth)}
          disabled={isPending}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={t("previousMonth")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => select(currentMonth)}
          disabled={isPending}
          className="min-w-32 px-3 text-sm font-bold capitalize text-slate-800 disabled:opacity-50 dark:text-slate-100"
          title={t("currentMonth")}
        >
          {formatter.format(monthKeyToDate(selectedMonth))}
        </button>
        <button
          type="button"
          onClick={() => select(nextMonth)}
          disabled={isPending || !canGoNext}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={t("nextMonth")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-slate-100 p-1 dark:bg-white/[0.05]">
        <button
          type="button"
          onClick={() => select(previousMonth)}
          disabled={isPending}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:scale-95 disabled:opacity-50 dark:text-slate-200"
          aria-label={t("previousMonth")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <strong className="text-sm capitalize text-slate-900 dark:text-slate-100">
          {formatter.format(monthKeyToDate(selectedMonth))}
        </strong>
        <button
          type="button"
          onClick={() => select(nextMonth)}
          disabled={isPending || !canGoNext}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 active:scale-95 disabled:opacity-30 dark:text-slate-200"
          aria-label={t("nextMonth")}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {months.map((month) => {
          const date = monthKeyToDate(month);
          const selected = month === selectedMonth;
          return (
            <button
              key={month}
              type="button"
              onClick={() => select(month)}
              disabled={isPending}
              className={`min-h-12 rounded-xl px-2 text-xs font-bold capitalize transition-colors disabled:cursor-wait ${
                selected
                  ? "bg-red-500 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-red-300 hover:text-red-500 dark:border-white/[0.06] dark:bg-white/[0.035] dark:text-slate-300"
              }`}
            >
              <span className="block">{shortFormatter.format(date)}</span>
              <span className={`mt-0.5 block text-[10px] ${selected ? "text-red-100" : "text-slate-400"}`}>
                {date.getFullYear()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
