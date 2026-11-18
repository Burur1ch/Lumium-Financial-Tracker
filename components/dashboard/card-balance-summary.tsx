"use client";

import Link from "next/link";
import { CreditCard, Eye, EyeOff, Pencil, Plus } from "lucide-react";
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
  return (
    <section className="finance-panel flex items-center gap-2 p-3 md:p-4" aria-label={t("cardBalance")} data-testid="card-balance">
      <div className="min-w-0 flex-1">
        <div data-tour-focus className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <CreditCard className="h-3.5 w-3.5 shrink-0" />
          <span>{t("cardBalance")}</span>
        </div>
        {balance ? <>
          <p data-tour-focus className={`mt-1 break-words text-[1.65rem] font-extrabold leading-tight tracking-tight tabular-nums ${balance.current < 0 ? "text-red-600 dark:text-red-400" : "text-slate-950 dark:text-white"}`} data-testid="current-card-amount">
            {balanceHidden ? "••••••" : fmt(balance.current)}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {t("balanceConfirmedOn")} {fmtDate(balance.confirmedAt)}
          </p>
        </> : <p data-tour-focus className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{t("setCardBalance")}</p>}
      </div>
      <div className="flex shrink-0 items-center">
        {balance && <button type="button" onClick={toggleBalanceHidden} aria-label={balanceHidden ? t("showBalance") : t("hideBalance")} aria-pressed={balanceHidden} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 active:scale-95 dark:hover:bg-white/5">
          {balanceHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>}
        <Link href="/dashboard/card" aria-label={balance ? t("reconcileBalance") : t("enterBalance")} title={balance ? t("reconcileBalance") : t("enterBalance")} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 active:scale-95 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
          {balance ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Link>
      </div>
    </section>
  );
}
