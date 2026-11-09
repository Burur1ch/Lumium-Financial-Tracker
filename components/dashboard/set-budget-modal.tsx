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

interface InitialBudget {
  categoryId: string;
  limitAmountUsd: number;
  rolloverEnabled: boolean;
  alertThreshold: number;
}

export default function SetBudgetModal({
  categories,
  currentBudgetCount,
  budgetedCategoryIds = [],
  initialBudget,
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  categories: Category[];
  currentBudgetCount: number;
  budgetedCategoryIds?: string[];
  initialBudget?: InitialBudget | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const { t, currencyRate } = useI18n();
  const { plan, currency } = usePrefs();
  const initialLimitAmount = initialBudget
    ? String(Number((initialBudget.limitAmountUsd * currencyRate).toFixed(2)))
    : "";
  const [internalOpen, setInternalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(
    initialBudget?.categoryId ?? "",
  );
  const [limitAmount, setLimitAmount] = useState(initialLimitAmount);
  const [rolloverEnabled, setRolloverEnabled] = useState(
    initialBudget?.rolloverEnabled ?? false,
  );
  const [alertThreshold, setAlertThreshold] = useState(
    String(initialBudget?.alertThreshold ?? 75),
  );
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPending, startTransition] = useTransition();
  const budgetLimit = getPlanBudgetLimit(plan);
  const hasReachedLimit = isLimitReached(budgetLimit, currentBudgetCount);
  const isOpen = open ?? internalOpen;
  const isEditing = Boolean(initialBudget);
  const categoryAlreadyBudgeted = budgetedCategoryIds.includes(categoryId);

  const setIsOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasReachedLimit && !isEditing && !categoryAlreadyBudgeted) {
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
        router.refresh();
      } catch {
        setError(t("budgetSaveFailed"));
      }
    });
  };

  return (
    <>
      {!hideTrigger ? (
        <button
          onClick={() => {
            setCategoryId("");
            setLimitAmount("");
            setRolloverEnabled(false);
            setAlertThreshold("75");
            setError(null);
            setIsOpen(true);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-98 sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          {t("setCategoryLimit")}
        </button>
      ) : null}

      {!hideTrigger && hasReachedLimit && budgetLimit !== null && (
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
        <div className="ui-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/65"
            onClick={() => setIsOpen(false)}
          />

          <div className="ui-modal-panel relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              aria-label={t("close")}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              {isEditing ? t("editLimit") : t("budgetLimitTitle")}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              {t("budgetLimitDesc")}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("category")}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isEditing}
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
                  placeholder="500"
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
