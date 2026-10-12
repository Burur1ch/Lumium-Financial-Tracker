# Lumium Monetization V1

## Goal

Create a simple pricing structure that matches the current product maturity and can be implemented incrementally without rebuilding the app architecture.

## Pricing model

### Free

- Price: $0
- Target user: solo users testing the app and building a finance habit
- Limits:
- 1 workspace
- 1 member
- 90 days of transaction history
- up to 15 custom categories
- up to 5 monthly budgets
- no exports
- no automation rules
- Included capabilities:
- manual transactions
- basic categories
- basic monthly budgets
- basic dashboard and recent activity
- basic notifications

### Pro

- Price: $7/month or $67/year
- Trial: 7 days
- Target user: active solo user who wants deeper insights and automation
- Limits:
- 1 workspace
- 1 member
- unlimited history
- unlimited categories
- unlimited budgets
- up to 20 exports/month
- up to 25 automation rules
- Included capabilities:
- CSV import
- advanced reports
- forecast and overspending alerts
- recurring transactions
- smart categorization rules
- AI insights and summaries
- priority support

### Family

- Price: $15/month or $144/year
- Trial: 14 days
- Target user: households and small shared-finance groups
- Limits:
- up to 3 workspaces
- up to 5 members
- unlimited history
- unlimited categories
- unlimited budgets
- up to 100 exports/month
- up to 100 automation rules
- Included capabilities:
- everything in Pro
- shared workspaces
- role permissions
- household collaboration
- shared budget alerts

## Product reasoning

- Free is useful enough to onboard and retain, but limited on history, exports, and automation.
- Pro monetizes insight and time-saving features instead of basic bookkeeping.
- Family monetizes collaboration, which is a separate willingness-to-pay layer.

## Recommended paywall boundaries

- Lock exports behind Pro.
- Lock advanced reports beyond the current basic dashboard behind Pro.
- Lock unlimited history behind Pro.
- Lock shared workspaces and permissions behind Family.
- Keep manual transaction creation and simple budgets in Free.

## Suggested implementation order

1. Add plan config and feature flags.
2. Gate advanced reports, exports, and unlimited history.
3. Add a pricing screen and upgrade prompts.
4. Add subscription persistence in the database.
5. Add Family workspace model and permissions.

## Source of truth in code

- utils/monetization/plans.ts
