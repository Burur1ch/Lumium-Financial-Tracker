"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import {
  getPlanHistoryDays,
  isWithinHistoryLimit,
} from "@/utils/monetization/limits";

interface CategorySummary {
  name: string;
  color: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  status: "completed" | "pending";
  date: string;
  categories?: CategorySummary[] | null;
}

interface TransactionsTableProps {
  transactions: Transaction[];
}

const INITIAL_COUNT = 10;
const PAGE_SIZE = 10;

export default function TransactionsTable({
  transactions,
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
  const visible = limitedTransactions.slice(0, visibleCount);
  const hasMore = visibleCount < limitedTransactions.length;
  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {t("recentTransactions")}
          </h4>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {t("latestActivity")}
          </p>
        </div>
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
              <div key={tx.id} className="flex items-center gap-3 py-3">
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
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {tx.description}
                  </p>
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
              </div>
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
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
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
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          {tx.description}
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
          Show more ({limitedTransactions.length - visibleCount} left)
        </button>
      )}
    </div>
  );
}
