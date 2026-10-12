# Lumium File Map For AI Agents

## Root
- proxy.ts: optimistic auth-page/dashboard redirects using Better Auth session cookie.
- db/index.ts: server-only PostgreSQL connection and Drizzle instance.
- db/schema.ts: Better Auth and application PostgreSQL schema.
- db/migrations/: generated Drizzle migrations shared by local and Railway databases.
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
- app/dashboard/layout.tsx: sidebar layout, mobile drawer, navigation progress wrapper.
- app/dashboard/loading.tsx: dashboard skeleton loader.

### Dashboard pages
- app/dashboard/page.tsx: main dashboard metrics, charts, and recent transactions.
- app/dashboard/transactions/page.tsx: filtered transactions page.
- app/dashboard/transactions/loading.tsx: transactions skeleton.
- app/dashboard/categories/page.tsx: category management UI.
- app/dashboard/budget/page.tsx: budget page loader + content wiring.
- app/dashboard/reports/page.tsx: reports page data wiring.
- app/dashboard/settings/page.tsx: profile/preferences/theme/danger-zone UI.
- app/dashboard/help/page.tsx: FAQ, docs, support contact UI.
- app/dashboard/help/actions.ts: support email server action.
- app/dashboard/users/page.tsx: placeholder for future team/family mode.
- app/dashboard/actions.ts: central server actions for domain logic.

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
- components/dashboard/dashboard-header.tsx: title/subtitle header.
- components/dashboard/period-selector.tsx: period state in URL + localStorage.
- components/dashboard/period-loading-wrapper.tsx: period change skeleton behavior.
- components/dashboard/add-expense-modal.tsx: create transaction modal with inline category creation.
- components/dashboard/transactions-filters.tsx: URL-driven search/type/category filters.
- components/dashboard/transactions-table.tsx: responsive transaction list/table.
- components/dashboard/metric-card.tsx: summary KPI card.
- components/dashboard/expense-chart.tsx: income vs expense chart.
- components/dashboard/category-chart.tsx: expense category donut chart.
- components/dashboard/budget-content.tsx: budget summaries and progress cards.
- components/dashboard/set-budget-modal.tsx: set category budget modal.
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
