"use client";

import React, { Suspense } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Activity,
  Receipt,
} from "lucide-react";
import PeriodSelector from "@/components/dashboard/period-selector";
import ReportCharts from "@/components/dashboard/report-charts";
import { useI18n } from "@/hooks/useI18n";

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
}: {
  data: ReportData | null;
  period: string;
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
    <div className="p-4 md:p-8 space-y-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t("reports")}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-1">
            {periodLabel} · {data?.txCount ?? 0}{" "}
            {t("transactions").toLowerCase()}
          </p>
        </div>
        <Suspense>
          <PeriodSelector />
        </Suspense>
      </div>

      {!data ? (
        <div className="text-center py-24 text-slate-400 dark:text-slate-500 text-sm">
          {t("noData")}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
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
