"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import { TransactionDetailSheet } from "@/components/dashboard/transaction-detail-sheet";
import { CategoryArtwork } from "@/components/dashboard/category-artwork";
import {
  getPlanHistoryDays,
  isWithinHistoryLimit,
} from "@/utils/monetization/limits";

interface CategorySummary {
  name: string;
  color: string;
  icon?: string | null;
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
  categories?: CategorySummary | CategorySummary[] | null;
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
    icon?: string | null;
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
  const { fmt, fmtDate, t, language } = useI18n();
  const { plan } = usePrefs();
  const [transactionOverrides, setTransactionOverrides] = React.useState<
    Record<string, Transaction>
  >({});
  const displayedTransactions = React.useMemo(
    () =>
      transactions.map(
        (transaction) => transactionOverrides[transaction.id] ?? transaction,
      ),
    [transactionOverrides, transactions],
  );
  const historyDays = getPlanHistoryDays(plan);
  const limitedTransactions = React.useMemo(
    () =>
      displayedTransactions.filter((tx) =>
        isWithinHistoryLimit(tx.date, historyDays),
      ),
    [displayedTransactions, historyDays],
  );
  const hiddenCount = displayedTransactions.length - limitedTransactions.length;
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_COUNT);
  const [selectedTransaction, setSelectedTransaction] =
    React.useState<Transaction | null>(null);
  const visible = limitedTransactions.slice(0, visibleCount);
  const hasMore = visibleCount < limitedTransactions.length;
  const mobileVisible = showViewAll ? visible.slice(0, 3) : visible;
  const locale = { en: "en-US", ru: "ru-RU", de: "de-DE", fr: "fr-FR" }[language];
  const todayKey = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();
  const groupedMobileTransactions = mobileVisible.reduce<Array<{ key: string; label: string; items: Transaction[] }>>((groups, tx) => {
    const date = new Date(tx.date);
    const key = date.toDateString();
    let group = groups.find((item) => item.key === key);
    if (!group) {
      const calendarDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);
      const label = key === todayKey
        ? `${t("today")}, ${calendarDate}`
        : key === yesterdayKey
          ? `${t("yesterday")}, ${calendarDate}`
          : calendarDate;
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(tx);
    return groups;
  }, []);

  const renderMobileRows = (items: Transaction[]) => (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 dark:border-white/[0.055] dark:bg-white/[0.035]">
      {items.map((tx) => {
        const isExpense = tx.type === "expense";
        const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
        const date = new Date(tx.date);
        const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
        const relativeDate = date.toDateString() === todayKey
          ? t("today")
          : date.toDateString() === yesterdayKey
            ? t("yesterday")
            : fmtDate(tx.date);
        const meta = showViewAll
          ? `${cat?.name ?? t("uncategorized")} · ${relativeDate}, ${time}`
          : `${cat?.name ?? t("uncategorized")} · ${time}`;
        const avatarColor = cat?.color ?? (isExpense ? "#ef4444" : "#10b981");
        return (
          <button
            key={tx.id}
            type="button"
            onClick={() => setSelectedTransaction(tx)}
            className="flex min-h-[4.35rem] w-full items-center gap-3 border-b border-slate-200/70 px-3 text-left last:border-b-0 active:bg-slate-100/70 dark:border-white/[0.055] dark:active:bg-white/[0.045]"
          >
            <CategoryArtwork
              icon={cat?.icon}
              name={cat?.name}
              className="h-10 w-10 rounded-xl"
              fallback={
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-sm"
                  style={{ backgroundColor: avatarColor }}
                >
                  {tx.description.trim().charAt(0).toUpperCase() || (isExpense ? "−" : "+")}
                </span>
              }
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{tx.description}</span>
                {tx.review_status === "needs_review" && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-label={t("needsReview")} />
                )}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-400 dark:text-slate-500">{meta}</span>
            </span>
            <span className={`max-w-[7.75rem] shrink-0 truncate text-right text-[13px] font-bold tabular-nums ${isExpense ? "text-slate-900 dark:text-slate-100" : "text-emerald-600 dark:text-emerald-400"}`}>
              {isExpense ? "−" : "+"}{fmt(Number(tx.amount))}
            </span>
            {!showViewAll && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.8} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full sm:rounded-2xl sm:border sm:border-slate-200/80 sm:bg-white sm:p-6 sm:shadow-sm sm:dark:border-slate-800 sm:dark:bg-slate-900">
      <div className={`mb-2.5 flex items-center justify-between sm:mb-6 ${showViewAll ? "" : "max-sm:hidden"}`}>
        <div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {t("recentTransactions")}
          </h4>
          <p className="mt-0.5 hidden text-xs text-slate-400 dark:text-slate-500 sm:block">
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

      {/* Mobile: grouped finance feed */}
      <div className="space-y-4 sm:hidden">
        {limitedTransactions.length === 0 ? (
          <p className="finance-panel py-8 text-center text-xs text-slate-400 dark:text-slate-500">
            {t("noTransactions")}
          </p>
        ) : showViewAll ? (
          renderMobileRows(mobileVisible)
        ) : (
          groupedMobileTransactions.map((group) => {
            const total = group.items.reduce((sum, tx) => sum + (tx.type === "income" ? Number(tx.amount) : -Number(tx.amount)), 0);
            return (
              <section key={group.key}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{group.label}</h3>
                  <span className={`text-xs font-bold tabular-nums ${total >= 0 ? "text-emerald-500" : "text-slate-700 dark:text-slate-200"}`}>{total >= 0 ? "+" : "−"}{fmt(Math.abs(total))}</span>
                </div>
                {renderMobileRows(group.items)}
              </section>
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
                          className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: `${cat.color}15`,
                            borderColor: `${cat.color}35`,
                            color: cat.color,
                          }}
                        >
                          <CategoryArtwork
                            icon={cat.icon}
                            name={cat.name}
                            className="h-5 w-5 rounded-md"
                          />
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
      {hasMore && !showViewAll && (
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
          onUpdated={(updated) => {
            setTransactionOverrides((current) => ({
              ...current,
              [updated.id]: updated,
            }));
          }}
        />
      )}
    </div>
  );
}
