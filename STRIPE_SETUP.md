# Stripe setup for Lumium (Checkout + Embedded Form + Apple Pay)

This project supports two payment modes:

- Hosted Stripe Checkout (default)
- Embedded card form via Stripe Payment Element (optional)

Implemented code:

- Checkout creation: app/dashboard/actions.ts
- Embedded form session creation: app/dashboard/actions.ts
- Billing portal creation: app/dashboard/actions.ts
- Webhook handler: app/api/stripe/webhook/route.ts
- Embedded form UI: components/dashboard/stripe-payment-form.tsx
- Env template: .env.example

## 1. Fill environment variables

Create or update .env.local from .env.example and provide real values:

- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- NEXT_PUBLIC_STRIPE_PAYMENT_MODE
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_PRO_MONTHLY
- STRIPE_PRICE_PRO_YEARLY
- STRIPE_PRICE_FAMILY_MONTHLY
- STRIPE_PRICE_FAMILY_YEARLY
- DATABASE_URL
- BETTER_AUTH_SECRET
- BETTER_AUTH_URL

Important:

- Use test keys first (sk_test...).
- Use matching publishable test key (pk_test...) for client form mode.
- NEXT_PUBLIC_APP_URL must be your real HTTPS domain in production.

Payment mode switch:

- NEXT_PUBLIC_STRIPE_PAYMENT_MODE=checkout
- NEXT_PUBLIC_STRIPE_PAYMENT_MODE=element

If value is omitted, app falls back to checkout mode.

## 2. Create products and prices in Stripe

In Stripe Dashboard:

1. Create product Pro.
2. Add recurring monthly and yearly prices.
3. Create product Family.
4. Add recurring monthly and yearly prices.
5. Copy each price id (price\_...) into .env.local.

## 3. Configure Customer Portal

In Stripe Dashboard:

- Settings -> Billing -> Customer portal
- Enable:
  - subscription cancellation
  - plan switching
  - payment method update

This is required because paid plan management in the app opens Stripe portal.

## 4. Configure webhook endpoint

Endpoint URL:

- https://your-domain.com/api/stripe/webhook

Recommended events:

- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

After creating endpoint, copy webhook signing secret (whsec\_...) to STRIPE_WEBHOOK_SECRET.

## 5. Apply PostgreSQL migrations

Set `DATABASE_URL` to the target database and run the checked-in Drizzle migrations:

- `npm run db:migrate`

This table is required as source of truth for active plan.

## 6. Apple Pay setup (Checkout and Embedded Form)

Apple Pay works in both modes after domain verification.

In Stripe Dashboard:

- Settings -> Payment methods -> Apple Pay
- Register your production domain (for example app.lumium.com)
- Stripe will provide verification flow or file guidance.

Requirements:

- HTTPS domain
- Verified domain in Stripe
- Safari/iOS/macOS for real Apple Pay button visibility

Notes:

- On localhost Apple Pay usually will not appear.
- In test mode use Safari + Apple test wallet conditions.
- In embedded mode, Apple Pay appears inside Payment Element when available.

## 7. Local webhook testing

Use Stripe CLI for local development:

1. stripe login
2. stripe listen --forward-to http://localhost:3000/api/stripe/webhook
3. Copy provided webhook secret to STRIPE_WEBHOOK_SECRET in .env.local

Then run app and test billing flow from pricing page.

## 8. End-to-end validation checklist

1. Set NEXT_PUBLIC_STRIPE_PAYMENT_MODE to checkout or element.
2. Open pricing page and click Pro monthly.
3. Complete payment in selected mode.
4. If mode is element and 3DS is required, Stripe may redirect and return to pricing page.
5. Confirm webhook was received.
6. Check the PostgreSQL `subscriptions` table was updated.
7. Re-open app and ensure paid features unlock.
8. Open Manage Plan and verify Stripe portal opens.
9. Cancel subscription in portal.
10. Confirm webhook updates plan back to free when inactive.
