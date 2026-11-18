# Lumium File Map For AI Agents

## Root
- utils/quick-launch.ts, components/dashboard/quick-launch.tsx and android-shortcuts.tsx: allowlisted Android app shortcuts, single-use launch behavior, account/draft readiness and setup instructions. app/manifest.ts supplies three static public shortcuts; scripts/generate-shortcut-icons.mjs generates their PNG icons.
- db/migrations/0010_card_balance_and_calendar.sql: one shared card checkpoint per user and one-time scheduled payments; existing financial amounts are unchanged.
- components/dashboard/card-balance-content.tsx and card-balance-summary.tsx: current card balance, reconciliation and setup at app/dashboard/card/page.tsx; exact checkpoint reads/writes live in actions.ts.
- utils/planning.ts, components/dashboard/payment-calendar.tsx and scheduled-payment-form.tsx: projected cash flow, URL-driven calendar, one-time/repeating schedules, pause/resume and recording controls.
- db/migrations/0009_product_usability.sql: account preferences, reminder day state, recurring date anchors and transaction creation timestamps.
- utils/preferences.ts and components/dashboard/account-sync.tsx: validated account preferences and field-level synchronization with local pending changes.
- utils/offline-transactions.ts, components/dashboard/offline-transactions.tsx and app/offline/page.tsx: per-account drafts, idempotent sending queue and offline entry shell.
- components/dashboard/reminder-controls.tsx and app/api/reminders/route.ts: authenticated daily completion/snooze controls in the app and notifications.
- utils/currency.ts and utils/currency-server.ts: BYN base currency, display conversions and NBRB snapshots.
- scripts/migrate.mjs and db/migrations/0006_byn_and_push.sql: transactional USD-to-BYN migration with a verified rate and split balancing. Run migrations through npm run db:migrate.
- scripts/start.mjs and app/api/internal/jobs/route.ts: production background scheduler and protected job endpoint.
- utils/recurring.ts and utils/reminders.ts: shared recurring materialization, calendar advancement and local push slots.
- utils/push.ts, public/sw.js and components/dashboard/push-settings.tsx: persistent opt-in Web Push, leases, retries, device settings and notification clicks.
- components/dashboard/account-export.tsx and exportAccountData in actions.ts: full free JSON export, without authentication or push secrets.
- utils/features.ts: explicit server and UI guards for temporarily unavailable billing/email features.
- .env.example: documented local environment variables with safe placeholder values.
- docker-compose.yml: local PostgreSQL 17 service used by the default `DATABASE_URL`.
- proxy.ts: optimistic auth-page/dashboard redirects using Better Auth session cookie.
- db/index.ts: server-only PostgreSQL connection and Drizzle instance.
- db/schema.ts: Better Auth and application PostgreSQL schema, including protected system category keys, transactions, presets, splits, recurring schedules, rules, budgets, and savings goals.
- db/migrations/: generated Drizzle migrations shared by local and Railway databases; `0001` adds quick presets/idempotency, `0002` adds planning, splits, review state, goals, and richer budgets, and `0003` marks protected base categories with stable system keys.
- utils/auth/server.ts: Better Auth server configuration and cookie plugin.
- utils/auth/client.ts: Better Auth browser client.
- utils/gemini-receipt.ts: server-only Gemini receipt extraction, structured response schema, and untrusted model-output validation.
- utils/receipt-image.ts: browser-side receipt resizing, enhancement, binarization, and upload compression.
- utils/receipt-scanner.ts: shared receipt types, local OCR parsing, category inference, QR parsing, and split allocation.
- utils/category-catalog.ts: standard parent/child catalog, localized labels/paths, archive visibility and descendant filter IDs.
- utils/financial-allocations.ts: allocation replacement, exact share balancing, parent rollups and non-overlapping budget scopes.
- db/migrations/0005_category_hierarchy.sql: parent/archive/order fields, sibling name uniqueness, owner/type foreign key and database depth guard; preserves existing IDs.
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
- app/dashboard/categories/page.tsx: authenticated category data loader; management UI lives in components/dashboard/categories-content.tsx.
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
- components/dashboard/categories-content.tsx: expandable category management, rename/create dialogs, archive and optional catalog groups.
- components/dashboard/category-picker.tsx: shared searchable parent/subcategory selector, including archived selections in historical editing.
- components/dashboard/category-breakdown.tsx: expandable report breakdown with separate direct-category amounts.
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
- components/dashboard/mobile-receipt-scanner.tsx: mobile camera/gallery receipt flow using Gemini first and local Tesseract OCR as fallback.
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
