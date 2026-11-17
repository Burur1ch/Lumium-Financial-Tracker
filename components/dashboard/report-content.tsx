"use client";

import { Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  ReceiptText,
  Wallet,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";
import type { getReportData } from "@/app/dashboard/actions";
import PeriodSelector from "./period-selector";
import ReportCharts from "./report-charts";
import { ExportReportButton } from "./export-report-button";
import { CategoryBreakdown } from "./category-breakdown";
import { CategoryArtwork } from "./category-artwork";
import { useI18n } from "@/hooks/useI18n";

export type ReportData = NonNullable<Awaited<ReturnType<typeof getReportData>>>;

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  color: "income" | "expense" | "neutral";
}) {
  const tone =
    color === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : color === "expense"
        ? "text-red-500"
        : "text-slate-800 dark:text-slate-100";
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <Icon className={`h-4 w-4 shrink-0 ${tone}`} strokeWidth={1.8} />
      </div>
      <p
        title={value}
        className={`mt-3 truncate text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${tone}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {sub}
        </p>
      )}
    </div>
  );
}

export default function ReportContent({ data }: { data: ReportData }) {
  const { t, fmt, fmtDate, categoryName } = useI18n();
  const periodLabels = {
    "7d": t("last7days"),
    "30d": t("last30days"),
    "3m": t("last3months"),
    "1y": t("lastYear"),
    all: t("allTime"),
  };
  const periodLabel = periodLabels[data.period];
  const hasExpenses = data.topExpenseCategories.length > 0;
  const hasIncome = data.topIncomeCategories.length > 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:space-y-6 md:p-8">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="hidden text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 lg:block">
            {t("reports")}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 lg:mt-1">
            <p>{periodLabel}</p>
            <p>
              {t("transactions")}{" "}
              <strong className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                {data.txCount}
              </strong>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Suspense>
            <PeriodSelector plan={data.plan} />
          </Suspense>
          <ExportReportButton period={data.period} plan={data.plan} />
        </div>
      </header>

      {data.txCount === 0 ? (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <ReceiptText className="h-10 w-10 text-slate-400" strokeWidth={1.4} />
          <h2 className="mt-5 text-lg font-bold text-slate-900 dark:text-slate-100">
            {t("noDataPeriod")}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t("reportsEmptyHint")}
          </p>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event("lumium:open-add-transaction"))
            }
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600"
          >
            <Plus className="h-4 w-4" />
            {t("addTransaction")}
          </button>
        </section>
      ) : (
        <>
          <section
            data-testid="report-summary"
            aria-label={t("reports")}
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <StatCard
              label={t("totalIncome")}
              value={fmt(data.totalIncome)}
              icon={ArrowDownLeft}
              color="income"
            />
            <StatCard
              label={t("totalExpenses")}
              value={fmt(data.totalExpense)}
              icon={ArrowUpRight}
              color="expense"
            />
            <StatCard
              label={t("netBalance")}
              value={(data.net > 0 ? "+" : "") + fmt(data.net)}
              sub={data.net >= 0 ? t("surplus") : t("deficit")}
              icon={Wallet}
              color={data.net >= 0 ? "neutral" : "expense"}
            />
            <StatCard
              label={t("savingsRate")}
              value={data.totalIncome > 0 ? `${data.savingsRate}%` : "—"}
              sub={`${t("avgPerDay")} ${fmt(data.avgDailyExpense)}`}
              icon={PiggyBank}
              color="neutral"
            />
          </section>

          <ReportCharts
            monthlyTrend={data.monthlyTrend}
            dailyTrend={data.dailyTrend}
            topExpenseCategories={data.topExpenseCategories}
            topIncomeCategories={data.topIncomeCategories}
            periodLabel={periodLabel}
            period={data.period}
          />

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <section
              aria-label={t("expensesByCategory")}
              className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
            >
              <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
                {t("expensesByCategory")}
              </h2>
              {hasExpenses ? (
                <CategoryBreakdown
                  rows={data.categoryBreakdown}
                  type="expense"
                />
              ) : (
                <p className="py-4 text-sm text-slate-500">
                  {t("noDataPeriod")}
                </p>
              )}
            </section>
            <section
              aria-label={t("incomeByCategory")}
              className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
            >
              <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
                {t("incomeByCategory")}
              </h2>
              {hasIncome ? (
                <CategoryBreakdown
                  rows={data.categoryBreakdown}
                  type="income"
                />
              ) : (
                <p className="py-4 text-sm text-slate-500">
                  {t("noDataPeriod")}
                </p>
              )}
            </section>
          </div>

          <section
            aria-label={t("largestTransactions")}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
          >
            <h2 className="mb-2 text-base font-bold text-slate-900 dark:text-slate-100">
              {t("largestTransactions")}
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.largest.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex min-w-0 items-center gap-3 py-3"
                >
                  <CategoryArtwork
                    icon={
                      transaction.isSplit
                        ? "tag"
                        : (transaction.categories?.icon ?? transaction.type)
                    }
                    name={transaction.categories?.name}
                    systemKey={
                      transaction.isSplit
                        ? undefined
                        : transaction.categories?.system_key
                    }
                    className="h-10 w-10 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {transaction.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {transaction.isSplit
                        ? t("splitIntoCategories")
                        : transaction.categories
                          ? categoryName(transaction.categories)
                          : t("uncategorized")}
                      <span className="ml-3 whitespace-nowrap">
                        {fmtDate(transaction.date)}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${transaction.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
                  >
                    {transaction.type === "income" ? "+" : "−"}
                    {fmt(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
