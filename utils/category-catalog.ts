import { translations, type TranslationKey } from "@/store/translations";

export interface CategoryLike {
  id: string;
  name: string;
  type?: string;
  system_key?: string | null;
  parent_id?: string | null;
  is_archived?: boolean;
  sort_order?: number;
  color?: string;
  icon?: string | null;
  parent_name?: string | null;
  parent_system_key?: string | null;
}

// Labels live in translations.ts; identifiers never depend on the UI language.
export const CATEGORY_CATALOG = [
  [
    "groceries",
    "shoppingCart",
    "#24845C",
    false,
    ["milk", "meat-fish", "produce", "bread", "drinks", "pantry"],
  ],
  [
    "transport",
    "bus",
    "#3478C8",
    false,
    ["public", "taxi", "fuel", "car-service"],
  ],
  [
    "housing",
    "home",
    "#9A6A3A",
    false,
    ["rent", "repairs", "furniture", "household"],
  ],
  [
    "utilities",
    "zap",
    "#EAB308",
    false,
    ["electricity", "water", "heating", "internet", "mobile"],
  ],
  [
    "health",
    "stethoscope",
    "#D92D3A",
    false,
    ["medicine", "doctors", "dental", "tests"],
  ],
  [
    "shopping",
    "shoppingBag",
    "#EC4899",
    false,
    ["clothes", "shoes", "electronics"],
  ],
  [
    "eating-out",
    "utensils",
    "#F97316",
    false,
    ["coffee", "restaurants", "delivery"],
  ],
  [
    "entertainment",
    "gamepad",
    "#287D91",
    false,
    ["cinema", "events", "games", "hobbies"],
  ],
  ["education", "book", "#06B6D4", false, ["courses", "books", "tuition"]],
  [
    "subscriptions",
    "creditCard",
    "#64748B",
    false,
    ["video", "music", "software", "cloud"],
  ],
  ["other-expense", "tag", "#737373", false, []],
  [
    "children",
    "heart",
    "#EC4899",
    true,
    ["childcare", "food", "clothes", "toys"],
  ],
  ["pets", "heart", "#9A6A3A", true, ["food", "vet", "care"]],
  ["travel", "plane", "#3478C8", true, ["tickets", "stays", "activities"]],
  [
    "sport",
    "dumbbell",
    "#24845C",
    true,
    ["membership", "training", "equipment"],
  ],
  ["personal-care", "heart", "#EC4899", true, ["hair", "cosmetics", "hygiene"]],
  ["gifts-charity", "gift", "#F97316", true, ["gifts", "donations"]],
  ["taxes-fees", "banknote", "#64748B", true, ["taxes", "bank", "government"]],
  ["insurance", "shield", "#287D91", true, ["car", "home", "health"]],
  ["salary", "wallet", "#24845C", false, ["base", "bonus"]],
  ["freelance", "briefcase", "#3478C8", false, ["projects", "consulting"]],
  ["other-income", "banknote", "#14B8A6", false, []],
  ["benefits", "wallet", "#24845C", true, ["allowances", "pension"]],
  ["rental-income", "home", "#9A6A3A", true, []],
  ["investment-income", "banknote", "#3478C8", true, ["interest", "dividends"]],
  ["cash-gifts", "gift", "#EC4899", true, []],
] as const;

export const INCOME_CATEGORY_KEYS = new Set([
  "salary",
  "freelance",
  "other-income",
  "benefits",
  "rental-income",
  "investment-income",
  "cash-gifts",
]);
export const categoryTranslationKey = (key: string) =>
  `cat_${key.replaceAll("/", "_").replaceAll("-", "_")}` as TranslationKey;

export function categoryLabel(
  category: Pick<CategoryLike, "name" | "system_key">,
  t: (key: TranslationKey) => string,
) {
  const key = category.system_key
    ? categoryTranslationKey(category.system_key)
    : null;
  return key &&
    (category.name === translations.en[key] ||
      (category.system_key === "utilities" && category.name === "Utilities"))
    ? t(key)
    : category.name;
}

export function categoryHasName(
  category: Pick<CategoryLike, "name" | "system_key">,
  name: string,
) {
  const normalized = name.trim().toLowerCase();
  if (category.name.trim().toLowerCase() === normalized) return true;
  if (!category.system_key) return false;
  const key = categoryTranslationKey(category.system_key);
  if (
    category.name !== translations.en[key] &&
    !(category.system_key === "utilities" && category.name === "Utilities")
  )
    return false;
  return Object.values(translations).some(
    (dictionary) =>
      (dictionary as Record<string, string>)[key]?.trim().toLowerCase() ===
      normalized,
  );
}

export function displayCategory<T extends CategoryLike>(
  category: T,
  all: CategoryLike[],
) {
  const parent = all.find((item) => item.id === category.parent_id);
  return {
    ...category,
    parent_name: parent?.name ?? null,
    parent_system_key: parent?.system_key ?? null,
  };
}

export function categoryDisplayLabel(
  category: Omit<CategoryLike, "id">,
  t: (key: TranslationKey) => string,
) {
  const label = categoryLabel(category, t);
  return category.parent_name
    ? `${categoryLabel({ name: category.parent_name, system_key: category.parent_system_key }, t)} / ${label}`
    : label;
}

export function categoryPath(
  category: CategoryLike,
  all: CategoryLike[],
  t: (key: TranslationKey) => string,
) {
  const parent = all.find((item) => item.id === category.parent_id);
  return parent
    ? `${categoryLabel(parent, t)} / ${categoryLabel(category, t)}`
    : categoryLabel(category, t);
}

export function isCategoryArchived(
  category: CategoryLike,
  all: CategoryLike[],
) {
  return Boolean(
    category.is_archived ||
      all.find((item) => item.id === category.parent_id)?.is_archived,
  );
}

export function categorySelectionIds(id: string, all: CategoryLike[]) {
  return new Set([
    id,
    ...all.filter((item) => item.parent_id === id).map((item) => item.id),
  ]);
}
