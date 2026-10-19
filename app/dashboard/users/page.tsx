"use client";

import { useState } from "react";
import { Eye, Lock, Search, Shield, Users, Wallet } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

export default function UsersPage() {
  const { t } = useI18n();
  const [profileId, setProfileId] = useState("");
  const [notice, setNotice] = useState(false);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:space-y-7 md:p-8">
      <header>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500 text-white shadow-sm shadow-red-500/20">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-50 md:text-3xl">
                {t("sharedFinances")}
              </h1>
              <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                {t("placeholder")}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("sharedFinancesSubtitle")}
            </p>
          </div>
        </div>
      </header>

      {notice && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {t("sharedFeatureNotConnected")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/30">
            <Eye className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-950 dark:text-slate-50">
            {t("viewBudgetById")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t("viewBudgetByIdHint")}
          </p>
          <div className="mt-5 flex gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={profileId} onChange={(event) => setProfileId(event.target.value)} placeholder={t("profileIdPlaceholder")} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" />
            </label>
            <button type="button" disabled={!profileId.trim()} onClick={() => setNotice(true)} className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-950">
              {t("find")}
            </button>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {t("sharedAccessPrivacyHint")}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/30">
            <Wallet className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-950 dark:text-slate-50">
            {t("familyWallet")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t("familyWalletHint")}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">{t("sharedBudgets")}</span>
            <span className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">{t("memberRoles")}</span>
            <span className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">{t("privateTransactions")}</span>
            <span className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">{t("sharedNotifications")}</span>
          </div>
          <button type="button" onClick={() => setNotice(true)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <Lock className="h-4 w-4" /> {t("comingSoon")}
          </button>
        </section>
      </div>
    </div>
  );
}
