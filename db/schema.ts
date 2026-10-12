import {
  boolean,
  check,
  date,
  index,
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
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.user_id, table.date),
    index("transactions_user_category_idx").on(table.user_id, table.category_id),
    check("transactions_type_check", sql`${table.type} in ('expense', 'income')`),
    check(
      "transactions_status_check",
      sql`${table.status} in ('completed', 'pending')`,
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
    month_year: date("month_year", { mode: "string" }).notNull(),
  },
  (table) => [
    unique("budgets_user_category_month_unique").on(
      table.user_id,
      table.category_id,
      table.month_year,
    ),
    index("budgets_user_month_idx").on(table.user_id, table.month_year),
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
