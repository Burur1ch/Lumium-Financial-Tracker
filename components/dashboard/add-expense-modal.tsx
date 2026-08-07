"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Check,
  TrendingDown,
  TrendingUp,
  Tag,
  FileText,
  DollarSign,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { createTransaction, createCategory } from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";
import { usePrefs } from "@/store/prefs";

interface Category {
  id: string;
  name: string;
  type: "expense" | "income";
  color?: string;
}

interface AddExpenseModalProps {
  categories: Category[];
}

const PRESET_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
];

const inputCls =
  "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600";

function FieldLabel({
  icon: Icon,
  label,
  action,
}: {
  icon: React.ElementType;
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      {action}
    </div>
  );
}

export default function AddExpenseModal({
  categories: initialCategories,
}: AddExpenseModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"expense" | "income">(
    "expense",
  );
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const { t } = useI18n();
  const { currency } = usePrefs();
  const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$",
    EUR: "€",
    RUB: "₽",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
  };
  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const [catOpen, setCatOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const catRef = useRef<HTMLDivElement>(null);

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const filteredCategories = categories.filter((c) => c.type === selectedType);
  const selectedCat = filteredCategories.find(
    (c) => c.id === selectedCategoryId,
  );

  const openModal = () => {
    setIsOpen(true);
    setSuccess(false);
    setError(null);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  };

  const closeModal = () => {
    setVisible(false);
    setTimeout(() => {
      setIsOpen(false);
      setShowNewCat(false);
      setNewCatName("");
      setSelectedCategoryId("");
      setCatOpen(false);
    }, 220);
  };

  useEffect(() => {
    if (!catOpen) return;
    const h = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node))
        setCatOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [catOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
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
      setCatError(result.error || "Error");
      return;
    }
    const { getCategories } = await import("@/app/dashboard/actions");
    const fresh = await getCategories();
    setCategories(fresh as Category[]);
    const created = (fresh as Category[]).find(
      (c) => c.name === newCatName.trim() && c.type === selectedType,
    );
    if (created) setSelectedCategoryId(created.id);
    setNewCatName("");
    setShowNewCat(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await createTransaction(formData);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => closeModal(), 900);
    } else {
      setError(result.error || "Something went wrong");
    }
  };

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-600 active:scale-95 transition-all duration-150"
      >
        <Plus className="w-4 h-4" />
        {t("addTransaction")}
      </button>

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
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 sm:rounded-2xl rounded-t-2xl border border-slate-100 dark:border-slate-800 shadow-2xl"
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
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${selectedType === "expense" ? "bg-red-100 dark:bg-red-950/50" : "bg-emerald-100 dark:bg-emerald-950/50"}`}
                >
                  {selectedType === "expense" ? (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {t("newTransaction")}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                    {t("transactionSaved")}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t("closingEllipsis")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        onClick={() => {
                          setSelectedType(txType);
                          setSelectedCategoryId("");
                          setShowNewCat(false);
                          setCatOpen(false);
                        }}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
                          selectedType === txType
                            ? txType === "expense"
                              ? "bg-white dark:bg-slate-800 text-red-500 shadow-sm"
                              : "bg-white dark:bg-slate-800 text-emerald-500 shadow-sm"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {txType === "expense" ? (
                          <TrendingDown className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingUp className="w-3.5 h-3.5" />
                        )}
                        {txType === "expense" ? t("expense") : t("income")}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="type" value={selectedType} />

                  {/* Amount */}
                  <div>
                    <FieldLabel icon={DollarSign} label={t("amount")} />
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-bold pointer-events-none">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        name="amount"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        className={
                          inputCls + " pl-7 text-lg font-bold tabular-nums"
                        }
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <FieldLabel icon={FileText} label={t("description")} />
                    <input
                      type="text"
                      name="description"
                      required
                      placeholder="e.g. Groceries at Whole Foods"
                      className={inputCls}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <FieldLabel
                      icon={Tag}
                      label={t("category")}
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewCat((v) => !v);
                            setCatError(null);
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          New
                        </button>
                      }
                    />

                    <div
                      className="overflow-hidden transition-all duration-200"
                      style={{
                        maxHeight: showNewCat ? "220px" : "0",
                        opacity: showNewCat ? 1 : 0,
                      }}
                    >
                      <div className="mb-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                        {catError && (
                          <p className="text-xs text-red-500 font-semibold">
                            {catError}
                          </p>
                        )}
                        <input
                          type="text"
                          placeholder="Category name"
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
                              className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
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
                                  className="w-3 h-3 text-white"
                                  strokeWidth={3}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={handleCreateCategory}
                          disabled={catLoading || !newCatName.trim()}
                          className="w-full rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
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

                    {filteredCategories.length === 0 && !showNewCat ? (
                      <button
                        type="button"
                        onClick={() => setShowNewCat(true)}
                        className="w-full flex items-center justify-between rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs text-slate-400 hover:border-red-400 dark:hover:border-red-600 hover:text-red-500 transition-colors"
                      >
                        <span>{t("noCategoriesCreate")}</span>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="relative" ref={catRef}>
                        <button
                          type="button"
                          onClick={() => setCatOpen((v) => !v)}
                          className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                            catOpen
                              ? "border-red-500 ring-1 ring-red-500 bg-white dark:bg-slate-950"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {selectedCat ? (
                              <>
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor:
                                      selectedCat.color ?? "#94a3b8",
                                  }}
                                />
                                <span className="text-slate-800 dark:text-slate-200 font-medium">
                                  {selectedCat.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600">
                                {t("uncategorizedOption")}
                              </span>
                            )}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${catOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        <div
                          className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-20"
                          style={{
                            maxHeight: catOpen ? "224px" : "0",
                            opacity: catOpen ? 1 : 0,
                            pointerEvents: catOpen ? "auto" : "none",
                            overflowY: catOpen ? "auto" : "hidden",
                            overflowX: "hidden",
                            transition:
                              "max-height 180ms ease, opacity 180ms ease",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId("");
                              setCatOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${!selectedCategoryId ? "text-red-500 font-semibold" : "text-slate-500 dark:text-slate-400"}`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
                            {t("uncategorizedOption")}
                          </button>
                          {filteredCategories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                setSelectedCategoryId(cat.id);
                                setCatOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${selectedCategoryId === cat.id ? "text-red-500 font-semibold" : "text-slate-700 dark:text-slate-300"}`}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: cat.color ?? "#94a3b8",
                                  }}
                                />
                                {cat.name}
                              </span>
                              {selectedCategoryId === cat.id && (
                                <Check
                                  className="w-3.5 h-3.5 text-red-500"
                                  strokeWidth={3}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                        <input
                          type="hidden"
                          name="category_id"
                          value={selectedCategoryId}
                        />
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <FieldLabel icon={Calendar} label={t("date")} />
                    <input
                      type="date"
                      name="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <input type="hidden" name="status" value="completed" />

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
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
