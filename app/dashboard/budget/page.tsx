import React from "react";
import { getCategories, getBudgetsWithProgress } from "../actions";
import BudgetContent from "@/components/dashboard/budget-content";

export default async function BudgetPage() {
  const [categories, budgets] = await Promise.all([
    getCategories(),
    getBudgetsWithProgress(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <BudgetContent categories={categories} budgets={budgets as any} />;
}
