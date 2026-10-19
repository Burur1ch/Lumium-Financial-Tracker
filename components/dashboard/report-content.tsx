"use client";

import React, { Suspense } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Activity,
  Receipt,
  Sparkles,
} from "lucide-react";
import PeriodSelector from "@/components/dashboard/period-selector";
import ReportCharts from "@/components/dashboard/report-charts";
import { ExportReportButton } from "@/components/dashboard/export-report-button";
import { useI18n } from "@/hooks/useI18n";
import { PaywallModal } from "@/components/dashboard/paywall-modal";

interface LargestTx {
  id: string;
  amount: number;
  type: string;
  category: string;
  color: string;
  date: string;
}

interface CategoryStat {
  name: string;
  color: string;
  income: number;
  expense: number;
}

interface TrendPoint {
  label: string;
  income: number;
  expense: number;
}

interface ReportData {
  totalIncome: number;
  totalExpense: number;
  net: number;
  savingsRate: number;
  avgDailyExpense: number;
  txCount: number;
  largest: LargestTx[];
  monthlyTrend: TrendPoint[];
  dailyTrend: TrendPoint[];
  topExpenseCategories: CategoryStat[];
  topIncomeCategories: CategoryStat[];
}

const COLOR_MAP = {
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    icon: "text-red-500",
    border: "border-red-100 dark:border-red-900/40",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: "text-emerald-500",
    border: "border-emerald-100 dark:border-emerald-900/40",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: "text-blue-500",
    border: "border-blue-100 dark:border-blue-900/40",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    icon: "text-violet-500",
    border: "border-violet-100 dark:border-violet-900/40",
  },
} as const;

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
  icon: React.ElementType;
  color: keyof typeof COLOR_MAP;
}) {
  const colors = COLOR_MAP[color];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-3 shadow-sm flex items-center gap-4 md:p-5">
      <div
        className={`w-11 h-11 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center shrink-0`}
      >
        <Icon className={`w-5 h-5 ${colors.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5">
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ReportContent({
  data,
  period,
  hasReportsAccess,
}: {
  data: ReportData | null;
  period: string;
  hasReportsAccess: boolean;
}) {
  const { t, fmt, fmtDate } = useI18n();

  const periodLabelMap: Record<string, string> = {
    "7d": t("last7days"),
    "30d": t("last30days"),
    "3m": t("last3months"),
    "1y": t("lastYear"),
    all: t("allTime"),
  };
  const periodLabel = periodLabelMap[period] ?? t("last30days");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:space-y-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-50 md:text-3xl">
            {t("reports")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {periodLabel} · {data?.txCount ?? 0}{" "}
            {t("transactions").toLowerCase()}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <ExportReportButton period={period} />
          <Suspense>
            <PeriodSelector />
          </Suspense>
        </div>
      </div>

      {!data ? (
        <div className="text-center py-24 text-slate-400 dark:text-slate-500 text-sm">
          {t("noData")}
        </div>
      ) : !hasReportsAccess ? (
        <div className="rounded-[28px] border border-red-100 dark:border-red-900/40 bg-linear-to-br from-white to-red-50 dark:from-slate-900 dark:to-red-950/10 p-8 md:p-10 shadow-sm">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 dark:bg-red-950/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-500">
              <Sparkles className="w-3.5 h-3.5" />
              Pro
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t("reportsProOnly")}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("reportsProOnlyDesc")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PaywallModal
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-500 hover:bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors"
                  >
                    {t("upgradeToPro")}
                  </button>
                }
                title={t("reportsProOnly")}
                description={t("reportsProOnlyDesc")}
                featureLabel={t("unlockAdvancedReports")}
              />
              <span className="inline-flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {t("unlockAdvancedReports")}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label={t("totalIncome")}
              value={fmt(data.totalIncome)}
              icon={TrendingUp}
              color="emerald"
            />
            <StatCard
              label={t("totalExpenses")}
              value={fmt(data.totalExpense)}
              icon={TrendingDown}
              color="red"
            />
            <StatCard
              label={t("netBalance")}
              value={(data.net >= 0 ? "+" : "") + fmt(data.net)}
              sub={data.net >= 0 ? t("surplus") : t("deficit")}
              icon={Wallet}
              color={data.net >= 0 ? "blue" : "red"}
            />
            <StatCard
              label={t("savingsRate")}
              value={`${data.savingsRate}%`}
              sub={`${t("avgPerDay")}: ${fmt(data.avgDailyExpense)}`}
              icon={PiggyBank}
              color="violet"
            />
          </div>

          {/* Charts */}
          <ReportCharts
            monthlyTrend={data.monthlyTrend}
            dailyTrend={data.dailyTrend}
            topExpenseCategories={data.topExpenseCategories}
            topIncomeCategories={data.topIncomeCategories}
            periodLabel={periodLabel}
            period={period}
          />

          {/* Two columns: largest transactions + category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Largest transactions */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Receipt className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t("largestTransactions")}
                </h3>
              </div>
              {data.largest.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t("noTransactions")}
                </p>
              ) : (
                <div className="space-y-3">
                  {data.largest.map((tx, i) => (
                    <div key={tx.id} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-slate-300 dark:text-slate-600 shrink-0">
                        #{i + 1}
                      </span>
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${tx.color}20`,
                          color: tx.color,
                        }}
                      >
                        {tx.type === "income" ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {tx.category}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {fmtDate(tx.date)}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold shrink-0 ${tx.type === "income" ? "text-emerald-500" : "text-red-500"}`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {fmt(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category breakdown */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t("topSpendingCategories")}
                </h3>
              </div>
              {data.topExpenseCategories.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t("noExpenseData")}
                </p>
              ) : (
                <div className="space-y-3">
                  {data.topExpenseCategories.map((cat) => {
                    const pct =
                      data.totalExpense > 0
                        ? (cat.expense / data.totalExpense) * 100
                        : 0;
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {cat.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {pct.toFixed(1)}%
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              {fmt(cat.expense)}
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
