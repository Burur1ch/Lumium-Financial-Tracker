"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Pause, Play, Trash2 } from "lucide-react";
import { deleteRecurringTransaction, materializeRecurringTransaction, setScheduledPaymentActive } from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";
import { Money } from "@/components/money";
import { shiftPlanningMonth, type CashflowPlan, type ScheduledPayment } from "@/utils/planning";

export function PaymentCalendar({ cashflow, recurring, onEdit, onAdd }: {
  cashflow: CashflowPlan; recurring: ScheduledPayment[];
  onEdit: (item: ScheduledPayment) => void; onAdd: (date: string) => void;
}) {
  const { t, fmtDate, fmtMonth, fmt } = useI18n();
  const [day, setDay] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const { month, today, events, forecast } = cashflow;
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const rows = events.filter((event) => !day || event.date === day);
  const run = (id: string, action: () => Promise<{ success: boolean }>) => {
    setPendingId(id); setError(false);
    startTransition(async () => { try { if (!(await action()).success) setError(true); } catch { setError(true); } finally { setPendingId(null); } });
  };
  const navClass = "flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-slate-800";
  const maxMonth = `${Number(today.slice(0, 4)) + 2}-12`;
  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="finance-panel p-4"><p className="text-xs leading-5 text-slate-500">{t("forecastEndBalance")}</p><p data-testid="forecast-end-balance" className={`mt-2 text-xl font-extrabold tabular-nums ${cashflow.projectedBalance !== null && cashflow.projectedBalance < 0 ? "text-red-600" : "text-slate-950 dark:text-white"}`}>{cashflow.projectedBalance === null ? "—" : fmt(cashflow.projectedBalance)}</p></div>
      <div className="finance-panel p-4"><p className="text-xs leading-5 text-slate-500">{t("plannedExpenses")}</p><p className="mt-2 text-xl font-extrabold tabular-nums text-slate-950 dark:text-white"><Money amount={cashflow.plannedExpense} /></p></div>
      <div className="finance-panel p-4"><p className="text-xs leading-5 text-slate-500">{t("plannedIncome")}</p><p className="mt-2 text-xl font-extrabold tabular-nums text-emerald-600"><Money amount={cashflow.plannedIncome} /></p></div>
    </div>
    {cashflow.lowestBalance !== null && cashflow.lowestBalance < 0 && <p role="status" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertTriangle className="mt-1 h-4 w-4 shrink-0" /><span>{t("balanceShortfall")} {cashflow.lowestDate && fmtDate(`${cashflow.lowestDate}T12:00:00Z`, { day: "numeric", month: "long", timeZone: "UTC" })}: <strong><Money amount={cashflow.lowestBalance} /></strong></span></p>}
    {forecast.length > 0 ? <div className="finance-panel p-4 md:p-5"><h2 className="font-bold text-slate-950 dark:text-white">{t("balanceForecast")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("forecastHint")}</p><ForecastChart points={forecast} /></div> : <div className="finance-panel p-4 text-sm leading-6 text-slate-500">{month < today.slice(0, 7) ? t("historicalCalendarHint") : <>{t("forecastNeedsBalance")} <Link href="/dashboard/card" className="font-semibold text-red-600">{t("enterBalance")}</Link></>}</div>}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="finance-panel p-3 md:p-5">
        <div className="mb-3 flex items-center justify-between"><Link href={`?month=${shiftPlanningMonth(month, -1)}`} scroll={false} aria-label={t("previousMonth")} className={navClass}><ChevronLeft className="h-5 w-5" /></Link><h2 className="text-center text-sm font-bold capitalize text-slate-950 dark:text-white">{fmtMonth(month)}</h2>{month < maxMonth ? <Link href={`?month=${shiftPlanningMonth(month, 1)}`} scroll={false} aria-label={t("nextMonth")} className={navClass}><ChevronRight className="h-5 w-5" /></Link> : <span className="h-11 w-11" />}</div>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={t("paymentCalendar")}>
          {(["monShort", "tueShort", "wedShort", "thuShort", "friShort", "satShort", "sunShort"] as const).map((key) => <div key={key} className="pb-2 text-center text-[11px] font-semibold text-slate-400">{t(key)}</div>)}
          {Array.from({ length: offset }, (_, index) => <div key={`blank-${index}`} />)}
          {Array.from({ length: days }, (_, index) => {
            const date = `${month}-${String(index + 1).padStart(2, "0")}`;
            const items = events.filter((e) => e.date === date);
            return <button key={date} type="button" aria-pressed={day === date} aria-current={date === today ? "date" : undefined} onClick={() => setDay(day === date ? null : date)} aria-label={`${fmtDate(`${date}T12:00:00Z`, { day: "numeric", month: "long", timeZone: "UTC" })}, ${t("paymentsCount")}: ${items.length}`} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${day === date ? "bg-red-500 text-white" : date === today ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}`}><span>{index + 1}</span><span className="flex h-1.5 gap-0.5">{items.slice(0, 3).map((item) => <span key={item.key} className={`h-1 w-1 rounded-full ${day === date ? "bg-white" : item.status === "paid" ? "bg-slate-400" : item.type === "income" ? "bg-emerald-500" : "bg-red-500"}`} />)}</span></button>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-slate-500">{(["expense", "income", "paidPayment"] as const).map((key, index) => <span key={key} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? "bg-red-500" : index === 1 ? "bg-emerald-500" : "bg-slate-400"}`} />{t(key)}</span>)}</div>
      </div>
      <div className="finance-panel overflow-hidden p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold text-slate-950 dark:text-white">{day ? fmtDate(`${day}T12:00:00Z`, { day: "numeric", month: "long", timeZone: "UTC" }) : t("monthPayments")}</h2>{day && <button type="button" onClick={() => setDay(null)} className="min-h-11 text-xs font-semibold text-red-600">{t("showAllPayments")}</button>}</div>
        {rows.length === 0 ? <div className="py-8 text-center"><CalendarDays className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">{t("noPaymentsForDate")}</p></div> : <div className="max-h-[30rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">{rows.map((event) => {
          const template = recurring.find((item) => item.id === event.templateId);
          return <article key={event.key} className="py-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-950 dark:text-white">{event.name}</p><p className="mt-1 text-xs text-slate-500">{fmtDate(`${event.date}T12:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })} · <span className={event.status === "overdue" ? "font-semibold text-red-600" : ""}>{t(event.status === "paid" ? "paidPayment" : event.status === "overdue" ? "overduePayment" : "plannedPayment")}</span></p></div><strong className={`shrink-0 text-sm tabular-nums ${event.type === "income" ? "text-emerald-600" : "text-slate-950 dark:text-white"}`}>{event.type === "income" ? "+" : "−"}<Money amount={event.amount} /></strong></div>
            {template && <div className="mt-2 flex flex-wrap gap-2">{event.date === template.nextDate && event.date <= today && <button type="button" disabled={pending} onClick={() => run(template.id, () => materializeRecurringTransaction(template.id))} className="flex min-h-10 items-center gap-1 rounded-lg bg-red-500 px-3 text-xs font-bold text-white disabled:opacity-50">{pendingId === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{t("markPaymentPaid")}</button>}<button type="button" onClick={() => onEdit(template)} className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500"><Pencil className="h-3.5 w-3.5" />{t("edit")}</button></div>}
          </article>;
        })}</div>}
        <button type="button" onClick={() => onAdd(day ?? (month === today.slice(0, 7) ? today : `${month}-01`))} className="mt-3 min-h-11 w-full rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/20">{t("addScheduledPayment")}</button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{t("genericError")}</p>}
    <div className="finance-panel p-4 md:p-5"><button type="button" aria-expanded={manage} onClick={() => setManage(!manage)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-bold text-slate-950 dark:text-white"><span>{t("manageSchedules")} <span className="ml-1 text-slate-400">{recurring.length}</span></span><ChevronRight className={`h-4 w-4 ${manage ? "rotate-90" : ""}`} /></button>
      {manage && <div className="divide-y divide-slate-100 dark:divide-slate-800">{recurring.length === 0 && <p className="py-4 text-sm text-slate-500">{t("noRecurringTransactionsHint")}</p>}{recurring.map((item) => <article key={item.id} className="flex flex-wrap items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-slate-950 dark:text-white">{item.name}</p><p className="mt-1 text-xs text-slate-500">{t(item.frequency)} · {item.active ? t(item.autoCreate ? "automaticPayment" : "manualPayment") : t(item.lastCreatedAt && item.frequency === "once" ? "paidPayment" : "pausedPayment")}</p></div><strong className="text-sm text-slate-950 dark:text-white"><Money amount={item.amount} /></strong><div className="flex">{!(item.frequency === "once" && item.lastCreatedAt) && <><button type="button" onClick={() => onEdit(item)} aria-label={`${t("edit")}: ${item.name}`} className={navClass}><Pencil className="h-4 w-4" /></button><button type="button" disabled={pending} onClick={() => run(item.id, () => setScheduledPaymentActive(item.id, !item.active))} aria-label={`${t(item.active ? "pausePayment" : "resumePayment")}: ${item.name}`} className={navClass}>{item.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button></>}<button type="button" disabled={pending} onClick={() => { if (window.confirm(t("deleteScheduleConfirm"))) run(item.id, () => deleteRecurringTransaction(item.id)); }} aria-label={`${t("deleteButton")}: ${item.name}`} className={`${navClass} text-red-500`}><Trash2 className="h-4 w-4" /></button></div></article>)}</div>}
    </div>
  </section>;
}

function ForecastChart({ points }: { points: CashflowPlan["forecast"] }) {
  const { t, fmt, fmtDate } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  const min = Math.min(...points.map((p) => p.balance));
  const max = Math.max(...points.map((p) => p.balance));
  const range = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const xy = (point: typeof points[number], i: number) => [12 + i / Math.max(points.length - 1, 1) * 676, max === min ? 75 : 128 - (point.balance - min) / range * 108];
  const path = points.map((p, i) => `${i ? "L" : "M"}${xy(p, i).join(",")}`).join(" ");
  const selected = points[index ?? points.length - 1];
  return <div className="mt-3">
    <p className="text-right text-xs text-slate-500" aria-live="polite">{fmtDate(`${selected.date}T12:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })} · <strong className="text-slate-800 dark:text-white">{fmt(selected.balance)}</strong></p>
    <svg viewBox="0 0 700 150" role="img" aria-label={t("balanceForecast")} className="mt-2 h-36 w-full" preserveAspectRatio="none"><path d="M12 140H688" stroke="currentColor" className="text-slate-100 dark:text-slate-800" /><path d={path} fill="none" stroke="#D92D3A" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /><circle cx={xy(selected, index ?? points.length - 1)[0]} cy={xy(selected, index ?? points.length - 1)[1]} r="4" fill="#D92D3A" /></svg>
    <input type="range" aria-label={t("forecastDate")} min={0} max={points.length - 1} value={index ?? points.length - 1} onChange={(e) => setIndex(Number(e.target.value))} className="cashflow-slider h-6 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-red-500" />
    <div className="flex justify-between text-[11px] text-slate-400"><span>{fmtDate(`${points[0].date}T12:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })}</span><span>{fmtDate(`${points.at(-1)!.date}T12:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })}</span></div>
  </div>;
}
