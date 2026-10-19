"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BusFront,
  Check,
  Coffee,
  Home,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  ShoppingBasket,
  Train,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import {
  createQuickPreset,
  createTransactionFromPreset,
  deleteQuickPreset,
  deleteTransaction,
  updateQuickPreset,
} from "@/app/dashboard/actions";
import { Money } from "@/components/money";
import { useI18n } from "@/hooks/useI18n";
import { RATES, usePrefs } from "@/store/prefs";

export interface QuickPreset {
  id: string;
  name: string;
  amount: number;
  type: "expense" | "income";
  icon: string;
  category: { id: string; name: string; color: string } | null;
}

interface QuickCategory {
  id: string;
  name: string;
  type: "expense" | "income";
  color: string;
}

interface QuickActionsProps {
  presets: QuickPreset[];
  categories: QuickCategory[];
}

const ICONS: Array<{ key: string; icon: LucideIcon }> = [
  { key: "train", icon: Train },
  { key: "coffee", icon: Coffee },
  { key: "utensils", icon: Utensils },
  { key: "shopping", icon: ShoppingBasket },
  { key: "bus", icon: BusFront },
  { key: "home", icon: Home },
  { key: "other", icon: MoreHorizontal },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  RUB: "₽",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
};

function getIcon(iconKey: string) {
  return ICONS.find((item) => item.key === iconKey)?.icon ?? MoreHorizontal;
}

export function QuickActions({ presets, categories }: QuickActionsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { currency } = usePrefs();
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [formMode, setFormMode] = useState<"list" | "create" | "edit">(
    "list",
  );
  const [editingPreset, setEditingPreset] = useState<QuickPreset | null>(null);
  const [selectedType, setSelectedType] = useState<"expense" | "income">(
    "expense",
  );
  const [selectedIcon, setSelectedIcon] = useState("train");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    transactionId?: string;
    name: string;
    kind: "success" | "error";
  } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!managerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setManagerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [managerOpen]);

  const showToast = (nextToast: NonNullable<typeof toast>) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(nextToast);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  };

  const handleQuickAdd = async (preset: QuickPreset) => {
    if (pendingPresetId) return;
    setPendingPresetId(preset.id);
    try {
      const result = await createTransactionFromPreset({
        presetId: preset.id,
        idempotencyKey: crypto.randomUUID(),
      });

      if (!result.success || !result.transactionId) {
        showToast({ name: t("genericError"), kind: "error" });
        return;
      }

      showToast({
        transactionId: result.transactionId,
        name: preset.name,
        kind: "success",
      });
      router.refresh();
    } catch {
      showToast({ name: t("genericError"), kind: "error" });
    } finally {
      setPendingPresetId(null);
    }
  };

  const resetForm = () => {
    setEditingPreset(null);
    setSelectedType("expense");
    setSelectedIcon("train");
    setSelectedCategoryId("");
    setName("");
    setAmount("");
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setFormMode("create");
    setManagerOpen(true);
  };

  const openEdit = (preset: QuickPreset) => {
    setEditingPreset(preset);
    setSelectedType(preset.type);
    setSelectedIcon(preset.icon);
    setSelectedCategoryId(preset.category?.id ?? "");
    setName(preset.name);
    setAmount(
      String(Number((preset.amount * (RATES[currency] ?? 1)).toFixed(2))),
    );
    setError(null);
    setFormMode("edit");
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("currency", currency);
    formData.set("type", selectedType);
    formData.set("icon", selectedIcon);
    formData.set("category_id", selectedCategoryId);

    try {
      const result = editingPreset
        ? await updateQuickPreset(editingPreset.id, formData)
        : await createQuickPreset(formData);

      if (!result.success) {
        setError(
          result.error === "QUICK_PRESET_LIMIT"
            ? t("quickActionLimitReached")
            : t("genericError"),
        );
        return;
      }

      resetForm();
      setFormMode("list");
      setManagerOpen(false);
      router.refresh();
    } catch {
      setError(t("genericError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePreset = async (preset: QuickPreset) => {
    if (!window.confirm(t("deleteQuickActionConfirm"))) return;
    setDeletingId(preset.id);
    setError(null);
    try {
      const result = await deleteQuickPreset(preset.id);
      if (!result.success) {
        setError(t("genericError"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("genericError"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleUndo = async () => {
    if (!toast?.transactionId || undoing) return;
    setUndoing(true);
    try {
      const result = await deleteTransaction(toast.transactionId);
      if (!result.success) {
        showToast({ name: t("genericError"), kind: "error" });
        return;
      }
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      setToast(null);
      router.refresh();
    } catch {
      showToast({ name: t("genericError"), kind: "error" });
    } finally {
      setUndoing(false);
    }
  };

  const filteredCategories = categories.filter(
    (category) => category.type === selectedType,
  );
  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const renderPreset = (preset: QuickPreset, mobile = false) => {
    const Icon = getIcon(preset.icon);
    const pending = pendingPresetId === preset.id;
    return (
      <button
        key={preset.id}
        type="button"
        disabled={Boolean(pendingPresetId)}
        onClick={() => void handleQuickAdd(preset)}
        className={`flex items-center gap-2.5 border text-left active:scale-[0.98] disabled:opacity-60 ${mobile ? "min-h-[4.15rem] min-w-0 rounded-xl border-slate-200/80 bg-white/80 px-2.5 dark:border-white/[0.055] dark:bg-white/[0.035]" : "min-h-16 min-w-36 rounded-2xl border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-950"}`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-xl text-white ${mobile ? "h-9 w-9" : "h-10 w-10"}`}
          style={{ backgroundColor: preset.category?.color || "#ef4444" }}
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Icon className="h-5 w-5" strokeWidth={2} />
          )}
        </span>
        <span className="min-w-0">
          <span className={`${mobile ? "text-xs" : "text-sm"} block truncate font-semibold text-slate-900 dark:text-slate-100`}>
            {preset.name}
          </span>
          <span className={`mt-0.5 block text-xs font-bold tabular-nums ${preset.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"}`}>
            {preset.type === "income" ? "+" : ""}
            <Money amount={preset.amount} decimals />
          </span>
        </span>
      </button>
    );
  };

  return (
    <>
      <section className="border-slate-200/80 bg-transparent dark:border-slate-800 sm:rounded-2xl sm:border sm:bg-white sm:p-5 sm:shadow-sm sm:dark:bg-slate-900">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950 dark:text-slate-50">
              <span className="sm:hidden">{t("quick")}</span>
              <span className="hidden sm:inline">{t("quickActions")}</span>
            </h2>
            <p className="mt-0.5 hidden text-xs leading-5 text-slate-500 dark:text-slate-400 sm:block">
              {t("quickActionsSubtitle")}
            </p>
          </div>
          {presets.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFormMode("list");
                setManagerOpen(true);
              }}
              className="flex min-h-8 items-center gap-1.5 rounded-xl px-1 text-xs font-semibold text-blue-500 hover:text-blue-600 sm:min-h-11 sm:px-3 sm:font-bold sm:text-slate-500 sm:hover:bg-slate-100 sm:hover:text-slate-900 dark:sm:text-slate-400 dark:sm:hover:bg-slate-800 dark:sm:hover:text-slate-100"
            >
              <Settings2 className="hidden h-4 w-4 sm:block" />
              <span className="sm:hidden">{t("edit")}</span>
              <span className="hidden sm:inline">{t("manageQuickActions")}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:hidden">
          {presets.slice(0, 5).map((preset) => renderPreset(preset, true))}
          {presets.length < 8 && (
            <button
              type="button"
              onClick={openCreate}
              className="flex min-h-[4.15rem] min-w-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/80 px-2 text-xs font-semibold text-slate-500 active:scale-[0.98] dark:border-white/[0.055] dark:bg-white/[0.035] dark:text-slate-300"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-700/70 dark:text-slate-200">
                <Plus className="h-5 w-5" />
              </span>
              <span className="hidden min-[375px]:inline">{t("addQuickAction")}</span>
            </button>
          )}
        </div>

        <div className="hidden gap-2 overflow-x-auto pb-1 sm:flex">
          {presets.map((preset) => renderPreset(preset))}
          {presets.length < 8 && (
            <button type="button" onClick={openCreate} className="flex min-h-16 min-w-32 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 text-sm font-bold text-slate-500 hover:border-red-400 hover:text-red-500 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-600 dark:hover:text-red-400">
              <Plus className="h-4 w-4" />
              {presets.length === 0 ? t("createQuickAction") : t("addQuickAction")}
            </button>
          )}
        </div>
      </section>

      {managerOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
          onMouseDown={() => setManagerOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-actions-title"
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <div className="flex items-center gap-1">
                {formMode !== "list" && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setFormMode("list");
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    aria-label={t("back")}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <h2
                  id="quick-actions-title"
                  className="text-lg font-bold text-slate-950 dark:text-slate-50"
                >
                  {formMode === "create"
                    ? t("newQuickAction")
                    : formMode === "edit"
                      ? t("editQuickAction")
                      : t("quickActions")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setManagerOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label={t("close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formMode === "list" ? (
              <div className="space-y-3 p-4">
                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    {error}
                  </p>
                )}
                {presets.map((preset) => {
                  const Icon = getIcon(preset.icon);
                  return (
                    <div
                      key={preset.id}
                      className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 px-3 dark:border-slate-800"
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: preset.category?.color || "#ef4444" }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                          {preset.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          <Money amount={preset.amount} decimals />
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit(preset)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        aria-label={t("editQuickAction")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === preset.id}
                        onClick={() => void handleDeletePreset(preset)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                        aria-label={t("deleteButton")}
                      >
                        {deletingId === preset.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
                {presets.length < 8 && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-600"
                  >
                    <Plus className="h-4 w-4" />
                    {t("addQuickAction")}
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4 p-4 sm:p-5">
                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
                    {error}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
                  {(["expense", "income"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setSelectedType(type);
                        setSelectedCategoryId("");
                      }}
                      className={`min-h-11 rounded-lg text-xs font-bold ${selectedType === type ? "bg-white text-red-500 shadow-sm dark:bg-slate-800" : "text-slate-500 dark:text-slate-400"}`}
                    >
                      {type === "expense" ? t("expense") : t("income")}
                    </button>
                  ))}
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t("quickActionName")}
                  </span>
                  <input
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    required
                    placeholder={t("quickActionNamePlaceholder")}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t("amount")}
                  </span>
                  <span className="relative block">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                      {currencySymbol}
                    </span>
                    <input
                      name="amount"
                      type="number"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3.5 text-sm font-bold tabular-nums text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t("category")}
                  </span>
                  <select
                    value={selectedCategoryId}
                    onChange={(event) => setSelectedCategoryId(event.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">{t("uncategorizedOption")}</option>
                    {filteredCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {t("selectIcon")}
                  </legend>
                  <div className="flex flex-wrap gap-1">
                    {ICONS.map(({ key, icon: Icon }, index) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedIcon(key)}
                        className={`flex h-11 w-11 items-center justify-center rounded-xl border ${selectedIcon === key ? "border-red-500 bg-red-50 text-red-500 dark:bg-red-950/30" : "border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"}`}
                        aria-label={`${t("selectIcon")} ${index + 1}`}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {editingPreset ? t("saveChanges") : t("createQuickAction")}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[80] mx-auto flex min-h-14 max-w-md items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl dark:bg-slate-100 dark:text-slate-950 lg:bottom-6"
        >
          {toast.kind === "success" ? (
            <Check className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <X className="h-5 w-5 shrink-0 text-red-400" />
          )}
          <span className="min-w-0 flex-1 text-sm">
            <strong className="font-bold">{toast.name}</strong>
            {toast.kind === "success" && (
              <span className="ml-1 text-slate-300 dark:text-slate-600">
                {t("quickActionAdded")}
              </span>
            )}
          </span>
          {toast.transactionId && (
            <button
              type="button"
              disabled={undoing}
              onClick={() => void handleUndo()}
              className="min-h-11 rounded-xl px-3 text-sm font-bold text-red-400 disabled:opacity-60"
            >
              {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : t("undo")}
            </button>
          )}
        </div>
      )}
    </>
  );
}
