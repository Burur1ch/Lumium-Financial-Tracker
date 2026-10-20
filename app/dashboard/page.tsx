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
import PeriodSelector from "@/components/dashboard/period-selector";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Suspense } from "react";
import { getBudgetsWithProgress } from "./actions";
import { MobileDashboardOverview } from "@/components/dashboard/mobile-dashboard-overview";

type Period = "7d" | "30d" | "3m" | "1y" | "all";

function getPeriodStart(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d.toISOString();
    }
    case "1y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString();
    }
    case "all":
      return null;
  }
}

function getPrevPeriodRange(
  period: Period,
): { start: string; end: string } | null {
  if (period === "all") return null;
  const now = new Date();
  const end = getPeriodStart(period)!; // start of current = end of prev
  let start: Date;
  switch (period) {
    case "7d":
      start = new Date(end);
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start = new Date(end);
      start.setDate(start.getDate() - 30);
      break;
    case "3m":
      start = new Date(end);
      start.setMonth(start.getMonth() - 3);
      break;
    case "1y":
      start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      return null;
  }
  void now;
  return { start: start.toISOString(), end };
}

function getPeriodKey(
  period: Period,
): "last7days" | "last30days" | "last3months" | "lastYear" | "allTime" {
  switch (period) {
    case "7d":
      return "last7days";
    case "30d":
      return "last30days";
    case "3m":
      return "last3months";
    case "1y":
      return "lastYear";
    case "all":
      return "allTime";
  }
}

function getChangeLabelKey(
  period: Period,
): "vsPrev7d" | "vsPrev30d" | "vsPrev3m" | "vsPrevYear" | "allTime" {
  switch (period) {
    case "7d":
      return "vsPrev7d";
    case "30d":
      return "vsPrev30d";
    case "3m":
      return "vsPrev3m";
    case "1y":
      return "vsPrevYear";
    case "all":
      return "allTime";
  }
}

function calcChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

// Group by day for 7d/30d, by week for 3m, by month for 1y/all
function getGroupLabel(dateStr: string, period: Period): string {
  const date = new Date(dateStr);
  if (period === "7d" || period === "30d") {
    return date.toISOString().slice(0, 10);
  }
  if (period === "3m") {
    // ISO week start (Monday)
    const d = new Date(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  // 1y / all → month
  return `${date.toISOString().slice(0, 7)}-01`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = (
    ["7d", "30d", "3m", "1y", "all"].includes(rawPeriod ?? "")
      ? rawPeriod
      : "30d"
  ) as Period;
  const periodStart = getPeriodStart(period);
  const periodKey = getPeriodKey(period);
  const changeLabelKey = getChangeLabelKey(period);

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
    category: { id: string; name: string; color: string } | null;
  }> = [];
  let quickCategories: Array<{
    id: string;
    name: string;
    type: "expense" | "income";
    color: string;
  }> = [];
  let dashboardBudgets: Array<{
    monthly_limit: number;
    current_spent: number;
    categories: { name: string; color: string } | null;
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
  const prevRange = getPrevPeriodRange(period);

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
          categories: { name: categories.name, color: categories.color },
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(
          periodStart
            ? and(
                owner,
                eq(transactions.status, "completed"),
                gte(transactions.date, new Date(periodStart)),
              )
            : and(owner, eq(transactions.status, "completed")),
        ),
      prevRange
        ? db
            .select({ amount: transactions.amount, type: transactions.type })
            .from(transactions)
            .where(
              and(
                owner,
                eq(transactions.status, "completed"),
                gte(transactions.date, new Date(prevRange.start)),
                lt(transactions.date, new Date(prevRange.end)),
              ),
            )
        : Promise.resolve([]),
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
          categories: { name: categories.name, color: categories.color },
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.category_id, categories.id))
        .where(owner)
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
        })
        .from(categories)
        .where(eq(categories.user_id, user.id))
        .orderBy(asc(categories.name)),
      getBudgetsWithProgress(),
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
        const groupKey = getGroupLabel(tx.date.toISOString(), period);

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
        limit: budget.monthly_limit,
      })),
  };

  return (
    <>
      <div className="mobile-finance-page mx-auto w-full max-w-lg space-y-5 px-4 py-3 lg:hidden">
        <MobileDashboardOverview
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
            <PeriodSelector />
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

      <div className="overflow-x-auto pb-1 lg:hidden">
        <Suspense>
          <PeriodSelector />
        </Suspense>
      </div>

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
