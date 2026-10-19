"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import { TransactionDetailSheet } from "@/components/dashboard/transaction-detail-sheet";
import {
  getPlanHistoryDays,
  isWithinHistoryLimit,
} from "@/utils/monetization/limits";

interface CategorySummary {
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  status: "completed" | "pending";
  note?: string | null;
  review_status?: "reviewed" | "needs_review";
  category_id?: string | null;
  recurring_transaction_id?: string | null;
  date: string;
  categories?: CategorySummary[] | null;
  splits?: Array<{
    id: string;
    categoryId: string | null;
    amount: number;
    note: string | null;
  }>;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  showViewAll?: boolean;
  categories?: Array<{
    id: string;
    name: string;
    color: string;
    type: "expense" | "income";
  }>;
}

const INITIAL_COUNT = 10;
const PAGE_SIZE = 10;

export default function TransactionsTable({
  transactions,
  showViewAll = false,
  categories = [],
}: TransactionsTableProps) {
  const { fmt, fmtDate, t } = useI18n();
  const { plan } = usePrefs();
  const historyDays = getPlanHistoryDays(plan);
  const limitedTransactions = React.useMemo(
    () =>
      transactions.filter((tx) => isWithinHistoryLimit(tx.date, historyDays)),
    [historyDays, transactions],
  );
  const hiddenCount = transactions.length - limitedTransactions.length;
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_COUNT);
  const [selectedTransaction, setSelectedTransaction] =
    React.useState<Transaction | null>(null);
  const visible = limitedTransactions.slice(0, visibleCount);
  const hasMore = visibleCount < limitedTransactions.length;
  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {t("recentTransactions")}
          </h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {t("latestActivity")}
          </p>
        </div>
        {showViewAll && (
          <Link
            href="/dashboard/transactions"
            className="inline-flex min-h-11 items-center px-2 text-xs font-bold text-slate-500 hover:text-red-500 dark:text-slate-400"
          >
            {t("viewAll")}
          </Link>
        )}
      </div>

      {hiddenCount > 0 && historyDays !== null && (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t("historyLimitedNotice")} {historyDays}d.
          </p>
          <Link
            href="/dashboard/pricing"
            className="font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            {t("upgradeToPro")}
          </Link>
        </div>
      )}

      {/* Mobile: card list */}
      <div className="sm:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        {limitedTransactions.length === 0 ? (
          <p className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            {t("noTransactions")}
          </p>
        ) : (
          visible.map((tx) => {
            const isExpense = tx.type === "expense";
            const cat = Array.isArray(tx.categories)
              ? tx.categories[0]
              : tx.categories;
            const formattedDate = fmtDate(tx.date);
            return (
              <button
                key={tx.id}
                type="button"
                onClick={() => setSelectedTransaction(tx)}
                className="flex w-full items-center gap-3 py-3 text-left active:scale-[0.99]"
              >
                <div
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border dark:border-transparent ${
                    isExpense
                      ? "bg-red-50 dark:bg-red-950/20 text-red-500"
                      : "bg-green-50 dark:bg-green-950/20 text-green-500"
                  }`}
                >
                  {isExpense ? (
                    <ArrowDownRight className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {tx.description}
                    </p>
                    {tx.review_status === "needs_review" && (
                      <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                        {t("needsReview")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {formattedDate}
                    </span>
                    {cat ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          backgroundColor: `${cat.color}18`,
                          color: cat.color,
                        }}
                      >
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {t("uncategorized")}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    isExpense
                      ? "text-slate-800 dark:text-slate-200"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {isExpense ? "-" : "+"}
                  {fmt(Number(tx.amount))}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-125">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="pb-3 pl-2">{t("description")}</th>
              <th className="pb-3">{t("category")}</th>
              <th className="pb-3 text-right pr-2">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 text-sm font-medium text-slate-700 dark:text-slate-300">
            {limitedTransactions.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs"
                >
                  {t("noTransactions")}
                </td>
              </tr>
            ) : (
              visible.map((tx) => {
                const isExpense = tx.type === "expense";
                const cat = Array.isArray(tx.categories)
                  ? tx.categories[0]
                  : tx.categories;
                const formattedDate = fmtDate(tx.date);
                return (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTransaction(tx)}
                    className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-3.5 pl-2 flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border dark:border-transparent transition-colors ${
                          isExpense
                            ? "bg-red-50 dark:bg-red-950/20 text-red-500"
                            : "bg-green-50 dark:bg-green-950/20 text-green-500"
                        }`}
                      >
                        {isExpense ? (
                          <ArrowDownRight className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                          {tx.description}
                          {tx.review_status === "needs_review" && (
                            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                              {t("needsReview")}
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                          {formattedDate}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5">
                      {cat ? (
                        <span
                          className="text-xs px-2.5 py-1 rounded-lg border font-semibold inline-flex items-center"
                          style={{
                            backgroundColor: `${cat.color}15`,
                            borderColor: `${cat.color}35`,
                            color: cat.color,
                          }}
                        >
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                          {t("uncategorized")}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3.5 text-right pr-2 font-bold ${isExpense ? "text-slate-800 dark:text-slate-200" : "text-green-600 dark:text-green-400"}`}
                    >
                      {isExpense ? "-" : "+"}
                      {fmt(Number(tx.amount))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Show more button */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          {t("showMore")} ({limitedTransactions.length - visibleCount} {t("remaining")})
        </button>
      )}

      {selectedTransaction && (
        <TransactionDetailSheet
          transaction={selectedTransaction}
          categories={categories}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}
