"use client";
import Link from "next/link";
import { Wallet, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import { CategoryArtwork } from "@/components/dashboard/category-artwork";
import { PeriodBalanceSummary } from "./period-balance-summary";

interface BudgetCategory {
  system_key?: string | null; name: string; color: string; icon?: string | null; limit: number; spent: number;
}
interface MobileDashboardOverviewProps {
  month: string; balance: number; balanceChange: number; trend: { date: string; net: number; transactions: { id: string; description: string; amount: number; type: "expense" | "income" }[] }[]; income: number; expense: number;
  incomeChange: number | null; expenseChange: number | null;
  budget: { spent: number; limit: number; categories: BudgetCategory[] };
}
export function MobileDashboardOverview({ month, balance, balanceChange, trend, income, expense, incomeChange, expenseChange, budget }: MobileDashboardOverviewProps) {
  const { fmt, t, fmtMonth, categoryName } = useI18n();
  const { balanceHidden } = usePrefs();
  const monthLabel = fmtMonth(month);
  const budgetPercent = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
  return (
    <section className="space-y-3" aria-label={t("dashboard")}>
      <div data-tour="overview">
        <PeriodBalanceSummary key={month} net={balance} change={balanceChange} trend={trend} hasActivity={income + expense > 0} />
        <div className="summary-strip mt-3 grid grid-cols-2 overflow-hidden rounded-xl bg-slate-100 dark:bg-neutral-800">
          <SummaryTile type="income" amount={income} change={incomeChange} />
          <SummaryTile type="expense" amount={expense} change={expenseChange} />
        </div>
      </div>
      <Link
        href={`/dashboard/budget?month=${month}`}
        className="finance-panel block px-4 py-3 transition-[border-color,background-color,transform] duration-150 hover:border-slate-300 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:border-neutral-700"
        aria-label={t("budgetsLimits")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t("budgetFor")} {monthLabel}
            </p>
            <p className="mt-1 truncate text-[clamp(1rem,4.8vw,1.125rem)] font-extrabold tracking-[-0.025em] text-slate-950 dark:text-white">
              {balanceHidden ? "••••" : fmt(budget.spent)} <span className="text-sm font-medium text-slate-500">{t("of")} {balanceHidden ? "••••" : fmt(budget.limit)}</span>
            </p>
          </div>
          <span className="pt-5 text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {balanceHidden ? "•••" : `${Math.round(budgetPercent)}%`}
          </span>
        </div>

        <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          {!balanceHidden && <span className={`h-full ${budgetPercent >= 100 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(budgetPercent, 100)}%` }} />}
        </div>

        {budget.limit <= 0 && <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">{t("setBudgetToPlanSpending")}</p>}

        {budget.categories.length > 0 ? (
          <div className="mt-3 space-y-3">
            {budget.categories.slice(0, 3).map((category, index) => {
              return (
                <div key={`${category.name}-${index}`} className="flex min-w-0 items-center gap-2.5">
                  <CategoryArtwork
                    icon={category.icon}
                    name={category.name}
                    systemKey={category.system_key}
                    className="h-7 w-7 rounded-lg bg-slate-100 p-0.5 dark:bg-neutral-800"
                    fallback={
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        <Wallet className="h-4 w-4" strokeWidth={2.1} />
                      </span>
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 text-xs"><span className="truncate font-semibold text-slate-700 dark:text-slate-200">{categoryName(category)}</span><strong className="shrink-0 text-slate-700 dark:text-slate-200">{balanceHidden ? "•••" : `${Math.round(category.limit > 0 ? category.spent / category.limit * 100 : 0)}%`}</strong></span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">{balanceHidden ? "••••" : fmt(category.spent)} {t("of")} {balanceHidden ? "••••" : fmt(category.limit)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </Link>
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
