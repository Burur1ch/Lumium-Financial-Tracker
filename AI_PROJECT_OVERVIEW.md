# Lumium Project Overview

## What this app is

Lumium is a personal financial tracker built with Next.js App Router, PostgreSQL, and Better Auth.
It supports authentication, transaction tracking, category management, monthly budgets, analytics reports, user preferences, and help/support messaging.

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

- Create income/expense transactions.
- Filter by text, type, and category.
- View recent transactions in dashboard and full list in transactions page.

3. Categories

- Create and delete custom categories for income/expense.
- Color and icon metadata is supported in UI.

4. Budgets

- Set monthly limits per expense category.
- Show spending progress and status (on track/warning/over limit).

5. Reports

- Aggregate totals, net balance, savings rate, trends, and top categories.
- Period filters: 7d, 30d, 3m, 1y, all.

6. Settings and profile

- Edit profile name.
- Theme control (light/dark/auto schedule).
- Local preferences: currency, language, date format, avatar style.
- Sign out and delete account flows.

7. Help and support

- FAQ, quick docs links, and support form.
- Server action sends support messages through Resend.

## Data flow conventions

- DB reads/writes generally happen in server actions.
- Client components call actions and refresh or re-fetch data when needed.
- Some UI preferences persist in localStorage via Zustand persist middleware.

## Internationalization

- Languages: en, ru, de, fr.
- All translatable UI labels should use translation keys in store/translations.ts.
- Currency/date output should go through useI18n formatters.

## Important caution for AI agents

This repository uses a Next.js version with behavior that may differ from old assumptions.
Before implementing framework-sensitive changes, check the local Next.js docs in node_modules/next/dist/docs.
