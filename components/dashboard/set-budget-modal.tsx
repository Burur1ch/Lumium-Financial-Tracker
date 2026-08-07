"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBudget } from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";
import { Plus, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
  type?: string;
}

export default function SetBudgetModal({
  categories,
}: {
  categories: Category[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !limitAmount) return;

    startTransition(async () => {
      try {
        await upsertBudget({
          categoryId,
          limitAmount: parseFloat(limitAmount),
        });
        setIsOpen(false);
        setCategoryId("");
        setLimitAmount("");
        router.refresh(); // Мгновенно обновляем серверные данные на странице
      } catch {
        alert(t("budgetLimitDesc"));
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium text-sm rounded-xl inline-flex items-center justify-center gap-2 transition-all shadow-sm shadow-red-500/10 active:scale-98"
      >
        <Plus className="w-4 h-4" />
        {t("setCategoryLimit")}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
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
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
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
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  {t("monthlyLimitLabel")}
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={limitAmount}
                  onChange={(e) => setLimitAmount(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-red-500 focus:outline-none text-sm text-slate-800 dark:text-slate-200"
                  required
                  min="1"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm"
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
