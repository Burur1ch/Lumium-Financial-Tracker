"use client";

import React from "react";
import { useTheme } from "next-themes";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/store/translations";

interface PieData {
  name: string;
  value: number;
  color: string;
}

interface CategoryChartProps {
  data: PieData[];
  periodKey: TranslationKey;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, isDark, fmt }: any) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg text-xs"
      style={{
        backgroundColor: isDark ? "#0f172a" : "#fff",
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
      }}
    >
      <span className="font-bold" style={{ color: item.payload.color }}>
        {item.name}
      </span>
      <span className="ml-2 text-slate-600 dark:text-slate-300 font-semibold">
        {fmt(item.value, { decimals: true })}
      </span>
    </div>
  );
};

export default function CategoryChart({ data, periodKey }: CategoryChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { fmt, t } = useI18n();
  const periodLabel = t(periodKey);
  const total = data.reduce((acc, item) => acc + item.value, 0);

  // Sort by value desc, show top 6
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col gap-4 h-100">
      <div>
        <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
          {t("categoryBreakdown")}
        </h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {periodLabel}
        </p>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
          {t("noDataPeriod")}
        </div>
      ) : (
        <>
          {/* Donut */}
          <div className="relative w-full h-40 flex items-center justify-center shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sorted}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {sorted.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip isDark={isDark} fmt={fmt} />}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Total
              </span>
              <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                {fmt(total)}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 overflow-y-auto flex-1">
            {sorted.map((item) => {
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.name} className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                        {item.name}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-2 shrink-0">
                        {fmt(item.value)}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 w-8 text-right">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface PieData {
  name: string;
  value: number;
  color: string;
}
