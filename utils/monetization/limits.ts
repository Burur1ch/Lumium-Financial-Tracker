import type { PlanKey } from "@/utils/monetization/plans";
import { MONETIZATION_PLANS } from "@/utils/monetization/plans";

export type PeriodValue = "7d" | "30d" | "3m" | "1y" | "all";

const PERIODS_BY_PLAN: Record<PlanKey, PeriodValue[]> = {
  free: ["7d", "30d"],
  pro: ["7d", "30d", "3m", "1y", "all"],
  family: ["7d", "30d", "3m", "1y", "all"],
};

export function getAccessiblePeriods(plan: PlanKey): PeriodValue[] {
  return PERIODS_BY_PLAN[plan];
}

export function canAccessPeriod(plan: PlanKey, period: string | null): boolean {
  if (!period) return true;
  return getAccessiblePeriods(plan).includes(period as PeriodValue);
}

export function canAccessAdvancedReports(plan: PlanKey): boolean {
  return MONETIZATION_PLANS[plan].features.advancedReports;
}

export function canAccessCsvExport(plan: PlanKey): boolean {
  return MONETIZATION_PLANS[plan].features.csvImport;
}

export function getPlanCategoryLimit(plan: PlanKey): number | null {
  return MONETIZATION_PLANS[plan].limits.customCategories;
}

export function getPlanBudgetLimit(plan: PlanKey): number | null {
  return MONETIZATION_PLANS[plan].limits.monthlyBudgets;
}

export function getPlanHistoryDays(plan: PlanKey): number | null {
  return MONETIZATION_PLANS[plan].limits.transactionHistoryDays;
}

export function isLimitReached(limit: number | null, count: number): boolean {
  return limit !== null && count >= limit;
}

export function isWithinHistoryLimit(
  dateString: string,
  days: number | null,
): boolean {
  if (days === null) return true;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(dateString) >= cutoff;
}
