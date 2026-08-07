"use client";

import React from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
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
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="pb-3 pl-2">{t("description")}</th>
              <th className="pb-3">{t("category")}</th>
              <th className="pb-3">{t("status")}</th>
              <th className="pb-3 text-right pr-2">{t("amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60 text-sm font-medium text-slate-700 dark:text-slate-300">
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs"
                >
                  {t("noTransactions")}
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isExpense = tx.type === "expense";
                const isCompleted = tx.status === "completed";
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
                      {tx.categories && tx.categories.length > 0 ? (
                        <span
                          className="text-xs px-2.5 py-1 rounded-lg border font-semibold inline-flex items-center"
                          style={{
                            backgroundColor: `${tx.categories[0].color}15`,
                            borderColor: `${tx.categories[0].color}35`,
                            color: tx.categories[0].color,
                          }}
                        >
                          {tx.categories[0].name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                          {t("uncategorized")}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl ${
                          isCompleted
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-transparent"
                            : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-transparent"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {isCompleted ? t("completed") : t("pending")}
                      </span>
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
