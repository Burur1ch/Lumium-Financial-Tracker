"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getCategories, createCategory, deleteCategory } from "../actions";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/store/translations";
import { usePrefs } from "@/store/prefs";
import { PaywallModal } from "@/components/dashboard/paywall-modal";
import {
  getPlanCategoryLimit,
  isLimitReached,
} from "@/utils/monetization/limits";
import {
  Tag,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Shapes,
  ShoppingCart,
  ShoppingBag,
  UtensilsCrossed,
  Car,
  Home,
  Heart,
  Gamepad2,
  Plane,
  GraduationCap,
  Briefcase,
  Coffee,
  Music,
  Dumbbell,
  Shirt,
  Fuel,
  Phone,
  Tv,
  Baby,
  PawPrint,
  Gift,
  Wallet,
  CreditCard,
  Banknote,
  Bus,
  Zap,
  Wifi,
  BookOpen,
  Wrench,
  Pizza,
  Wine,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { CategoryArtwork } from "@/components/dashboard/category-artwork";

const ICON_MAP: Record<string, LucideIcon> = {
  tag: Tag,
  shoppingCart: ShoppingCart,
  shoppingBag: ShoppingBag,
  utensils: UtensilsCrossed,
  car: Car,
  home: Home,
  heart: Heart,
  gamepad: Gamepad2,
  plane: Plane,
  graduationCap: GraduationCap,
  briefcase: Briefcase,
  coffee: Coffee,
  music: Music,
  dumbbell: Dumbbell,
  shirt: Shirt,
  fuel: Fuel,
  phone: Phone,
  tv: Tv,
  baby: Baby,
  paw: PawPrint,
  gift: Gift,
  wallet: Wallet,
  creditCard: CreditCard,
  banknote: Banknote,
  bus: Bus,
  zap: Zap,
  wifi: Wifi,
  book: BookOpen,
  wrench: Wrench,
  pizza: Pizza,
  wine: Wine,
  stethoscope: Stethoscope,
};

function CategoryIcon({
  icon,
  name,
  className,
}: {
  icon?: string | null;
  name?: string | null;
  className?: string;
}) {
  const Icon = (icon && ICON_MAP[icon]) || Tag;
  return (
    <CategoryArtwork
      icon={icon}
      name={name}
      className="h-9 w-9"
      fallback={<Icon className={className ?? "w-4 h-4"} />}
    />
  );
}

interface Category {
  id: string;
  name: string;
  type: "expense" | "income";
  color: string;
  icon?: string | null;
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
  "#14B8A6",
  "#F43F5E",
  "#84CC16",
  "#9A6A3A",
];

const ICON_KEYS = Object.keys(ICON_MAP);

function CategoryGroup({
  type,
  items,
  onDelete,
  deletingId,
  t,
}: {
  type: "expense" | "income";
  items: Category[];
  onDelete: (id: string) => void;
  deletingId: string | null;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {type === "expense" ? (
          <TrendingDown className="w-4 h-4 text-red-500" />
        ) : (
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        )}
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
          {type === "expense" ? t("expense") : t("income")}
          <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-slate-500 normal-case tracking-normal">
            {items.length}{" "}
            {items.length === 1 ? t("category") : t("categories")}
          </span>
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-400 dark:text-slate-500">
          {t("noCategories")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((cat) => (
            <div
              key={cat.id}
              className="group flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 transition-colors duration-150 hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${cat.color}20`,
                    color: cat.color,
                  }}
                >
                  <CategoryIcon icon={cat.icon} name={cat.name} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {cat.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {cat.type === "expense" ? t("expense") : t("income")}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onDelete(cat.id)}
                disabled={deletingId === cat.id}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition-[color,background-color,opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-950/30"
                aria-label={`${t("deleteCategory")} ${cat.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedType, setSelectedType] = useState<"expense" | "income">(
    "expense",
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState("tag");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showAllIcons, setShowAllIcons] = useState(false);
  const { plan } = usePrefs();

  useEffect(() => {
    getCategories().then((data) => setCategories(data as Category[]));
  }, []);

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");
  const categoryLimit = getPlanCategoryLimit(plan);
  const hasReachedCategoryLimit = isLimitReached(
    categoryLimit,
    categories.length,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (hasReachedCategoryLimit) {
      setError(t("categoryPlanLimitHint"));
      setShowPaywall(true);
      return;
    }
    setError(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("type", selectedType);
      fd.append("color", color);
      fd.append("icon", icon);
      const result = await createCategory(fd);
      if (!result.success) {
        setError(result.error || "Error");
        return;
      }
      const fresh = await getCategories();
      setCategories(fresh as Category[]);
      setName("");
      setCreateOpen(false);
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      await deleteCategory(id);
      const fresh = await getCategories();
      setCategories(fresh as Category[]);
      setDeletingId(null);
    });
  };

  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:space-y-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-50 md:text-3xl">
            {t("categories")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("manageCategoriesDesc")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
            <Shapes className="w-4 h-4" />
            {categories.length}
            {categoryLimit !== null ? ` / ${categoryLimit}` : ""}
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-bold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] lg:hidden"
          >
            <Plus className="h-4 w-4" /> {t("createCategory")}
          </button>
        </div>
      </div>

      {categoryLimit !== null && (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t("categoryPlanLimitHint")} {categories.length}/{categoryLimit}
          </p>
          <Link
            href="/dashboard/pricing"
            className="font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            {t("upgradeToPro")}
          </Link>
        </div>
      )}

      {createOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[89] bg-slate-950/65 lg:hidden"
          onClick={() => setCreateOpen(false)}
          aria-label={t("close")}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Create form */}
        <div className={`${createOpen ? "fixed" : "hidden"} mobile-inline-sheet inset-x-0 bottom-0 z-[90] max-h-[88dvh] space-y-5 overflow-y-auto rounded-t-[1.75rem] border border-slate-200/80 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6 lg:static lg:block lg:max-h-none lg:rounded-2xl lg:shadow-none`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("createCategory")}
            </h3>
            <button type="button" onClick={() => setCreateOpen(false)} className="icon-button lg:hidden" aria-label={t("close")}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-xs text-red-500 font-semibold bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedType("expense")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-[color,background-color,transform] duration-150 ${
                  selectedType === "expense"
                    ? "bg-white dark:bg-slate-800 text-red-500"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                }`}
              >
                <TrendingDown className="w-3 h-3" /> {t("expense")}
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("income")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-[color,background-color,transform] duration-150 ${
                  selectedType === "income"
                    ? "bg-white dark:bg-slate-800 text-emerald-500"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                }`}
              >
                <TrendingUp className="w-3 h-3" /> {t("income")}
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t("categoryName")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Subscriptions, Gym…"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t("selectIcon")}
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {(showAllIcons ? ICON_KEYS : ICON_KEYS.slice(0, 12)).map((key) => {
                  const Icon = ICON_MAP[key];
                  const selected = icon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIcon(key)}
                      title={key}
                      className={`relative flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-xl border transition-[border-color,background-color,transform] duration-150 active:scale-[0.96] ${
                        selected
                          ? "scale-[1.04] border-red-500 bg-red-50 ring-2 ring-red-500/15 dark:bg-red-950/25"
                          : "border-slate-200/70 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                      }`}
                      aria-pressed={selected}
                      aria-label={`${t("selectIcon")} ${key}`}
                    >
                      <CategoryArtwork
                        icon={key}
                        className="h-full w-full rounded-[0.65rem]"
                        imageClassName="h-full w-full object-contain p-0.5"
                        fallback={<Icon className="h-4 w-4" />}
                      />
                    </button>
                  );
                })}
              </div>
              {!showAllIcons && ICON_KEYS.length > 12 && (
                <button type="button" onClick={() => setShowAllIcons(true)} className="mt-2 min-h-10 w-full rounded-xl text-xs font-bold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20">
                  {t("showMore")}
                </button>
              )}
            </div>

            {/* Color presets */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t("selectColor")}
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center ring-offset-2 ring-offset-white dark:ring-offset-slate-900"
                    style={{
                      backgroundColor: c,
                      boxShadow: color === c ? `0 0 0 2px ${c}` : undefined,
                      outline: color === c ? `2px solid ${c}` : undefined,
                      outlineOffset: "2px",
                    }}
                    aria-label={`${t("selectColor")} ${c}`}
                    aria-pressed={color === c}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <CategoryIcon icon={icon} name={name} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {name || t("categoryName")}
                </p>
                <p
                  className={`text-xs font-semibold ${selectedType === "expense" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
                >
                  {selectedType === "expense" ? t("expense") : t("income")}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                hasReachedCategoryLimit
                  ? "bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                  : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {isPending ? t("creatingEllipsis") : t("addCategory")}
            </button>
          </form>
        </div>

        {/* Categories list */}
        <div className="space-y-8 lg:col-span-2">
          <CategoryGroup
            type="expense"
            items={expenseCategories}
            onDelete={handleDelete}
            deletingId={deletingId}
            t={t}
          />
          <CategoryGroup
            type="income"
            items={incomeCategories}
            onDelete={handleDelete}
            deletingId={deletingId}
            t={t}
          />
        </div>
      </div>

      {showPaywall && (
        <PaywallModal
          isOpen={showPaywall}
          onClose={() => setShowPaywall(false)}
          title={t("categoryLockedTitle")}
          description={t("categoryLockedDesc")}
          featureLabel={t("category")}
        />
      )}
    </div>
  );
}
