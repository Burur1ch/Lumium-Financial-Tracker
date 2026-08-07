"use client";

import React, { useEffect, useState, useTransition } from "react";
import { getCategories, createCategory, deleteCategory } from "../actions";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/store/translations";
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
  type LucideIcon,
} from "lucide-react";

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

export function CategoryIcon({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  const Icon = (icon && ICON_MAP[icon]) || Tag;
  return <Icon className={className ?? "w-4 h-4"} />;
}

interface Category {
  id: string;
  name: string;
  type: "expense" | "income";
  color: string;
  icon?: string | null;
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
  "#14B8A6",
  "#F43F5E",
  "#84CC16",
  "#A855F7",
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
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
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
              className="group flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${cat.color}20`,
                    color: cat.color,
                  }}
                >
                  <CategoryIcon icon={cat.icon} />
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {cat.type === "expense" ? t("expense") : t("income")}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onDelete(cat.id)}
                disabled={deletingId === cat.id}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-150 shrink-0 disabled:opacity-30"
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

  useEffect(() => {
    getCategories().then((data) => setCategories(data as Category[]));
  }, []);

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
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
    <div className="p-4 md:p-8 space-y-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t("categories")}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-1">
            {t("manageCategoriesDesc")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
          <Shapes className="w-4 h-4" />
          {categories.length} total
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm h-fit space-y-5">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t("createCategory")}
          </h3>

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
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  selectedType === "expense"
                    ? "bg-white dark:bg-slate-800 text-red-500 shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                }`}
              >
                <TrendingDown className="w-3 h-3" /> {t("expense")}
              </button>
              <button
                type="button"
                onClick={() => setSelectedType("income")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  selectedType === "income"
                    ? "bg-white dark:bg-slate-800 text-emerald-500 shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                }`}
              >
                <TrendingUp className="w-3 h-3" /> {t("income")}
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
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
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                {t("selectIcon")}
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {ICON_KEYS.map((key) => {
                  const Icon = ICON_MAP[key];
                  const selected = icon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIcon(key)}
                      title={key}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        selected
                          ? "text-white shadow-sm"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                      style={selected ? { backgroundColor: color } : undefined}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color presets */}
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
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
                <CategoryIcon icon={icon} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {name || "Category name"}
                </p>
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider ${selectedType === "expense" ? "text-red-500" : "text-emerald-500"}`}
                >
                  {selectedType}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
        <div className="lg:col-span-2 space-y-8">
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
    </div>
  );
}
