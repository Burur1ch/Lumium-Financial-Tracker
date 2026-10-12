"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  CreditCard,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import {
  createBillingPortalSession,
  createCheckoutSession,
  createPaymentElementSession,
  getCurrentPlan,
} from "@/app/dashboard/actions";
import { StripePaymentForm } from "@/components/dashboard/stripe-payment-form";
import {
  BillingInterval,
  MONETIZATION_PLANS,
  PlanKey,
  getPlanPriceLabel,
} from "@/utils/monetization/plans";

const PLAN_ORDER: PlanKey[] = ["free", "pro", "family"];

type PaidPlanKey = Exclude<PlanKey, "free">;

const FEATURE_ROWS = [
  { labelKey: "fullHistory", value: "transactionHistoryDays" },
  { labelKey: "csvImport", value: "csvImport" },
  { labelKey: "aiInsights", value: "aiInsights" },
  { labelKey: "sharedWorkspace", value: "sharedWorkspace" },
  { labelKey: "rolePermissions", value: "rolePermissions" },
] as const;

function getPlanHighlights(plan: PlanKey, t: (key: never) => string) {
  switch (plan) {
    case "free":
      return [
        "30 days history",
        `10 ${t("categoriesCount" as never)}`,
        `5 ${t("budgetsCount" as never)}`,
      ];
    case "pro":
      return [
        t("fullHistory" as never),
        t("csvImport" as never),
        t("aiInsights" as never),
      ];
    case "family":
      return [
        t("sharedWorkspace" as never),
        t("rolePermissions" as never),
        `5 ${t("membersCount" as never)}`,
      ];
  }
}

function getPlanIcon(plan: PlanKey) {
  switch (plan) {
    case "free":
      return CreditCard;
    case "pro":
      return Sparkles;
    case "family":
      return Users;
  }
}

function renderFeatureValue(
  plan: (typeof MONETIZATION_PLANS)[PlanKey],
  key: string,
) {
  switch (key) {
    case "transactionHistoryDays":
      return plan.limits.transactionHistoryDays === null
        ? "Unlimited"
        : `${plan.limits.transactionHistoryDays} days`;
    case "csvImport":
      return plan.features.csvImport;
    case "aiInsights":
      return plan.features.aiInsights;
    case "sharedWorkspace":
      return plan.features.sharedWorkspace;
    case "rolePermissions":
      return plan.features.rolePermissions;
    default:
      return false;
  }
}

function ValueMark({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return (
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {value}
      </span>
    );
  }

  return value ? (
    <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500">
      <Check className="w-3.5 h-3.5" />
    </span>
  ) : (
    <span className="text-xs font-semibold text-slate-300 dark:text-slate-600">
      -
    </span>
  );
}

export default function PricingPage() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { plan: currentPlan, setPlan } = usePrefs();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [actionError, setActionError] = useState<string | null>(null);
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<{
    plan: PaidPlanKey;
    interval: BillingInterval;
    clientSecret: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const checkoutState = searchParams.get("checkout");
  const isElementMode =
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_MODE === "element";

  const queryNotice =
    checkoutState === "success"
      ? t("checkoutSuccessMessage")
      : checkoutState === "cancel"
        ? t("checkoutCanceledMessage")
        : null;

  const flowNotice = manualNotice ?? queryNotice;

  const visibleActionError = checkoutState ? null : actionError;

  useEffect(() => {
    startTransition(async () => {
      const plan = await getCurrentPlan();
      setPlan(plan);
    });
  }, [setPlan]);

  useEffect(() => {
    if (checkoutState === "success") {
      startTransition(async () => {
        const plan = await getCurrentPlan();
        setPlan(plan);
      });
    }
  }, [checkoutState, setPlan]);

  const openBillingPortal = () => {
    setActionError(null);
    setManualNotice(null);
    setPaymentForm(null);
    startTransition(async () => {
      const result = await createBillingPortalSession();
      if (!result.success || !result.url) {
        setActionError(result.error ?? "Billing portal is unavailable");
        return;
      }

      window.location.href = result.url;
    });
  };

  const handlePlanSelect = (nextPlan: PlanKey) => {
    setActionError(null);
    setManualNotice(null);

    if (nextPlan === "free") {
      if (currentPlan !== "free") {
        openBillingPortal();
      }
      setPaymentForm(null);
      return;
    }

    if (currentPlan !== "free" && currentPlan !== nextPlan) {
      openBillingPortal();
      return;
    }

    if (currentPlan === nextPlan) {
      openBillingPortal();
      return;
    }

    if (isElementMode) {
      startTransition(async () => {
        const result = await createPaymentElementSession({
          plan: nextPlan,
          interval,
        });

        if (!result.success || !result.clientSecret) {
          setActionError(result.error ?? "Payment form is unavailable");
          return;
        }

        setPaymentForm({
          plan: nextPlan,
          interval,
          clientSecret: result.clientSecret,
        });
      });
      return;
    }

    startTransition(async () => {
      const result = await createCheckoutSession({
        plan: nextPlan,
        interval,
      });

      if (!result.success || !result.url) {
        setActionError(result.error ?? "Checkout is unavailable");
        return;
      }

      window.location.href = result.url;
    });
  };

  const handleEmbeddedSuccess = () => {
    setPaymentForm(null);
    setActionError(null);
    setManualNotice(t("checkoutSuccessMessage"));

    startTransition(async () => {
      const plan = await getCurrentPlan();
      setPlan(plan);
    });
  };

  const getPlanButtonLabel = (plan: PlanKey, isCurrent: boolean) => {
    if (plan === "free") {
      return isCurrent ? t("currentPlan") : t("managePlan");
    }

    if (isCurrent) {
      return t("managePlan");
    }

    const selectedPlan = MONETIZATION_PLANS[plan];
    return selectedPlan.trialDays > 0
      ? `${t("startTrial")} · ${selectedPlan.trialDays}d`
      : t("choosePlan");
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-7xl mx-auto space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800 bg-linear-to-br from-white via-orange-50/70 to-red-50 dark:from-slate-900 dark:via-orange-950/10 dark:to-red-950/10 p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-60 pointer-events-none">
          <div className="absolute right-[-10%] top-[-10%] h-56 w-56 rounded-full bg-red-200/30 blur-3xl dark:bg-red-700/10" />
          <div className="absolute right-[10%] bottom-[-20%] h-64 w-64 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-700/10" />
        </div>

        <div className="relative grid gap-6 xl:grid-cols-[1.35fr_0.9fr] xl:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 dark:border-red-900/40 bg-white/85 dark:bg-slate-900/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-500">
              <Zap className="w-3.5 h-3.5" />
              {t("pricing")}
            </div>
            <h1 className="mt-4 max-w-2xl text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Pick a plan that grows from simple tracking to shared financial
              control.
            </h1>
            <p className="mt-3 max-w-2xl text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("pricingSubtitle")}
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/70 dark:border-slate-800 bg-white/75 dark:bg-slate-900/75 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-red-500">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Insight
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  From basic budgets to forecast-driven decisions.
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 dark:border-slate-800 bg-white/75 dark:bg-slate-900/75 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-red-500">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Automation
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Unlock imports, rules, and AI summaries in higher tiers.
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 dark:border-slate-800 bg-white/75 dark:bg-slate-900/75 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-red-500">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Control
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Move from solo use to shared workspaces and permissions.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/85 p-5 backdrop-blur-sm shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Billing
            </p>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              {isElementMode
                ? t("paymentModeEmbedded")
                : t("paymentModeCheckout")}
            </p>
            <div className="mt-3 inline-flex w-full items-center gap-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setInterval("month")}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  interval === "month"
                    ? "bg-red-500 text-white"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {t("monthlyBilling")}
              </button>
              <button
                type="button"
                onClick={() => setInterval("year")}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                  interval === "year"
                    ? "bg-red-500 text-white"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {t("yearlyBilling")}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("saveYearly")}
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Active choice
              </p>
              <p className="mt-1 text-lg font-bold capitalize text-slate-900 dark:text-slate-100">
                {currentPlan}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("pricingStripeFlowHint")}
              </p>
            </div>
            {flowNotice ? (
              <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
                {flowNotice}
              </p>
            ) : null}
            {visibleActionError ? (
              <p className="mt-3 text-xs text-red-500">{visibleActionError}</p>
            ) : null}
          </div>
        </div>
      </section>

      {paymentForm ? (
        <section className="rounded-[28px] border border-red-100 dark:border-red-900/40 bg-white dark:bg-slate-900 p-6 md:p-7 shadow-sm space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">
              {t("paymentFormTitle")}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100 capitalize">
              {paymentForm.plan} · {paymentForm.interval}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t("paymentFormDescription")}
            </p>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {t("paymentFormApplePayHint")}
            </p>
          </div>

          <StripePaymentForm
            clientSecret={paymentForm.clientSecret}
            returnPath="/dashboard/pricing?checkout=success"
            onCancel={() => setPaymentForm(null)}
            onLocalSuccess={handleEmbeddedSuccess}
          />
        </section>
      ) : null}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {PLAN_ORDER.map((key) => {
          const plan = MONETIZATION_PLANS[key];
          const Icon = getPlanIcon(key);
          const isCurrent = currentPlan === key;
          const highlights = getPlanHighlights(
            key,
            t as (key: never) => string,
          );

          return (
            <div
              key={plan.key}
              className={`relative overflow-hidden rounded-[28px] border p-6 shadow-sm transition-all ${
                plan.highlighted
                  ? "border-red-200 dark:border-red-900/40 bg-linear-to-b from-white to-red-50/40 dark:from-slate-900 dark:to-red-950/10 shadow-red-100/50"
                  : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute right-[-36px] top-5 rotate-12 rounded-full bg-red-500 px-10 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white shadow-sm">
                  {t("popular")}
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {plan.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {plan.tagline}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 pt-8">
                  {isCurrent && (
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                      {t("currentPlan")}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-end gap-2">
                <span className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {plan.price.monthly === 0
                    ? "$0"
                    : interval === "year"
                      ? `$${plan.price.yearlyPerMonth.toFixed(2)}`
                      : `$${plan.price.monthly}`}
                </span>
                <span className="pb-1 text-sm text-slate-500 dark:text-slate-400">
                  {plan.price.monthly === 0
                    ? ""
                    : interval === "year"
                      ? "/mo"
                      : "/mo"}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {getPlanPriceLabel(plan, interval)}
              </p>
              {interval === "year" && plan.price.yearly > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {`Billed yearly at $${plan.price.yearly}`}
                </p>
              )}

              <button
                type="button"
                onClick={() => handlePlanSelect(plan.key)}
                disabled={isPending}
                className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
                  isPending
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-wait"
                    : plan.highlighted
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {getPlanButtonLabel(plan.key, isCurrent)}
              </button>

              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t("includedFeatures")}
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {highlights.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t("usageLimits")}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t("membersCount")}
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">
                        {plan.limits.members}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t("budgetsCount")}
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">
                        {plan.limits.monthlyBudgets ?? "∞"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t("categoriesCount")}
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">
                        {plan.limits.customCategories ?? "∞"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t("history")}
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">
                        {plan.limits.transactionHistoryDays === null
                          ? "∞"
                          : `${plan.limits.transactionHistoryDays}d`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Compare
          </div>
          {PLAN_ORDER.map((key) => (
            <div
              key={key}
              className="px-4 py-4 text-center text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              {MONETIZATION_PLANS[key].name}
            </div>
          ))}
        </div>

        {FEATURE_ROWS.map((row) => (
          <div
            key={row.labelKey}
            className="grid grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] border-b border-slate-100 dark:border-slate-800 last:border-b-0"
          >
            <div className="px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
              {t(row.labelKey as never)}
            </div>
            {PLAN_ORDER.map((key) => (
              <div
                key={key}
                className="px-4 py-4 flex items-center justify-center"
              >
                <ValueMark
                  value={renderFeatureValue(MONETIZATION_PLANS[key], row.value)}
                />
              </div>
            ))}
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-xs text-slate-500 dark:text-slate-400 shadow-sm">
        {t("pricingFootnote")}
      </div>
    </div>
  );
}
