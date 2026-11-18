"use client";

import { Eye, EyeOff, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";

export function PeriodBalanceSummary({ net, change, trend, hasActivity }: {
  net: number;
  change: number;
  trend: number[];
  hasActivity: boolean;
}) {
  const { t, fmt } = useI18n();
  const { balanceHidden, toggleBalanceHidden } = usePrefs();
  const values = trend.length > 1 ? trend : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => ({
    x: 4 + index / (values.length - 1) * 104,
    y: max === min ? 34 : 62 - (value - min) / (max - min) * 56,
  }));
  const color = net < 0 ? "#D92D3A" : "#24845C";
  const signed = (value: number) => `${value > 0 ? "+" : ""}${fmt(value)}`;
  return <section className="finance-panel p-4" aria-label={t("monthlyResult")} data-testid="period-summary">
    <div data-tour-focus className="flex items-center justify-between gap-2">
      <div><h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("monthlyResult")}</h2><p className="mt-0.5 text-[11px] text-slate-500">{t("incomeMinusExpenses")}</p></div>
      <button type="button" onClick={toggleBalanceHidden} aria-label={balanceHidden ? t("showBalance") : t("hideBalance")} aria-pressed={balanceHidden} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 active:scale-95 dark:hover:bg-white/5">{balanceHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
    </div>
    <div className="mt-1 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p data-tour-focus data-testid="period-net-value" className={`break-words text-[clamp(1.3rem,6.5vw,2rem)] font-extrabold leading-tight tracking-tight tabular-nums ${net < 0 ? "text-red-600 dark:text-red-400" : net > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-950 dark:text-white"}`}>{balanceHidden ? "••••••" : signed(net)}</p>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">{t("vsPreviousMonth")}</p>
        <p className={`flex items-center gap-1 text-xs font-semibold ${change < 0 ? "text-red-600 dark:text-red-400" : change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>{change < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}{balanceHidden ? "••••" : signed(change)}</p>
      </div>
      <div className="w-24 shrink-0">
        <svg viewBox="0 0 112 68" role="img" aria-label={t("periodNetDynamics")} className="h-16 w-full">
          {balanceHidden || !hasActivity ? <path d="M4 34H108" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-700" /> : <><path d={points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r="3" fill={color} /></>}
        </svg>
        {!balanceHidden && !hasActivity && <p className="text-center text-[10px] leading-4 text-slate-400">{t("noActivityThisMonth")}</p>}
      </div>
    </div>
  </section>;
}
