"use client";

import { CarFront, Eye, House, TrendingDown, TrendingUp, Utensils } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface BudgetCategory {
  name: string;
  color: string;
  limit: number;
}

interface MobileDashboardOverviewProps {
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

function buildPath(values: number[], width: number, height: number) {
  if (values.length < 2) return `M 0 ${height / 2} L ${width} ${height / 2}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function TrendChart({ values }: { values: number[] }) {
  const normalized = values.length > 1 ? values : [0, 0, 0, 0, 0, 0];
  const splitIndex = Math.max(2, Math.floor(normalized.length * 0.35));
  const first = normalized.slice(0, splitIndex);
  const second = normalized.slice(splitIndex - 1);

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 156 62"
      className="h-14 w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <path d="M 0 48 H 156" stroke="currentColor" strokeDasharray="3 5" className="text-slate-300 dark:text-slate-700" />
      <path d={buildPath(first, 54, 62)} fill="none" stroke="#ef4444" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(52 0)">
        <path d={buildPath(second, 104, 62)} fill="none" stroke="#20c982" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function MobileDashboardOverview({
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
  const locale = LOCALES[language];
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date());
  const budgetPercent = budget.limit > 0 ? Math.min((budget.spent / budget.limit) * 100, 100) : 0;
  const greenWidth = Math.min(budgetPercent, 55);
  const amberWidth = Math.max(budgetPercent - greenWidth, 0);
  const compactMax = Math.max(...trend.map((value) => Math.abs(value)), Math.abs(balance), 0) * currencyRate;
  const compactValue = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 0 }).format(compactMax);
  const categoryIcons = [House, Utensils, CarFront];

  return (
    <section className="space-y-3" aria-label={t("dashboard")}>
      <div className="finance-panel px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(7rem,0.8fr)] items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>{t("myBalance")}</span>
              <Eye className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
            </div>
            <p className="mt-1 truncate text-[2rem] font-extrabold leading-none tracking-[-0.055em] text-slate-950 dark:text-white">
              {fmt(balance)}
            </p>
            <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${balanceDelta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {balanceDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{balanceDelta >= 0 ? "+" : ""}{fmt(balanceDelta)}</span>
              <span className="font-medium text-slate-400 dark:text-slate-500">{t("forThirtyDays")}</span>
            </div>
          </div>
          <div className="relative min-w-0 pl-1">
            <span className="absolute right-0 top-0 text-[10px] font-medium text-slate-400 dark:text-slate-500">{compactValue}</span>
            <TrendChart values={trend} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <SummaryTile type="income" amount={income} change={incomeChange} />
          <SummaryTile type="expense" amount={expense} change={expenseChange} />
        </div>
      </div>

      <div className="finance-panel px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t("budgetFor")} {month}
            </p>
            <p className="mt-1 text-lg font-extrabold tracking-[-0.025em] text-slate-950 dark:text-white">
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
              const Icon = categoryIcons[index] ?? House;
              return (
                <div key={`${category.name}-${index}`} className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${category.color}22`, color: category.color }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.1} />
                  </span>
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
      <p className="mt-1.5 truncate text-base font-extrabold tabular-nums text-slate-950 dark:text-white">{fmt(amount)}</p>
      <p className={`mt-1 text-[10px] font-semibold ${favorable ? "text-emerald-500" : "text-red-500"}`}>
        {change === null ? t("noDataShort") : `${change >= 0 ? "+" : ""}${change}%`} <span className="font-medium text-slate-400 dark:text-slate-500">{t("vsPreviousMonth")}</span>
      </p>
    </div>
  );
}
