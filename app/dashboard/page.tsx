import { ReminderControls } from "@/components/dashboard/reminder-controls";
import React from "react";
import {
  allocateTransactions,
  independentBudgets,
} from "@/utils/financial-allocations";
import { displayCategory } from "@/utils/category-catalog";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  categories,
  quickTransactionPresets,
  transactions,
  transactionSplits,
} from "@/db/schema";
import { auth } from "@/utils/auth/server";
import MetricCard from "@/components/dashboard/metric-card";
import ExpenseChart from "@/components/dashboard/expense-chart";
import CategoryChart from "@/components/dashboard/category-chart";
import TransactionsTable from "@/components/dashboard/transactions-table";
import { AddTransactionButton } from "@/components/dashboard/add-transaction-button";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Suspense } from "react";
import { getBudgetsWithProgress, getCategories } from "./actions";
import { MobileDashboardOverview } from "@/components/dashboard/mobile-dashboard-overview";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { quickLaunchAction, quickLaunchAuthUrl } from "@/utils/quick-launch";

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function getMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(rawMonth?: string) {
  const now = new Date();
  const fallback = getMonthKey(now);
  const match = MONTH_PATTERN.exec(rawMonth ?? fallback);
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  const previousStart = new Date(Date.UTC(year, monthIndex - 1, 1));

  return {
    key: getMonthKey(start),
    start,
    end,
    previousStart,
  };
}

function calcChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / Math.abs(prev)) * 100);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; launch?: string }>;
}) {
  const { month: rawMonth, launch } = await searchParams;
  const monthRange = getMonthRange(rawMonth);
  const periodKey = "monthly" as const;
  const changeLabelKey = "vsPreviousMonth" as const;
  const completedThrough = new Date();
  completedThrough.setUTCHours(24, 0, 0, 0);

  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) redirect(quickLaunchAuthUrl("login", quickLaunchAction(launch)));

  let totalIncome = 0;
  let totalExpenses = 0;
  let prevIncome = 0;
  let prevExpenses = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentTransactions: any[] = [];
  let quickPresets: Array<{
    id: string;
    name: string;
    amount: number;
    type: "expense" | "income";
    icon: string;
    category: { id: string; name: string; color: string; icon: string } | null;
  }> = [];
  let quickCategories: Array<{
    id: string;
    name: string;
    type: "expense" | "income";
    color: string;
    icon: string;
  }> = [];
  let dashboardBudgets: Array<{
    category_id: string;
    parent_id: string | null;
    monthly_limit: number;
    current_spent: number;
    categories: { name: string; color: string; icon: string | null } | null;
  }> = [];
  const chartDataMap: { [key: string]: { income: number; expense: number } } =
    {};
  const categoryDataMap: {
    [key: string]: {
      value: number;
      color: string;
      name: string;
      system_key: string | null;
    };
  } = {};

  const COLORS = [
    "#D92D3A",
    "#3478C8",
    "#24845C",
    "#B8791D",
    "#287D91",
    "#EC4899",
  ];
  if (user) {
    const owner = eq(transactions.user_id, user.id);
    const [
      txAll,
      prevData,
      recentData,
      presetData,
      categoryOptions,
      budgetData,
      splitData,
    ] = await Promise.all([
      db
        .select({
          id: transactions.id,
          category_id: transactions.category_id,
          amount: transactions.amount,
          type: transactions.type,
          date: transactions.date,
          categories: {
            name: categories.name,
            color: categories.color,
            icon: categories.icon,
          },
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
          and(
            owner,
            eq(transactions.status, "completed"),
            lt(transactions.date, completedThrough),
            gte(transactions.date, monthRange.start),
            lt(transactions.date, monthRange.end),
          ),
        ),
      db
        .select({ amount: transactions.amount, type: transactions.type })
        .from(transactions)
        .where(
          and(
            owner,
            eq(transactions.status, "completed"),
            lt(transactions.date, completedThrough),
            gte(transactions.date, monthRange.previousStart),
            lt(transactions.date, monthRange.start),
          ),
        ),
      db
        .select({
          id: transactions.id,
          description: transactions.description,
          amount: transactions.amount,
          type: transactions.type,
          status: transactions.status,
          note: transactions.note,
          review_status: transactions.review_status,
          recurring_transaction_id: transactions.recurring_transaction_id,
          category_id: transactions.category_id,
          date: transactions.date,
          categories: {
            name: categories.name,
            color: categories.color,
            icon: categories.icon,
          },
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
          and(
            owner,
            gte(transactions.date, monthRange.start),
            lt(transactions.date, monthRange.end),
          ),
        )
        .orderBy(desc(transactions.date))
        .limit(20),
      db
        .select({
          id: quickTransactionPresets.id,
          name: quickTransactionPresets.name,
          amount: quickTransactionPresets.amount,
          type: quickTransactionPresets.type,
          icon: quickTransactionPresets.icon,
          categoryId: quickTransactionPresets.category_id,
          categoryName: categories.name,
          categoryColor: categories.color,
          categoryIcon: categories.icon,
        })
        .from(quickTransactionPresets)
        .leftJoin(
          categories,
          eq(quickTransactionPresets.category_id, categories.id),
        )
        .where(eq(quickTransactionPresets.user_id, user.id))
        .orderBy(
          asc(quickTransactionPresets.sort_order),
          asc(quickTransactionPresets.created_at),
        )
        .limit(8),
      getCategories(),
      getBudgetsWithProgress(monthRange.key),
      db
        .select({
          transaction_id: transactionSplits.transaction_id,
          category_id: transactionSplits.category_id,
          amount: transactionSplits.amount,
        })
        .from(transactionSplits)
        .innerJoin(
          transactions,
          eq(transactionSplits.transaction_id, transactions.id),
        )
        .where(
          and(
            eq(transactionSplits.user_id, user.id),
            owner,
            gte(transactions.date, monthRange.start),
            lt(transactions.date, monthRange.end),
          ),
        ),
    ]);

    dashboardBudgets = budgetData.map((budget) => ({
      category_id: budget.category_id,
      parent_id: budget.parent_id,
      monthly_limit: Number(budget.monthly_limit),
      current_spent: Number(budget.current_spent),
      categories: budget.categories,
    }));

    quickPresets = presetData.map((preset) => ({
      id: preset.id,
      name: preset.name,
      amount: Number(preset.amount),
      type: preset.type as "expense" | "income",
      icon: preset.icon,
      category:
        preset.categoryId && preset.categoryName && preset.categoryColor
          ? {
              ...displayCategory(
                categoryOptions.find((c) => c.id === preset.categoryId) ?? {
                  id: preset.categoryId,
                  name: preset.categoryName,
                },
                categoryOptions,
              ),
              id: preset.categoryId,
              name: preset.categoryName,
              color: preset.categoryColor,
              icon: preset.categoryIcon ?? "tag",
            }
          : null,
    }));
    quickCategories = categoryOptions.map((category) => ({
      ...category,
      type: category.type as "expense" | "income",
    }));

    if (prevData) {
      prevData.forEach((tx) => {
        const amount = Number(tx.amount);
        if (tx.type === "income") prevIncome += amount;
        else if (tx.type === "expense") prevExpenses += amount;
      });
    }

    if (txAll) {
      txAll.forEach((tx) => {
        const amount = Number(tx.amount);
        const groupKey = tx.date.toISOString().slice(0, 10);

        if (!chartDataMap[groupKey])
          chartDataMap[groupKey] = { income: 0, expense: 0 };

        if (tx.type === "income") {
          totalIncome += amount;
          chartDataMap[groupKey].income += amount;
        } else if (tx.type === "expense") {
          totalExpenses += amount;
          chartDataMap[groupKey].expense += amount;
        }
      });
    }

    for (const allocation of allocateTransactions(txAll, splitData)) {
      if (allocation.type !== "expense") continue;
      const category = categoryOptions.find(
        (c) => c.id === allocation.category_id,
      );
      const root =
        categoryOptions.find((c) => c.id === category?.parent_id) ?? category;
      const id = root?.id ?? "uncategorized";
      const total = categoryDataMap[id] ?? {
        value: 0,
        color: root?.color ?? COLORS[0],
        name: root?.name ?? "",
        system_key: root?.system_key ?? null,
      };
      total.value += allocation.amount;
      categoryDataMap[id] = total;
    }
    recentTransactions = recentData.map((tx) => ({
      ...tx,
      categories: categoryOptions
        .filter((c) => c.id === tx.category_id)
        .map((c) => displayCategory(c, categoryOptions)),
      splits: splitData
        .filter((part) => part.transaction_id === tx.id)
        .map((part, index) => ({
          id: tx.id + index,
          categoryId: part.category_id,
          amount: Number(part.amount),
          note: null,
        })),
      amount: Number(tx.amount),
      date: tx.date.toISOString(),
    }));
  }

  const expenseChartData = Object.entries(chartDataMap)
    .map(([label, v]) => ({ label, income: v.income, expense: v.expense }))
    .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());

  const categoryChartData = Object.entries(categoryDataMap).map(
    ([id, obj]) => ({ id, ...obj }),
  );

  const monthlyTrend: { date: string; net: number }[] = [];
  let runningNet = 0;
  for (let date = new Date(monthRange.start); date < monthRange.end && date < completedThrough; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateKey = date.toISOString().slice(0, 10);
    const daily = chartDataMap[dateKey];
    runningNet += (daily?.income ?? 0) - (daily?.expense ?? 0);
    monthlyTrend.push({ date: dateKey, net: runningNet });
  }

  const mobileBudget = {
    spent: independentBudgets(dashboardBudgets).reduce(
      (sum, budget) => sum + budget.current_spent,
      0,
    ),
    limit: independentBudgets(dashboardBudgets).reduce(
      (sum, budget) => sum + budget.monthly_limit,
      0,
    ),
    categories: [...dashboardBudgets]
      .sort((a, b) => b.monthly_limit - a.monthly_limit)
      .slice(0, 3)
      .map((budget) => ({
        ...budget.categories,
        name: budget.categories?.name ?? "Other",
        color: budget.categories?.color ?? "#64748b",
        icon: budget.categories?.icon ?? null,
        limit: budget.monthly_limit,
      })),
  };

  return (
    <>
      <div className="mobile-finance-page mx-auto w-full max-w-lg space-y-5 px-4 py-3 lg:hidden">
        <MobileDashboardOverview
          month={monthRange.key}
          balance={totalIncome - totalExpenses}
          balanceChange={totalIncome - totalExpenses - (prevIncome - prevExpenses)}
          trend={monthlyTrend}
          income={totalIncome}
          expense={totalExpenses}
          incomeChange={calcChange(totalIncome, prevIncome)}
          expenseChange={calcChange(totalExpenses, prevExpenses)}
          budget={mobileBudget}
        />
        <ReminderControls />
        <QuickActions presets={quickPresets} categories={quickCategories} />
        <TransactionsTable
          transactions={recentTransactions}
          categories={quickCategories}
          showViewAll
        />
      </div>

      <div className="mx-auto hidden w-full max-w-7xl space-y-5 p-4 md:space-y-8 md:p-8 lg:block">
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <DashboardHeader />
          <div className="flex items-center gap-3">
            <Suspense>
              <div data-tour="period">
                <MonthSelector variant="stepper" />
              </div>
            </Suspense>
            <AddTransactionButton />
          </div>
        </div>

        <ReminderControls />
        <div data-tour="overview" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <MetricCard amount={totalIncome - totalExpenses} change={calcChange(totalIncome - totalExpenses, prevIncome - prevExpenses)} type="net" changeLabelKey={changeLabelKey} featured />
          <MetricCard
            amount={totalIncome}
            change={calcChange(totalIncome, prevIncome)}
            type="income"
            changeLabelKey={changeLabelKey}
          />
          <MetricCard
            amount={totalExpenses}
            change={calcChange(totalExpenses, prevExpenses)}
            type="expense"
            changeLabelKey={changeLabelKey}
          />
        </div>

        <QuickActions presets={quickPresets} categories={quickCategories} />

        {/* Графики */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2 w-full overflow-hidden">
            <ExpenseChart data={expenseChartData} periodKey={periodKey} />
          </div>
          <div className="w-full overflow-hidden">
            <CategoryChart data={categoryChartData} periodKey={periodKey} />
          </div>
        </div>

        {/* Таблица транзакций */}
        <div className="w-full overflow-hidden">
          <TransactionsTable
            transactions={recentTransactions}
            categories={quickCategories}
            showViewAll
          />
        </div>
      </div>
    </>
  );
}
