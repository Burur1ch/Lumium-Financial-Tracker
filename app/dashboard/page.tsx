import React from "react";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  categories,
  quickTransactionPresets,
  transactions,
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
import { getBudgetsWithProgress } from "./actions";
import { MobileDashboardOverview } from "@/components/dashboard/mobile-dashboard-overview";
import { MonthSelector } from "@/components/dashboard/month-selector";

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
  return Math.round(((current - prev) / prev) * 100);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: rawMonth } = await searchParams;
  const monthRange = getMonthRange(rawMonth);
  const periodKey = "monthly" as const;
  const changeLabelKey = "vsPreviousMonth" as const;

  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) redirect("/login");

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
    monthly_limit: number;
    current_spent: number;
    categories: { name: string; color: string; icon: string | null } | null;
  }> = [];
  const chartDataMap: { [key: string]: { income: number; expense: number } } =
    {};
  const categoryDataMap: { [key: string]: { value: number; color: string } } =
    {};

  const COLORS = [
    "#EF4444",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
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
    ] = await Promise.all([
      db
        .select({
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
          category_id: transactions.category_id,
          recurring_transaction_id: transactions.recurring_transaction_id,
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
      db
        .select({
          id: categories.id,
          name: categories.name,
          type: categories.type,
          color: categories.color,
          icon: categories.icon,
        })
        .from(categories)
        .where(eq(categories.user_id, user.id))
        .orderBy(asc(categories.name)),
      getBudgetsWithProgress(monthRange.key),
    ]);

    dashboardBudgets = budgetData.map((budget) => ({
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
      txAll.forEach((tx, idx) => {
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

          const cat = tx.categories;
          const categoryName = cat?.name || "Other";
          const categoryColor = cat?.color || COLORS[idx % COLORS.length];
          if (!categoryDataMap[categoryName]) {
            categoryDataMap[categoryName] = { value: 0, color: categoryColor };
          }
          categoryDataMap[categoryName].value += amount;
        }
      });
    }

    recentTransactions = recentData.map((tx) => ({
      ...tx,
      amount: Number(tx.amount),
      date: tx.date.toISOString(),
    }));
  }

  const expenseChartData = Object.entries(chartDataMap)
    .map(([label, v]) => ({ label, income: v.income, expense: v.expense }))
    .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());

  const categoryChartData = Object.entries(categoryDataMap).map(
    ([name, obj]) => ({ name, value: obj.value, color: obj.color }),
  );

  const mobileTrend = expenseChartData.reduce<number[]>((trend, point) => {
    const previous = trend.at(-1) ?? 0;
    return [...trend, previous + point.income - point.expense];
  }, [0]);
  const mobileBudget = {
    spent: dashboardBudgets.reduce((sum, budget) => sum + budget.current_spent, 0),
    limit: dashboardBudgets.reduce((sum, budget) => sum + budget.monthly_limit, 0),
    categories: [...dashboardBudgets]
      .sort((a, b) => b.monthly_limit - a.monthly_limit)
      .slice(0, 3)
      .map((budget) => ({
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
          balanceDelta={(totalIncome - totalExpenses) - (prevIncome - prevExpenses)}
          income={totalIncome}
          expense={totalExpenses}
          incomeChange={calcChange(totalIncome, prevIncome)}
          expenseChange={calcChange(totalExpenses, prevExpenses)}
          trend={mobileTrend}
          budget={mobileBudget}
        />
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
            <MonthSelector variant="stepper" />
          </Suspense>
          <AddTransactionButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <MetricCard
          amount={totalIncome - totalExpenses}
          change={calcChange(
            totalIncome - totalExpenses,
            prevIncome - prevExpenses,
          )}
          type="net"
          changeLabelKey={changeLabelKey}
          featured
        />
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
