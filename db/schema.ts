import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Better Auth tables. Keep these names/field names aligned with its Drizzle adapter.
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email").notNull(),
  avatar_url: text("avatar_url"),
  updated_at: updatedAt(),
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: varchar("type", { length: 16 }).notNull(),
    color: varchar("color", { length: 32 }).notNull(),
    icon: varchar("icon", { length: 64 }).notNull().default("tag"),
    created_at: createdAt(),
  },
  (table) => [
    index("categories_user_id_idx").on(table.user_id),
    check("categories_type_check", sql`${table.type} in ('expense', 'income')`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category_id: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    type: varchar("type", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("completed"),
    note: text("note"),
    review_status: varchar("review_status", { length: 16 })
      .notNull()
      .default("reviewed"),
    recurring_transaction_id: uuid("recurring_transaction_id"),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    idempotency_key: varchar("idempotency_key", { length: 64 }),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.user_id, table.date),
    index("transactions_user_category_idx").on(table.user_id, table.category_id),
    unique("transactions_user_idempotency_unique").on(
      table.user_id,
      table.idempotency_key,
    ),
    check("transactions_type_check", sql`${table.type} in ('expense', 'income')`),
    check(
      "transactions_status_check",
      sql`${table.status} in ('completed', 'pending')`,
    ),
    check(
      "transactions_review_status_check",
      sql`${table.review_status} in ('reviewed', 'needs_review')`,
    ),
  ],
);

export const quickTransactionPresets = pgTable(
  "quick_transaction_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category_id: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 80 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    type: varchar("type", { length: 16 }).notNull().default("expense"),
    icon: varchar("icon", { length: 32 }).notNull().default("train"),
    sort_order: integer("sort_order").notNull().default(0),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    index("quick_presets_user_order_idx").on(table.user_id, table.sort_order),
    check(
      "quick_presets_type_check",
      sql`${table.type} in ('expense', 'income')`,
    ),
    check("quick_presets_amount_check", sql`${table.amount} > 0`),
  ],
);

export const recurringTransactions = pgTable(
  "recurring_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category_id: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    type: varchar("type", { length: 16 }).notNull().default("expense"),
    frequency: varchar("frequency", { length: 16 }).notNull(),
    next_date: date("next_date", { mode: "string" }).notNull(),
    auto_create: boolean("auto_create").notNull().default(false),
    active: boolean("active").notNull().default(true),
    last_created_at: timestamp("last_created_at", { withTimezone: true }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    index("recurring_transactions_user_date_idx").on(
      table.user_id,
      table.next_date,
    ),
    check(
      "recurring_transactions_type_check",
      sql`${table.type} in ('expense', 'income')`,
    ),
    check(
      "recurring_transactions_frequency_check",
      sql`${table.frequency} in ('weekly', 'monthly', 'yearly')`,
    ),
    check(
      "recurring_transactions_amount_check",
      sql`${table.amount} > 0`,
    ),
  ],
);

export const transactionRules = pgTable(
  "transaction_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category_id: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 100 }).notNull(),
    match_text: varchar("match_text", { length: 120 }).notNull(),
    type: varchar("type", { length: 16 }),
    mark_reviewed: boolean("mark_reviewed").notNull().default(true),
    active: boolean("active").notNull().default(true),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    index("transaction_rules_user_idx").on(table.user_id, table.created_at),
    check(
      "transaction_rules_type_check",
      sql`${table.type} is null or ${table.type} in ('expense', 'income')`,
    ),
  ],
);

export const transactionSplits = pgTable(
  "transaction_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transaction_id: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category_id: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    note: text("note"),
    created_at: createdAt(),
  },
  (table) => [
    index("transaction_splits_transaction_idx").on(table.transaction_id),
    check("transaction_splits_amount_check", sql`${table.amount} > 0`),
  ],
);

export const savingsGoals = pgTable(
  "savings_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    target_amount: numeric("target_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    current_amount: numeric("current_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    target_date: date("target_date", { mode: "string" }),
    color: varchar("color", { length: 32 }).notNull().default("#ef4444"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    index("savings_goals_user_idx").on(table.user_id, table.created_at),
    check("savings_goals_target_check", sql`${table.target_amount} > 0`),
    check("savings_goals_current_check", sql`${table.current_amount} >= 0`),
    check(
      "savings_goals_status_check",
      sql`${table.status} in ('active', 'completed')`,
    ),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category_id: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    monthly_limit: numeric("monthly_limit", { precision: 14, scale: 2 }).notNull(),
    rollover_enabled: boolean("rollover_enabled").notNull().default(false),
    alert_threshold: integer("alert_threshold").notNull().default(75),
    month_year: date("month_year", { mode: "string" }).notNull(),
  },
  (table) => [
    unique("budgets_user_category_month_unique").on(
      table.user_id,
      table.category_id,
      table.month_year,
    ),
    index("budgets_user_month_idx").on(table.user_id, table.month_year),
    check(
      "budgets_alert_threshold_check",
      sql`${table.alert_threshold} between 50 and 100`,
    ),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    user_id: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: varchar("plan", { length: 16 }).notNull().default("free"),
    status: varchar("status", { length: 32 }).notNull().default("inactive"),
    billing_interval: varchar("billing_interval", { length: 16 }),
    stripe_customer_id: text("stripe_customer_id").unique(),
    stripe_subscription_id: text("stripe_subscription_id").unique(),
    current_period_end: timestamp("current_period_end", { withTimezone: true }),
    cancel_at_period_end: boolean("cancel_at_period_end")
      .notNull()
      .default(false),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    check(
      "subscriptions_plan_check",
      sql`${table.plan} in ('free', 'pro', 'family')`,
    ),
    check(
      "subscriptions_interval_check",
      sql`${table.billing_interval} is null or ${table.billing_interval} in ('month', 'year')`,
    ),
  ],
);
