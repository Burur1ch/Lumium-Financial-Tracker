# Lumium Project Overview

## What this app is

Lumium is a mobile-first personal financial tracker built with Next.js App Router, PostgreSQL, and Better Auth.
It supports authentication, transaction lifecycle management, quick-entry presets, recurring operations, automation rules, category budgets, savings goals, analytics reports, user preferences, and help/support messaging.

## Core stack

- Next.js 16.2.10 (App Router)
- React 19.2.4
- TypeScript (strict)
- Tailwind CSS v4
- PostgreSQL (Railway in production; local PostgreSQL for development)
- Drizzle ORM and migrations
- Better Auth (email/password and sessions)
- Zustand (client preferences and notifications)
- Recharts (data visualizations)
- Resend (support email sending)

## App-level architecture

- Route redirects use Next.js 16 proxy.ts for optimistic guest routing; protected routes and every server action validate the Better Auth session server-side. Auth pages validate sessions in their server layout.
- Database access is server-only through db/index.ts and db/schema.ts; ownership is enforced by session-derived user IDs in each query.
- Auth pages are under app/(auth).
- Main product pages are under app/dashboard.
- Server-side business logic is centralized in app/dashboard/actions.ts.
- Reusable dashboard UI is in components/dashboard.
- Client i18n and formatting are handled via store/translations.ts and hooks/useI18n.ts.

## Main business areas

1. Authentication

- Email/password sign in and sign up.
- Credentials and sessions are stored in the PostgreSQL database using Better Auth.
- Redirect guests to login and redirect authenticated users to dashboard.

2. Transactions

- Create income/expense transactions with an optional note.
- Open a transaction detail sheet to edit, duplicate, delete, split, or change its review status.
- Split a transaction into 2-12 category allocations whose converted total must equal the original amount.
- Save one-tap presets for common transactions and create entries with idempotency protection.
- Filter by text, type, category, and review status.
- View recent transactions in dashboard and full list in transactions page.

3. Categories

- Create and delete custom categories for income/expense.
- Color and icon metadata is supported in UI.

4. Budgets

- Set monthly limits per expense category.
- Configure a 50-100% alert threshold and optional rollover of the previous month's unused limit.
- Show spending progress, three-month average spending, and a current month-end forecast.
- Sidebar notifications use each budget's configured warning threshold.

5. Planning and automation

- Define weekly, monthly, or yearly recurring income/expense templates.
- Materialize recurring entries manually or automatically when the dashboard opens.
- Apply description-matching rules to assign categories and review status to new or existing transactions.
- Track savings goals with targets, progress, optional deadlines, color, and completion state.

6. Reports

- Aggregate totals, net balance, savings rate, trends, and top categories.
- Period filters: 7d, 30d, 3m, 1y, all.

7. Settings and profile

- Edit profile name.
- Theme control (light/dark/auto schedule).
- Local preferences: currency, language, date format, avatar style.
- Sign out and delete account flows.

8. Help and support

- FAQ, quick docs links, and support form.
- Server action sends support messages through Resend.

9. Shared finances placeholder

- The users page previews future budget-by-ID and family-wallet concepts.
- No shared workspace, invitation, membership, or cross-user database access exists yet.
- Knowing a profile ID never bypasses the existing `user_id` ownership checks.

## Data flow conventions

- DB reads/writes generally happen in server actions.
- Client components call actions and refresh or re-fetch data when needed.
- Some UI preferences persist in localStorage via Zustand persist middleware.
- Reports, dashboard widgets, and transaction filters remain URL-driven where applicable.

## Recurring processing model

- `RecurringProcessor` calls `processDueRecurringTransactions` when the authenticated dashboard layout mounts.
- Each occurrence uses a unique key derived from recurring definition ID and scheduled date.
- The database uniqueness constraint makes repeated processing idempotent.
- The current implementation is visit-driven, not a background cron scheduler.

## Main domain tables

- `transactions`: financial entries, notes, review state, and optional recurring source.
- `quick_transaction_presets`: one-tap transaction templates.
- `transaction_splits`: per-category allocations owned by the transaction owner.
- `recurring_transactions`: schedules and automatic-materialization state.
- `transaction_rules`: description matching, target category, and review behavior.
- `budgets`: monthly limits, rollover setting, and alert threshold.
- `savings_goals`: target/current amounts, deadline, color, and completion state.

## Internationalization

- Languages: en, ru, de, fr.
- All translatable UI labels should use translation keys in store/translations.ts.
- Currency/date output should go through useI18n formatters.

## Important caution for AI agents

This repository uses a Next.js version with behavior that may differ from old assumptions.
Before implementing framework-sensitive changes, check the local Next.js docs in node_modules/next/dist/docs.

Do not implement the shared-finance placeholder as cross-user reads without first adding explicit invitations, memberships, roles, and server-side authorization.
