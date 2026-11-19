"use client";

import { useState } from "react";
import { Eye, EyeOff, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";

export function PeriodBalanceSummary({ net, change, trend, hasActivity }: {
  net: number;
  change: number;
  trend: { date: string; net: number; transactions: { id: string; description: string; amount: number; type: "expense" | "income" }[] }[];
  hasActivity: boolean;
}) {
  const { t, fmt, fmtDate } = useI18n();
  const { balanceHidden, toggleBalanceHidden } = usePrefs();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const index = Math.min(selectedIndex ?? trend.length - 1, trend.length - 1);
  const selected = trend[index];
  const min = Math.min(0, ...trend.map((day) => day.net));
  const max = Math.max(0, ...trend.map((day) => day.net));
  const y = (value: number) => max === min ? 50 : 90 - (value - min) / (max - min) * 80;
  const points = trend.map((day, i) => ({
    x: trend.length === 1 ? 160 : 8 + i / (trend.length - 1) * 304,
    y: y(day.net),
  }));
  // Horizontal tangents keep each curve between its two recorded daily values.
  const path = points.map((point, i) => {
    if (i === 0) return `M${point.x},${point.y}`;
    const previous = points[i - 1];
    const third = (point.x - previous.x) / 3;
    return `C${previous.x + third},${previous.y} ${point.x - third},${point.y} ${point.x},${point.y}`;
  }).join(" ");
  const color = net < 0 ? "#D92D3A" : "#24845C";
  const signed = (value: number) => `${value > 0 ? "+" : ""}${fmt(value)}`;
  const dateLabel = (date: string) => fmtDate(`${date}T12:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" });

  return <section className="finance-panel p-4" aria-label={t("monthlyResult")} data-testid="period-summary">
    <div data-tour-focus className="flex items-center justify-between gap-2">
      <div><h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("monthlyResult")}</h2><p className="mt-0.5 text-[11px] text-slate-500">{t("incomeMinusExpenses")}</p></div>
      <button type="button" onClick={toggleBalanceHidden} aria-label={balanceHidden ? t("showBalance") : t("hideBalance")} aria-pressed={balanceHidden} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 active:scale-95 dark:hover:bg-white/5">{balanceHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
    </div>
    <div className="mt-1 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <p data-tour-focus data-testid="period-net-value" className={`break-words text-[clamp(1.3rem,6.5vw,2rem)] font-extrabold leading-tight tracking-tight tabular-nums ${balanceHidden ? "text-slate-950 dark:text-white" : net < 0 ? "text-red-600 dark:text-red-400" : net > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-950 dark:text-white"}`}>{balanceHidden ? "••••••" : signed(net)}</p>
      <div className="pb-0.5 text-right">
        <p className="text-[11px] leading-4 text-slate-500">{t("vsPreviousMonth")}</p>
        <p className={`flex items-center justify-end gap-1 text-xs font-semibold ${balanceHidden ? "text-slate-500" : change < 0 ? "text-red-600 dark:text-red-400" : change > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>{!balanceHidden && (change < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />)}{balanceHidden ? "••••" : signed(change)}</p>
      </div>
    </div>
    {!balanceHidden && hasActivity && selected ? <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/10">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("resultByDay")}</h3>
        <p className="text-right text-xs text-slate-500" aria-live="polite" data-testid="period-chart-selection">{dateLabel(selected.date)} · <strong className="tabular-nums text-slate-800 dark:text-white">{signed(selected.net)}</strong></p>
      </div>
      <div className="mt-2 flex items-stretch gap-2">
        <div className="relative w-[4.75rem] shrink-0 text-right text-[10px] tabular-nums text-slate-400" aria-hidden="true">{(max === min ? [0] : [max, (max + min) / 2, min]).map((value, i) => <span key={i} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${y(value)}%` }}>{fmt(value, { decimals: max - min < 3 })}</span>)}</div>
        <svg viewBox="0 0 320 100" role="img" aria-label={t("periodNetDynamics")} className="h-24 min-w-0 flex-1 overflow-visible" preserveAspectRatio="none">
          <path d="M8 10H312 M8 50H312 M8 90H312 M8 10V90" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" className="text-slate-100 dark:text-slate-800" />
          <path d={`M8 ${y(0)}H312`} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" className="text-slate-300 dark:text-slate-600" />
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={points[index].x} cy={points[index].y} r="4" fill={color} stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      {trend.length > 1 && <input type="range" aria-label={t("selectResultDay")} aria-valuetext={`${dateLabel(selected.date)}, ${signed(selected.net)}`} min={0} max={trend.length - 1} value={index} onChange={(event) => setSelectedIndex(Number(event.target.value))} className="cashflow-slider mt-1 h-6 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-red-500" />}
      <div className="flex justify-between text-[11px] text-slate-400"><span>{dateLabel(trend[0].date)}</span><span>{dateLabel(trend[trend.length - 1].date)}</span></div>
      <button type="button" onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen} className="mt-3 min-h-11 w-full rounded-xl bg-slate-100 px-3 text-left text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-200">{t("dayTransactions")} · {selected.transactions.length} <span className="float-right">{detailsOpen ? "−" : "+"}</span></button>
      {detailsOpen && <div className="mt-2 divide-y divide-slate-100 dark:divide-white/10" data-testid="period-day-transactions">{selected.transactions.length === 0 ? <p className="py-3 text-xs text-slate-500">{t("noTransactionsForDay")}</p> : selected.transactions.map((transaction) => <div key={transaction.id} className="flex items-center justify-between gap-3 py-2.5 text-xs"><span className="min-w-0 break-words text-slate-700 dark:text-slate-200">{transaction.description}</span><strong className={`shrink-0 tabular-nums ${transaction.type === "income" ? "text-emerald-600" : "text-red-600"}`}>{transaction.type === "income" ? "+" : "−"}{fmt(transaction.amount)}</strong></div>)}</div>}
    </div> : !balanceHidden && !hasActivity ? <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-white/10">{t("noActivityThisMonth")}</p> : null}
  </section>;
}
