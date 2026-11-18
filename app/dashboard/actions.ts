"use server";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  sql,
} from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  budgets,
  categories,
  profiles,
  pushSubscriptions,
  quickTransactionPresets,
  recurringTransactions,
  savingsGoals,
  subscriptions,
  transactionRules,
  transactionSplits,
  transactions,
  userPreferences,
  reminderDays,
} from "@/db/schema";
import { auth } from "@/utils/auth/server";
import * as XLSX from "xlsx";
import {
  canAccessAdvancedReports,
  canAccessCsvExport,
  getAccessiblePeriods,
  getPlanBudgetLimit,
  getPlanHistoryDays,
  isLimitReached,
} from "@/utils/monetization/limits";
import type { BillingInterval, PlanKey } from "@/utils/monetization/plans";
import { formatBaseStorageAmount, isCurrency } from "@/utils/currency";
import { getCurrencyRate } from "@/utils/currency-server";
import { extractReceiptWithGemini } from "@/utils/gemini-receipt";
import { revalidatePath } from "next/cache";
import {
  CATEGORY_CATALOG,
  INCOME_CATEGORY_KEYS,
  categoryTranslationKey,
  displayCategory,
  categorySelectionIds,
  categoryHasName,
  isCategoryArchived,
  type CategoryLike,
} from "@/utils/category-catalog";
import {
  allocateTransactions,
  sumCategoryAllocations,
  rebalanceAllocationAmounts,
} from "@/utils/financial-allocations";
import { translations } from "@/store/translations";
import {
  getAppBaseUrl,
  getPriceIdForPlan,
  getStripeClient,
} from "@/utils/stripe/server";
import type Stripe from "stripe";
import { BILLING_ENABLED } from "@/utils/features";
import { materializeRecurring, processRecurring } from "@/utils/recurring";
import { pushConfiguration, sendDevicePush, validPushSubscription, type DevicePush } from "@/utils/push";
import { localDate, validTimezone } from "@/utils/reminders";
import { takeRequestLimit } from "@/utils/request-limits";
import { DEFAULT_PREFERENCES, validPreferencePatch, type AccountPreferences } from "@/utils/preferences";

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
const CATEGORY_NAME_MAX_LENGTH = 60;
const CATEGORY_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const CATEGORY_SPLIT_LIMIT = 100;

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
  if (!BILLING_ENABLED) return "free";
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

async function ensureDefaultCategories(userId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
    );
    const existing = await tx
      .select()
      .from(categories)
      .where(eq(categories.user_id, userId));
    const known = new Map(
      existing.filter((c) => c.system_key).map((c) => [c.system_key!, c]),
    );
    for (const [key, icon, color, archived, children] of CATEGORY_CATALOG) {
      const type = INCOME_CATEGORY_KEYS.has(key) ? "income" : "expense";
      const name = translations.en[categoryTranslationKey(key)];
      let parent = known.get(key);
      if (!parent) {
        const match = existing.find(
          (c) =>
            !c.system_key &&
            !c.parent_id &&
            c.type === type &&
            c.name.trim().toLowerCase() === name.toLowerCase(),
        );
        [parent] = match
          ? await tx
              .update(categories)
              .set({ system_key: key })
              .where(eq(categories.id, match.id))
              .returning()
          : await tx
              .insert(categories)
              .values({
                user_id: userId,
                name,
                type,
                color,
                icon,
                system_key: key,
                is_archived: archived,
                sort_order: CATEGORY_CATALOG.findIndex((c) => c[0] === key),
              })
              .returning();
        known.set(key, parent);
      }
      const missing = children
        .filter((child) => !known.has(`${key}/${child}`))
        .map((child, index) => ({
          user_id: userId,
          name: translations.en[categoryTranslationKey(`${key}/${child}`)],
          type,
          color,
          icon,
          system_key: `${key}/${child}`,
          parent_id: parent.id,
          sort_order: index,
        }));
      if (missing.length)
        await tx.insert(categories).values(missing).onConflictDoNothing();
    }
  });
}

async function userCategoryRows(userId: string) {
  return db.select().from(categories).where(eq(categories.user_id, userId));
}

async function financialAllocations(
  userId: string,
  conditions: ReturnType<typeof eq>[],
) {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.user_id, userId), ...conditions));
  const splits = await db
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
        eq(transactionSplits.user_id, userId),
        eq(transactions.user_id, userId),
        ...conditions,
      ),
    );
  return allocateTransactions(rows, splits);
}

async function categoryFilter(userId: string, categoryId: string) {
  const all = await userCategoryRows(userId);
  if (!all.some((c) => c.id === categoryId)) return sql`false`;
  const ids = sql.join(
    [...categorySelectionIds(categoryId, all)].map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  return sql`((not exists (select 1 from transaction_splits s where s.transaction_id = ${transactions.id} and s.user_id = ${userId}) and ${transactions.category_id} in (${ids})) or exists (select 1 from transaction_splits s where s.transaction_id = ${transactions.id} and s.user_id = ${userId} and s.category_id in (${ids})))`;
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
  allowArchived = false,
) {
  if (!UUID_PATTERN.test(categoryId)) return false;
  const all = await userCategoryRows(userId);
  const ownedCategory = all.find((c) => c.id === categoryId);
  return Boolean(
    ownedCategory &&
      (!type || ownedCategory.type === type) &&
      (allowArchived || !isCategoryArchived(ownedCategory, all)),
  );
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
    typeof categoryInput === "string" && categoryInput ? categoryInput : null;
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
    amountInBase: amount / (await getCurrencyRate(currencyInput)),
    type,
    categoryId,
    icon,
  };
}

function getPeriodStartDate(period: string, now = new Date()): Date | null {
  if (period === "all") return null;
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (period === "3m" || period === "1y") {
    const month = date.getUTCMonth() - (period === "3m" ? 3 : 12);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), month + 1, 0),
    ).getUTCDate();
    date.setUTCFullYear(
      date.getUTCFullYear(),
      month,
      Math.min(date.getUTCDate(), lastDay),
    );
  } else {
    date.setUTCDate(date.getUTCDate() - (period === "7d" ? 6 : 29));
  }
  return date;
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
  if (!BILLING_ENABLED) return { success: false, error: "billingComingSoonTitle" };
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  if (input.plan === "family") {
    return { success: false, error: "familyPlanUnavailable" };
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
  if (!BILLING_ENABLED) return { success: false, error: "billingComingSoonTitle" };
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
  if (!BILLING_ENABLED) return { success: false, error: "billingComingSoonTitle" };
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  if (input.plan === "family") {
    return { success: false, error: "familyPlanUnavailable" };
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
  const expectedUserId = formData.get("expected_user_id");
  if (expectedUserId && expectedUserId !== user?.id) return { success: false, error: "UNAUTHORIZED" };
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
  const idempotencyInput = formData.get("idempotency_key");
  const idempotencyKey = typeof idempotencyInput === "string" ? idempotencyInput : null;
  if (idempotencyKey && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey))
    return { success: false, error: "INVALID_TRANSACTION" };
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

  const amountInBase = amount / (await getCurrencyRate(currencyInput));

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
      amount: formatBaseStorageAmount(amountInBase),
      type,
      status,
      note: note || null,
      review_status:
        matchingRule && !matchingRule.mark_reviewed
          ? "needs_review"
          : "reviewed",
      date: transactionDate,
      idempotency_key: idempotencyKey,
    })
    .onConflictDoNothing({ target: [transactions.user_id, transactions.idempotency_key] })
    .returning({ id: transactions.id });

  const existing = !created && idempotencyKey ? await db.select({ id: transactions.id }).from(transactions)
    .where(and(eq(transactions.user_id, user.id), eq(transactions.idempotency_key, idempotencyKey))).limit(1) : [];

  // 4. Сбрасываем кэш страницы дашборда, чтобы графики и таблицы сразу обновились
  revalidateFinancialViews();
  return { success: true, transactionId: created?.id ?? existing[0]?.id };
}

export async function scanReceiptWithGemini(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "UNAUTHORIZED" };
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return { success: false as const, error: "GEMINI_NOT_CONFIGURED" };
  }

  const image = formData.get("image");
  if (
    !image ||
    typeof image === "string" ||
    !["image/jpeg", "image/png", "image/webp"].includes(image.type) ||
    image.size <= 0 ||
    image.size > 2_800_000
  ) {
    return { success: false as const, error: "INVALID_RECEIPT_IMAGE" };
  }

  try {
    if (!(await takeRequestLimit(db, user.id, "receipt-minute", 5, 60)) ||
      !(await takeRequestLimit(db, user.id, "receipt-day", 100, 86400))) {
      return { success: false as const, error: "RECEIPT_RATE_LIMITED" };
    }
    const result = await extractReceiptWithGemini({
      base64: Buffer.from(await image.arrayBuffer()).toString("base64"),
      mimeType: image.type,
      categories: (await getCategories())
        .filter(
          (c, _, all) => c.type === "expense" && !isCategoryArchived(c, all),
        )
        .map(({ id, name, parent_id }) => ({ id, name, parent_id })),
    });
    return { success: true as const, result };
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "GEMINI_UNKNOWN_ERROR";
    console.error("Gemini receipt recognition failed:", code);
    return { success: false as const, error: "GEMINI_SCAN_FAILED" };
  }
}

export async function createScannedTransaction(input: {
  expectedUserId?: string;
  idempotencyKey?: string;
  description: string;
  amount: number;
  currency: string;
  date?: string | null;
  note?: string;
  categoryId?: string | null;
  splits: Array<{ categoryId: string; amount: number; note?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };

  if (input.idempotencyKey && !IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey))
    return { success: false, error: "INVALID_RECEIPT" };
  if (input.expectedUserId && input.expectedUserId !== user.id)
    return { success: false, error: "UNAUTHORIZED" };

  const description = input.description.trim();
  const transactionDate = parseTransactionDate(input.date ?? null);
  if (
    !description ||
    description.length > 200 ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    !isCurrency(input.currency) ||
    !transactionDate ||
    input.splits.length > CATEGORY_SPLIT_LIMIT
  ) {
    return { success: false, error: "INVALID_RECEIPT" };
  }

  const categoryIds = new Set(
    [input.categoryId, ...input.splits.map((split) => split.categoryId)].filter(
      (value): value is string => Boolean(value),
    ),
  );
  for (const categoryId of categoryIds) {
    if (
      !UUID_PATTERN.test(categoryId) ||
      !(await categoryBelongsToUser(user.id, categoryId, "expense"))
    ) {
      return { success: false, error: "INVALID_CATEGORY" };
    }
  }

  for (const split of input.splits) {
    if (!Number.isFinite(split.amount) || split.amount <= 0) {
      return { success: false, error: "INVALID_SPLITS" };
    }
  }
  const splitTotal = input.splits.reduce((sum, split) => sum + split.amount, 0);
  if (input.splits.length > 0 && Math.abs(splitTotal - input.amount) > 0.011) {
    return { success: false, error: "SPLIT_TOTAL_MISMATCH" };
  }

  const currencyRate = await getCurrencyRate(input.currency);
  const amountInBase = input.amount / currencyRate;
  const normalizedSplits = input.splits.map((split) => ({
    ...split,
    amountInBase: split.amount / currencyRate,
  }));
  const primaryCategoryId =
    input.categoryId ??
    [...normalizedSplits].sort(
      (left, right) => right.amountInBase - left.amountInBase,
    )[0]?.categoryId ??
    null;

  let storedSplitAmounts: string[] = [];
  try {
    if (normalizedSplits.length >= 2)
      storedSplitAmounts = rebalanceAllocationAmounts(
        formatBaseStorageAmount(amountInBase),
        normalizedSplits.map((split) =>
          formatBaseStorageAmount(split.amountInBase),
        ),
      );
  } catch {
    return { success: false, error: "INVALID_SPLITS" };
  }

  const transactionId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(transactions)
      .values({
        user_id: user.id,
        category_id: primaryCategoryId,
        description,
        amount: formatBaseStorageAmount(amountInBase),
        type: "expense",
        status: "completed",
        note: input.note?.trim().slice(0, 1000) || null,
        review_status: "reviewed",
        date: transactionDate,
        idempotency_key: input.idempotencyKey ?? null,
      })
      .onConflictDoNothing({ target: [transactions.user_id, transactions.idempotency_key] })
      .returning({ id: transactions.id });

    if (!created) {
      const [existing] = await tx.select({ id: transactions.id }).from(transactions)
        .where(and(eq(transactions.user_id, user.id), eq(transactions.idempotency_key, input.idempotencyKey!))).limit(1);
      return existing.id;
    }

    if (normalizedSplits.length >= 2) {
      await tx.insert(transactionSplits).values(
        normalizedSplits.map((split, index) => ({
          transaction_id: created.id,
          user_id: user.id,
          category_id: split.categoryId,
          amount: storedSplitAmounts[index],
          note: split.note?.trim().slice(0, 500) || null,
        })),
      );
    }
    return created.id;
  });

  revalidateFinancialViews();
  return { success: true, transactionId };
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
      amount: formatBaseStorageAmount(input.amountInBase),
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
      amount: formData.get("amount_changed") === "false" ? quickTransactionPresets.amount : formatBaseStorageAmount(input.amountInBase),
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
    typeof categoryInput === "string" && categoryInput ? categoryInput : null;
  const note = typeof noteInput === "string" ? noteInput.trim() : "";

  const amountChanged = formData.get("amount_changed") !== "false";
  if (
    !description ||
    !Number.isFinite(amount) ||
    (amountChanged && amount <= 0) ||
    !type ||
    !transactionDate ||
    typeof currencyInput !== "string" ||
    !isCurrency(currencyInput)
  ) {
    return { success: false, error: "INVALID_TRANSACTION" };
  }
  const [original] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.user_id, user.id)))
    .limit(1);
  if (!original) return { success: false, error: "TRANSACTION_NOT_FOUND" };
  if (
    categoryId &&
    !(await categoryBelongsToUser(
      user.id,
      categoryId,
      type,
      original.category_id === categoryId,
    ))
  ) {
    return { success: false, error: "INVALID_CATEGORY" };
  }

  const currencyRate = amountChanged ? await getCurrencyRate(currencyInput) : 1;
  const updated = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.user_id, user.id)))
      .for("update");
    if (!locked) return null;
    const [updated] = await tx
      .update(transactions)
      .set({
        category_id: categoryId,
        description,
        amount: amountChanged ? formatBaseStorageAmount(amount / currencyRate) : locked.amount,
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
    const parts = await tx
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transaction_id, id),
          eq(transactionSplits.user_id, user.id),
        ),
      )
      .orderBy(asc(transactionSplits.id));
    if (
      parts.length &&
      (locked.type !== type || locked.category_id !== categoryId)
    ) {
      await tx
        .delete(transactionSplits)
        .where(
          and(
            eq(transactionSplits.transaction_id, id),
            eq(transactionSplits.user_id, user.id),
          ),
        );
    } else if (parts.length && locked.amount !== updated.amount) {
      const amounts = rebalanceAllocationAmounts(
        updated.amount,
        parts.map((part) => part.amount),
      );
      for (let index = 0; index < parts.length; index++)
        await tx
          .update(transactionSplits)
          .set({ amount: amounts[index] })
          .where(eq(transactionSplits.id, parts[index].id));
    }
    return updated;
  });

  if (!updated) return { success: false, error: "TRANSACTION_NOT_FOUND" };
  const savedSplits = await db
    .select({
      id: transactionSplits.id,
      categoryId: transactionSplits.category_id,
      amount: transactionSplits.amount,
      note: transactionSplits.note,
    })
    .from(transactionSplits)
    .where(
      and(
        eq(transactionSplits.transaction_id, id),
        eq(transactionSplits.user_id, user.id),
      ),
    );
  revalidateFinancialViews();
  return {
    success: true,
    transaction: {
      id: updated.id,
      splits: savedSplits.map((part) => ({
        ...part,
        amount: Number(part.amount),
      })),
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
    input.splits.length > CATEGORY_SPLIT_LIMIT
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
    amountInBase: split.amount / currencyRate,
  }));
  const total = normalized.reduce((sum, split) => sum + split.amountInBase, 0);
  if (Math.abs(total - Number(transaction.amount)) > 0.011) {
    return { success: false, error: "SPLIT_TOTAL_MISMATCH" };
  }

  let storedAmounts: string[];
  try {
    storedAmounts = rebalanceAllocationAmounts(
      transaction.amount,
      normalized.map((split) => formatBaseStorageAmount(split.amountInBase)),
    );
  } catch {
    return { success: false, error: "INVALID_SPLITS" };
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
      normalized.map((split, index) => ({
        transaction_id: input.transactionId,
        user_id: user.id,
        category_id: split.categoryId,
        amount: storedAmounts[index],
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
    typeof categoryInput === "string" && categoryInput ? categoryInput : null;

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
  if (categoryId && !(await categoryBelongsToUser(user.id, categoryId, type))) {
    return { success: false, error: "INVALID_CATEGORY" };
  }

  const currencyRate = await getCurrencyRate(currencyInput);
  await db.insert(recurringTransactions).values({
    user_id: user.id,
    category_id: categoryId,
    name,
    amount: formatBaseStorageAmount(amount / currencyRate),
    type,
    frequency,
    next_date: nextDate,
    anchor_date: nextDate,
    auto_create: formData.get("auto_create") === "on",
  });
  revalidateFinancialViews();
  return { success: true };
}

export async function materializeRecurringTransaction(id: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  if (!UUID_PATTERN.test(id))
    return { success: false, error: "INVALID_RECURRING" };
  const result = await materializeRecurring(id, user.id);
  if (!result.found) return { success: false, error: "RECURRING_NOT_FOUND" };
  revalidateFinancialViews();
  return { success: true, transactionId: result.transactionId };
}

export async function processDueRecurringTransactions() {
  const user = await getCurrentUser();
  if (!user) return { success: false, createdCount: 0 };
  const createdCount = await processRecurring(user.id);
  if (createdCount) revalidateFinancialViews();
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
    typeof categoryInput === "string" && categoryInput ? categoryInput : null;
  const type =
    typeInput === "expense" || typeInput === "income" ? typeInput : null;
  if (!name || !matchText || matchText.length < 2 || !type) {
    return { success: false, error: "INVALID_RULE" };
  }
  if (categoryId && !(await categoryBelongsToUser(user.id, categoryId, type))) {
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
    typeof currentInput === "string" && currentInput ? Number(currentInput) : 0;
  const colorInput = formData.get("color");
  const color =
    typeof colorInput === "string" && /^#[0-9a-f]{6}$/i.test(colorInput)
      ? colorInput
      : "#D92D3A";
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
  const targetBase = target / currencyRate;
  const currentBase = current / currencyRate;
  await db.insert(savingsGoals).values({
    user_id: user.id,
    name,
    target_amount: formatBaseStorageAmount(targetBase),
    current_amount: formatBaseStorageAmount(currentBase),
    target_date: targetDate,
    color,
    status: currentBase >= targetBase ? "completed" : "active",
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
  const amountBase = input.amount / (await getCurrencyRate(input.currency));
  await db
    .update(savingsGoals)
    .set({
      current_amount: formatBaseStorageAmount(amountBase),
      status: amountBase >= Number(goal.target) ? "completed" : "active",
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
  await ensureDefaultCategories(user.id);
  const rows = await userCategoryRows(user.id);
  return rows
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((row) => ({
      ...row,
      ...displayCategory(row, rows),
      type: row.type as "expense" | "income",
    }));
}

export async function createCategory(formData: FormData) {
  return saveCategory(null, formData);
}

export async function updateCategory(id: string, formData: FormData) {
  return saveCategory(id, formData);
}

async function saveCategory(id: string | null, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "UNAUTHORIZED" };
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type"));
  const color = String(formData.get("color") ?? "#24845C");
  const icon = String(formData.get("icon") ?? "tag");
  const parentId = String(formData.get("parent_id") ?? "") || null;
  if (
    !name ||
    name.length > CATEGORY_NAME_MAX_LENGTH ||
    !CATEGORY_COLOR_PATTERN.test(color) ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(icon) ||
    !["income", "expense"].includes(type) ||
    (id && !UUID_PATTERN.test(id))
  )
    return { success: false, error: "INVALID_CATEGORY" };
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${user.id}, 0))`,
    );
    const rows = await tx
      .select()
      .from(categories)
      .where(eq(categories.user_id, user.id));
    const current = rows.find((c) => c.id === id);
    if (id && !current) return { success: false, error: "INVALID_CATEGORY" };
    const parent = rows.find((c) => c.id === parentId);
    if (
      parentId &&
      (!parent ||
        parent.parent_id ||
        parent.type !== type ||
        (parent.is_archived && current?.parent_id !== parentId) ||
        parentId === id)
    )
      return { success: false, error: "INVALID_PARENT" };
    if (
      current &&
      (current.type !== type || (current.parent_id ?? null) !== parentId)
    )
      return { success: false, error: "CATEGORY_IN_USE" };
    if (
      rows.some(
        (c) =>
          c.id !== id &&
          c.type === type &&
          c.parent_id === parentId &&
          categoryHasName(c, name),
      )
    )
      return { success: false, error: "DUPLICATE_CATEGORY" };
    if (current)
      await tx
        .update(categories)
        .set({ name, color, icon, system_key: current.system_key })
        .where(
          and(eq(categories.id, current.id), eq(categories.user_id, user.id)),
        );
    else
      await tx.insert(categories).values({
        user_id: user.id,
        name,
        type,
        color,
        icon,
        parent_id: parentId,
      });
    revalidateFinancialViews();
    return { success: true };
  });
}

export async function setCategoryArchived(id: string, archived: boolean) {
  const user = await getCurrentUser();
  if (!user || !UUID_PATTERN.test(id) || typeof archived !== "boolean")
    return { success: false, error: "INVALID_CATEGORY" };
  const updated = await db
    .update(categories)
    .set({ is_archived: archived })
    .where(and(eq(categories.id, id), eq(categories.user_id, user.id)))
    .returning({ id: categories.id });
  if (!updated.length) return { success: false, error: "INVALID_CATEGORY" };
  revalidateFinancialViews();
  return { success: true };
}

// Keep the old action safe for existing callers: deletion now preserves history.
export async function deleteCategory(id: string) {
  return setCategoryArchived(id, true);
}

// Получение транзакций с учетом поиска и фильтров
export async function getFilteredTransactions(filters: {
  search?: string;
  type?: string;
  categoryId?: string;
  reviewStatus?: string;
  month?: string;
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

  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(filters.month ?? "");
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const monthIndex = Number(monthMatch[2]) - 1;
    conditions.push(
      gte(transactions.date, new Date(Date.UTC(year, monthIndex, 1))),
    );
    conditions.push(
      lt(transactions.date, new Date(Date.UTC(year, monthIndex + 1, 1))),
    );
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
    conditions.push(await categoryFilter(user.id, filters.categoryId));
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

  const allCategories = await userCategoryRows(user.id);
  const selectedIds =
    filters.categoryId && filters.categoryId !== "all"
      ? categorySelectionIds(filters.categoryId, allCategories)
      : null;
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    type: row.type as "expense" | "income",
    status: row.status as "completed" | "pending",
    date: row.date.toISOString(),
    review_status: row.review_status as "reviewed" | "needs_review",
    categories: allCategories
      .filter((c) => c.id === row.category_id)
      .map((c) => displayCategory(c, allCategories)),
    matched_amount: selectedIds
      ? splitsByTransaction.get(row.id)?.length
        ? splitsByTransaction
            .get(row.id)!
            .filter(
              (split) => split.categoryId && selectedIds.has(split.categoryId),
            )
            .reduce((sum, split) => sum + split.amount, 0)
        : Number(row.amount)
      : null,
    splits: splitsByTransaction.get(row.id) ?? [],
  }));
}

export async function exportTransactionsWorkbook(
  filters: {
    search?: string;
    type?: string;
    categoryId?: string;
    month?: string;
  },
  language: string = "en",
) {
  const { user, plan, profileName } = await getExportUserContext();
  if (!user || !canAccessCsvExport(plan))
    return { success: false, error: "Plan upgrade required" };
  const data = await getFilteredTransactions(filters);
  const all = await userCategoryRows(user.id);
  const selected =
    filters.categoryId && filters.categoryId !== "all"
      ? categorySelectionIds(filters.categoryId, all)
      : null;
  const rows = data.flatMap((tx) => {
    const parts = tx.splits.length
      ? tx.splits
      : [{ categoryId: tx.category_id, amount: tx.amount }];
    return parts
      .filter(
        (part) =>
          !selected || (part.categoryId && selected.has(part.categoryId)),
      )
      .map((part) =>
        exportAllocation(
          { ...tx, category_id: part.categoryId, amount: part.amount },
          all,
          language,
        ),
      );
  });
  return {
    success: true,
    workbook: buildWorkbookBase64([{ name: "Transactions", rows }]),
    filename: `${slugifyFilePart(profileName)}-transactions.xlsx`,
  };
}

function exportAllocation(
  tx: {
    id: string;
    description: string;
    date: Date | string;
    type: string;
    amount: number;
    category_id: string | null;
  },
  all: CategoryLike[],
  language: string,
) {
  const locale =
    language === "ru" || language === "de" || language === "fr"
      ? language
      : "en";
  const t = (key: keyof typeof translations.en): string =>
    (translations[locale] as Record<string, string>)[key] ??
    translations.en[key];
  const category = all.find((c) => c.id === tx.category_id);
  const parent = all.find((c) => c.id === category?.parent_id);
  const label = (c: CategoryLike) =>
    c.system_key &&
    c.name === translations.en[categoryTranslationKey(c.system_key)]
      ? t(categoryTranslationKey(c.system_key))
      : c.name;
  return {
    ID: tx.id,
    [t("date")]: new Date(tx.date).toISOString(),
    [t("description")]: tx.description,
    [t("type")]: t(tx.type === "income" ? "income" : "expense"),
    [t("category")]: category
      ? label(parent ?? category)
      : t("uncategorizedOption"),
    [t("subcategory")]: parent && category ? label(category) : "",
    [t("amount")]: tx.amount,
  };
}

export async function exportReportWorkbook(
  period: string = "30d",
  language: string = "en",
) {
  const { user, plan, profileName } = await getExportUserContext();
  if (!user || !canAccessAdvancedReports(plan))
    return { success: false, error: "Plan upgrade required" };
  const report = await getReportData(period);
  if (!report) return { success: false, error: "Unauthorized" };
  const all = await userCategoryRows(user.id);
  const allocations = await financialAllocations(user.id, [
    eq(transactions.status, "completed"),
    gte(transactions.date, new Date(report.rangeStart)),
    lt(transactions.date, new Date(report.rangeEnd)),
  ]);
  const locale =
    language === "ru" || language === "de" || language === "fr"
      ? language
      : "en";
  const t = (key: keyof typeof translations.en): string =>
    (translations[locale] as Record<string, string>)[key] ??
    translations.en[key];
  const rows = allocations.map((tx) => ({
    ...exportAllocation(tx, all, language),
    [t("currency")]: "BYN",
  }));
  const label = (category: CategoryLike) =>
    category.system_key &&
    category.name ===
      translations.en[categoryTranslationKey(category.system_key)]
      ? t(categoryTranslationKey(category.system_key))
      : category.name;
  const summary = [
    {
      [t("reports")]: t("totalIncome"),
      [t("amount")]: report.totalIncome,
      [t("currency")]: "BYN",
    },
    {
      [t("reports")]: t("totalExpenses"),
      [t("amount")]: report.totalExpense,
      [t("currency")]: "BYN",
    },
    {
      [t("reports")]: t("netBalance"),
      [t("amount")]: report.net,
      [t("currency")]: "BYN",
    },
    {
      [t("reports")]: t("savingsRate"),
      [t("amount")]: report.savingsRate,
      [t("currency")]: "%",
    },
  ];
  const categoryRows = report.categoryBreakdown.flatMap((root) =>
    root.children.map((child) => ({
      [t("category")]: label(root),
      [t("subcategory")]: child.isDirect ? t("noSubcategory") : label(child),
      [t("income")]: child.income,
      [t("expenses")]: child.expense,
      [t("currency")]: "BYN",
    })),
  );
  const workbook = buildWorkbookBase64([
    { name: "Summary", rows: summary },
    { name: "Transactions", rows },
    { name: "Categories", rows: categoryRows },
  ]);
  return {
    success: true,
    workbook,
    filename: `${slugifyFilePart(profileName)}-${report.period}-byn-report.xlsx`,
  };
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
  const startOfMonth = new Date(Date.UTC(selectedYear, selectedMonthIndex, 1));
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

  const all = await userCategoryRows(user.id);
  const [current, previous, allocations] = await Promise.all([
    db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.user_id, user.id),
          eq(budgets.month_year, currentMonthYear),
        ),
      ),
    db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.user_id, user.id),
          eq(budgets.month_year, previousMonthYear),
        ),
      ),
    financialAllocations(user.id, [
      eq(transactions.type, "expense"),
      eq(transactions.status, "completed"),
      gte(transactions.date, startOfThreeMonthsAgo),
      lt(transactions.date, startOfNextMonth),
    ]),
  ]);
  const spent = sumCategoryAllocations(
    allocations.filter((a) => a.date >= startOfMonth),
    all,
  );
  const prior = sumCategoryAllocations(
    allocations.filter(
      (a) => a.date >= startOfPreviousMonth && a.date < startOfMonth,
    ),
    all,
  );
  const historical = sumCategoryAllocations(
    allocations.filter((a) => a.date < startOfMonth),
    all,
  );
  return current.map((b) => {
    const category = all.find((c) => c.id === b.category_id);
    const base = Number(b.monthly_limit);
    const previousLimit = Number(
      previous.find((p) => p.category_id === b.category_id)?.monthly_limit ?? 0,
    );
    const rollover = Number(
      (b.rollover_enabled
        ? Math.max(previousLimit - (prior.get(b.category_id) ?? 0), 0)
        : 0
      ).toFixed(8),
    );
    return {
      ...b,
      categories: category ? displayCategory(category, all) : null,
      parent_id: category?.parent_id ?? null,
      current_spent: Number((spent.get(b.category_id) ?? 0).toFixed(8)),
      base_limit: base,
      rollover_amount: rollover,
      average_monthly_spent: (historical.get(b.category_id) ?? 0) / 3,
      monthly_limit: Number((base + rollover).toFixed(8)),
    };
  });
}

// Создание или обновление лимита бюджета (Upsert)
export async function upsertBudget(formData: {
  categoryId: string;
  limitAmount: number;
  amountChanged?: boolean;
  currency: string;
  month?: string;
  rolloverEnabled?: boolean;
  alertThreshold?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "UNAUTHORIZED" };
  const month = formData.month ?? new Date().toISOString().slice(0, 7);
  const alertThreshold = formData.alertThreshold ?? 75;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith("0000"))
    return { success: false as const, error: "INVALID_MONTH" };
  if (
    !UUID_PATTERN.test(formData.categoryId) ||
    !Number.isFinite(formData.limitAmount) ||
    (formData.amountChanged !== false && formData.limitAmount <= 0) ||
    !isCurrency(formData.currency) ||
    !Number.isInteger(alertThreshold) ||
    alertThreshold < 50 ||
    alertThreshold > 100
  )
    return { success: false as const, error: "INVALID_BUDGET" };
  const limitInBase = formData.amountChanged === false ? null :
    formData.limitAmount / (await getCurrencyRate(formData.currency));
  if (
    limitInBase !== null && (!Number.isFinite(limitInBase) ||
    limitInBase < 0.00000001 ||
    limitInBase >= 1e12)
  )
    return { success: false as const, error: "INVALID_BUDGET" };
  const plan = await getCurrentPlanForUser(user);
  const monthYear = month + "-01";
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${user.id}, 1))`,
    );
    const all = await tx
      .select()
      .from(categories)
      .where(eq(categories.user_id, user.id));
    const category = all.find(
      (item) => item.id === formData.categoryId && item.type === "expense",
    );
    const current = await tx
      .select({ id: budgets.id, categoryId: budgets.category_id, amount: budgets.monthly_limit })
      .from(budgets)
      .where(
        and(eq(budgets.user_id, user.id), eq(budgets.month_year, monthYear)),
      );
    const existing = current.find(
      (item) => item.categoryId === formData.categoryId,
    );
    if (!category || (!existing && isCategoryArchived(category, all)))
      return { success: false as const, error: "INVALID_CATEGORY" };
    if (!existing && isLimitReached(getPlanBudgetLimit(plan), current.length))
      return { success: false as const, error: "PLAN_LIMIT" };
    if (!existing && limitInBase === null)
      return { success: false as const, error: "INVALID_BUDGET" };
    const storedAmount = existing && formData.amountChanged === false
      ? existing.amount
      : formatBaseStorageAmount(limitInBase!);
    await tx
      .insert(budgets)
      .values({
        user_id: user.id,
        category_id: category.id,
        monthly_limit: storedAmount,
        rollover_enabled: Boolean(formData.rolloverEnabled),
        alert_threshold: alertThreshold,
        month_year: monthYear,
      })
      .onConflictDoUpdate({
        target: [budgets.user_id, budgets.category_id, budgets.month_year],
        set: {
          monthly_limit: storedAmount,
          rollover_enabled: Boolean(formData.rolloverEnabled),
          alert_threshold: alertThreshold,
        },
      });
    return { success: true as const };
  });
  if (result.success) revalidateFinancialViews();
  return result;
}

// Получить профиль текущего пользователя
export async function getAccountPreferences() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [saved] = await db.select().from(userPreferences).where(eq(userPreferences.user_id, user.id)).limit(1);
  return { userId: user.id, preferences: saved ? { ...DEFAULT_PREFERENCES, ...saved.data } : null };
}

export async function saveAccountPreferences(patch: Partial<AccountPreferences>, initialize = false) {
  const user = await getCurrentUser();
  if (!user || !validPreferencePatch(patch)) return { success: false as const };
  const [saved] = await db.insert(userPreferences).values({
    user_id: user.id,
    data: { ...DEFAULT_PREFERENCES, ...patch },
  }).onConflictDoUpdate({
    target: userPreferences.user_id,
    set: { data: initialize ? userPreferences.data : sql`${userPreferences.data} || ${JSON.stringify(patch)}::jsonb`, updated_at: new Date() },
  }).returning({ data: userPreferences.data });
  return { success: true as const, preferences: saved.data };
}

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
export async function exportAccountData() {
  const user = await getCurrentUser();
  if (!user) return { success: false as const };
  const data = await db.transaction(
    async (tx) => ({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      baseCurrency: "BYN",
      account: { id: user.id, email: user.email, name: user.name },
      profiles: await tx
        .select()
        .from(profiles)
        .where(eq(profiles.id, user.id)),
      transactions: await tx
        .select()
        .from(transactions)
        .where(eq(transactions.user_id, user.id)),
      transactionSplits: await tx
        .select()
        .from(transactionSplits)
        .where(eq(transactionSplits.user_id, user.id)),
      categories: await tx
        .select()
        .from(categories)
        .where(eq(categories.user_id, user.id)),
      budgets: await tx
        .select()
        .from(budgets)
        .where(eq(budgets.user_id, user.id)),
      quickPresets: await tx
        .select()
        .from(quickTransactionPresets)
        .where(eq(quickTransactionPresets.user_id, user.id)),
      recurringTransactions: await tx
        .select()
        .from(recurringTransactions)
        .where(eq(recurringTransactions.user_id, user.id)),
      rules: await tx
        .select()
        .from(transactionRules)
        .where(eq(transactionRules.user_id, user.id)),
      savingsGoals: await tx
        .select()
        .from(savingsGoals)
        .where(eq(savingsGoals.user_id, user.id)),
    }),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  return { success: true as const, data };
}

export async function getReminderDay(timezone: string) {
  const user = await getCurrentUser();
  if (!user || !validTimezone(timezone)) return null;
  const [day] = await db.select().from(reminderDays).where(and(
    eq(reminderDays.user_id, user.id), eq(reminderDays.local_date, localDate(new Date(), timezone)),
  )).limit(1);
  return { completed: day?.completed ?? false, snoozedUntil: day?.snoozed_until?.toISOString() ?? null };
}

export async function updateReminderDay(action: "done" | "snooze", timezone: string) {
  const user = await getCurrentUser();
  if (!user || !validTimezone(timezone) || !["done", "snooze"].includes(action)) return { success: false };
  const now = new Date();
  const values = {
    completed: action === "done",
    snoozed_until: action === "snooze" ? new Date(now.getTime() + 3600000) : null,
    timezone,
  };
  await db.insert(reminderDays).values({ user_id: user.id, local_date: localDate(now, timezone), ...values })
    .onConflictDoUpdate({ target: [reminderDays.user_id, reminderDays.local_date], set: values });
  return { success: true };
}

export async function getPushSettings(endpoint?: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const [device] = endpoint
    ? await db
        .select({
          id: pushSubscriptions.id,
          timezone: pushSubscriptions.timezone,
        })
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.user_id, user.id),
            eq(pushSubscriptions.endpoint, endpoint),
          ),
        )
        .limit(1)
    : [];
  return {
    publicKey: pushConfiguration()?.publicKey ?? null,
    enabled: Boolean(device),
    timezone: device?.timezone ?? null,
  };
}

export async function subscribePush(
  input: DevicePush,
  timezone: string,
  language: string,
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !pushConfiguration() ||
    !validPushSubscription(input) ||
    !validTimezone(timezone) ||
    !["en", "ru", "de", "fr"].includes(language)
  )
    return { success: false };
  const devices = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.user_id, user.id));
  if (devices.length >= 10 && !(await getPushSettings(input.endpoint))?.enabled)
    return { success: false };
  const [saved] = await db
    .insert(pushSubscriptions)
    .values({
      user_id: user.id,
      endpoint: input.endpoint,
      auth: input.keys.auth,
      p256dh: input.keys.p256dh,
      timezone,
      language,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        auth: input.keys.auth,
        p256dh: input.keys.p256dh,
        timezone,
        language,
      },
      setWhere: eq(pushSubscriptions.user_id, user.id),
    })
    .returning({ id: pushSubscriptions.id });
  return { success: Boolean(saved) };
}

export async function unsubscribePush(endpoint: string) {
  const user = await getCurrentUser();
  if (!user || typeof endpoint !== "string") return { success: false };
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.user_id, user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );
  return { success: true };
}

export async function testPush(endpoint: string) {
  const user = await getCurrentUser();
  if (!user || typeof endpoint !== "string") return { success: false };
  const [device] = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.user_id, user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    )
    .limit(1);
  if (!device) return { success: false };
  try {
    // Limit test notifications independently of the scheduled reminder slots.
    const [allowed] = await db
      .update(pushSubscriptions)
      .set({ last_test_at: new Date() })
      .where(
        and(
          eq(pushSubscriptions.id, device.id),
          sql`(${pushSubscriptions.last_test_at} is null or ${pushSubscriptions.last_test_at} < ${new Date(Date.now() - 60000)})`,
        ),
      )
      .returning({ id: pushSubscriptions.id });
    if (!allowed) return { success: false };
    await sendDevicePush(
      {
        endpoint: device.endpoint,
        keys: { auth: device.auth, p256dh: device.p256dh },
      },
      device.language,
      "lumium-test",
      device.timezone,
    );
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function deleteAccount() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  await auth.api.signOut({ headers: await headers() });
  const { users } = await import("@/db/schema");
  await db.delete(users).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { success: true };
}
export async function getReportData(requestedPeriod: string = "30d") {
  const user = await getCurrentUser();
  if (!user) return null;
  const plan = await getCurrentPlanForUser(user);
  const period =
    getAccessiblePeriods(plan).find((value) => value === requestedPeriod) ??
    "30d";
  const now = new Date();
  const periodStart = getPeriodStartDate(period, now);
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

  const conditions = [
    eq(transactions.user_id, user.id),
    eq(transactions.status, "completed"),
    lt(transactions.date, periodEnd),
  ];
  if (periodStart) conditions.push(gte(transactions.date, periodStart));
  const reportTransactions = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.type,
      date: transactions.date,
      category_id: transactions.category_id,
    })
    .from(transactions)
    .where(and(...conditions))
    .orderBy(transactions.date);

  const allCategories = await userCategoryRows(user.id);
  const allocations = await financialAllocations(user.id, conditions);
  type CategoryStat = {
    id: string;
    category_id: string | null;
    name: string;
    system_key: string | null;
    color: string;
    icon: string | null;
    income: number;
    expense: number;
    isDirect?: boolean;
  };
  const breakdown = new Map<
    string,
    CategoryStat & { children: CategoryStat[] }
  >();
  for (const allocation of allocations) {
    const category = allCategories.find((c) => c.id === allocation.category_id);
    const parent = allCategories.find((c) => c.id === category?.parent_id);
    const root = parent ?? category;
    const rootId = root?.id ?? `uncategorized/${allocation.type}`;
    const group = breakdown.get(rootId) ?? {
      id: rootId,
      category_id: root?.id ?? null,
      name: root?.name ?? "",
      system_key: root?.system_key ?? null,
      color: root?.color ?? "#94a3b8",
      icon: root?.icon ?? null,
      income: 0,
      expense: 0,
      children: [],
    };
    const field = allocation.type === "income" ? "income" : "expense";
    group[field] += allocation.amount;
    const childId = parent ? category!.id : rootId + "/direct";
    let child = group.children.find((c) => c.id === childId);
    if (!child) {
      child = {
        id: childId,
        category_id: category?.id ?? null,
        name: category?.name ?? "",
        system_key: category?.system_key ?? null,
        color: category?.color ?? "#94a3b8",
        icon: category?.icon ?? null,
        income: 0,
        expense: 0,
        isDirect: !parent,
      };
      group.children.push(child);
    }
    child[field] += allocation.amount;
    breakdown.set(rootId, group);
  }
  // Aggregations
  let totalIncome = 0;
  let totalExpense = 0;
  const byMonth: Record<string, { income: number; expense: number }> = {};
  const byDay: Record<string, { income: number; expense: number }> = {};

  reportTransactions.forEach((tx) => {
    const amount = Number(tx.amount);
    const date = new Date(tx.date);
    const monthKey = date.toISOString().slice(0, 7);
    const dayKey = date.toISOString().slice(0, 10);
    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };
    if (!byDay[dayKey]) byDay[dayKey] = { income: 0, expense: 0 };
    if (tx.type === "income") {
      totalIncome += amount;
      byMonth[monthKey].income += amount;
      byDay[dayKey].income += amount;
    } else {
      totalExpense += amount;
      byMonth[monthKey].expense += amount;
      byDay[dayKey].expense += amount;
    }
  });

  const roundAmount = (value: number) => Number(formatBaseStorageAmount(value));
  for (const group of breakdown.values()) {
    group.income = roundAmount(group.income);
    group.expense = roundAmount(group.expense);
    for (const child of group.children) {
      child.income = roundAmount(child.income);
      child.expense = roundAmount(child.expense);
    }
  }
  totalIncome = roundAmount(totalIncome);
  totalExpense = roundAmount(totalExpense);
  const firstDay = new Date(periodStart ?? reportTransactions[0]?.date ?? now);
  firstDay.setUTCHours(0, 0, 0, 0);
  if (period === "7d" || period === "30d") {
    for (
      const date = new Date(firstDay);
      date < periodEnd;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      byDay[date.toISOString().slice(0, 10)] ??= { income: 0, expense: 0 };
    }
  }
  const firstMonth = new Date(
    Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), 1),
  );
  for (
    const date = firstMonth;
    date < periodEnd;
    date.setUTCMonth(date.getUTCMonth() + 1)
  ) {
    byMonth[date.toISOString().slice(0, 7)] ??= { income: 0, expense: 0 };
  }

  // Top spending categories
  const topExpenseCategories = [...breakdown.values()]
    .filter((c) => c.expense > 0)
    .sort((a, b) => b.expense - a.expense);

  // Top income categories
  const topIncomeCategories = [...breakdown.values()]
    .filter((c) => c.income > 0)
    .sort((a, b) => b.income - a.income);

  // Monthly trend (sorted)
  const monthlyTrend = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      income: roundAmount(v.income),
      expense: roundAmount(v.expense),
    }));

  // Daily trend is only useful for short periods.
  const dailyTrend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      income: roundAmount(v.income),
      expense: roundAmount(v.expense),
    }));

  // Largest transactions
  const largest = [...reportTransactions]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((tx) => {
      const category = allCategories.find((item) => item.id === tx.category_id);
      return {
        id: tx.id,
        description: tx.description,
        amount: Number(tx.amount),
        type: tx.type as "income" | "expense",
        date: tx.date.toISOString(),
        categories: category ? displayCategory(category, allCategories) : null,
        isSplit: allocations.filter((item) => item.id === tx.id).length > 1,
      };
    });

  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
      : 0;
  const dayInMilliseconds = 24 * 60 * 60 * 1000;
  const periodDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - firstDay.getTime()) / dayInMilliseconds),
  );
  const avgDailyExpense = totalExpense / periodDays;

  return {
    plan,
    period,
    rangeStart: firstDay.toISOString(),
    rangeEnd: periodEnd.toISOString(),
    totalIncome,
    totalExpense,
    net: roundAmount(totalIncome - totalExpense),
    savingsRate,
    avgDailyExpense,
    monthlyTrend,
    dailyTrend,
    categoryBreakdown: [...breakdown.values()].sort(
      (a, b) => b.expense - a.expense || b.income - a.income,
    ),
    topExpenseCategories,
    topIncomeCategories,
    largest,
    txCount: reportTransactions.length,
  };
}
