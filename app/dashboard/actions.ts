"use server";

import { and, asc, count, desc, eq, gte, ilike, lt, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  budgets,
  categories,
  profiles,
  quickTransactionPresets,
  recurringTransactions,
  savingsGoals,
  subscriptions,
  transactionRules,
  transactionSplits,
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
import { isCurrency } from "@/utils/currency";
import { getCurrencyRate } from "@/utils/currency-server";
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

const QUICK_PRESET_LIMIT = 8;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const QUICK_PRESET_ICONS = new Set([
  "train",
  "coffee",
  "utensils",
  "shopping",
  "bus",
  "home",
  "other",
]);

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

function revalidateFinancialViews() {
  revalidatePath("/dashboard", "layout");
}

function parseTransactionDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return new Date();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function parseDateOnly(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  const parsed = parseTransactionDate(value);
  return parsed ? value : null;
}

function addRecurringPeriod(
  dateValue: string,
  frequency: "weekly" | "monthly" | "yearly",
) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (frequency === "monthly") {
    const targetMonth = month;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const lastDay = new Date(
      Date.UTC(targetYear, normalizedMonth + 1, 0, 12),
    ).getUTCDate();
    date.setUTCFullYear(targetYear, normalizedMonth, Math.min(day, lastDay));
  }
  if (frequency === "yearly") {
    const lastDay = new Date(Date.UTC(year + 1, month, 0, 12)).getUTCDate();
    date.setUTCFullYear(year + 1, month - 1, Math.min(day, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

async function findMatchingRule(
  userId: string,
  description: string,
  type: "expense" | "income",
) {
  const rules = await db
    .select()
    .from(transactionRules)
    .where(
      and(
        eq(transactionRules.user_id, userId),
        eq(transactionRules.active, true),
      ),
    )
    .orderBy(asc(transactionRules.created_at));

  const normalized = description.toLocaleLowerCase();
  return rules.find(
    (rule) =>
      (!rule.type || rule.type === type) &&
      normalized.includes(rule.match_text.toLocaleLowerCase()),
  );
}

async function categoryBelongsToUser(
  userId: string,
  categoryId: string,
  type?: "expense" | "income",
) {
  if (!UUID_PATTERN.test(categoryId)) return false;
  const [ownedCategory] = await db
    .select({ id: categories.id, type: categories.type })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.user_id, userId)))
    .limit(1);

  return Boolean(ownedCategory && (!type || ownedCategory.type === type));
}

async function parseQuickPresetForm(formData: FormData) {
  const nameInput = formData.get("name");
  const amountInput = formData.get("amount");
  const currencyInput = formData.get("currency");
  const typeInput = formData.get("type");
  const categoryInput = formData.get("category_id");
  const iconInput = formData.get("icon");

  const name = typeof nameInput === "string" ? nameInput.trim() : "";
  const amount = typeof amountInput === "string" ? Number(amountInput) : NaN;
  const type: "expense" | "income" | null =
    typeInput === "expense"
      ? "expense"
      : typeInput === "income"
        ? "income"
        : null;
  const categoryId =
    typeof categoryInput === "string" && categoryInput
      ? categoryInput
      : null;
  const icon =
    typeof iconInput === "string" && QUICK_PRESET_ICONS.has(iconInput)
      ? iconInput
      : "other";

  if (
    !name ||
    name.length > 80 ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    typeof currencyInput !== "string" ||
    !isCurrency(currencyInput) ||
    !type
  ) {
    return null;
  }

  return {
    name,
    amountInUsd: amount / (await getCurrencyRate(currencyInput)),
    type,
    categoryId,
    icon,
  };
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
  const transactionDate = parseTransactionDate(formData.get("date"));

  // В реальном приложении здесь будет ID выбранной категории.
  // Пока передаем null или дефолтную категорию, если таблица пустая.
  let category_id = (formData.get("category_id") as string) || null;
  const noteInput = formData.get("note");
  const note = typeof noteInput === "string" ? noteInput.trim() : "";

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
    !isCurrency(currencyInput) ||
    !transactionDate
  ) {
    return { success: false, error: "Заполните все обязательные поля" };
  }

  const amountInUsd = amount / (await getCurrencyRate(currencyInput));

  const typedType = type as "expense" | "income";
  const matchingRule = await findMatchingRule(
    user.id,
    description.trim(),
    typedType,
  );
  if (!category_id && matchingRule?.category_id) {
    category_id = matchingRule.category_id;
  }

  if (category_id) {
    const ownsCategory = await categoryBelongsToUser(
      user.id,
      category_id,
      typedType,
    );
    if (!ownsCategory) return { success: false, error: "Invalid category" };
  }

  // 3. Вставляем запись в таблицу transactions
  const [created] = await db
    .insert(transactions)
    .values({
      user_id: user.id,
      category_id,
      description: description.trim(),
      amount: amountInUsd.toFixed(2),
      type,
      status,
      note: note || null,
      review_status:
        matchingRule && !matchingRule.mark_reviewed
          ? "needs_review"
          : "reviewed",
      date: transactionDate,
    })
    .returning({ id: transactions.id });

  // 4. Сбрасываем кэш страницы дашборда, чтобы графики и таблицы сразу обновились
  revalidateFinancialViews();
  return { success: true, transactionId: created.id };
}

export async function createQuickPreset(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };

  const input = await parseQuickPresetForm(formData);
  if (!input) return { success: false, error: "INVALID_PRESET" };

  if (
    input.categoryId &&
    !(await categoryBelongsToUser(user.id, input.categoryId, input.type))
  ) {
    return { success: false, error: "INVALID_CATEGORY" };
  }

  const [presetCount] = await db
    .select({ count: count() })
    .from(quickTransactionPresets)
    .where(eq(quickTransactionPresets.user_id, user.id));

  if (presetCount.count >= QUICK_PRESET_LIMIT) {
    return { success: false, error: "QUICK_PRESET_LIMIT" };
  }

  const [created] = await db
    .insert(quickTransactionPresets)
    .values({
      user_id: user.id,
      category_id: input.categoryId,
      name: input.name,
      amount: input.amountInUsd.toFixed(2),
      type: input.type,
      icon: input.icon,
      sort_order: presetCount.count,
    })
    .returning({ id: quickTransactionPresets.id });

  revalidatePath("/dashboard");
  return { success: true, presetId: created.id };
}

export async function updateQuickPreset(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) {
    return { success: false, error: "INVALID_PRESET" };
  }

  const input = await parseQuickPresetForm(formData);
  if (!input) return { success: false, error: "INVALID_PRESET" };

  if (
    input.categoryId &&
    !(await categoryBelongsToUser(user.id, input.categoryId, input.type))
  ) {
    return { success: false, error: "INVALID_CATEGORY" };
  }

  const [updated] = await db
    .update(quickTransactionPresets)
    .set({
      category_id: input.categoryId,
      name: input.name,
      amount: input.amountInUsd.toFixed(2),
      type: input.type,
      icon: input.icon,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(quickTransactionPresets.id, id),
        eq(quickTransactionPresets.user_id, user.id),
      ),
    )
    .returning({ id: quickTransactionPresets.id });

  if (!updated) return { success: false, error: "PRESET_NOT_FOUND" };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteQuickPreset(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) {
    return { success: false, error: "INVALID_PRESET" };
  }

  await db
    .delete(quickTransactionPresets)
    .where(
      and(
        eq(quickTransactionPresets.id, id),
        eq(quickTransactionPresets.user_id, user.id),
      ),
    );

  revalidatePath("/dashboard");
  return { success: true };
}

export async function createTransactionFromPreset(input: {
  presetId: string;
  idempotencyKey: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (
    !UUID_PATTERN.test(input.presetId) ||
    !IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)
  ) {
    return { success: false, error: "INVALID_PRESET" };
  }

  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.user_id, user.id),
        eq(transactions.idempotency_key, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (existing) {
    return { success: true, transactionId: existing.id, duplicate: true };
  }

  const [preset] = await db
    .select({
      name: quickTransactionPresets.name,
      amount: quickTransactionPresets.amount,
      type: quickTransactionPresets.type,
      categoryId: quickTransactionPresets.category_id,
    })
    .from(quickTransactionPresets)
    .where(
      and(
        eq(quickTransactionPresets.id, input.presetId),
        eq(quickTransactionPresets.user_id, user.id),
      ),
    )
    .limit(1);

  if (!preset) return { success: false, error: "PRESET_NOT_FOUND" };

  const [created] = await db
    .insert(transactions)
    .values({
      user_id: user.id,
      category_id: preset.categoryId,
      description: preset.name,
      amount: preset.amount,
      type: preset.type,
      status: "completed",
      date: new Date(),
      idempotency_key: input.idempotencyKey,
    })
    .onConflictDoNothing({
      target: [transactions.user_id, transactions.idempotency_key],
    })
    .returning({ id: transactions.id });

  if (created) {
    revalidateFinancialViews();
    return { success: true, transactionId: created.id, duplicate: false };
  }

  const [deduplicated] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.user_id, user.id),
        eq(transactions.idempotency_key, input.idempotencyKey),
      ),
    )
    .limit(1);

  return deduplicated
    ? { success: true, transactionId: deduplicated.id, duplicate: true }
    : { success: false, error: "CREATE_FAILED" };
}

export async function deleteTransaction(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) {
    return { success: false, error: "INVALID_TRANSACTION" };
  }

  const [deleted] = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.user_id, user.id)))
    .returning({ id: transactions.id });

  if (!deleted) return { success: false, error: "TRANSACTION_NOT_FOUND" };

  revalidateFinancialViews();
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) {
    return { success: false, error: "INVALID_TRANSACTION" };
  }

  const descriptionInput = formData.get("description");
  const amountInput = formData.get("amount");
  const currencyInput = formData.get("currency");
  const typeInput = formData.get("type");
  const categoryInput = formData.get("category_id");
  const noteInput = formData.get("note");
  const transactionDate = parseTransactionDate(formData.get("date"));
  const description =
    typeof descriptionInput === "string" ? descriptionInput.trim() : "";
  const amount = typeof amountInput === "string" ? Number(amountInput) : NaN;
  const type =
    typeInput === "expense" || typeInput === "income" ? typeInput : null;
  const categoryId =
    typeof categoryInput === "string" && categoryInput
      ? categoryInput
      : null;
  const note = typeof noteInput === "string" ? noteInput.trim() : "";

  if (
    !description ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !type ||
    !transactionDate ||
    typeof currencyInput !== "string" ||
    !isCurrency(currencyInput)
  ) {
    return { success: false, error: "INVALID_TRANSACTION" };
  }
  if (
    categoryId &&
    !(await categoryBelongsToUser(user.id, categoryId, type))
  ) {
    return { success: false, error: "INVALID_CATEGORY" };
  }

  const currencyRate = await getCurrencyRate(currencyInput);
  const [updated] = await db
    .update(transactions)
    .set({
      category_id: categoryId,
      description,
      amount: (amount / currencyRate).toFixed(2),
      type,
      note: note || null,
      review_status: "reviewed",
      date: transactionDate,
    })
    .where(and(eq(transactions.id, id), eq(transactions.user_id, user.id)))
    .returning({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      status: transactions.status,
      note: transactions.note,
      reviewStatus: transactions.review_status,
      categoryId: transactions.category_id,
      recurringTransactionId: transactions.recurring_transaction_id,
      date: transactions.date,
    });

  if (!updated) return { success: false, error: "TRANSACTION_NOT_FOUND" };
  revalidateFinancialViews();
  return {
    success: true,
    transaction: {
      id: updated.id,
      description: updated.description,
      amount: Number(updated.amount),
      type: updated.type as "income" | "expense",
      status: updated.status as "completed" | "pending",
      note: updated.note,
      review_status: updated.reviewStatus as "reviewed" | "needs_review",
      category_id: updated.categoryId,
      recurring_transaction_id: updated.recurringTransactionId,
      date: updated.date.toISOString(),
    },
  };
}

export async function duplicateTransaction(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) {
    return { success: false, error: "INVALID_TRANSACTION" };
  }

  const [source] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.user_id, user.id)))
    .limit(1);
  if (!source) return { success: false, error: "TRANSACTION_NOT_FOUND" };

  const [created] = await db
    .insert(transactions)
    .values({
      user_id: user.id,
      category_id: source.category_id,
      description: source.description,
      amount: source.amount,
      type: source.type,
      status: source.status,
      note: source.note,
      review_status: "reviewed",
      date: new Date(),
    })
    .returning({ id: transactions.id });

  const splits = await db
    .select()
    .from(transactionSplits)
    .where(
      and(
        eq(transactionSplits.transaction_id, id),
        eq(transactionSplits.user_id, user.id),
      ),
    );
  if (splits.length > 0) {
    await db.insert(transactionSplits).values(
      splits.map((split) => ({
        transaction_id: created.id,
        user_id: user.id,
        category_id: split.category_id,
        amount: split.amount,
        note: split.note,
      })),
    );
  }

  revalidateFinancialViews();
  return { success: true, transactionId: created.id };
}

export async function saveTransactionSplits(input: {
  transactionId: string;
  currency: string;
  splits: Array<{ categoryId: string | null; amount: number; note?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (
    !UUID_PATTERN.test(input.transactionId) ||
    !isCurrency(input.currency) ||
    input.splits.length < 2 ||
    input.splits.length > 12
  ) {
    return { success: false, error: "INVALID_SPLITS" };
  }

  const [transaction] = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      type: transactions.type,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, input.transactionId),
        eq(transactions.user_id, user.id),
      ),
    )
    .limit(1);
  if (!transaction) return { success: false, error: "TRANSACTION_NOT_FOUND" };
  const currency = input.currency;

  for (const split of input.splits) {
    if (!Number.isFinite(split.amount) || split.amount <= 0) {
      return { success: false, error: "INVALID_SPLITS" };
    }
    if (
      split.categoryId &&
      !(await categoryBelongsToUser(
        user.id,
        split.categoryId,
        transaction.type as "expense" | "income",
      ))
    ) {
      return { success: false, error: "INVALID_CATEGORY" };
    }
  }

  const currencyRate = await getCurrencyRate(currency);
  const normalized = input.splits.map((split) => ({
    ...split,
    amountInUsd: split.amount / currencyRate,
  }));
  const total = normalized.reduce((sum, split) => sum + split.amountInUsd, 0);
  if (Math.abs(total - Number(transaction.amount)) > 0.011) {
    return { success: false, error: "SPLIT_TOTAL_MISMATCH" };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transaction_id, input.transactionId),
          eq(transactionSplits.user_id, user.id),
        ),
      );
    await tx.insert(transactionSplits).values(
      normalized.map((split) => ({
        transaction_id: input.transactionId,
        user_id: user.id,
        category_id: split.categoryId,
        amount: split.amountInUsd.toFixed(2),
        note: split.note?.trim() || null,
      })),
    );
  });

  revalidateFinancialViews();
  return { success: true };
}

export async function setTransactionReviewStatus(
  id: string,
  status: "reviewed" | "needs_review",
) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) {
    return { success: false, error: "INVALID_TRANSACTION" };
  }
  const [updated] = await db
    .update(transactions)
    .set({ review_status: status })
    .where(and(eq(transactions.id, id), eq(transactions.user_id, user.id)))
    .returning({ id: transactions.id });
  if (!updated) return { success: false, error: "TRANSACTION_NOT_FOUND" };
  revalidateFinancialViews();
  return { success: true };
}

export async function getPlanningData() {
  const user = await getCurrentUser();
  if (!user) return { recurring: [], rules: [], goals: [] };

  const [recurring, rules, goals] = await Promise.all([
    db
      .select({
        id: recurringTransactions.id,
        name: recurringTransactions.name,
        amount: recurringTransactions.amount,
        type: recurringTransactions.type,
        frequency: recurringTransactions.frequency,
        nextDate: recurringTransactions.next_date,
        autoCreate: recurringTransactions.auto_create,
        active: recurringTransactions.active,
        categoryId: recurringTransactions.category_id,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(recurringTransactions)
      .leftJoin(
        categories,
        eq(recurringTransactions.category_id, categories.id),
      )
      .where(eq(recurringTransactions.user_id, user.id))
      .orderBy(asc(recurringTransactions.next_date)),
    db
      .select({
        id: transactionRules.id,
        name: transactionRules.name,
        matchText: transactionRules.match_text,
        type: transactionRules.type,
        active: transactionRules.active,
        markReviewed: transactionRules.mark_reviewed,
        categoryId: transactionRules.category_id,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(transactionRules)
      .leftJoin(categories, eq(transactionRules.category_id, categories.id))
      .where(eq(transactionRules.user_id, user.id))
      .orderBy(asc(transactionRules.created_at)),
    db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.user_id, user.id))
      .orderBy(asc(savingsGoals.created_at)),
  ]);

  return {
    recurring: recurring.map((item) => ({
      ...item,
      amount: Number(item.amount),
      type: item.type as "expense" | "income",
      frequency: item.frequency as "weekly" | "monthly" | "yearly",
    })),
    rules: rules.map((item) => ({
      ...item,
      type: item.type as "expense" | "income" | null,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: Number(goal.target_amount),
      currentAmount: Number(goal.current_amount),
      targetDate: goal.target_date,
      color: goal.color,
      status: goal.status as "active" | "completed",
    })),
  };
}

export async function createRecurringTransaction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  const nameInput = formData.get("name");
  const amountInput = formData.get("amount");
  const currencyInput = formData.get("currency");
  const typeInput = formData.get("type");
  const frequencyInput = formData.get("frequency");
  const categoryInput = formData.get("category_id");
  const nextDate = parseDateOnly(formData.get("next_date"));
  const name = typeof nameInput === "string" ? nameInput.trim() : "";
  const amount = typeof amountInput === "string" ? Number(amountInput) : NaN;
  const type =
    typeInput === "expense" || typeInput === "income" ? typeInput : null;
  const frequency =
    frequencyInput === "weekly" ||
    frequencyInput === "monthly" ||
    frequencyInput === "yearly"
      ? frequencyInput
      : null;
  const categoryId =
    typeof categoryInput === "string" && categoryInput
      ? categoryInput
      : null;

  if (
    !name ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !type ||
    !frequency ||
    !nextDate ||
    typeof currencyInput !== "string" ||
    !isCurrency(currencyInput)
  ) {
    return { success: false, error: "INVALID_RECURRING" };
  }
  if (
    categoryId &&
    !(await categoryBelongsToUser(user.id, categoryId, type))
  ) {
    return { success: false, error: "INVALID_CATEGORY" };
  }

  const currencyRate = await getCurrencyRate(currencyInput);
  await db.insert(recurringTransactions).values({
    user_id: user.id,
    category_id: categoryId,
    name,
    amount: (amount / currencyRate).toFixed(2),
    type,
    frequency,
    next_date: nextDate,
    auto_create: formData.get("auto_create") === "on",
  });
  revalidateFinancialViews();
  return { success: true };
}

export async function materializeRecurringTransaction(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) {
    return { success: false, error: "INVALID_RECURRING" };
  }
  const [item] = await db
    .select()
    .from(recurringTransactions)
    .where(
      and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.user_id, user.id),
      ),
    )
    .limit(1);
  if (!item) return { success: false, error: "RECURRING_NOT_FOUND" };

  const idempotencyKey = `recurring-${item.id}-${item.next_date}`;
  const [created] = await db
    .insert(transactions)
    .values({
      user_id: user.id,
      category_id: item.category_id,
      description: item.name,
      amount: item.amount,
      type: item.type,
      status: "completed",
      review_status: "reviewed",
      recurring_transaction_id: item.id,
      idempotency_key: idempotencyKey,
      date: parseTransactionDate(item.next_date) ?? new Date(),
    })
    .onConflictDoNothing({
      target: [transactions.user_id, transactions.idempotency_key],
    })
    .returning({ id: transactions.id });

  await db
    .update(recurringTransactions)
    .set({
      next_date: addRecurringPeriod(
        item.next_date,
        item.frequency as "weekly" | "monthly" | "yearly",
      ),
      last_created_at: new Date(),
      updated_at: new Date(),
    })
    .where(
      and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.user_id, user.id),
      ),
    );

  revalidateFinancialViews();
  return { success: true, transactionId: created?.id ?? null };
}

export async function processDueRecurringTransactions() {
  const user = await getCurrentUser();
  if (!user) return { success: false, createdCount: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const due = await db
    .select()
    .from(recurringTransactions)
    .where(
      and(
        eq(recurringTransactions.user_id, user.id),
        eq(recurringTransactions.active, true),
        eq(recurringTransactions.auto_create, true),
        lte(recurringTransactions.next_date, today),
      ),
    );

  let createdCount = 0;
  for (const item of due) {
    let nextDate = item.next_date;
    let iterations = 0;
    while (nextDate <= today && iterations < 24) {
      const [created] = await db
        .insert(transactions)
        .values({
          user_id: user.id,
          category_id: item.category_id,
          description: item.name,
          amount: item.amount,
          type: item.type,
          status: "completed",
          review_status: "reviewed",
          recurring_transaction_id: item.id,
          idempotency_key: `recurring-${item.id}-${nextDate}`,
          date: parseTransactionDate(nextDate) ?? new Date(),
        })
        .onConflictDoNothing({
          target: [transactions.user_id, transactions.idempotency_key],
        })
        .returning({ id: transactions.id });
      if (created) createdCount += 1;
      nextDate = addRecurringPeriod(
        nextDate,
        item.frequency as "weekly" | "monthly" | "yearly",
      );
      iterations += 1;
    }
    await db
      .update(recurringTransactions)
      .set({
        next_date: nextDate,
        last_created_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(recurringTransactions.id, item.id),
          eq(recurringTransactions.user_id, user.id),
        ),
      );
  }

  if (createdCount > 0) revalidateFinancialViews();
  return { success: true, createdCount };
}

export async function deleteRecurringTransaction(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) {
    return { success: false, error: "INVALID_RECURRING" };
  }
  await db
    .delete(recurringTransactions)
    .where(
      and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.user_id, user.id),
      ),
    );
  revalidateFinancialViews();
  return { success: true };
}

export async function createTransactionRule(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  const nameInput = formData.get("name");
  const matchInput = formData.get("match_text");
  const categoryInput = formData.get("category_id");
  const typeInput = formData.get("type");
  const name = typeof nameInput === "string" ? nameInput.trim() : "";
  const matchText =
    typeof matchInput === "string" ? matchInput.trim().toLocaleLowerCase() : "";
  const categoryId =
    typeof categoryInput === "string" && categoryInput
      ? categoryInput
      : null;
  const type =
    typeInput === "expense" || typeInput === "income" ? typeInput : null;
  if (!name || !matchText || matchText.length < 2 || !type) {
    return { success: false, error: "INVALID_RULE" };
  }
  if (
    categoryId &&
    !(await categoryBelongsToUser(user.id, categoryId, type))
  ) {
    return { success: false, error: "INVALID_CATEGORY" };
  }
  await db.insert(transactionRules).values({
    user_id: user.id,
    category_id: categoryId,
    name,
    match_text: matchText,
    type,
    mark_reviewed: formData.get("mark_reviewed") === "on",
  });
  revalidateFinancialViews();
  return { success: true };
}

export async function applyTransactionRule(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) return { success: false, error: "INVALID_RULE" };
  const [rule] = await db
    .select()
    .from(transactionRules)
    .where(
      and(eq(transactionRules.id, id), eq(transactionRules.user_id, user.id)),
    )
    .limit(1);
  if (!rule) return { success: false, error: "RULE_NOT_FOUND" };
  const conditions = [
    eq(transactions.user_id, user.id),
    ilike(transactions.description, `%${rule.match_text}%`),
  ];
  if (rule.type) conditions.push(eq(transactions.type, rule.type));
  const updated = await db
    .update(transactions)
    .set({
      category_id: rule.category_id,
      review_status: rule.mark_reviewed ? "reviewed" : "needs_review",
    })
    .where(and(...conditions))
    .returning({ id: transactions.id });
  revalidateFinancialViews();
  return { success: true, updatedCount: updated.length };
}

export async function deleteTransactionRule(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) return { success: false, error: "INVALID_RULE" };
  await db
    .delete(transactionRules)
    .where(
      and(eq(transactionRules.id, id), eq(transactionRules.user_id, user.id)),
    );
  revalidateFinancialViews();
  return { success: true };
}

export async function createSavingsGoal(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  const nameInput = formData.get("name");
  const targetInput = formData.get("target_amount");
  const currentInput = formData.get("current_amount");
  const currencyInput = formData.get("currency");
  const targetDate = parseDateOnly(formData.get("target_date"));
  const name = typeof nameInput === "string" ? nameInput.trim() : "";
  const target = typeof targetInput === "string" ? Number(targetInput) : NaN;
  const current =
    typeof currentInput === "string" && currentInput
      ? Number(currentInput)
      : 0;
  const colorInput = formData.get("color");
  const color =
    typeof colorInput === "string" && /^#[0-9a-f]{6}$/i.test(colorInput)
      ? colorInput
      : "#ef4444";
  if (
    !name ||
    !Number.isFinite(target) ||
    target <= 0 ||
    !Number.isFinite(current) ||
    current < 0 ||
    typeof currencyInput !== "string" ||
    !isCurrency(currencyInput)
  ) {
    return { success: false, error: "INVALID_GOAL" };
  }
  const currencyRate = await getCurrencyRate(currencyInput);
  const targetUsd = target / currencyRate;
  const currentUsd = current / currencyRate;
  await db.insert(savingsGoals).values({
    user_id: user.id,
    name,
    target_amount: targetUsd.toFixed(2),
    current_amount: currentUsd.toFixed(2),
    target_date: targetDate,
    color,
    status: currentUsd >= targetUsd ? "completed" : "active",
  });
  revalidateFinancialViews();
  return { success: true };
}

export async function setSavingsGoalProgress(input: {
  id: string;
  amount: number;
  currency: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (
    !UUID_PATTERN.test(input.id) ||
    !Number.isFinite(input.amount) ||
    input.amount < 0 ||
    !isCurrency(input.currency)
  ) {
    return { success: false, error: "INVALID_GOAL" };
  }
  const [goal] = await db
    .select({ target: savingsGoals.target_amount })
    .from(savingsGoals)
    .where(
      and(eq(savingsGoals.id, input.id), eq(savingsGoals.user_id, user.id)),
    )
    .limit(1);
  if (!goal) return { success: false, error: "GOAL_NOT_FOUND" };
  const amountUsd = input.amount / (await getCurrencyRate(input.currency));
  await db
    .update(savingsGoals)
    .set({
      current_amount: amountUsd.toFixed(2),
      status: amountUsd >= Number(goal.target) ? "completed" : "active",
      updated_at: new Date(),
    })
    .where(
      and(eq(savingsGoals.id, input.id), eq(savingsGoals.user_id, user.id)),
    );
  revalidateFinancialViews();
  return { success: true };
}

export async function deleteSavingsGoal(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id)) return { success: false, error: "INVALID_GOAL" };
  await db
    .delete(savingsGoals)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.user_id, user.id)));
  revalidateFinancialViews();
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
  reviewStatus?: string;
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

  if (
    filters.reviewStatus === "reviewed" ||
    filters.reviewStatus === "needs_review"
  ) {
    conditions.push(eq(transactions.review_status, filters.reviewStatus));
  }

  // Сортируем: сначала самые новые
  const rows = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      status: transactions.status,
      note: transactions.note,
      review_status: transactions.review_status,
      recurring_transaction_id: transactions.recurring_transaction_id,
      date: transactions.date,
      category_id: transactions.category_id,
      categories: {
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
      },
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.category_id, categories.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  const splitRows = await db
    .select({
      id: transactionSplits.id,
      transactionId: transactionSplits.transaction_id,
      categoryId: transactionSplits.category_id,
      amount: transactionSplits.amount,
      note: transactionSplits.note,
    })
    .from(transactionSplits)
    .where(eq(transactionSplits.user_id, user.id));
  const splitsByTransaction = new Map<
    string,
    Array<{
      id: string;
      categoryId: string | null;
      amount: number;
      note: string | null;
    }>
  >();
  splitRows.forEach((split) => {
    const current = splitsByTransaction.get(split.transactionId) ?? [];
    current.push({
      id: split.id,
      categoryId: split.categoryId,
      amount: Number(split.amount),
      note: split.note,
    });
    splitsByTransaction.set(split.transactionId, current);
  });

  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    type: row.type as "expense" | "income",
    status: row.status as "completed" | "pending",
    date: row.date.toISOString(),
    review_status: row.review_status as "reviewed" | "needs_review",
    categories: row.categories ? [row.categories] : null,
    splits: splitsByTransaction.get(row.id) ?? [],
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
      categories: {
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
      },
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

// Получение бюджетов с агрегацией расходов за выбранный календарный месяц
export async function getBudgetsWithProgress(month?: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  const now = new Date();
  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month ?? "");
  const selectedYear = monthMatch
    ? Number(monthMatch[1])
    : now.getUTCFullYear();
  const selectedMonthIndex = monthMatch
    ? Number(monthMatch[2]) - 1
    : now.getUTCMonth();
  const startOfMonth = new Date(
    Date.UTC(selectedYear, selectedMonthIndex, 1),
  );
  const startOfNextMonth = new Date(
    Date.UTC(selectedYear, selectedMonthIndex + 1, 1),
  );
  const startOfPreviousMonth = new Date(
    Date.UTC(selectedYear, selectedMonthIndex - 1, 1),
  );
  const startOfThreeMonthsAgo = new Date(
    Date.UTC(selectedYear, selectedMonthIndex - 3, 1),
  );
  const currentMonthYear = startOfMonth.toISOString().slice(0, 10);
  const previousMonthYear = startOfPreviousMonth.toISOString().slice(0, 10);

  // 1. Получаем лимиты бюджетов за выбранный месяц
  const budgetsData = await db
    .select({
      id: budgets.id,
      monthly_limit: budgets.monthly_limit,
      rollover_enabled: budgets.rollover_enabled,
      alert_threshold: budgets.alert_threshold,
      category_id: budgets.category_id,
      categories: {
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
      },
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.category_id, categories.id))
    .where(
      and(
        eq(budgets.user_id, user.id),
        eq(budgets.month_year, currentMonthYear),
      ),
    );

  // 2. Получаем расходы только внутри выбранного месяца
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
        lt(transactions.date, startOfNextMonth),
      ),
    );

  // Считаем сумму расходов по каждой категории
  const spentMap: Record<string, number> = {};
  spending.forEach((tx) => {
    if (!tx.category_id) return;
    spentMap[tx.category_id] =
      (spentMap[tx.category_id] || 0) + Number(tx.amount);
  });

  const [previousBudgets, previousSpending, historicalSpending] =
    await Promise.all([
    db
      .select({
        category_id: budgets.category_id,
        monthly_limit: budgets.monthly_limit,
      })
      .from(budgets)
      .where(
        and(
          eq(budgets.user_id, user.id),
          eq(budgets.month_year, previousMonthYear),
        ),
      ),
    db
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
          gte(transactions.date, startOfPreviousMonth),
          lt(transactions.date, startOfMonth),
        ),
      ),
    db
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
          gte(transactions.date, startOfThreeMonthsAgo),
          lt(transactions.date, startOfMonth),
        ),
      ),
  ]);
  const previousLimitMap = new Map(
    previousBudgets.map((budget) => [
      budget.category_id,
      Number(budget.monthly_limit),
    ]),
  );
  const previousSpentMap = new Map<string, number>();
  previousSpending.forEach((transaction) => {
    if (!transaction.category_id) return;
    previousSpentMap.set(
      transaction.category_id,
      (previousSpentMap.get(transaction.category_id) ?? 0) +
        Number(transaction.amount),
    );
  });
  const historicalSpentMap = new Map<string, number>();
  historicalSpending.forEach((transaction) => {
    if (!transaction.category_id) return;
    historicalSpentMap.set(
      transaction.category_id,
      (historicalSpentMap.get(transaction.category_id) ?? 0) +
        Number(transaction.amount),
    );
  });

  // Объединяем лимиты с реальными расходами
  return budgetsData.map((b) => {
    const baseLimit = Number(b.monthly_limit);
    const rolloverAmount = b.rollover_enabled
      ? Math.max(
          (previousLimitMap.get(b.category_id) ?? 0) -
            (previousSpentMap.get(b.category_id) ?? 0),
          0,
        )
      : 0;
    return {
      ...b,
      current_spent: spentMap[b.category_id] || 0,
      base_limit: baseLimit,
      rollover_amount: rolloverAmount,
      average_monthly_spent:
        (historicalSpentMap.get(b.category_id) ?? 0) / 3,
      monthly_limit: baseLimit + rolloverAmount,
    };
  });
}

// Создание или обновление лимита бюджета (Upsert)
export async function upsertBudget(formData: {
  categoryId: string;
  limitAmount: number;
  currency: string;
  rolloverEnabled?: boolean;
  alertThreshold?: number;
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
  const limitInUsd =
    formData.limitAmount / (await getCurrencyRate(formData.currency));
  const alertThreshold = Math.min(
    100,
    Math.max(50, Math.round(formData.alertThreshold ?? 75)),
  );
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
      rollover_enabled: Boolean(formData.rolloverEnabled),
      alert_threshold: alertThreshold,
      month_year: monthYear,
    })
    .onConflictDoUpdate({
      target: [budgets.user_id, budgets.category_id, budgets.month_year],
      set: {
        monthly_limit: limitInUsd.toFixed(2),
        rollover_enabled: Boolean(formData.rolloverEnabled),
        alert_threshold: alertThreshold,
      },
    });
  revalidatePath("/dashboard/budget");
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
