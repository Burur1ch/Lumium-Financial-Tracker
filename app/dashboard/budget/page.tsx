import React from "react";
import { getCategories, getBudgetsWithProgress } from "../actions";
import BudgetContent from "@/components/dashboard/budget-content";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "")
    ? params.month!
    : new Date().toISOString().slice(0, 7);
  const [categories, budgets] = await Promise.all([
    getCategories(),
    getBudgetsWithProgress(month),
  ]);

  return (
    <BudgetContent categories={categories} budgets={budgets} month={month} />
  );
}
