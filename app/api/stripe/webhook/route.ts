import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import type { BillingInterval, PlanKey } from "@/utils/monetization/plans";
import { getPlanFromPriceId, getStripeClient } from "@/utils/stripe/server";

export const runtime = "nodejs";

type StripeSubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

function getUserIdFromSubscription(subscription: Stripe.Subscription) {
  const metadataUserId = subscription.metadata?.user_id;
  return metadataUserId && metadataUserId.length > 0 ? metadataUserId : null;
}

function toDateOrNull(unixTimestamp: number | null | undefined): Date | null {
  if (!unixTimestamp) return null;
  return new Date(unixTimestamp * 1000);
}

function getBillingIntervalFromSubscription(
  subscription: Stripe.Subscription,
): BillingInterval | null {
  const interval = subscription.items.data[0]?.price.recurring?.interval;
  if (interval === "month") return "month";
  if (interval === "year") return "year";
  return null;
}

function getCurrentPeriodEndFromSubscription(
  subscription: Stripe.Subscription,
) {
  return subscription.items.data[0]?.current_period_end ?? null;
}

function getPlanFromSubscription(subscription: Stripe.Subscription): PlanKey {
  const firstPriceId = subscription.items.data[0]?.price.id;

  if (!firstPriceId) {
    return "free";
  }

  return getPlanFromPriceId(firstPriceId).plan;
}

async function resolveUserIdByCustomerId(
  customerId: string,
): Promise<string | null> {
  const [subscription] = await db.select({ user_id: subscriptions.user_id })
    .from(subscriptions)
    .where(eq(subscriptions.stripe_customer_id, customerId))
    .limit(1);
  return subscription?.user_id ?? null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const userIdFromMetadata = getUserIdFromSubscription(subscription);
  const userId =
    userIdFromMetadata ?? (await resolveUserIdByCustomerId(customerId));

  if (!userId) {
    console.warn("Stripe webhook ignored: user_id not found", {
      subscriptionId: subscription.id,
      customerId,
    });
    return;
  }

  const plan = getPlanFromSubscription(subscription);
  const interval = getBillingIntervalFromSubscription(subscription);
  const status = subscription.status as StripeSubscriptionStatus;

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    console.warn("Stripe webhook ignored: user does not exist", { userId });
    return;
  }

  await db.insert(subscriptions).values({
      user_id: userId,
      plan,
      status,
      billing_interval: interval,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      current_period_end: toDateOrNull(
        getCurrentPeriodEndFromSubscription(subscription),
      ),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }).onConflictDoUpdate({
      target: subscriptions.user_id,
      set: {
        plan,
        status,
        billing_interval: interval,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        current_period_end: toDateOrNull(getCurrentPeriodEndFromSubscription(subscription)),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date(),
      },
    });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 },
    );
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && typeof session.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription,
          );
          await syncSubscription(subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handling failed", error);
    return NextResponse.json(
      { error: "Webhook handling failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
