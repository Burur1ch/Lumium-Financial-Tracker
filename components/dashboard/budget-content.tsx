"use client";

import React from "react";
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";
import SetBudgetModal from "@/components/dashboard/set-budget-modal";
import { Money } from "@/components/money";
import { useI18n } from "@/hooks/useI18n";

interface Category {
  id: string;
  name: string;
  color: string;
  type?: string;
}

interface BudgetItem {
  id: string;
  monthly_limit: number;
  current_spent: number;
  category_id: string;
  categories?: { name: string; color: string }[] | null;
}

function getCat(b: BudgetItem) {
  return Array.isArray(b.categories) ? b.categories[0] : b.categories;
}

export default function BudgetContent({
  categories,
  budgets,
}: {
  categories: Category[];
  budgets: BudgetItem[];
}) {
  const { t } = useI18n();

  const b = budgets as BudgetItem[];
  const totalLimit = b.reduce((s, i) => s + Number(i.monthly_limit ?? 0), 0);
  const totalSpent = b.reduce((s, i) => s + Number(i.current_spent ?? 0), 0);
  const overBudgetCount = b.filter(
    (i) => i.current_spent >= i.monthly_limit,
  ).length;
  const safeBudgetCount = b.filter(
    (i) => i.current_spent < i.monthly_limit * 0.8,
  ).length;

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t("budgetsLimits")}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-1">
            {t("monthlySpendingLimits")}
          </p>
        </div>
        <SetBudgetModal categories={categories} />
      </div>

      {/* Summary row */}
      {b.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t("totalLimit")}
              </p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                <Money amount={totalLimit} />
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t("totalSpent")}
              </p>
              <p className="text-base font-bold text-red-500">
                <Money amount={totalSpent} />
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t("overLimitCount")}
              </p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                {overBudgetCount}{" "}
                <span className="text-xs font-medium text-slate-400">
                  {t("categories").toLowerCase()}
                </span>
              </p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t("onTrack")}
              </p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                {safeBudgetCount}{" "}
                <span className="text-xs font-medium text-slate-400">
                  {t("categories").toLowerCase()}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Budget cards */}
      {b.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {t("noBudgetSet")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("noBudgetHint")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {b.map((budget) => {
            const cat = getCat(budget);
            const limit = Number(budget.monthly_limit ?? 0);
            const spent = Number(budget.current_spent ?? 0);
            const percentage =
              limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
            const remaining = Math.max(limit - spent, 0);
            const isOver = spent >= limit;
            const isWarning = percentage >= 75 && !isOver;
            const catColor = cat?.color || "#ef4444";

            return (
              <div
                key={budget.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow duration-200"
              >
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${catColor}20`,
                        color: catColor,
                      }}
                    >
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                        {cat?.name || t("uncategorized")}
                      </h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {t("monthlyLimit")}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 font-bold rounded-xl ${
                      isOver
                        ? "bg-red-50 dark:bg-red-950/30 text-red-500"
                        : isWarning
                          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-500"
                          : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600"
                    }`}
                  >
                    {isOver
                      ? t("overLimit")
                      : isWarning
                        ? t("warning")
                        : t("onTrack")}
                  </span>
                </div>

                {/* Amounts */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      <Money amount={spent} />
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      of <Money amount={limit} />
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: isOver
                          ? "#ef4444"
                          : isWarning
                            ? "#f59e0b"
                            : catColor,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {percentage.toFixed(0)}% {t("used")}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${isOver ? "text-red-500" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      {isOver ? (
                        <>
                          <Money amount={spent - limit} /> {t("over")}
                        </>
                      ) : (
                        <>
                          <Money amount={remaining} /> {t("left")}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
