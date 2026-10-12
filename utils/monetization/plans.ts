export type PlanKey = "free" | "pro" | "family";
export type BillingInterval = "month" | "year";

export interface PlanPrice {
  monthly: number;
  yearly: number;
  yearlyPerMonth: number;
}

export interface PlanLimits {
  workspaces: number;
  members: number;
  transactionHistoryDays: number | null;
  customCategories: number | null;
  monthlyBudgets: number | null;
  exportsPerMonth: number;
  savedRules: number;
  supportLevel: "community" | "priority";
}

export interface PlanFeatures {
  csvImport: boolean;
  advancedReports: boolean;
  forecastAlerts: boolean;
  recurringTransactions: boolean;
  smartCategorization: boolean;
  sharedWorkspace: boolean;
  rolePermissions: boolean;
  aiInsights: boolean;
}

export interface MonetizationPlan {
  key: PlanKey;
  name: string;
  tagline: string;
  trialDays: number;
  price: PlanPrice;
  limits: PlanLimits;
  features: PlanFeatures;
  highlighted: boolean;
}

export const MONETIZATION_PLANS: Record<PlanKey, MonetizationPlan> = {
  free: {
    key: "free",
    name: "Free",
    tagline: "For personal tracking and habit building.",
    trialDays: 0,
    price: {
      monthly: 0,
      yearly: 0,
      yearlyPerMonth: 0,
    },
    limits: {
      workspaces: 1,
      members: 1,
      transactionHistoryDays: 30,
      customCategories: 10,
      monthlyBudgets: 5,
      exportsPerMonth: 0,
      savedRules: 0,
      supportLevel: "community",
    },
    features: {
      csvImport: false,
      advancedReports: false,
      forecastAlerts: false,
      recurringTransactions: false,
      smartCategorization: false,
      sharedWorkspace: false,
      rolePermissions: false,
      aiInsights: false,
    },
    highlighted: false,
  },
  pro: {
    key: "pro",
    name: "Pro",
    tagline: "For power users who want automation and deeper insight.",
    trialDays: 7,
    price: {
      monthly: 7,
      yearly: 67,
      yearlyPerMonth: 5.58,
    },
    limits: {
      workspaces: 1,
      members: 1,
      transactionHistoryDays: null,
      customCategories: null,
      monthlyBudgets: null,
      exportsPerMonth: 20,
      savedRules: 25,
      supportLevel: "priority",
    },
    features: {
      csvImport: true,
      advancedReports: true,
      forecastAlerts: true,
      recurringTransactions: true,
      smartCategorization: true,
      sharedWorkspace: false,
      rolePermissions: false,
      aiInsights: true,
    },
    highlighted: true,
  },
  family: {
    key: "family",
    name: "Family",
    tagline: "For households and small teams sharing money decisions.",
    trialDays: 14,
    price: {
      monthly: 15,
      yearly: 144,
      yearlyPerMonth: 12,
    },
    limits: {
      workspaces: 3,
      members: 5,
      transactionHistoryDays: null,
      customCategories: null,
      monthlyBudgets: null,
      exportsPerMonth: 100,
      savedRules: 100,
      supportLevel: "priority",
    },
    features: {
      csvImport: true,
      advancedReports: true,
      forecastAlerts: true,
      recurringTransactions: true,
      smartCategorization: true,
      sharedWorkspace: true,
      rolePermissions: true,
      aiInsights: true,
    },
    highlighted: false,
  },
};

export const DEFAULT_PLAN: PlanKey = "free";

export function getPlan(plan: PlanKey = DEFAULT_PLAN): MonetizationPlan {
  return MONETIZATION_PLANS[plan];
}

export function getPlanPriceLabel(
  plan: MonetizationPlan,
  interval: BillingInterval,
): string {
  if (plan.price.monthly === 0) return "$0";
  return interval === "year"
    ? `$${plan.price.yearly}/year`
    : `$${plan.price.monthly}/month`;
}
