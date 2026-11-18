"use client";
import { CategoryPicker } from "@/components/dashboard/category-picker";
import { CategoryArtwork } from "@/components/dashboard/category-artwork";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  X,
  Plus,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  Tag,
  AlignLeft,
  StickyNote,
  Banknote,
  CalendarDays,
} from "lucide-react";
import { createCategory } from "@/app/dashboard/actions";
import { cachedOfflineAccount, readTransactionDraft, writeTransactionDraft, submitManualTransaction } from "@/utils/offline-transactions";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";
import { isCurrency } from "@/utils/currency";

interface Category {
  id: string;
  name: string;
  type: "expense" | "income";
  color?: string;
  icon?: string | null;
}

interface AddExpenseModalProps {
  categories?: Category[];
  hideTrigger?: boolean;
}

interface TransactionDraft {
  amount?: number | string;
  description?: string;
  note?: string;
  currency?: string;
  date?: string;
  type?: "expense" | "income";
  category_id?: string;
  idempotency_key?: string;
}

const PRESET_COLORS = [
  "#D92D3A",
  "#F97316",
  "#EAB308",
  "#24845C",
  "#06B6D4",
  "#3478C8",
  "#287D91",
  "#EC4899",
];

const inputCls =
  "min-h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600";

function FieldLabel({
  icon: Icon,
  label,
  action,
  htmlFor,
}: {
  icon: React.ElementType;
  label: string;
  action?: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"
      >
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {action}
    </div>
  );
}

export default function AddExpenseModal({
  categories: initialCategories = [],
  hideTrigger = false,
}: AddExpenseModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"expense" | "income">(
    "expense",
  );
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [draft, setDraft] = useState<TransactionDraft>({});
  const { t } = useI18n();
  const { currency } = usePrefs();
  const draftCurrency = draft.currency ?? currency;
  const currencySymbol = isCurrency(draftCurrency)
    ? draftCurrency
    : draftCurrency;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const saved = useRef(false);
  const [entryKey, setEntryKey] = useState("");
  const categoryRequest = useRef(0);
  const fieldId = useId();

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(today);

  const filteredCategories = categories.filter((c) => c.type === selectedType);

  const openModal = useCallback(
    (nextDraft: TransactionDraft = {}) => {
      const restored = Object.keys(nextDraft).length ? nextDraft : readTransactionDraft() ?? {};
      setDraft(restored);
      setDate(restored.date ?? today);
      setSelectedType(restored.type === "income" ? "income" : "expense");
      setSelectedCategoryId(restored.category_id ?? "");
      setEntryKey(restored.idempotency_key ?? crypto.randomUUID());
      saved.current = false;
      setQueued(false);
      const cached = cachedOfflineAccount();
      if (cached) setCategories(cached.categories);
      setIsOpen(true);
      setSuccess(false);
      setError(null);
      const request = ++categoryRequest.current;
      if (navigator.onLine) void import("@/app/dashboard/actions").then(async ({ getCategories }) => {
        try {
          const fresh = await getCategories();
          if (request === categoryRequest.current)
            setCategories(fresh as Category[]);
        } catch {
          if (request === categoryRequest.current) setError(t("genericError"));
        }
      });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
    },
    [t, today],
  );

  const persistDraft = useCallback((overrides: Record<string, string> = {}) => {
    if (!formRef.current || saved.current) return;
    try {
      const fields = Object.fromEntries(Array.from(new FormData(formRef.current).entries(), ([key, value]) => [key, String(value)]));
      writeTransactionDraft({ ...fields, ...overrides });
    } catch { setError(t("draftSaveFailed")); }
  }, [t]);

  const closeModal = useCallback(() => {
    persistDraft();
    setVisible(false);
    setTimeout(() => {
      setIsOpen(false);
      setShowNewCat(false);
      setNewCatName("");
      setSelectedCategoryId("");
    }, 220);
  }, [persistDraft]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, closeModal]);

  useEffect(() => {
    const handler = (event: Event) => {
      const nextDraft = (event as CustomEvent<TransactionDraft>).detail;
      openModal(nextDraft ?? {});
    };
    const close = () => {
      setVisible(false);
      setIsOpen(false);
      setShowNewCat(false);
      setSelectedCategoryId("");
    };
    window.addEventListener("lumium:open-add-transaction", handler);
    window.addEventListener("lumium:close-entry-panels", close);
    return () => {
      window.removeEventListener("lumium:open-add-transaction", handler);
      window.removeEventListener("lumium:close-entry-panels", close);
    };
  }, [openModal]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      if (!document.documentElement.dataset.tourActive)
        amountRef.current?.focus();
    }, 240);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setCatLoading(true);
    setCatError(null);
    const fd = new FormData();
    fd.append("name", newCatName.trim());
    fd.append("type", selectedType);
    fd.append("color", newCatColor);
    const result = await createCategory(fd);
    setCatLoading(false);
    if (!result.success) {
      setCatError(result.error || t("genericError"));
      return;
    }
    const { getCategories } = await import("@/app/dashboard/actions");
    const fresh = await getCategories();
    setCategories(fresh as Category[]);
    const created = (fresh as Category[]).find(
      (c) => c.name === newCatName.trim() && c.type === selectedType,
    );
    if (created) {
      setSelectedCategoryId(created.id);
      persistDraft({ category_id: created.id });
    }
    setNewCatName("");
    setShowNewCat(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await submitManualTransaction(formData);
      if (result.success) {
        saved.current = true;
        writeTransactionDraft(null);
        setQueued(result.queued);
        setSuccess(true);
        setTimeout(() => closeModal(), 900);
      } else {
        setError(result.error || t("genericError"));
      }
    } catch {
      setError(navigator.onLine ? t("genericError") : t("offlineHint"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => openModal()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-red-600 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          {t("addTransaction")}
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{
            backgroundColor: visible
              ? "rgba(15,23,42,0.5)"
              : "rgba(15,23,42,0)",
            backdropFilter: visible ? "blur(4px)" : "blur(0px)",
            transition:
              "background-color 220ms ease, backdrop-filter 220ms ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-transaction-title"
            className="max-h-[92dvh] w-full overflow-y-auto bg-white pb-[env(safe-area-inset-bottom)] dark:bg-slate-900 sm:max-w-md sm:rounded-2xl rounded-t-2xl border border-slate-100 dark:border-slate-800 shadow-2xl"
            style={{
              transform: visible
                ? "translateY(0) scale(1)"
                : "translateY(32px) scale(0.97)",
              opacity: visible ? 1 : 0,
              transition:
                "transform 220ms cubic-bezier(0.34,1.2,0.64,1), opacity 220ms ease",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <CategoryArtwork
                  icon={selectedType}
                  className="h-9 w-9 rounded-xl"
                />
                <h3
                  id="new-transaction-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  {t("newTransaction")}
                </h3>
              </div>
              <button
                onClick={closeModal}
                aria-label={t("close")}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              {success ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                    <Check
                      className="w-7 h-7 text-emerald-500"
                      strokeWidth={2.5}
                    />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {t(queued ? "offlineQueued" : "transactionSaved")}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t("closingEllipsis")}
                  </p>
                </div>
              ) : (
                <form ref={formRef} onInput={() => persistDraft()} onSubmit={handleSubmit} className="space-y-4">
                  <input type="hidden" name="idempotency_key" value={entryKey} />
                  <input type="hidden" name="currency" value={draftCurrency} />
                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-3 py-2 text-xs font-semibold text-red-500">
                      {error}
                    </div>
                  )}

                  {/* Type toggle */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    {(["expense", "income"] as const).map((txType) => (
                      <button
                        key={txType}
                        type="button"
                        aria-pressed={selectedType === txType}
                        onClick={() => {
                          setSelectedType(txType);
                          setSelectedCategoryId("");
                          persistDraft({ type: txType, category_id: "" });
                          setShowNewCat(false);
                        }}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs font-bold transition-[color,background-color,transform] duration-150 ${
                          selectedType === txType
                            ? txType === "expense"
                              ? "bg-white dark:bg-slate-800 text-red-500"
                              : "bg-white dark:bg-slate-800 text-emerald-500"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {txType === "expense" ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        )}
                        {txType === "expense" ? t("expense") : t("income")}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="type" value={selectedType} />

                  {/* Amount */}
                  <div>
                    <FieldLabel
                      icon={Banknote}
                      label={t("amount")}
                      htmlFor={`${fieldId}-amount`}
                    />
                    <div className="relative">
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-bold pointer-events-none">
                        {currencySymbol}
                      </span>
                      <input
                        ref={amountRef}
                        id={`${fieldId}-amount`}
                        type="number"
                        name="amount"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={draft.amount ?? ""}
                        onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                        className={
                          inputCls + " pr-16 text-lg font-bold tabular-nums"
                        }
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <FieldLabel
                      icon={AlignLeft}
                      label={t("description")}
                      htmlFor={`${fieldId}-description`}
                    />
                    <input
                      type="text"
                      name="description"
                      id={`${fieldId}-description`}
                      required
                      placeholder={t("transactionDescriptionPlaceholder")}
                      value={draft.description ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <FieldLabel
                      icon={StickyNote}
                      label={t("transactionNote")}
                      htmlFor={`${fieldId}-note`}
                    />
                    <textarea
                      name="note"
                      id={`${fieldId}-note`}
                      placeholder={t("transactionNotePlaceholder")}
                      value={draft.note ?? ""}
                      onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                      className={inputCls + " min-h-20 py-3"}
                    />
                  </div>

                  {/* Category */}
                  <div data-tour="transaction-category">
                    <FieldLabel
                      icon={Tag}
                      label={t("category")}
                      htmlFor={`${fieldId}-category`}
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewCat((v) => !v);
                            setCatError(null);
                          }}
                          className="flex min-h-11 items-center gap-1 px-1 text-[11px] font-semibold text-red-500 hover:text-red-600"
                        >
                          <Plus className="w-3 h-3" />
                          {t("newCategory")}
                        </button>
                      }
                    />

                    {showNewCat && (
                      <div className="mobile-inline-reveal">
                        <div className="mb-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                          {catError && (
                            <p className="text-xs text-red-500 font-semibold">
                              {catError}
                            </p>
                          )}
                          <input
                            type="text"
                            placeholder={t("categoryNamePlaceholder")}
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCreateCategory();
                              }
                            }}
                            className={inputCls}
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setNewCatColor(color)}
                                className="flex h-11 w-11 items-center justify-center rounded-full"
                                aria-label={color}
                              >
                                <span
                                  className="flex h-6 w-6 items-center justify-center rounded-full"
                                  style={{
                                    backgroundColor: color,
                                    outline:
                                      newCatColor === color
                                        ? `2px solid ${color}`
                                        : "none",
                                    outlineOffset: "2px",
                                  }}
                                >
                                  {newCatColor === color && (
                                    <Check
                                      className="h-3 w-3 text-white"
                                      strokeWidth={3}
                                    />
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={catLoading || !newCatName.trim()}
                            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-red-500 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            {catLoading ? (
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            {catLoading
                              ? t("creatingEllipsis")
                              : t("createAndSelect")}
                          </button>
                        </div>
                      </div>
                    )}

                    <CategoryPicker
                      categories={filteredCategories}
                      value={selectedCategoryId}
                      onChange={(event) => {
                        setSelectedCategoryId(event.target.value);
                        persistDraft({ category_id: event.target.value });
                      }}
                      name="category_id"
                      id={`${fieldId}-category`}
                      aria-label={t("category")}
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <FieldLabel
                      icon={CalendarDays}
                      label={t("date")}
                      htmlFor={`${fieldId}-date`}
                    />
                    <input
                      type="date"
                      name="date"
                      id={`${fieldId}-date`}
                      value={date}
                      onChange={(event) => {
                        setDate(event.target.value);
                        persistDraft({ date: event.target.value });
                      }}
                      className={inputCls}
                    />
                  </div>

                  <input type="hidden" name="status" value="completed" />

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="min-h-11 flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-[background-color,transform] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                        selectedType === "expense"
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      }`}
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t("savingEllipsis")}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" strokeWidth={2.5} />
                          {t("saveChanges")}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
