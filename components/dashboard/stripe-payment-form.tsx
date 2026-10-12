"use client";

import { FormEvent, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useI18n } from "@/hooks/useI18n";

function StripePaymentFormInner({
  returnPath,
  onCancel,
  onLocalSuccess,
}: {
  returnPath: string;
  onCancel: () => void;
  onLocalSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage(t("paymentFormInitError"));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const returnUrl = `${window.location.origin}${returnPath}`;

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (result.error) {
      setErrorMessage(result.error.message ?? t("paymentFormFailed"));
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onLocalSuccess();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {errorMessage ? (
        <p className="text-xs text-red-500">{errorMessage}</p>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !stripe || !elements}
          className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
            isSubmitting || !stripe || !elements
              ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-wait"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
        >
          {isSubmitting ? t("processingPayment") : t("payAndSubscribe")}
        </button>
      </div>
    </form>
  );
}

export function StripePaymentForm({
  clientSecret,
  returnPath,
  onCancel,
  onLocalSuccess,
}: {
  clientSecret: string;
  returnPath: string;
  onCancel: () => void;
  onLocalSuccess: () => void;
}) {
  const { t } = useI18n();
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const stripePromise = useMemo(() => {
    if (!stripeKey) return null;
    return loadStripe(stripeKey);
  }, [stripeKey]);

  if (!stripePromise) {
    return <p className="text-xs text-red-500">{t("paymentFormMissingKey")}</p>;
  }

  return (
    <Elements options={{ clientSecret }} stripe={stripePromise}>
      <StripePaymentFormInner
        returnPath={returnPath}
        onCancel={onCancel}
        onLocalSuccess={onLocalSuccess}
      />
    </Elements>
  );
}
