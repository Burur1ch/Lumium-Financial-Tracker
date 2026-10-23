import React from "react";
import { getCategories, getFilteredTransactions } from "../actions";
import TransactionsTable from "@/components/dashboard/transactions-table";
import TransactionsFilters from "@/components/dashboard/transactions-filters";
import { AddTransactionButton } from "@/components/dashboard/add-transaction-button";
import { ExportTransactionsButton } from "@/components/dashboard/export-transactions-button";
import { DashboardPageTitle } from "@/components/dashboard/dashboard-page-title";

interface SearchParams {
  search?: string;
  type?: string;
  categoryId?: string;
  reviewStatus?: string;
  month?: string;
}

interface TransactionsPageProps {
  searchParams: Promise<SearchParams>; // В Next.js 15+ searchParams возвращает Promise.
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  // Дожидаемся разрешения параметров и списка категорий
  const resolvedParams = await searchParams;
  const categories = await getCategories();

  // Извлекаем чистые данные фильтров
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const filters = {
    search: resolvedParams.search,
    type: resolvedParams.type,
    categoryId: resolvedParams.categoryId,
    reviewStatus: resolvedParams.reviewStatus,
    month: resolvedParams.month ?? currentMonth,
  };

  // Получаем отфильтрованный массив транзакций из PostgreSQL
  const transactions = await getFilteredTransactions(filters);

  return (
    <div className="mobile-finance-page mx-auto w-full max-w-7xl space-y-5 p-4 md:space-y-8 md:p-8">
      {/* Шапка страницы транзакций */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <DashboardPageTitle titleKey="transactions" subtitleKey="transactionsSubtitle" />
        </div>
        <div className="hidden gap-3 lg:flex">
          <ExportTransactionsButton filters={filters} />
          <AddTransactionButton />
        </div>
      </div>

      {/* Интерактивный блок фильтрации и поиска */}
      <TransactionsFilters categories={categories} />

      {/* Таблица с результатами выборки */}
      <div className="w-full">
        <TransactionsTable transactions={transactions} categories={categories} />
      </div>
    </div>
  );
}
