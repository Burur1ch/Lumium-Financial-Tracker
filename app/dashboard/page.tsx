import React from "react";
import { createClient } from "@/utils/supabase/server";
import { getCategories } from "./actions";
import MetricCard from "@/components/dashboard/metric-card";
import ExpenseChart from "@/components/dashboard/expense-chart";
import CategoryChart from "@/components/dashboard/category-chart";
import TransactionsTable from "@/components/dashboard/transactions-table";
import AddExpenseModal from "@/components/dashboard/add-expense-modal";
import PeriodSelector from "@/components/dashboard/period-selector";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { Suspense } from "react";

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
    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }
  if (period === "3m") {
    // ISO week start (Monday)
    const d = new Date(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }
  // 1y / all → month
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let totalIncome = 0;
  let totalExpenses = 0;
  let prevIncome = 0;
  let prevExpenses = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentTransactions: any[] = [];
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
  const categoriesList = await getCategories();
  const prevRange = getPrevPeriodRange(period);

  if (user) {
    let txQuery = supabase
      .from("transactions")
      .select("amount, type, date, categories(name, color)")
      .eq("user_id", user.id);
    if (periodStart) txQuery = txQuery.gte("date", periodStart);

    let prevQuery = supabase
      .from("transactions")
      .select("amount, type")
      .eq("user_id", user.id);
    if (prevRange) {
      prevQuery = prevQuery
        .gte("date", prevRange.start)
        .lt("date", prevRange.end);
    }

    const [txAllRes, prevRes, recentRes] = await Promise.all([
      txQuery,
      prevRange ? prevQuery : Promise.resolve({ data: [] }),
      supabase
        .from("transactions")
        .select(
          "id, description, amount, type, status, date, categories(name, color)",
        )
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(20),
    ]);

    if (prevRes.data) {
      prevRes.data.forEach((tx: { amount: number; type: string }) => {
        const amount = Number(tx.amount);
        if (tx.type === "income") prevIncome += amount;
        else if (tx.type === "expense") prevExpenses += amount;
      });
    }

    if (txAllRes.data) {
      txAllRes.data.forEach((tx, idx) => {
        const amount = Number(tx.amount);
        const groupKey = getGroupLabel(tx.date, period);

        if (!chartDataMap[groupKey])
          chartDataMap[groupKey] = { income: 0, expense: 0 };

        if (tx.type === "income") {
          totalIncome += amount;
          chartDataMap[groupKey].income += amount;
        } else if (tx.type === "expense") {
          totalExpenses += amount;
          chartDataMap[groupKey].expense += amount;

          const cat = Array.isArray(tx.categories)
            ? tx.categories[0]
            : tx.categories;
          const categoryName = cat?.name || "Other";
          const categoryColor = cat?.color || COLORS[idx % COLORS.length];
          if (!categoryDataMap[categoryName]) {
            categoryDataMap[categoryName] = { value: 0, color: categoryColor };
          }
          categoryDataMap[categoryName].value += amount;
        }
      });
    }

    if (recentRes.data) recentTransactions = recentRes.data;
  }

  const expenseChartData = Object.entries(chartDataMap)
    .map(([label, v]) => ({ label, income: v.income, expense: v.expense }))
    .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());

  const categoryChartData = Object.entries(categoryDataMap).map(
    ([name, obj]) => ({ name, value: obj.value, color: obj.color }),
  );

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 w-full max-w-7xl mx-auto">
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DashboardHeader />
        <div className="flex items-center gap-3 flex-wrap">
          <Suspense>
            <PeriodSelector />
          </Suspense>
          <AddExpenseModal categories={categoriesList} />
        </div>
      </div>

      {/* Сетка карточек метрик */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <MetricCard
          amount={totalExpenses}
          change={calcChange(totalExpenses, prevExpenses)}
          type="expense"
          changeLabelKey={changeLabelKey}
        />
        <MetricCard
          amount={totalIncome}
          change={calcChange(totalIncome, prevIncome)}
          type="income"
          changeLabelKey={changeLabelKey}
        />
        <MetricCard
          amount={totalIncome - totalExpenses}
          change={calcChange(
            totalIncome - totalExpenses,
            prevIncome - prevExpenses,
          )}
          type="net"
          changeLabelKey={changeLabelKey}
        />
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 w-full overflow-hidden">
          <ExpenseChart data={expenseChartData} periodKey={periodKey} />
        </div>
        <div className="w-full overflow-hidden">
          <CategoryChart data={categoryChartData} periodKey={periodKey} />
        </div>
      </div>

      {/* Таблица транзакций */}
      <div className="w-full overflow-hidden">
        <TransactionsTable transactions={recentTransactions} />
      </div>
    </div>
  );
}
