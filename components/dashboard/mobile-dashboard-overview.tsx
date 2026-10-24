"use client";

import { Eye, EyeOff, Wallet, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import { CategoryArtwork } from "@/components/dashboard/category-artwork";

interface BudgetCategory {
  name: string;
  color: string;
  icon?: string | null;
  limit: number;
}

interface MobileDashboardOverviewProps {
  month: string;
  balance: number;
  balanceDelta: number;
  income: number;
  expense: number;
  incomeChange: number | null;
  expenseChange: number | null;
  trend: number[];
  budget: {
    spent: number;
    limit: number;
    categories: BudgetCategory[];
  };
}

const LOCALES = {
  en: "en-US",
  ru: "ru-RU",
  de: "de-DE",
  fr: "fr-FR",
} as const;

function getChartPoints(values: number[], width: number, height: number) {
  const normalized = values.length > 1 ? values : [0, 0];
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = max - min || 1;

  return normalized.map((value, index) => ({
    value,
    x: (index / (normalized.length - 1)) * width,
    y: height - ((value - min) / range) * (height - 12) - 6,
  }));
}

function TrendChart({ values, hidden, hasActivity }: { values: number[]; hidden: boolean; hasActivity: boolean }) {
  const normalized = hasActivity && values.length > 1 ? values : [0, 0];
  const points = getChartPoints(normalized, 148, 62);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 148 62"
      className={`h-[4.25rem] w-full overflow-visible transition-opacity ${hidden ? "opacity-20" : "opacity-100"}`}
      preserveAspectRatio="none"
    >
      <path d="M 0 52 H 148" stroke="currentColor" className="text-slate-200 dark:text-neutral-800" />
      {!hidden && hasActivity && (
        <>
          {points.slice(1).map((point, index) => {
            const previous = points[index];
            const growing = point.value >= previous.value;
            return (
              <line
                key={`${point.x}-${point.y}`}
                x1={previous.x}
                y1={previous.y}
                x2={point.x}
                y2={point.y}
                stroke={growing ? "#20c982" : "#D92D3A"}
                strokeWidth="2.7"
                strokeLinecap="round"
              />
            );
          })}
          <circle
            cx={points.at(-1)?.x}
            cy={points.at(-1)?.y}
            r="2.8"
            fill={normalized.at(-1)! >= normalized.at(-2)! ? "#20c982" : "#D92D3A"}
          />
        </>
      )}
      {!hidden && !hasActivity && (
        <path d="M 0 38 H 148" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-300 dark:text-neutral-700" />
      )}
    </svg>
  );
}

export function MobileDashboardOverview({
  month,
  balance,
  balanceDelta,
  income,
  expense,
  incomeChange,
  expenseChange,
  trend,
  budget,
}: MobileDashboardOverviewProps) {
  const { fmt, t, language, currencyRate } = useI18n();
  const { balanceHidden, toggleBalanceHidden } = usePrefs();
  const locale = LOCALES[language];
  const [monthYear, monthNumber] = month.split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: monthYear === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(monthYear, monthNumber - 1, 1, 12));
  const budgetPercent = budget.limit > 0 ? Math.min((budget.spent / budget.limit) * 100, 100) : 0;
  const greenWidth = Math.min(budgetPercent, 55);
  const amberWidth = Math.max(budgetPercent - greenWidth, 0);
  const convertedTrend = (trend.length > 1 ? trend : [0, balance]).map((value) => value * currencyRate);
  const compactFormatter = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 0 });
  const compactMax = compactFormatter.format(Math.max(...convertedTrend, 0));
  const compactMin = compactFormatter.format(Math.min(...convertedTrend, 0));
  const hasActivity = trend.length > 1 && trend.some((value) => value !== 0);
  const available = budget.limit > 0 ? budget.limit - budget.spent : balance;
  const daysInMonth = new Date(monthYear, monthNumber, 0).getDate();
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === monthYear && now.getMonth() + 1 === monthNumber;
  const isFutureMonth = new Date(monthYear, monthNumber - 1, 1).getTime() > new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const remainingDays = isCurrentMonth ? Math.max(daysInMonth - now.getDate() + 1, 1) : isFutureMonth ? daysInMonth : 0;
  const dailyAvailable = remainingDays > 0 ? available / remainingDays : null;

  return (
    <section className="space-y-3" aria-label={t("dashboard")}>
      <div className="finance-panel px-4 py-4">
        <div className="grid grid-cols-[minmax(0,1.12fr)_minmax(7.5rem,0.88fr)] items-center gap-3">
          <div className="min-w-0">
            <div className="flex min-h-11 min-w-0 items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="min-w-0 truncate">{t("availableThisMonth")}</span>
              <button
                type="button"
                onClick={toggleBalanceHidden}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                aria-label={balanceHidden ? t("showBalance") : t("hideBalance")}
                aria-pressed={balanceHidden}
              >
                {balanceHidden ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
              </button>
            </div>
            <p className={`mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(1.4rem,6.6vw,2.15rem)] font-extrabold leading-none tracking-[-0.045em] ${available < 0 ? "text-red-600 dark:text-red-400" : "text-slate-950 dark:text-white"}`}>
              {balanceHidden ? "••••••" : fmt(available)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
              <span className="font-medium text-slate-500 dark:text-neutral-400">{t("currentBalance")}</span>
              <strong className="tabular-nums text-slate-800 dark:text-neutral-100">{balanceHidden ? "••••" : fmt(balance)}</strong>
              {hasActivity && (
                <span className={`inline-flex items-center gap-1 font-semibold ${balanceDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {balanceDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="whitespace-nowrap">{balanceHidden ? "••••" : `${balanceDelta >= 0 ? "+" : ""}${fmt(balanceDelta)}`}</span>
                </span>
              )}
            </div>
          </div>
          <div className={`relative min-w-0 ${hasActivity ? "pr-8" : ""}`}>
            {hasActivity && (
              <>
                <span className="absolute right-0 top-0 text-[11px] font-medium tabular-nums text-slate-500 dark:text-neutral-400">{balanceHidden ? "••" : compactMax}</span>
                <span className="absolute bottom-1 right-0 text-[11px] font-medium tabular-nums text-slate-500 dark:text-neutral-400">{balanceHidden ? "••" : compactMin}</span>
              </>
            )}
            <TrendChart values={trend} hidden={balanceHidden} hasActivity={hasActivity} />
            {!hasActivity && !balanceHidden && (
              <span className="absolute inset-x-0 bottom-0 truncate text-center text-[11px] text-slate-500 dark:text-neutral-400">{t("noActivityThisMonth")}</span>
            )}
          </div>
        </div>

        <div className="summary-strip mt-4 grid grid-cols-2 overflow-hidden rounded-xl bg-slate-100 dark:bg-neutral-800">
          <SummaryTile type="income" amount={income} change={incomeChange} />
          <SummaryTile type="expense" amount={expense} change={expenseChange} />
        </div>
      </div>

      <div className="finance-panel px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t("budgetFor")} {monthLabel}
            </p>
            <p className="mt-1 truncate text-[clamp(1rem,4.8vw,1.125rem)] font-extrabold tracking-[-0.025em] text-slate-950 dark:text-white">
              {fmt(budget.spent)} <span className="text-sm font-medium text-slate-500">{t("of")} {fmt(budget.limit)}</span>
            </p>
          </div>
          <span className="pt-5 text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {Math.round(budgetPercent)}%
          </span>
        </div>

        <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <span className="h-full bg-emerald-500" style={{ width: `${greenWidth}%` }} />
          <span className="h-full bg-amber-400" style={{ width: `${amberWidth}%` }} />
        </div>

        {budget.limit > 0 && dailyAvailable !== null ? (
          <p className="mt-3 text-xs text-slate-600 dark:text-neutral-300">
            <strong className="tabular-nums text-slate-900 dark:text-white">{balanceHidden ? "••••" : fmt(dailyAvailable)}</strong> {t("avgPerDay")}
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">{t("setBudgetToPlanSpending")}</p>
        )}

        {budget.categories.length > 0 ? (
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {budget.categories.slice(0, 3).map((category, index) => {
              return (
                <div key={`${category.name}-${index}`} className="flex min-w-0 items-center gap-2">
                  <CategoryArtwork
                    icon={category.icon}
                    name={category.name}
                    className="h-7 w-7 rounded-lg bg-slate-100 p-0.5 dark:bg-neutral-800"
                    fallback={
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        <Wallet className="h-4 w-4" strokeWidth={2.1} />
                      </span>
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-neutral-400">{category.name}</span>
                    <strong className="block truncate text-xs text-slate-800 dark:text-slate-100">{fmt(category.limit)}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SummaryTile({
  type,
  amount,
  change,
}: {
  type: "income" | "expense";
  amount: number;
  change: number | null;
}) {
  const { fmt, t } = useI18n();
  const isIncome = type === "income";
  const positive = (change ?? 0) >= 0;
  const favorable = isIncome ? positive : !positive;

  return (
    <div className="px-3 py-3 first:border-r first:border-slate-200 first:dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <span className={isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
          {isIncome ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </span>
        <span className="text-xs font-medium text-slate-600 dark:text-neutral-300">{isIncome ? t("totalIncome") : t("totalExpenses")}</span>
      </div>
      <p className="mt-1.5 truncate text-[clamp(0.82rem,4vw,1rem)] font-extrabold tabular-nums text-slate-950 dark:text-white">{fmt(amount)}</p>
      <p className={`mt-1 text-[11px] font-semibold ${change === null ? "text-slate-500 dark:text-neutral-400" : favorable ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {change === null ? t("noDataShort") : `${change >= 0 ? "+" : ""}${change}%`} <span className="font-medium text-slate-500 dark:text-neutral-400">{t("vsPreviousMonth")}</span>
      </p>
    </div>
  );
}
