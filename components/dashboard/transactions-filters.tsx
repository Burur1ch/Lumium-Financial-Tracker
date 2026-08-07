"use client";

import React, { useTransition } from "react";
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-500">
      {/* 1. Поиск по тексту */}
      <div className="md:col-span-2 relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          defaultValue={searchParams.get("search") || ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-800 dark:text-slate-200 transition-all placeholder-slate-400"
        />
      </div>

      {/* 2. Фильтр: Тип транзакции */}
      <div className="relative flex items-center">
        <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
        <select
          defaultValue={searchParams.get("type") || "all"}
          onChange={(e) => updateFilter("type", e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-red-500 focus:outline-none cursor-pointer text-slate-700 dark:text-slate-300"
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
          className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-red-500 focus:outline-none cursor-pointer text-slate-700 dark:text-slate-300"
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
