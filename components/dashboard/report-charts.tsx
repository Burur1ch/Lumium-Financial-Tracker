"use client";

import React from "react";
import { useTheme } from "next-themes";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  type TooltipContentProps,
} from "recharts";
import { useI18n } from "@/hooks/useI18n";

interface TrendPoint {
  label: string;
  income: number;
  expense: number;
}

interface CategoryStat {
  name: string;
  color: string;
  income: number;
  expense: number;
  system_key?: string | null;
}

interface ReportChartsProps {
  monthlyTrend: TrendPoint[];
  dailyTrend: TrendPoint[];
  topExpenseCategories: CategoryStat[];
  topIncomeCategories: CategoryStat[];
  periodLabel: string;
  period: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  const { fmt, t } = useI18n();
  if (!active || !payload?.length) return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="font-bold text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </p>
      {payload.map((e, index) => (
        <div key={index} className="flex items-center justify-between gap-5">
          <span
            className="flex items-center gap-1.5"
            style={{ color: e.color }}
          >
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: e.color }}
            />
            {e.name === "income"
              ? t("income")
              : e.name === "expense"
                ? t("expense")
                : e.name === "net"
                  ? t("netBalance")
                  : e.name}
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {fmt(Number(e.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ReportCharts({
  monthlyTrend,
  dailyTrend,
  topExpenseCategories,
  topIncomeCategories,
  periodLabel,
  period,
}: ReportChartsProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { fmt, fmtDate, t, categoryName } = useI18n();
  const gridColor = isDark ? "#2a2a2a" : "#edf1f4";
  const tickColor = isDark ? "#aeb9c3" : "#667788";

  // Use daily for short periods, monthly otherwise
  const trendData =
    period === "7d" || period === "30d" ? dailyTrend : monthlyTrend;
  const formatTrendLabel = (label: string) =>
    label.length === 7
      ? fmtDate(`${label}-01T12:00:00`, {
          month: "short",
          year: "2-digit",
        })
      : fmtDate(`${label}T12:00:00`, {
          day: "numeric",
          month: "short",
        });
  const trendWithAlias = trendData.map((d) => ({
    ...d,
    label: formatTrendLabel(d.label),
  }));

  const pieExpenseData = topExpenseCategories.map((c) => ({
    name: categoryName(c) || t("uncategorized"),
    value: c.expense,
    color: c.color,
  }));
  const pieIncomeData = topIncomeCategories.map((c) => ({
    name: categoryName(c) || t("uncategorized"),
    value: c.income,
    color: c.color,
  }));

  let cumulativeNet = 0;
  const netData: { label: string; net: number }[] = [];
  for (const d of trendData) {
    cumulativeNet += d.income - d.expense;
    netData.push({ label: formatTrendLabel(d.label), net: cumulativeNet });
  }

  return (
    <div className="space-y-6">
      {/* Main trend chart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("cashFlow")}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{" "}
              {t("income")}
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{" "}
              {t("expense")}
            </span>
          </div>
        </div>
        <div className="h-60">
          {trendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
              {t("noDataPeriod")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                accessibilityLayer
                aria-label={t("cashFlow")}
                data={trendWithAlias}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
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
                  width={74}
                  tickFormatter={(value) =>
                    fmt(Number(value), { decimals: false })
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: tickColor, fontSize: 11 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="income"
                  name="income"
                  fill="#24845C"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  opacity={0.85}
                />
                <Bar
                  dataKey="expense"
                  name="expense"
                  fill="#D92D3A"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  opacity={0.85}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Net balance + Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Net balance area */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            {t("netBalance")}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
            {t("reportsNetHint")}
          </p>
          <div className="h-44">
            {netData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                {t("noData")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  accessibilityLayer
                  aria-label={t("netBalance")}
                  data={netData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="netGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#3478C8"
                        stopOpacity={isDark ? 0.3 : 0.15}
                      />
                      <stop offset="95%" stopColor="#3478C8" stopOpacity={0} />
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
                    tick={{ fill: tickColor, fontSize: 10 }}
                  />
                  <YAxis
                    width={74}
                    tickFormatter={(value) =>
                      fmt(Number(value), { decimals: false })
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: tickColor, fontSize: 10 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="net"
                    name="net"
                    stroke="#3478C8"
                    strokeWidth={2}
                    fill="url(#netGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expense donut */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            {t("expensesByCategory")}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            {periodLabel}
          </p>
          <PieDonut data={pieExpenseData} isDark={isDark} fmt={fmt} />
        </div>

        {/* Income donut */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            {t("incomeByCategory")}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            {periodLabel}
          </p>
          <PieDonut data={pieIncomeData} isDark={isDark} fmt={fmt} />
        </div>
      </div>
    </div>
  );
}

function PieDonut({
  data,
  isDark,
  fmt,
}: {
  data: { name: string; value: number; color: string }[];
  isDark: boolean;
  fmt: (n: number) => string;
}) {
  const { t } = useI18n();
  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
        {t("noDataPeriod")}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={58}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#0f172a" : "#fff",
                borderRadius: "12px",
                border: isDark ? "1px solid #1e293b" : "1px solid #e2e8f0",
                fontSize: 11,
              }}
              formatter={(v) => [fmt(Number(v ?? 0)), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {fmt(total)}
          </span>
        </div>
      </div>
      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
        {data.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                {item.name}
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
              {total > 0 ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
