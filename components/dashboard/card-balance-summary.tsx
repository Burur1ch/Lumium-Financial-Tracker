"use client";

import Link from "next/link";
import { ArrowUpRight, CreditCard, Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";

export interface CardBalanceData {
  current: number;
  confirmedAmount: number;
  confirmedAt: string;
  incomeChange: number;
  expenseChange: number;
}

export function CardBalanceSummary({ balance }: { balance: CardBalanceData | null }) {
  const { t, fmt, fmtDate } = useI18n();
  const { balanceHidden, toggleBalanceHidden } = usePrefs();
  return <section className="finance-panel p-4 md:p-5" aria-label={t("cardBalance")} data-testid="card-balance">
    <div data-tour-focus className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><CreditCard className="h-4 w-4" />{t("cardBalance")}</span>
      <button type="button" onClick={toggleBalanceHidden} aria-label={balanceHidden ? t("showBalance") : t("hideBalance")} aria-pressed={balanceHidden} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 active:scale-95 dark:hover:bg-white/5">{balanceHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
    </div>
    {balance ? <>
      <p data-tour-focus className={`mt-1 break-words text-3xl font-extrabold tracking-tight tabular-nums ${balance.current < 0 ? "text-red-600 dark:text-red-400" : "text-slate-950 dark:text-white"}`} data-testid="current-card-amount">{balanceHidden ? "••••••" : fmt(balance.current)}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{t("balanceConfirmedOn")} {fmtDate(balance.confirmedAt)}</p>
    </> : <><p data-tour-focus className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{t("setCardBalance")}</p><p className="mt-2 max-w-md text-xs leading-5 text-slate-500">{t("cardBalanceIntro")}</p></>}
    <Link href="/dashboard/card" className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-red-600 hover:text-red-700 dark:text-red-400">{balance ? t("reconcileBalance") : t("enterBalance")}<ArrowUpRight className="h-4 w-4" /></Link>
  </section>;
}
