"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upsertBudget } from "@/app/dashboard/actions";
import { PaywallModal } from "@/components/dashboard/paywall-modal";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import {
  getPlanBudgetLimit,
  isLimitReached,
} from "@/utils/monetization/limits";
import { Plus, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  type?: string;
}

export default function SetBudgetModal({
  categories,
  currentBudgetCount,
}: {
  categories: Category[];
  currentBudgetCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState("75");
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { t } = useI18n();
  const { plan, currency } = usePrefs();
  const budgetLimit = getPlanBudgetLimit(plan);
  const hasReachedLimit = isLimitReached(budgetLimit, currentBudgetCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasReachedLimit) {
      setShowPaywall(true);
      return;
    }
    if (!categoryId || !limitAmount) return;

    startTransition(async () => {
      try {
        await upsertBudget({
          categoryId,
          limitAmount: parseFloat(limitAmount),
          currency,
          rolloverEnabled,
          alertThreshold: Number(alertThreshold),
        });
        setIsOpen(false);
        setCategoryId("");
        setLimitAmount("");
        setRolloverEnabled(false);
        setAlertThreshold("75");
        router.refresh(); // Мгновенно обновляем серверные данные на странице
      } catch {
        alert(t("budgetLimitDesc"));
      }
    });
  };

  return (
    <>
      <button
        onClick={() => {
          if (hasReachedLimit) {
            setShowPaywall(true);
            return;
          }
          setIsOpen(true);
        }}
        className={`w-full sm:w-auto px-4 py-2.5 text-white font-medium text-sm rounded-xl inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 active:scale-98 ${
          hasReachedLimit
            ? "bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
            : "bg-red-500 hover:bg-red-600"
        }`}
      >
        <Plus className="w-4 h-4" />
        {hasReachedLimit ? t("planLimitReached") : t("setCategoryLimit")}
      </button>

      {hasReachedLimit && budgetLimit !== null && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t("budgetPlanLimitHint")} {budgetLimit}.{" "}
          <Link
            href="/dashboard/pricing"
            className="font-bold text-red-500 hover:text-red-600"
          >
            {t("upgradeToPro")}
          </Link>
        </div>
      )}

      {showPaywall && (
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          title={t("budgetLockedTitle")}
          description={t("budgetLockedDesc")}
          featureLabel={t("budgetsLimits")}
        />
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/65"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              {t("budgetLimitTitle")}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              {t("budgetLimitDesc")}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("category")}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-red-500 focus:outline-none text-sm text-slate-800 dark:text-slate-200"
                  required
                >
                  <option value="">{t("selectCategory")}</option>
                  {categories
                    .filter((cat) => cat.type === "expense")
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("budgetAlertThreshold")}
                </label>
                <select
                  value={alertThreshold}
                  onChange={(event) => setAlertThreshold(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-800 outline-none focus:border-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="75">75%</option>
                  <option value="80">80%</option>
                  <option value="90">90%</option>
                </select>
              </div>

              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={rolloverEnabled}
                  onChange={(event) => setRolloverEnabled(event.target.checked)}
                  className="h-4 w-4 accent-red-500"
                />
                <span>
                  {t("rolloverBudget")}
                  <small className="mt-0.5 block font-normal text-slate-400">
                    {t("rolloverBudgetHint")}
                  </small>
                </span>
              </label>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("monthlyLimitLabel")} ({currency})
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={limitAmount}
                  onChange={(e) => setLimitAmount(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-red-500 focus:outline-none text-sm text-slate-800 dark:text-slate-200"
                  required
                  min="0.01"
                  step="0.01"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-medium text-sm rounded-xl transition-[background-color,transform] duration-150 active:scale-[0.98]"
              >
                {isPending ? t("savingEllipsis") : t("saveLimit")}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
