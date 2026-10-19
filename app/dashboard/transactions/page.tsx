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
    reviewStatus: resolvedParams.reviewStatus,
  };

  // Получаем отфильтрованный массив транзакций из PostgreSQL
  const transactions = await getFilteredTransactions(filters);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:space-y-8 md:p-8">
      {/* Шапка страницы транзакций */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DashboardPageTitle titleKey="transactions" subtitleKey="transactionsSubtitle" />
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
          <ExportTransactionsButton filters={filters} />
          <AddTransactionButton className="hidden w-full sm:inline-flex sm:w-auto" />
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
