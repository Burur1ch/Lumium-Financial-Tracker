# Graph Report - Lumium-Financial-Tracker  (2026-10-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 361 nodes · 912 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 47 edges
2. `react` - 37 edges
3. `usePrefs` - 25 edges
4. `createClient()` - 23 edges
5. `next` - 22 edges
6. `lucide-react` - 21 edges
7. `PaywallModal()` - 17 edges
8. `DashboardPage()` - 16 edges
9. `compilerOptions` - 16 edges
10. `SettingsPage()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `PrefsState` --references--> `PlanKey`  [EXTRACTED]
  store/prefs.ts → utils/monetization/plans.ts
- `CategoryChartProps` --references--> `TranslationKey`  [EXTRACTED]
  components/dashboard/category-chart.tsx → store/translations.ts
- `ExpenseChartProps` --references--> `TranslationKey`  [EXTRACTED]
  components/dashboard/expense-chart.tsx → store/translations.ts
- `MetricCardProps` --references--> `TranslationKey`  [EXTRACTED]
  components/dashboard/metric-card.tsx → store/translations.ts
- `deleteAccount()` --calls--> `createClient()`  [EXTRACTED]
  app/dashboard/actions.ts → utils/supabase/server.ts

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (49): deleteAccount(), getProfile(), signOut(), updateProfile(), CURRENCIES, DATE_FORMATS, Field(), LANGUAGES (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (45): buildWorkbookBase64(), createBillingPortalSession(), createCheckoutSession(), createPaymentElementSession(), exportReportWorkbook(), getCurrentPlan(), getCurrentPlanForUser(), getExportUserContext() (+37 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (34): exportTransactionsWorkbook(), upsertBudget(), BudgetContent(), BudgetItem, Category, getCat(), ExportReportButton(), ExportTransactionsButton() (+26 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (29): calcChange(), DashboardPage(), getChangeLabelKey(), getGroupLabel(), getPeriodKey(), getPeriodStart(), getPrevPeriodRange(), Period (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (34): StripePaymentForm(), StripePaymentFormInner(), eslintConfig, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (16): LoginPage(), RegisterPage(), DashboardLayout(), DashboardLoading(), PLANNED_FEATURES, PeriodLoadingWrapper(), NavigationProgress(), StoreHydration() (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (21): createTransaction(), getBudgetsWithProgress(), getCategories(), BudgetPage(), SearchParams, TransactionsPage(), TransactionsPageProps, AddExpenseModal() (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (15): dependencies, lucide-react, next, next-themes, react, react-dom, recharts, resend (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.26
Nodes (12): getBillingIntervalFromSubscription(), getCurrentPeriodEndFromSubscription(), getPlanFromSubscription(), getUserIdFromSubscription(), POST(), resolveUserIdByCustomerId(), runtime, StripeSubscriptionStatus (+4 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (11): resend, sendSupportEmail(), FAQ_DE, FAQ_EN, FAQ_FR, FAQ_MAP, FAQ_RU, FaqItem() (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.30
Nodes (11): createCategory(), deleteCategory(), CategoriesPage(), Category, CategoryGroup(), CategoryIcon(), ICON_KEYS, ICON_MAP (+3 more)

## Knowledge Gaps
- **7 isolated node(s):** `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `@types/node`, `@types/react` (+2 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 134 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **What connects `react-dom`, `tailwindcss`, `@tailwindcss/postcss` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06312098188194039 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 6`, `Community 9`, `Community 11`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Why does `useI18n()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 6`, `Community 10`, `Community 11`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1273532668881506 - nodes in this community are weakly interconnected._