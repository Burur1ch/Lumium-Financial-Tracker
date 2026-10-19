"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteTransaction,
  duplicateTransaction,
  saveTransactionSplits,
  setTransactionReviewStatus,
  updateTransaction,
} from "@/app/dashboard/actions";
import type { Transaction } from "@/components/dashboard/transactions-table";
import { Money } from "@/components/money";
import { useI18n } from "@/hooks/useI18n";
import { RATES, usePrefs } from "@/store/prefs";

interface CategoryOption {
  id: string;
  name: string;
  color: string;
  type: "expense" | "income";
}

interface SplitDraft {
  categoryId: string;
  amount: string;
  note: string;
}

export function TransactionDetailSheet({
  transaction,
  categories,
  onClose,
}: {
  transaction: Transaction;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { t, fmtDate } = useI18n();
  const { currency } = usePrefs();
  const rate = RATES[currency] ?? 1;
  const [mode, setMode] = useState<"details" | "edit" | "split">("details");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState(transaction.type);
  const localAmount = Number((transaction.amount * rate).toFixed(2));
  const initialSplits = useMemo<SplitDraft[]>(() => {
    if (transaction.splits && transaction.splits.length >= 2) {
      return transaction.splits.map((split) => ({
        categoryId: split.categoryId ?? "",
        amount: String(Number((split.amount * rate).toFixed(2))),
        note: split.note ?? "",
      }));
    }
    const first = Number((localAmount / 2).toFixed(2));
    return [
      { categoryId: transaction.category_id ?? "", amount: String(first), note: "" },
      {
        categoryId: "",
        amount: String(Number((localAmount - first).toFixed(2))),
        note: "",
      },
    ];
  }, [localAmount, rate, transaction.category_id, transaction.splits]);
  const [splits, setSplits] = useState(initialSplits);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const finish = () => {
    router.refresh();
    onClose();
  };

  const run = async (action: () => Promise<{ success: boolean }>) => {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(t("genericError"));
        return;
      }
      finish();
    } catch {
      setError(t("genericError"));
    } finally {
      setPending(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("currency", currency);
    formData.set("type", selectedType);
    await run(() => updateTransaction(transaction.id, formData));
  };

  const handleSplit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = splits.map((split) => ({
      categoryId: split.categoryId || null,
      amount: Number(split.amount),
      note: split.note,
    }));
    const total = parsed.reduce((sum, split) => sum + split.amount, 0);
    if (parsed.some((split) => !Number.isFinite(split.amount) || split.amount <= 0)) {
      setError(t("invalidSplitAmounts"));
      return;
    }
    if (Math.abs(total - localAmount) > 0.011) {
      setError(t("splitTotalMismatch"));
      return;
    }
    await run(() =>
      saveTransactionSplits({
        transactionId: transaction.id,
        currency,
        splits: parsed,
      }),
    );
  };

  const inputClass =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100";
  const filteredCategories = categories.filter(
    (category) => category.type === selectedType,
  );

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-detail-title"
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
        <header className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <div>
            <h2 id="transaction-detail-title" className="text-lg font-bold text-slate-950 dark:text-slate-50">
              {mode === "edit"
                ? t("editTransaction")
                : mode === "split"
                  ? t("splitTransaction")
                  : t("transactionDetails")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {transaction.description}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t("close")}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}

          {mode === "details" && (
            <>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className={`text-3xl font-black tabular-nums ${transaction.type === "income" ? "text-emerald-500" : "text-slate-950 dark:text-slate-50"}`}>
                  {transaction.type === "income" ? "+" : "-"}
                  <Money amount={transaction.amount} decimals />
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="block text-slate-400">{t("date")}</span>
                    <strong className="mt-1 block text-slate-700 dark:text-slate-200">{fmtDate(transaction.date)}</strong>
                  </div>
                  <div>
                    <span className="block text-slate-400">{t("category")}</span>
                    <strong className="mt-1 block text-slate-700 dark:text-slate-200">{transaction.categories?.[0]?.name ?? t("uncategorized")}</strong>
                  </div>
                </div>
                {transaction.note && (
                  <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">{transaction.note}</p>
                )}
                {transaction.splits && transaction.splits.length > 0 && (
                  <p className="mt-3 text-xs font-semibold text-red-500">
                    {t("splitIntoCategories")}: {transaction.splits.length}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMode("edit")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  <Pencil className="h-4 w-4" /> {t("edit")}
                </button>
                <button type="button" onClick={() => setMode("split")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  <Scissors className="h-4 w-4" /> {t("splitTransaction")}
                </button>
                <button type="button" disabled={pending} onClick={() => void run(() => duplicateTransaction(transaction.id))} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200">
                  <Copy className="h-4 w-4" /> {t("duplicate")}
                </button>
                <button type="button" disabled={pending} onClick={() => void run(() => setTransactionReviewStatus(transaction.id, transaction.review_status === "needs_review" ? "reviewed" : "needs_review"))} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200">
                  <Check className="h-4 w-4" /> {transaction.review_status === "needs_review" ? t("markReviewed") : t("markForReview")}
                </button>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(t("deleteTransactionConfirm"))) {
                    void run(() => deleteTransaction(transaction.id));
                  }
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t("deleteTransaction")}
              </button>
            </>
          )}

          {mode === "edit" && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["expense", "income"] as const).map((type) => (
                  <button key={type} type="button" onClick={() => setSelectedType(type)} className={`min-h-11 rounded-xl text-sm font-bold ${selectedType === type ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-950 dark:text-slate-400"}`}>
                    {type === "expense" ? t("expense") : t("income")}
                  </button>
                ))}
              </div>
              <input name="amount" type="number" min="0.01" step="0.01" required defaultValue={localAmount} className={inputClass} aria-label={t("amount")} />
              <input name="description" required defaultValue={transaction.description} className={inputClass} aria-label={t("description")} />
              <select name="category_id" defaultValue={transaction.category_id ?? ""} className={inputClass} aria-label={t("category")}>
                <option value="">{t("uncategorizedOption")}</option>
                {filteredCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <input name="date" type="date" defaultValue={transaction.date.slice(0, 10)} className={inputClass} aria-label={t("date")} />
              <textarea name="note" defaultValue={transaction.note ?? ""} placeholder={t("transactionNotePlaceholder")} className={`${inputClass} min-h-24 py-3`} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMode("details")} className="min-h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 dark:border-slate-800">{t("cancel")}</button>
                <button type="submit" disabled={pending} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-bold text-white disabled:opacity-50">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} {t("saveChanges")}
                </button>
              </div>
            </form>
          )}

          {mode === "split" && (
            <form onSubmit={handleSplit} className="space-y-3">
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t("splitTransactionHint")}</p>
              {splits.map((split, index) => (
                <div key={index} className="grid grid-cols-[1fr_7rem_2.75rem] gap-2">
                  <select value={split.categoryId} onChange={(event) => setSplits((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, categoryId: event.target.value } : item))} className={inputClass} aria-label={t("category")}>
                    <option value="">{t("uncategorizedOption")}</option>
                    {categories.filter((category) => category.type === transaction.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <input type="number" min="0.01" step="0.01" value={split.amount} onChange={(event) => setSplits((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} className={inputClass} aria-label={t("amount")} />
                  <button type="button" disabled={splits.length <= 2} onClick={() => setSplits((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-500 disabled:opacity-30" aria-label={t("deleteButton")}><X className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setSplits((current) => [...current, { categoryId: "", amount: "", note: "" }])} className="min-h-11 w-full rounded-xl border border-dashed border-slate-300 text-sm font-bold text-slate-500 dark:border-slate-700">{t("addSplit")}</button>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
                <span className="text-slate-500">{t("splitTotal")}</span>
                <strong className="tabular-nums text-slate-900 dark:text-slate-100">{splits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0).toFixed(2)} / {localAmount.toFixed(2)} {currency}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMode("details")} className="min-h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 dark:border-slate-800">{t("cancel")}</button>
                <button type="submit" disabled={pending} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-bold text-white disabled:opacity-50">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />} {t("saveSplit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
