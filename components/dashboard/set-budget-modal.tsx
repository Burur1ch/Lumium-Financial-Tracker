"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { upsertBudget } from "@/app/dashboard/actions";
import { CategoryPicker } from "./category-picker";
import { PaywallModal } from "./paywall-modal";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import { getPlanBudgetLimit } from "@/utils/monetization/limits";
import type { CategoryLike } from "@/utils/category-catalog";

export interface BudgetDraft {
  categoryId: string;
  limitAmountBase: number;
  rolloverEnabled: boolean;
  alertThreshold: number;
}

interface Props {
  categories: CategoryLike[];
  currentBudgetCount: number;
  existingBudgets?: BudgetDraft[];
  month: string;
  initialBudget?: BudgetDraft | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export default function SetBudgetModal({
  hideTrigger = false,
  open,
  onOpenChange,
  ...props
}: Props) {
  const { t } = useI18n();
  const { plan, currency } = usePrefs();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  useEffect(() => {
    const close = () => {
      setInternalOpen(false);
      onOpenChange?.(false);
    };
    const show = () => setInternalOpen(true);
    if (!hideTrigger) window.addEventListener("lumium:open-budget-limit", show);
    window.addEventListener("lumium:close-entry-panels", close);
    return () => {
      window.removeEventListener("lumium:open-budget-limit", show);
      window.removeEventListener("lumium:close-entry-panels", close);
    };
  }, [hideTrigger, onOpenChange]);
  const budgetLimit = getPlanBudgetLimit(plan);
  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          data-tour="set-budget-limit"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {t("setCategoryLimit")}
        </button>
      )}
      {!hideTrigger && budgetLimit !== null && (
        <p className="text-xs text-slate-500">
          {t("budgetPlanLimitHint")} {props.currentBudgetCount}/{budgetLimit}
        </p>
      )}
      {isOpen && (
        <BudgetLimitForm
          key={`${props.initialBudget?.categoryId ?? "new"}:${props.month}:${currency}`}
          {...props}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function BudgetLimitForm({
  categories,
  initialBudget,
  existingBudgets = [],
  month,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter();
  const { t, currencyRate, fmtMonth } = useI18n();
  const { currency } = usePrefs();
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [categoryId, setCategoryId] = useState(initialBudget?.categoryId ?? "");
  const [limitAmount, setLimitAmount] = useState(
    initialBudget
      ? String(Number((initialBudget.limitAmountBase * currencyRate).toFixed(2)))
      : "",
  );
  const [rolloverEnabled, setRolloverEnabled] = useState(
    initialBudget?.rolloverEnabled ?? false,
  );
  const [originalLimit, setOriginalLimit] = useState(limitAmount);
  const [alertThreshold, setAlertThreshold] = useState(
    String(initialBudget?.alertThreshold ?? 75),
  );
  const [error, setError] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [pending, startTransition] = useTransition();
  const existing =
    initialBudget ??
    existingBudgets.find((budget) => budget.categoryId === categoryId);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!document.documentElement.dataset.tourActive)
      dialog.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (document.documentElement.dataset.tourActive) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const chooseCategory = (value: string) => {
    setCategoryId(value);
    const saved = existingBudgets.find((budget) => budget.categoryId === value);
    setOriginalLimit(saved ? String(Number((saved.limitAmountBase * currencyRate).toFixed(2))) : "");
    setLimitAmount(
      saved
        ? String(Number((saved.limitAmountBase * currencyRate).toFixed(2)))
        : "",
    );
    setAlertThreshold(String(saved?.alertThreshold ?? 75));
    setRolloverEnabled(saved?.rolloverEnabled ?? false);
    setError("");
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await upsertBudget({
          categoryId,
          limitAmount: Number(limitAmount),
          amountChanged: !existing || Number(limitAmount) !== Number(originalLimit),
          currency,
          month,
          rolloverEnabled,
          alertThreshold: Number(alertThreshold),
        });
        if (!result.success) {
          if (result.error === "PLAN_LIMIT") setShowPaywall(true);
          else
            setError(
              t(
                result.error === "INVALID_CATEGORY"
                  ? "budgetCategoryUnavailable"
                  : "budgetSaveFailed",
              ),
            );
          return;
        }
        onClose();
        router.refresh();
      } catch {
        setError(t("budgetSaveFailed"));
      }
    });
  };
  const field =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
  return (
    <div
      className="ui-modal-overlay fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-period`}
        data-tour="budget-limit"
        className="ui-modal-panel max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-5 shadow-xl outline-none dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id={`${id}-title`}
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              {existing ? t("editLimit") : t("budgetLimitTitle")}
            </h2>
            <p
              id={`${id}-period`}
              className="mt-1 text-sm capitalize text-slate-500"
            >
              {fmtMonth(month)}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30"
            >
              {error}
            </p>
          )}
          <div>
            <label
              htmlFor={`${id}-category`}
              className="mb-1.5 block text-xs font-semibold text-slate-500"
            >
              {t("category")}
            </label>
            <CategoryPicker
              id={`${id}-category`}
              aria-label={t("category")}
              value={categoryId}
              onChange={(event) => chooseCategory(event.target.value)}
              disabled={Boolean(initialBudget)}
              required
              categories={categories.filter(
                (category) => category.type === "expense",
              )}
            />
          </div>
          <div data-tour="budget-limit-fields">
            <label
              htmlFor={`${id}-amount`}
              className="mb-1.5 block text-xs font-semibold text-slate-500"
            >
              {t("monthlyLimitLabel")} ({currency})
            </label>
            <input
              id={`${id}-amount`}
              name="amount"
              type="number"
              min={existing && Number(originalLimit) === 0 ? "0" : "0.01"}
              step="0.01"
              required
              value={limitAmount}
              onChange={(event) => setLimitAmount(event.target.value)}
              className={field}
            />
          </div>
          <div>
            <label
              htmlFor={`${id}-threshold`}
              className="mb-1.5 block text-xs font-semibold text-slate-500"
            >
              {t("budgetAlertThreshold")} (%)
            </label>
            <input
              id={`${id}-threshold`}
              name="threshold"
              type="number"
              min={50}
              max={100}
              step={1}
              required
              value={alertThreshold}
              onChange={(event) => setAlertThreshold(event.target.value)}
              className={field}
            />
          </div>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={rolloverEnabled}
              onChange={(event) => setRolloverEnabled(event.target.checked)}
              className="h-4 w-4 shrink-0 accent-red-500"
            />
            <span className="font-semibold">
              {t("rolloverBudget")}
              <small className="mt-1 block font-normal text-slate-500">
                {t("rolloverBudgetHint")}
              </small>
            </span>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full rounded-xl bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {t(pending ? "savingEllipsis" : "saveLimit")}
          </button>
        </form>
      </div>
      {showPaywall && (
        <PaywallModal
          isOpen
          onClose={() => setShowPaywall(false)}
          title={t("budgetLockedTitle")}
          description={t("budgetLockedDesc")}
          featureLabel={t("budgetsLimits")}
        />
      )}
    </div>
  );
}
