import React from "react";
import { getCategories, getFilteredTransactions } from "../actions";
import TransactionsTable from "@/components/dashboard/transactions-table";
import TransactionsFilters from "@/components/dashboard/transactions-filters";
import AddExpenseModal from "@/components/dashboard/add-expense-modal";

interface SearchParams {
  search?: string;
  type?: string;
  categoryId?: string;
}

interface TransactionsPageProps {
  searchParams: Promise<SearchParams>; // В Next.js 15+ searchParams — это Promise
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  // Дожидаемся разрешения параметров и списка категорий
  const resolvedParams = await searchParams;
  const categories = await getCategories();

  // Извлекаем чистые данные фильтров
  const filters = {
    search: resolvedParams.search,
    type: resolvedParams.type,
    categoryId: resolvedParams.categoryId,
  };

  // Получаем отфильтрованный массив транзакций из Supabase
  const transactions = await getFilteredTransactions(filters);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 w-full max-w-7xl mx-auto">
      {/* Шапка страницы транзакций */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Transactions
          </h1>
          <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-1">
            View, search, and audit all your financial logs
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <AddExpenseModal categories={categories} />
        </div>
      </div>

      {/* Интерактивный блок фильтрации и поиска */}
      <TransactionsFilters categories={categories} />

      {/* Таблица с результатами выборки */}
      <div className="w-full">
        <TransactionsTable transactions={transactions} />
      </div>
    </div>
  );
}
