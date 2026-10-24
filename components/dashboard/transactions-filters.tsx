"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { ExportTransactionsButton } from "@/components/dashboard/export-transactions-button";

interface Category {
  id: string;
  name: string;
}

interface TransactionsFiltersProps {
  categories: Category[];
}

export default function TransactionsFilters({
  categories,
}: TransactionsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t } = useI18n();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [filterOpen, setFilterOpen] = useState(false);

  // Изменение фильтра в URL
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    // Обертка в startTransition сохраняет фокус ввода при обновлении страницы
    startTransition(() => {
      router.push(`/dashboard/transactions?${params.toString()}`);
    });
  };

  const updateFilters = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
    });
    startTransition(() => {
      router.push(`/dashboard/transactions?${params.toString()}`);
    });
  };

  useEffect(() => {
    const currentSearch = searchParams.get("search") || "";
    if (search === currentSearch) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search.trim()) params.set("search", search.trim());
      else params.delete("search");
      startTransition(() => {
        router.replace(`/dashboard/transactions?${params.toString()}`, {
          scroll: false,
        });
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [router, search, searchParams]);

  return (
    <>
      <div className="space-y-3 sm:hidden">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-slate-400" strokeWidth={1.8} />
          <input
            id="mobile-transactions-search"
            type="text"
            placeholder={t("searchTransactions")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-200/60 py-2 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none dark:border-white/[0.055] dark:bg-white/[0.065] dark:text-slate-100"
          />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => updateFilters({ type: "all", categoryId: "all" })}
            className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold ${!searchParams.get("type") && !searchParams.get("categoryId") ? "bg-red-500 text-white" : "bg-slate-200/70 text-slate-700 dark:bg-white/[0.07] dark:text-slate-200"}`}
          >
            {t("all")}
          </button>
          {(["income", "expense"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateFilters({ type, categoryId: "all" })}
              className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold ${searchParams.get("type") === type ? "bg-red-500 text-white" : "bg-slate-200/70 text-slate-700 dark:bg-white/[0.07] dark:text-slate-200"}`}
            >
              {type === "income" ? t("totalIncome") : t("totalExpenses")}
            </button>
          ))}
          {categories.slice(0, 2).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => updateFilters({ categoryId: category.id, type: "all" })}
              className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold ${searchParams.get("categoryId") === category.id ? "bg-red-500 text-white" : "bg-slate-200/70 text-slate-700 dark:bg-white/[0.07] dark:text-slate-200"}`}
            >
              {category.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${searchParams.get("reviewStatus") || searchParams.get("categoryId") || searchParams.get("type") ? "bg-red-500 text-white" : "bg-slate-200/70 text-slate-700 dark:bg-white/[0.07] dark:text-slate-200"}`}
            aria-label={t("filter")}
            aria-haspopup="dialog"
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className="mobile-sheet-layer sm:hidden" onMouseDown={() => setFilterOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="transaction-filter-title" className="mobile-sheet" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h2 id="transaction-filter-title" className="text-lg font-bold text-slate-950 dark:text-slate-50">{t("filter")}</h2>
              <button type="button" className="icon-button" onClick={() => setFilterOpen(false)} aria-label={t("close")}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 px-4 pb-5">
              <select value={searchParams.get("type") || "all"} onChange={(event) => updateFilter("type", event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <option value="all">{t("allTypes")}</option>
                <option value="expense">{t("expenses")}</option>
                <option value="income">{t("income")}</option>
              </select>
              <select value={searchParams.get("categoryId") || "all"} onChange={(event) => updateFilter("categoryId", event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <option value="all">{t("allCategories")}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select value={searchParams.get("reviewStatus") || "all"} onChange={(event) => updateFilter("reviewStatus", event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <option value="all">{t("allReviews")}</option>
                <option value="needs_review">{t("needsReview")}</option>
                <option value="reviewed">{t("reviewed")}</option>
              </select>
              <ExportTransactionsButton filters={{
                search: searchParams.get("search") || undefined,
                type: searchParams.get("type") || undefined,
                categoryId: searchParams.get("categoryId") || undefined,
                month: searchParams.get("month") || undefined,
              }} />
            </div>
          </section>
        </div>
      )}

    <div className="hidden grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:grid md:grid-cols-5 md:gap-4 md:p-4">
      {/* 1. Поиск по тексту */}
      <div className="relative col-span-2 flex items-center md:col-span-2">
        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        />
      </div>

      {/* 2. Фильтр: Тип транзакции */}
      <div className="relative flex items-center">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
        <select
          defaultValue={searchParams.get("type") || "all"}
          onChange={(e) => updateFilter("type", e.target.value)}
          className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-red-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <option value="all">{t("allTypes")}</option>
          <option value="expense">{t("expenses")}</option>
          <option value="income">{t("income")}</option>
        </select>
      </div>

      {/* 3. Фильтр: Категории */}
      <div className="relative flex items-center">
        <select
          defaultValue={searchParams.get("categoryId") || "all"}
          onChange={(e) => updateFilter("categoryId", e.target.value)}
          className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-red-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <option value="all">{t("allCategories")}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Индикатор загрузки во время фильтрации */}
        {isPending && (
          <span className="absolute right-3 h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
        )}
      </div>

      <div className="relative col-span-2 flex items-center md:col-span-1">
        <select
          defaultValue={searchParams.get("reviewStatus") || "all"}
          onChange={(e) => updateFilter("reviewStatus", e.target.value)}
          className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-red-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <option value="all">{t("allReviews")}</option>
          <option value="needs_review">{t("needsReview")}</option>
          <option value="reviewed">{t("reviewed")}</option>
        </select>
      </div>
    </div>
    </>
  );
}
