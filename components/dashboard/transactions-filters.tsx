"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

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
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4 md:gap-4 md:p-4">
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
        <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
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
          <span className="absolute right-3 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
        )}
      </div>
    </div>
  );
}
