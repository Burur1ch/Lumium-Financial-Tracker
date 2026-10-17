"use server";

import { and, count, desc, eq, gte, ilike } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  budgets,
  categories,
  profiles,
  subscriptions,
  transactions,
} from "@/db/schema";
import { auth } from "@/utils/auth/server";
import * as XLSX from "xlsx";
import {
  canAccessAdvancedReports,
  canAccessCsvExport,
  getPlanBudgetLimit,
  getPlanCategoryLimit,
  getPlanHistoryDays,
  isLimitReached,
} from "@/utils/monetization/limits";
import type { BillingInterval, PlanKey } from "@/utils/monetization/plans";
import { isCurrency, RATES } from "@/utils/currency";
import { revalidatePath } from "next/cache";
import {
  getAppBaseUrl,
  getPriceIdForPlan,
  getStripeClient,
} from "@/utils/stripe/server";
import type Stripe from "stripe";

type StripeSubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

function isStripePlanActive(
  status: StripeSubscriptionStatus,
  currentPeriodEnd: string | null,
) {
  if (
    !(status === "active" || status === "trialing" || status === "past_due")
  ) {
    return false;
  }

  if (!currentPeriodEnd) {
    return true;
  }

  return new Date(currentPeriodEnd).getTime() > Date.now();
}

function normalizePlanKey(value: unknown): PlanKey {
  return value === "pro" || value === "family" ? value : "free";
}

function slugifyFilePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "lumium"
  );
}

async function getCurrentPlanForUser(user: { id: string }): Promise<PlanKey> {
  const [data] = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.current_period_end,
    })
    .from(subscriptions)
    .where(eq(subscriptions.user_id, user.id))
    .limit(1);

  if (!data) return "free";

  const status = data.status as StripeSubscriptionStatus;
  const isActive = isStripePlanActive(
    status,
    data.currentPeriodEnd?.toISOString() ?? null,
  );

  if (!isActive) {
    return "free";
  }

  return normalizePlanKey(data.plan);
}

async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

function getPeriodStartDate(period: string): Date | null {
  const now = new Date();

  switch (period) {
    case "7d": {
      const date = new Date(now);
      date.setDate(now.getDate() - 7);
      return date;
    }
    case "30d": {
      const date = new Date(now);
      date.setDate(now.getDate() - 30);
      return date;
    }
    case "3m": {
      const date = new Date(now);
      date.setMonth(now.getMonth() - 3);
      return date;
    }
    case "1y": {
      const date = new Date(now);
      date.setFullYear(now.getFullYear() - 1);
      return date;
    }
    case "all":
    default:
      return null;
  }
}

function buildWorkbookBase64(sheets: Array<{ name: string; rows: unknown[] }>) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  return XLSX.write(workbook, {
    type: "base64",
    bookType: "xlsx",
  });
}

async function getExportUserContext() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      plan: "free" as PlanKey,
      profileName: "lumium",
    };
  }

  const [profile] = await db
    .select({ name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return {
    user,
    plan: await getCurrentPlanForUser(user),
    profileName: profile?.name?.trim() || user.email.split("@")[0] || "lumium",
  };
}

export async function getCurrentPlan(): Promise<PlanKey> {
  const user = await getCurrentUser();

  if (!user) {
    return "free";
  }

  return getCurrentPlanForUser(user);
}

export async function setCurrentPlan(plan: PlanKey) {
  if (plan !== "free") {
    return {
      success: false,
      error: "Direct upgrade is disabled. Use Stripe checkout.",
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  await db
    .insert(subscriptions)
    .values({
      user_id: user.id,
      plan: "free",
      status: "inactive",
      billing_interval: null,
      current_period_end: null,
      cancel_at_period_end: false,
    })
    .onConflictDoUpdate({
      target: subscriptions.user_id,
      set: {
        plan: "free",
        status: "inactive",
        billing_interval: null,
        current_period_end: null,
        cancel_at_period_end: false,
        updated_at: new Date(),
      },
    });

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function createCheckoutSession(input: {
  plan: Exclude<PlanKey, "free">;
  interval: BillingInterval;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const priceId = getPriceIdForPlan(input.plan, input.interval);
  if (!priceId) {
    return { success: false, error: "Stripe price is not configured" };
  }

  const stripe = getStripeClient();
  const baseUrl = getAppBaseUrl();

  const [currentSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.user_id, user.id))
    .limit(1);

  const existingStatus = currentSubscription?.status as
    | StripeSubscriptionStatus
    | undefined;
  const hasActivePaidSubscription =
    !!currentSubscription?.stripe_subscription_id &&
    normalizePlanKey(currentSubscription?.plan) !== "free" &&
    !!existingStatus &&
    isStripePlanActive(
      existingStatus,
      currentSubscription.current_period_end?.toISOString() ?? null,
    );

  if (hasActivePaidSubscription) {
    return {
      success: false,
      error:
        "You already have an active paid subscription. Use Manage plan to switch it in Stripe portal.",
    };
  }

  let customerId = currentSubscription?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        user_id: user.id,
      },
    });

    customerId = customer.id;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/dashboard/pricing?checkout=success`,
    cancel_url: `${baseUrl}/dashboard/pricing?checkout=cancel`,
    metadata: {
      user_id: user.id,
      plan: input.plan,
      interval: input.interval,
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        plan: input.plan,
      },
    },
  });

  await db
    .insert(subscriptions)
    .values({
      user_id: user.id,
      stripe_customer_id: customerId,
      plan: "free",
      status: "incomplete",
    })
    .onConflictDoUpdate({
      target: subscriptions.user_id,
      set: {
        stripe_customer_id: customerId,
        status: "incomplete",
        updated_at: new Date(),
      },
    });

  if (!checkoutSession.url) {
    return { success: false, error: "Stripe checkout URL is missing" };
  }

  return { success: true, url: checkoutSession.url };
}

export async function createBillingPortalSession() {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const [subscription] = await db
    .select({ stripe_customer_id: subscriptions.stripe_customer_id })
    .from(subscriptions)
    .where(eq(subscriptions.user_id, user.id))
    .limit(1);

  const customerId = subscription?.stripe_customer_id;
  if (!customerId) {
    return { success: false, error: "No Stripe customer found for this user" };
  }

  const stripe = getStripeClient();
  const baseUrl = getAppBaseUrl();

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/dashboard/pricing`,
  });

  return { success: true, url: portal.url };
}

function getInvoiceClientSecret(subscription: Stripe.Subscription) {
  const latestInvoice = subscription.latest_invoice;

  if (!latestInvoice || typeof latestInvoice === "string") {
    return null;
  }

  return latestInvoice.confirmation_secret?.client_secret ?? null;
}

export async function createPaymentElementSession(input: {
  plan: Exclude<PlanKey, "free">;
  interval: BillingInterval;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const priceId = getPriceIdForPlan(input.plan, input.interval);
  if (!priceId) {
    return { success: false, error: "Stripe price is not configured" };
  }

  const stripe = getStripeClient();

  const [currentSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.user_id, user.id))
    .limit(1);

  const existingStatus = currentSubscription?.status as
    | StripeSubscriptionStatus
    | undefined;
  const hasActivePaidSubscription =
    !!currentSubscription?.stripe_subscription_id &&
    normalizePlanKey(currentSubscription?.plan) !== "free" &&
    !!existingStatus &&
    isStripePlanActive(
      existingStatus,
      currentSubscription.current_period_end?.toISOString() ?? null,
    );

  if (hasActivePaidSubscription) {
    return {
      success: false,
      error:
        "You already have an active paid subscription. Use Manage plan to switch it in Stripe portal.",
    };
  }

  let customerId = currentSubscription?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        user_id: user.id,
      },
    });

    customerId = customer.id;
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    metadata: {
      user_id: user.id,
      plan: input.plan,
      interval: input.interval,
    },
    expand: ["latest_invoice.confirmation_secret"],
  });

  const clientSecret = getInvoiceClientSecret(subscription);
  if (!clientSecret) {
    return {
      success: false,
      error: "Unable to initialize payment form. Missing client secret.",
    };
  }

  await db
    .insert(subscriptions)
    .values({
      user_id: user.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      plan: "free",
      status: "incomplete",
      billing_interval: input.interval,
      cancel_at_period_end: false,
    })
    .onConflictDoUpdate({
      target: subscriptions.user_id,
      set: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        status: "incomplete",
        billing_interval: input.interval,
        cancel_at_period_end: false,
        updated_at: new Date(),
      },
    });

  return {
    success: true,
    clientSecret,
    subscriptionId: subscription.id,
  };
}

export async function createTransaction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Неавторизован" };
  }

  // 2. Считываем данные из полей формы
  const description = formData.get("description");
  const amountInput = formData.get("amount");
  const currencyInput = formData.get("currency");
  const amount = typeof amountInput === "string" ? Number(amountInput) : NaN;
  const type = formData.get("type");
  const status = formData.get("status") ?? "completed";

  // В реальном приложении здесь будет ID выбранной категории.
  // Пока передаем null или дефолтную категорию, если таблица пустая.
  const category_id = (formData.get("category_id") as string) || null;

  if (
    typeof description !== "string" ||
    !description.trim() ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    typeof type !== "string" ||
    (type !== "expense" && type !== "income") ||
    typeof status !== "string" ||
    (status !== "completed" && status !== "pending") ||
    typeof currencyInput !== "string" ||
    !isCurrency(currencyInput)
  ) {
    return { success: false, error: "Заполните все обязательные поля" };
  }

  const amountInUsd = amount / RATES[currencyInput];

  if (category_id) {
    const [ownedCategory] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.id, category_id), eq(categories.user_id, user.id)),
      )
      .limit(1);
    if (!ownedCategory) return { success: false, error: "Invalid category" };
  }

  // 3. Вставляем запись в таблицу transactions
  await db.insert(transactions).values({
    user_id: user.id,
    category_id,
    description: description.trim(),
    amount: amountInUsd.toFixed(2),
    type,
    status,
    date: new Date(),
  });

  // 4. Сбрасываем кэш страницы дашборда, чтобы графики и таблицы сразу обновились
  revalidatePath("/dashboard");
  return { success: true };
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });

  // Сбрасываем кэш и перенаправляем на логин
  revalidatePath("/", "layout");
}

// Получить все категории текущего пользователя
export async function getCategories() {
  const user = await getCurrentUser();

  if (!user) return [];

  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.user_id, user.id))
    .orderBy(desc(categories.created_at));
  return rows.map((row) => ({
    ...row,
    type: row.type as "expense" | "income",
  }));
}

// Создать новую кастомную категорию
export async function createCategory(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) return { success: false, error: "Неавторизован" };

  const name = formData.get("name") as string;
  const type = formData.get("type") as "expense" | "income";
  const color = formData.get("color") as string;
  const icon = (formData.get("icon") as string) || "tag";

  if (!name || !color || (type !== "expense" && type !== "income")) {
    return { success: false, error: "Заполните все поля" };
  }

  const plan = await getCurrentPlanForUser(user);
  const categoryLimit = getPlanCategoryLimit(plan);
  if (categoryLimit !== null) {
    const [result] = await db
      .select({ count: count() })
      .from(categories)
      .where(eq(categories.user_id, user.id));
    if (isLimitReached(categoryLimit, result.count)) {
      return { success: false, error: "Plan limit reached for categories" };
    }
  }

  await db.insert(categories).values({
    user_id: user.id,
    name,
    type,
    color,
    icon,
  });

  revalidatePath("/dashboard/categories");
  return { success: true };
}

// Удалить категорию
export async function deleteCategory(id: string) {
  const user = await getCurrentUser();

  if (!user) return { success: false, error: "Неавторизован" };

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.user_id, user.id)));

  revalidatePath("/dashboard/categories");
  return { success: true };
}

// Получение транзакций с учетом поиска и фильтров
export async function getFilteredTransactions(filters: {
  search?: string;
  type?: string;
  categoryId?: string;
}) {
  const user = await getCurrentUser();

  if (!user) return [];
  const plan = await getCurrentPlanForUser(user);
  const historyDays = getPlanHistoryDays(plan);

  // Начинаем строить запрос с JOIN-ом категорий
  const conditions = [eq(transactions.user_id, user.id)];
  if (historyDays !== null) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - historyDays);
    conditions.push(gte(transactions.date, cutoff));
  }

  // Фильтр по поисковому слову (регистронезависимый поиск)
  if (filters.search) {
    conditions.push(ilike(transactions.description, `%${filters.search}%`));
  }

  // Фильтр по типу (expense / income)
  if (filters.type && filters.type !== "all") {
    if (filters.type === "expense" || filters.type === "income")
      conditions.push(eq(transactions.type, filters.type));
  }

  // Фильтр по конкретной категории
  if (filters.categoryId && filters.categoryId !== "all") {
    conditions.push(eq(transactions.category_id, filters.categoryId));
  }

  // Сортируем: сначала самые новые
  const rows = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      status: transactions.status,
      date: transactions.date,
      category_id: transactions.category_id,
      categories: { name: categories.name, color: categories.color },
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.category_id, categories.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date));
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    type: row.type as "expense" | "income",
    status: row.status as "completed" | "pending",
    date: row.date.toISOString(),
    categories: row.categories ? [row.categories] : null,
  }));
}

export async function exportTransactionsWorkbook(filters: {
  search?: string;
  type?: string;
  categoryId?: string;
}) {
  const { user, plan, profileName } = await getExportUserContext();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!canAccessCsvExport(plan)) {
    return { success: false, error: "Plan upgrade required" };
  }

  const conditions = [eq(transactions.user_id, user.id)];

  if (filters.search) {
    conditions.push(ilike(transactions.description, `%${filters.search}%`));
  }

  if (filters.type && filters.type !== "all") {
    if (filters.type === "expense" || filters.type === "income")
      conditions.push(eq(transactions.type, filters.type));
  }

  if (filters.categoryId && filters.categoryId !== "all") {
    conditions.push(eq(transactions.category_id, filters.categoryId));
  }

  const data = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      status: transactions.status,
      date: transactions.date,
      categories: { name: categories.name, color: categories.color },
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.category_id, categories.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  const rows = (data ?? []).map((tx) => {
    const categories = tx.categories as
      | { name?: string }[]
      | { name?: string }
      | null;
    const category = Array.isArray(categories)
      ? categories[0]?.name
      : categories?.name;

    return {
      Date: tx.date.toISOString(),
      Type: tx.type,
      Status: tx.status,
      Description: tx.description,
      Amount: Number(tx.amount),
      Category: category ?? "Uncategorized",
    };
  });

  const workbook = buildWorkbookBase64([{ name: "Transactions", rows }]);
  const filename = `${slugifyFilePart(profileName)}-transactions.xlsx`;

  return { success: true, workbook, filename };
}

export async function exportReportWorkbook(period: string = "30d") {
  const { user, plan, profileName } = await getExportUserContext();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!canAccessAdvancedReports(plan)) {
    return { success: false, error: "Plan upgrade required" };
  }

  const periodStart = getPeriodStartDate(period);
  const conditions = [
    eq(transactions.user_id, user.id),
    eq(transactions.status, "completed"),
  ];

  if (periodStart) {
    conditions.push(gte(transactions.date, periodStart));
  }

  const transactionRowsData = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      status: transactions.status,
      date: transactions.date,
      category_id: transactions.category_id,
      categories: { name: categories.name, color: categories.color },
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.category_id, categories.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals = new Map<string, { income: number; expense: number }>();

  const transactionRows = transactionRowsData.map((tx) => {
    const categories = tx.categories as
      | { name?: string }[]
      | { name?: string }
      | null;
    const category = Array.isArray(categories)
      ? categories[0]?.name
      : categories?.name;
    const categoryName = category ?? "Uncategorized";
    const amount = Number(tx.amount);
    const totals = categoryTotals.get(categoryName) ?? {
      income: 0,
      expense: 0,
    };

    if (tx.type === "income") {
      totalIncome += amount;
      totals.income += amount;
    } else {
      totalExpense += amount;
      totals.expense += amount;
    }

    categoryTotals.set(categoryName, totals);

    return {
      Date: tx.date.toISOString(),
      Type: tx.type,
      Status: tx.status,
      Description: tx.description,
      Category: categoryName,
      Amount: amount,
    };
  });

  const summaryRows = [
    { Metric: "Profile", Value: profileName },
    { Metric: "Period", Value: period },
    { Metric: "Transactions", Value: transactionRowsData.length },
    { Metric: "Total income", Value: totalIncome },
    { Metric: "Total expense", Value: totalExpense },
    { Metric: "Net balance", Value: totalIncome - totalExpense },
    {
      Metric: "Savings rate",
      Value:
        totalIncome > 0
          ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
          : 0,
    },
  ];

  const categoryRows = Array.from(categoryTotals.entries()).map(
    ([name, totals]) => ({
      Category: name,
      Income: totals.income,
      Expense: totals.expense,
      Net: totals.income - totals.expense,
    }),
  );

  const workbook = buildWorkbookBase64([
    { name: "Summary", rows: summaryRows },
    { name: "Transactions", rows: transactionRows },
    { name: "Categories", rows: categoryRows },
  ]);

  const filename = `${slugifyFilePart(profileName)}-${period}-report.xlsx`;

  return { success: true, workbook, filename };
}

// Получение бюджетов с агрегацией текущих расходов за текущий месяц
export async function getBudgetsWithProgress() {
  const user = await getCurrentUser();
  if (!user) return [];

  // 1. Получаем лимиты бюджетов за текущий месяц
  const now = new Date();
  const currentMonthYear = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const budgetsData = await db
    .select({
      id: budgets.id,
      monthly_limit: budgets.monthly_limit,
      category_id: budgets.category_id,
      categories: { name: categories.name, color: categories.color },
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.category_id, categories.id))
    .where(
      and(
        eq(budgets.user_id, user.id),
        eq(budgets.month_year, currentMonthYear),
      ),
    );

  // 2. Получаем расходы за текущий месяц для расчета прогресса
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const spending = await db
    .select({
      amount: transactions.amount,
      category_id: transactions.category_id,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.user_id, user.id),
        eq(transactions.type, "expense"),
        eq(transactions.status, "completed"),
        gte(transactions.date, startOfMonth),
      ),
    );

  // Считаем сумму расходов по каждой категории
  const spentMap: Record<string, number> = {};
  spending.forEach((tx) => {
    if (!tx.category_id) return;
    spentMap[tx.category_id] =
      (spentMap[tx.category_id] || 0) + Number(tx.amount);
  });

  // Объединяем лимиты с реальными расходами
  return budgetsData.map((b) => ({
    ...b,
    current_spent: spentMap[b.category_id] || 0,
    monthly_limit: Number(b.monthly_limit),
  }));
}

// Создание или обновление лимита бюджета (Upsert)
export async function upsertBudget(formData: {
  categoryId: string;
  limitAmount: number;
  currency: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (
    !Number.isFinite(formData.limitAmount) ||
    formData.limitAmount <= 0 ||
    !isCurrency(formData.currency)
  ) {
    throw new Error("Invalid budget amount");
  }
  const limitInUsd = formData.limitAmount / RATES[formData.currency];
  const plan = await getCurrentPlanForUser(user);
  const [ownedCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, formData.categoryId),
        eq(categories.user_id, user.id),
      ),
    )
    .limit(1);
  if (!ownedCategory) throw new Error("Invalid category");

  // month_year хранит первый день текущего месяца
  const now = new Date();
  const monthYear = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const budgetLimit = getPlanBudgetLimit(plan);
  if (budgetLimit !== null) {
    const [existingBudget] = await db
      .select({ id: budgets.id })
      .from(budgets)
      .where(
        and(
          eq(budgets.user_id, user.id),
          eq(budgets.category_id, formData.categoryId),
          eq(budgets.month_year, monthYear),
        ),
      )
      .limit(1);

    if (!existingBudget) {
      const [result] = await db
        .select({ count: count() })
        .from(budgets)
        .where(
          and(eq(budgets.user_id, user.id), eq(budgets.month_year, monthYear)),
        );
      if (isLimitReached(budgetLimit, result.count)) {
        throw new Error("Plan limit reached for budgets");
      }
    }
  }

  await db
    .insert(budgets)
    .values({
      user_id: user.id,
      category_id: formData.categoryId,
      monthly_limit: limitInUsd.toFixed(2),
      month_year: monthYear,
    })
    .onConflictDoUpdate({
      target: [budgets.user_id, budgets.category_id, budgets.month_year],
      set: { monthly_limit: limitInUsd.toFixed(2) },
    });
}

// Получить профиль текущего пользователя
export async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [data] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return {
    id: data?.id ?? user.id,
    name: data?.name ?? user.name ?? "",
    email: data?.email ?? user.email,
    avatar_url: data?.avatar_url ?? null,
    plan: await getCurrentPlanForUser(user),
  };
}

// Загрузить аватар
export async function uploadAvatar(formData: FormData) {
  void formData;
  return { success: false, error: "Avatar storage is not configured" };
}

// Обновить профиль
export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string;
  await db
    .insert(profiles)
    .values({ id: user.id, email: user.email, name, updated_at: new Date() })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { name, updated_at: new Date() },
    });
  revalidatePath("/dashboard/settings");
  return { success: true };
}

// Удалить аккаунт
export async function deleteAccount() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  await auth.api.signOut({ headers: await headers() });
  const { users } = await import("@/db/schema");
  await db.delete(users).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { success: true };
}
export async function getReportData(period: string = "30d") {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getCurrentPlanForUser(user);
  if (!canAccessAdvancedReports(plan)) return null;

  const now = new Date();
  let periodStart: Date | null = null;
  switch (period) {
    case "7d":
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 7);
      break;
    case "30d":
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 30);
      break;
    case "3m":
      periodStart = new Date(now);
      periodStart.setMonth(now.getMonth() - 3);
      break;
    case "1y":
      periodStart = new Date(now);
      periodStart.setFullYear(now.getFullYear() - 1);
      break;
    case "all":
      periodStart = null;
      break;
  }

  const conditions = [
    eq(transactions.user_id, user.id),
    eq(transactions.status, "completed"),
  ];
  if (periodStart) conditions.push(gte(transactions.date, periodStart));
  const reportTransactions = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      type: transactions.type,
      date: transactions.date,
      category_id: transactions.category_id,
      categories: { name: categories.name, color: categories.color },
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.category_id, categories.id))
    .where(and(...conditions))
    .orderBy(transactions.date);

  // Aggregations
  let totalIncome = 0;
  let totalExpense = 0;
  const byMonth: Record<string, { income: number; expense: number }> = {};
  const byCategory: Record<
    string,
    { name: string; color: string; income: number; expense: number }
  > = {};
  const byDay: Record<string, { income: number; expense: number }> = {};

  reportTransactions.forEach((tx) => {
    const amount = Number(tx.amount);
    const date = new Date(tx.date);
    const monthKey = date.toISOString().slice(0, 7);
    const dayKey = date.toISOString().slice(0, 10);
    const cat = tx.categories;
    const catName = cat?.name || "Uncategorized";
    const catColor = cat?.color || "#94a3b8";
    const catKey = tx.category_id || "uncategorized";

    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };
    if (!byDay[dayKey]) byDay[dayKey] = { income: 0, expense: 0 };
    if (!byCategory[catKey])
      byCategory[catKey] = {
        name: catName,
        color: catColor,
        income: 0,
        expense: 0,
      };

    if (tx.type === "income") {
      totalIncome += amount;
      byMonth[monthKey].income += amount;
      byDay[dayKey].income += amount;
      byCategory[catKey].income += amount;
    } else {
      totalExpense += amount;
      byMonth[monthKey].expense += amount;
      byDay[dayKey].expense += amount;
      byCategory[catKey].expense += amount;
    }
  });

  // Top spending categories
  const topExpenseCategories = Object.values(byCategory)
    .filter((c) => c.expense > 0)
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 6);

  // Top income categories
  const topIncomeCategories = Object.values(byCategory)
    .filter((c) => c.income > 0)
    .sort((a, b) => b.income - a.income)
    .slice(0, 6);

  // Monthly trend (sorted)
  const monthlyTrend = Object.entries(byMonth).map(([label, v]) => ({
    label,
    ...v,
  }));

  // Daily trend — only for short periods
  const dailyTrend = Object.entries(byDay).map(([label, v]) => ({
    label,
    ...v,
  }));

  // Largest transactions
  const largest = [...reportTransactions]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((tx) => ({
      id: tx.id,
      description: "Transaction",
      amount: Number(tx.amount),
      type: tx.type as "income" | "expense",
      date: tx.date.toISOString(),
      category: tx.categories?.name || "Uncategorized",
      color: tx.categories?.color || "#94a3b8",
    }));

  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
      : 0;
  const dayInMilliseconds = 24 * 60 * 60 * 1000;
  const periodDays = periodStart
    ? Math.max(
        1,
        Math.ceil((now.getTime() - periodStart.getTime()) / dayInMilliseconds),
      )
    : reportTransactions.length > 0
      ? Math.max(
          1,
          Math.floor(
            (new Date(now.toDateString()).getTime() -
              new Date(reportTransactions[0].date.toDateString()).getTime()) /
              dayInMilliseconds,
          ) + 1,
        )
      : 1;
  const avgDailyExpense = totalExpense / periodDays;

  return {
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    savingsRate,
    avgDailyExpense,
    monthlyTrend,
    dailyTrend,
    topExpenseCategories,
    topIncomeCategories,
    largest,
    txCount: reportTransactions.length,
  };
}
