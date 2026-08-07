"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

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

export default function TransactionsTable({
  transactions,
}: TransactionsTableProps) {
  const { fmt, t } = useI18n();
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

      <div className="overflow-x-auto w-full -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left border-collapse min-w-125">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="pb-3 pl-2">{t("description")}</th>
              <th className="pb-3">{t("category")}</th>
              <th className="pb-3 text-right pr-2">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 text-sm font-medium text-slate-700 dark:text-slate-300">
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs"
                >
                  {t("noTransactions")}
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isExpense = tx.type === "expense";
                const cat = Array.isArray(tx.categories)
                  ? tx.categories[0]
                  : tx.categories;
                const formattedDate = new Date(tx.date).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" },
                );

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
    </div>
  );
}
