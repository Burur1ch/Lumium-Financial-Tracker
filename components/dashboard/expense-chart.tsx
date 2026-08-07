"use client";

import React from "react";
import { useTheme } from "next-themes";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { TranslationKey } from "@/store/translations";
import { useI18n } from "@/hooks/useI18n";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ChartDataPoint {
  label: string;
  income: number;
  expense: number;
}

interface ExpenseChartProps {
  data: ChartDataPoint[];
  periodKey: TranslationKey;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label, isDark, fmt, t }: any) => {
  if (!active || !payload?.length) return null;
  const income =
    payload.find(
      (p: { dataKey: string; value: number }) => p.dataKey === "income",
    )?.value ?? 0;
  const expense =
    payload.find(
      (p: { dataKey: string; value: number }) => p.dataKey === "expense",
    )?.value ?? 0;
  const net = income - expense;
  return (
    <div
      className="rounded-2xl border px-4 py-3 shadow-xl text-xs min-w-36"
      style={{
        backgroundColor: isDark ? "#0f172a" : "#fff",
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
      }}
    >
      <p className="font-bold text-slate-400 dark:text-slate-500 mb-2.5 text-[11px] uppercase tracking-wider">
        {label}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {t("income")}
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
            {fmt(income)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-red-500">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {t("expenses")}
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
            {fmt(expense)}
          </span>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex items-center justify-between gap-5">
          <span className="text-slate-400 dark:text-slate-500">{t("net")}</span>
          <span
            className={`font-bold tabular-nums ${net >= 0 ? "text-emerald-500" : "text-red-500"}`}
          >
            {net >= 0 ? "+" : ""}
            {fmt(net)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function ExpenseChart({ data, periodKey }: ExpenseChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { fmt, t } = useI18n();
  const periodLabel = t(periodKey);

  const gridColor = isDark ? "#1e293b" : "#f1f5f9";
  const tickColor = isDark ? "#475569" : "#94a3b8";

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpense = data.reduce((s, d) => s + d.expense, 0);
  const net = totalIncome - totalExpense;
  const NetIcon = net > 0 ? TrendingUp : net < 0 ? TrendingDown : Minus;
  const netColor = net >= 0 ? "text-emerald-500" : "text-red-500";
  const netBg =
    net >= 0
      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40"
      : "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40";

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm flex flex-col gap-4 h-100">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t("incomeVsExpenses")}
          </h4>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            {periodLabel}
          </p>
        </div>
        {/* Net pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold shrink-0 ${netBg} ${netColor}`}
        >
          <NetIcon className="w-3.5 h-3.5" />
          {net >= 0 ? "+" : ""}
          {fmt(net)}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-2">
          <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            {t("income")}
          </p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {fmt(totalIncome)}
          </p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 px-3 py-2">
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">
            {t("expenses")}
          </p>
          <p className="text-sm font-bold text-red-500 tabular-nums mt-0.5">
            {fmt(totalExpense)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
            {t("noDataPeriod")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="#10b981"
                    stopOpacity={isDark ? 0.3 : 0.2}
                  />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="#ef4444"
                    stopOpacity={isDark ? 0.3 : 0.2}
                  />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={gridColor}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 11 }}
              />
              <Tooltip
                content={<CustomTooltip isDark={isDark} fmt={fmt} t={t} />}
              />
              {totalIncome > 0 && totalExpense > 0 && (
                <ReferenceLine
                  y={0}
                  stroke={isDark ? "#334155" : "#cbd5e1"}
                  strokeDasharray="4 3"
                />
              )}
              <Area
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#incomeGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#expenseGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
