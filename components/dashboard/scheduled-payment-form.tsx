"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { createRecurringTransaction } from "@/app/dashboard/actions";
import { CategoryPicker } from "./category-picker";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import type { ScheduledPayment } from "@/utils/planning";

type Category = { id: string; name: string; color: string; type: "expense" | "income" };
export function ScheduledPaymentForm({ categories, item, date, onClose }: {
  categories: Category[]; item?: ScheduledPayment; date: string; onClose: () => void;
}) {
  const { t, currency } = useI18n();
  const rate = usePrefs((state) => state.exchangeRates[currency] ?? 1);
  const [originalAmount] = useState(() => item ? String(Number((item.amount * rate).toFixed(2))) : "");
  const [amount, setAmount] = useState(originalAmount);
  const [type, setType] = useState<"expense" | "income">(item?.type ?? "expense");
  const [frequency, setFrequency] = useState(item?.frequency ?? "once");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = "mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white";
  const label = "text-xs font-semibold text-slate-600 dark:text-slate-300";
  return <form aria-label={t(item ? "editScheduledPayment" : "addScheduledPayment")} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("currency", currency);
    data.set("amount_changed", String(!item || Number(amount) !== Number(originalAmount)));
    setError(false);
    startTransition(async () => {
      try { const result = await createRecurringTransaction(data); if (result.success) onClose(); else setError(true); }
      catch { setError(true); }
    });
  }} className="finance-panel space-y-4 p-4 md:p-5">
    <h2 className="text-lg font-bold text-slate-950 dark:text-white">{t(item ? "editScheduledPayment" : "addScheduledPayment")}</h2>
    {item && <input type="hidden" name="id" value={item.id} />}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className={label}>{t("description")}<input autoFocus name="name" required maxLength={120} defaultValue={item?.name} placeholder={t("paymentNameHint")} className={input} /></label>
      <label className={label}>{t("amount")} · {currency}<div className="relative"><input name="amount" type="number" required min={item ? "0" : "0.01"} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${input} pr-16`} placeholder="0.00" /><span className="pointer-events-none absolute bottom-3 right-3 text-sm text-slate-400">{currency}</span></div></label>
      <label className={label}>{t("type")}<select name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className={input}><option value="expense">{t("expense")}</option><option value="income">{t("income")}</option></select></label>
      <label className={label}>{t("date")}<input name="next_date" type="date" defaultValue={item?.nextDate ?? date} required className={input} /></label>
      <label className={label}>{t("repeatPayment")}<select name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)} className={input}>{(["once", "weekly", "monthly", "yearly"] as const).map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
      <div className={label}><span id="payment-category-label">{t("category")}</span><CategoryPicker key={type} name="category_id" defaultValue={item?.type === type ? item.categoryId ?? "" : ""} aria-labelledby="payment-category-label" categories={categories.filter((c) => c.type === type)} className={input} /></div>
    </div>
    <label className="flex min-h-11 items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><input type="checkbox" name="auto_create" defaultChecked={item?.autoCreate ?? false} className="mt-1 h-4 w-4 shrink-0 accent-red-500" /><span className="text-slate-800 dark:text-slate-200">{t("autoCreateTransaction")}<span className="mt-1 block text-xs leading-5 text-slate-500">{t("paymentAutomationHint")}</span></span></label>
    {error && <p role="alert" className="text-sm text-red-600">{t("genericError")}</p>}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">{t("cancel")}</button><button type="submit" disabled={pending} className="flex min-h-11 items-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-bold text-white hover:bg-red-600 active:scale-[0.98] disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("save")}</button></div>
  </form>;
}
