"use client";

import { useState, useTransition } from "react";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { confirmCardBalance } from "@/app/dashboard/actions";
import { CardBalanceSummary, type CardBalanceData } from "./card-balance-summary";
import { useI18n } from "@/hooks/useI18n";
import { CURRENCIES } from "@/utils/currency";
import { pendingTransactions, cachedOfflineAccount } from "@/utils/offline-transactions";

export function CardBalanceContent({ balance }: { balance: CardBalanceData | null }) {
  const { t, fmt, currency } = useI18n();
  const [inputCurrency, setInputCurrency] = useState(currency);
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<"saved" | "error" | "offline" | null>(null);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const owner = cachedOfflineAccount();
    if (!navigator.onLine || (owner && pendingTransactions(owner.userId).length > 0)) {
      setMessage("offline"); return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await confirmCardBalance(data);
        setMessage(result.success ? "saved" : "error");
        if (result.success) setAmount("");
      } catch { setMessage("error"); }
    });
  }
  return <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-8">
    <header><h1 className="hidden text-3xl font-bold tracking-tight text-slate-950 dark:text-white lg:block">{t("myCard")}</h1><p className="mt-1 text-sm leading-6 text-slate-500">{t("cardBalanceIntro")}</p></header>
    <CardBalanceSummary balance={balance} />
    {balance && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {([{ label: "confirmedBalance", amount: balance.confirmedAmount }, { label: "incomeSinceBalance", amount: balance.incomeChange }, { label: "expenseSinceBalance", amount: balance.expenseChange }] as const).map((item) => <div key={item.label} className="finance-panel p-4"><p className="text-xs leading-5 text-slate-500">{t(item.label)}</p><p className="mt-2 font-bold tabular-nums text-slate-950 dark:text-white">{fmt(item.amount)}</p></div>)}
    </div>}
    <form onSubmit={submit} className="finance-panel space-y-4 p-4 md:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950 dark:text-white"><CreditCard className="h-5 w-5 text-red-500" />{balance ? t("reconcileBalance") : t("enterBalance")}</h2>
      <p className="max-w-xl text-sm leading-6 text-slate-500">{t("balanceCheckpointHint")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{t("actualCardBalance")}<input name="amount" type="number" step="0.01" required value={amount} onChange={(e) => { setAmount(e.target.value); setMessage(null); }} placeholder="0.00" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-lg font-bold tabular-nums outline-none focus:border-red-500 dark:border-slate-800 dark:bg-slate-950" /></label>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("currency")}<select name="currency" value={inputCurrency} onChange={(e) => setInputCurrency(e.target.value as typeof currency)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-red-500 dark:border-slate-800 dark:bg-slate-950">{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select></label>
      </div>
      {message && <p role="status" className={`text-sm ${message === "saved" ? "text-emerald-600" : "text-red-600"}`}>{t(message === "saved" ? "balanceSaved" : message === "offline" ? "syncBeforeBalance" : "genericError")}</p>}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-bold text-white transition-colors hover:bg-red-600 active:scale-[0.98] disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("confirmBalance")}</button>
    </form>
    <p className="text-xs leading-5 text-slate-500">{t("balanceHistoryHint")}</p>
  </div>;
}
