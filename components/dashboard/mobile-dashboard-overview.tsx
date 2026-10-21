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

function buildPath(values: number[], width: number, height: number) {
  const points = getChartPoints(values, width, height);
  if (points.length < 2) return `M 0 ${height / 2} L ${width} ${height / 2}`;
  return points
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function TrendChart({ values, hidden }: { values: number[]; hidden: boolean }) {
  const normalized = values.length > 1 ? values : [0, 0];
  const points = getChartPoints(normalized, 148, 62);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 148 62"
      className={`h-[4.25rem] w-full overflow-visible transition-opacity ${hidden ? "opacity-20" : "opacity-100"}`}
      preserveAspectRatio="none"
    >
      <path d="M 0 52 H 148" stroke="currentColor" strokeDasharray="3 5" className="text-slate-300 dark:text-slate-700" />
      {!hidden && (
        <>
          <path d={buildPath(normalized, 148, 62)} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 dark:text-slate-700" />
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
                stroke={growing ? "#20c982" : "#ef4444"}
                strokeWidth="2.7"
                strokeLinecap="round"
              />
            );
          })}
          <circle
            cx={points.at(-1)?.x}
            cy={points.at(-1)?.y}
            r="2.8"
            fill={normalized.at(-1)! >= normalized.at(-2)! ? "#20c982" : "#ef4444"}
          />
        </>
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

  return (
    <section className="space-y-3" aria-label={t("dashboard")}>
      <div className="finance-panel px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1.12fr)_minmax(7.5rem,0.88fr)] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>{t("myBalance")}</span>
              <button
                type="button"
                onClick={toggleBalanceHidden}
                className="-m-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                aria-label={balanceHidden ? t("showBalance") : t("hideBalance")}
                aria-pressed={balanceHidden}
              >
                {balanceHidden ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
              </button>
            </div>
            <p className="mt-1 whitespace-nowrap text-[clamp(1.55rem,7.2vw,2.15rem)] font-extrabold leading-none tracking-[-0.055em] text-slate-950 dark:text-white">
              {balanceHidden ? "••••••" : fmt(balance)}
            </p>
            <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${balanceDelta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {balanceDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="whitespace-nowrap">{balanceHidden ? "••••" : `${balanceDelta >= 0 ? "+" : ""}${fmt(balanceDelta)}`}</span>
              <span className="font-medium text-slate-400 dark:text-slate-500">{t("vsPreviousMonth")}</span>
            </div>
          </div>
          <div className="relative min-w-0 pr-8">
            <span className="absolute right-0 top-0 text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500">{balanceHidden ? "••" : compactMax}</span>
            <span className="absolute bottom-1 right-0 text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500">{balanceHidden ? "••" : compactMin}</span>
            <TrendChart values={trend} hidden={balanceHidden} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
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

        {budget.categories.length > 0 ? (
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {budget.categories.slice(0, 3).map((category, index) => {
              return (
                <div key={`${category.name}-${index}`} className="flex min-w-0 items-center gap-2">
                  <CategoryArtwork
                    icon={category.icon}
                    name={category.name}
                    className="h-7 w-7 rounded-lg"
                    fallback={
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${category.color}22`, color: category.color }}
                      >
                        <Wallet className="h-4 w-4" strokeWidth={2.1} />
                      </span>
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">{category.name}</span>
                    <strong className="block truncate text-xs text-slate-800 dark:text-slate-100">{fmt(category.limit)}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{t("noBudgetSet")}</p>
        )}
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
    <div className="rounded-2xl border border-slate-200/70 bg-white/75 px-3 py-2.5 dark:border-white/[0.055] dark:bg-white/[0.035]">
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isIncome ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-red-100 text-red-500 dark:bg-red-500/15"}`}>
          {isIncome ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </span>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{isIncome ? t("totalIncome") : t("totalExpenses")}</span>
      </div>
      <p className="mt-1.5 truncate text-[clamp(0.82rem,4vw,1rem)] font-extrabold tabular-nums text-slate-950 dark:text-white">{fmt(amount)}</p>
      <p className={`mt-1 text-[10px] font-semibold ${favorable ? "text-emerald-500" : "text-red-500"}`}>
        {change === null ? t("noDataShort") : `${change >= 0 ? "+" : ""}${change}%`} <span className="font-medium text-slate-400 dark:text-slate-500">{t("vsPreviousMonth")}</span>
      </p>
    </div>
  );
}
