import Stripe from "stripe";
import type { BillingInterval, PlanKey } from "@/utils/monetization/plans";

interface StripePlanConfig {
  plan: Exclude<PlanKey, "free">;
  interval: BillingInterval;
  priceId: string;
}

const stripePlanConfigs: StripePlanConfig[] = [
  {
    plan: "pro",
    interval: "month",
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  },
  {
    plan: "pro",
    interval: "year",
    priceId: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  },
  {
    plan: "family",
    interval: "month",
    priceId: process.env.STRIPE_PRICE_FAMILY_MONTHLY ?? "",
  },
  {
    plan: "family",
    interval: "year",
    priceId: process.env.STRIPE_PRICE_FAMILY_YEARLY ?? "",
  },
];

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey);
}

export function getAppBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_URL;

  if (explicit) {
    return explicit;
  }

  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

export function getPriceIdForPlan(
  plan: Exclude<PlanKey, "free">,
  interval: BillingInterval,
): string | null {
  const found = stripePlanConfigs.find(
    (item) => item.plan === plan && item.interval === interval,
  );

  if (!found || !found.priceId) {
    return null;
  }

  return found.priceId;
}

export function getPlanFromPriceId(priceId: string): {
  plan: PlanKey;
  interval: BillingInterval | null;
} {
  const found = stripePlanConfigs.find((item) => item.priceId === priceId);

  if (!found) {
    return { plan: "free", interval: null };
  }

  return { plan: found.plan, interval: found.interval };
}
