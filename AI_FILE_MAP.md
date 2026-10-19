# Lumium File Map For AI Agents

## Root
- .env.example: documented local environment variables with safe placeholder values.
- compose.yaml: local PostgreSQL 17 service used by the default `DATABASE_URL`.
- proxy.ts: optimistic auth-page/dashboard redirects using Better Auth session cookie.
- db/index.ts: server-only PostgreSQL connection and Drizzle instance.
- db/schema.ts: Better Auth and application PostgreSQL schema, including transactions, presets, splits, recurring schedules, rules, budgets, and savings goals.
- db/migrations/: generated Drizzle migrations shared by local and Railway databases; `0001` adds quick presets/idempotency and `0002` adds planning, splits, review state, goals, and richer budgets.
- utils/auth/server.ts: Better Auth server configuration and cookie plugin.
- utils/auth/client.ts: Better Auth browser client.
- app/api/auth/[...all]/route.ts: Better Auth API route.
- next.config.ts: Next.js config placeholder.
- eslint.config.mjs: lint setup using next core-web-vitals + typescript presets.
- tsconfig.json: strict TypeScript settings with @/* path alias.

## Database and authentication
- db/index.ts: PostgreSQL Pool and Drizzle connection.
- db/schema.ts: shared domain/auth schema.
- utils/auth/server.ts and utils/auth/client.ts: Better Auth setup.

## App routes
- app/layout.tsx: root HTML/body, theme provider, scheduled theme handler.
- app/page.tsx: redirects root to /dashboard.
- app/globals.css: global styles, light/dark overrides, transition effects.

### Auth routes
- app/(auth)/login/page.tsx: Better Auth email/password login.
- app/(auth)/register/page.tsx: Better Auth email/password registration.

### Dashboard shell
- app/dashboard/layout.tsx: sidebar layout, mobile drawer, navigation progress wrapper, and recurring transaction processor.
- app/dashboard/loading.tsx: dashboard skeleton loader.

### Dashboard pages
- app/dashboard/page.tsx: main dashboard metrics, charts, and recent transactions.
- app/dashboard/transactions/page.tsx: filtered transactions page.
- app/dashboard/transactions/loading.tsx: transactions skeleton.
- app/dashboard/categories/page.tsx: category management UI.
- app/dashboard/budget/page.tsx: budget page loader + content wiring.
- app/dashboard/planning/page.tsx: recurring transactions, automation rules, and savings-goal data wiring.
- app/dashboard/reports/page.tsx: reports page data wiring.
- app/dashboard/settings/page.tsx: profile/preferences/theme/danger-zone UI.
- app/dashboard/help/page.tsx: FAQ, docs, support contact UI.
- app/dashboard/help/actions.ts: support email server action.
- app/dashboard/users/page.tsx: non-functional placeholder for future budget-by-ID and family-wallet access.
- app/dashboard/actions.ts: central authenticated domain logic for transactions, presets, splits, review state, planning, budgets, goals, reports, profile, and billing.

## Core reusable components
- components/money.tsx: currency-aware money renderer.
- components/navigation-progress.tsx: top progress bar during route/filter transitions.
- components/scheduled-theme.tsx: auto day/night theme scheduler.
- components/theme-provider.tsx: next-themes wrapper.
- components/theme-toggle.tsx: animated theme switcher.
- components/store-hydration.tsx: hydration placeholder.
- components/user-avatar.tsx: avatar renderer + options.

## Dashboard components
- components/dashboard/sidebar.tsx: primary navigation, notifications popover, sign-out shortcut.
- components/dashboard/mobile-app-chrome.tsx: mobile bottom navigation and overflow menu.
- components/dashboard/dashboard-header.tsx: title/subtitle header.
- components/dashboard/dashboard-page-title.tsx: responsive dashboard title treatment.
- components/dashboard/period-selector.tsx: period state in URL + localStorage.
- components/dashboard/period-loading-wrapper.tsx: period change skeleton behavior.
- components/dashboard/add-transaction-button.tsx: shared trigger for opening transaction creation.
- components/dashboard/add-expense-modal.tsx: create transaction modal with note support and inline category creation.
- components/dashboard/quick-actions.tsx: create, edit, delete, and execute one-tap transaction presets.
- components/dashboard/transactions-filters.tsx: URL-driven search/type/category/review filters.
- components/dashboard/transactions-table.tsx: responsive transaction list/table and detail-sheet trigger.
- components/dashboard/transaction-detail-sheet.tsx: view, edit, duplicate, delete, split, and review a transaction.
- components/dashboard/metric-card.tsx: summary KPI card.
- components/dashboard/expense-chart.tsx: income vs expense chart.
- components/dashboard/category-chart.tsx: expense category donut chart.
- components/dashboard/budget-content.tsx: budget progress, rollover, historical average, and forecast cards.
- components/dashboard/set-budget-modal.tsx: category limit, alert threshold, and rollover controls.
- components/dashboard/planning-content.tsx: recurring transaction, rule, and savings-goal forms/lists.
- components/dashboard/recurring-processor.tsx: visit-driven processing of due automatic recurring transactions.
- components/dashboard/report-content.tsx: report page layout and section rendering.
- components/dashboard/report-charts.tsx: report charts composition.

## Client state and i18n
- store/prefs.ts: persisted preferences, avatar choices, notifications store, exchange rates.
- store/translations.ts: translation dictionary (en/ru/de/fr).
- hooks/useI18n.ts: translation getter + currency/date formatters.

## Implementation note
When adding features, prefer existing patterns:
- Server changes in app/dashboard/actions.ts.
- UI text through translation keys.
- Monetary/date display through useI18n.
- Keep route-level data fetching in route files and UI behavior in components.
- Keep recurring writes idempotent and preserve `user_id` ownership checks on every operation.
- Treat shared finances as a placeholder until invitations, membership roles, and explicit authorization are implemented.
