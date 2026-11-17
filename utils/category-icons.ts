import { CATEGORY_CATALOG } from "./category-catalog";

interface CategoryIcon {
  key: string;
  color: string;
  asset?: string;
}

const ROOT_ICONS: Record<string, CategoryIcon> = {
  groceries: { key: "shoppingCart", asset: "groceries", color: "#24845C" },
  transport: { key: "bus", asset: "transport", color: "#3478C8" },
  housing: { key: "home", asset: "housing", color: "#9A6A3A" },
  utilities: { key: "zap", asset: "utilities", color: "#B8791D" },
  health: { key: "stethoscope", asset: "health", color: "#D92D3A" },
  shopping: { key: "shoppingBag", asset: "shopping", color: "#EC4899" },
  "eating-out": { key: "utensils", asset: "dining", color: "#F97316" },
  entertainment: { key: "gamepad", asset: "entertainment", color: "#287D91" },
  education: { key: "book", asset: "education", color: "#06B6D4" },
  subscriptions: {
    key: "creditCard",
    asset: "subscriptions",
    color: "#64748B",
  },
  "other-expense": { key: "tag", color: "#737373" },
  children: { key: "baby", color: "#C03D76" },
  pets: { key: "pawPrint", color: "#9A6A3A" },
  travel: { key: "plane", asset: "travel", color: "#3478C8" },
  sport: { key: "dumbbell", color: "#24845C" },
  "personal-care": { key: "sparkles", color: "#C03D76" },
  "gifts-charity": { key: "gift", asset: "gifts", color: "#F97316" },
  "taxes-fees": { key: "landmark", color: "#64748B" },
  insurance: { key: "shield", color: "#287D91" },
  salary: { key: "banknote", asset: "salary", color: "#24845C" },
  freelance: { key: "briefcase", color: "#3478C8" },
  "other-income": { key: "banknote", color: "#14B8A6" },
  benefits: { key: "handCoins", color: "#24845C" },
  "rental-income": { key: "home", asset: "housing", color: "#9A6A3A" },
  "investment-income": { key: "landmark", color: "#3478C8" },
  "cash-gifts": { key: "gift", asset: "gifts", color: "#C03D76" },
};

const ICON_ALIASES: Record<string, string> = {
  "shopping-cart": "shoppingCart",
  "shopping-basket": "shoppingCart",
  shopping: "shoppingCart",
  "shopping-bag": "shoppingBag",
  "credit-card": "creditCard",
  "graduation-cap": "graduationCap",
  "paw-print": "pawPrint",
  "heart-pulse": "stethoscope",
  house: "home",
  other: "tag",
};

const ICONS: Record<string, CategoryIcon> = {
  shoppingCart: ROOT_ICONS.groceries,
  shoppingBag: ROOT_ICONS.shopping,
  bus: ROOT_ICONS.transport,
  home: ROOT_ICONS.housing,
  zap: ROOT_ICONS.utilities,
  stethoscope: ROOT_ICONS.health,
  gamepad: ROOT_ICONS.entertainment,
  book: ROOT_ICONS.education,
  graduationCap: ROOT_ICONS.education,
  creditCard: ROOT_ICONS.subscriptions,
  plane: ROOT_ICONS.travel,
  gift: ROOT_ICONS["gifts-charity"],
  banknote: ROOT_ICONS.salary,
  briefcase: ROOT_ICONS.freelance,
  dumbbell: ROOT_ICONS.sport,
  shield: ROOT_ICONS.insurance,
  baby: ROOT_ICONS.children,
  pawPrint: ROOT_ICONS.pets,
  sparkles: ROOT_ICONS["personal-care"],
  coffee: { key: "coffee", asset: "coffee", color: "#9A6A3A" },
  pharmacy: { key: "pill", asset: "pharmacy", color: "#D92D3A" },
  wallet: { key: "wallet", color: "#24845C" },
  savings: { key: "piggyBank", asset: "savings", color: "#24845C" },
  train: { key: "train", color: "#3478C8" },
  car: { key: "car", color: "#3478C8" },
  fuel: { key: "fuel", color: "#B8791D" },
  heart: { key: "heart", color: "#D92D3A" },
  tag: ROOT_ICONS["other-expense"],
  utensils: ROOT_ICONS["eating-out"],
  pizza: { key: "pizza", color: "#F97316" },
  wine: { key: "wine", color: "#C03D76" },
  wifi: { key: "wifi", color: "#3478C8" },
  phone: { key: "phone", color: "#3478C8" },
  wrench: { key: "wrench", color: "#9A6A3A" },
  music: { key: "music", color: "#287D91" },
  tv: { key: "tv", color: "#287D91" },
  milk: { key: "milk", color: "#24845C" },
  fish: { key: "fish", color: "#24845C" },
  apple: { key: "apple", color: "#24845C" },
  bread: { key: "bread", color: "#9A6A3A" },
  cup: { key: "cup", color: "#3478C8" },
  spray: { key: "spray", color: "#3478C8" },
  armchair: { key: "armchair", color: "#9A6A3A" },
  pill: { key: "pill", asset: "pharmacy", color: "#D92D3A" },
  shirt: { key: "shirt", color: "#C03D76" },
  shoe: { key: "shoe", color: "#9A6A3A" },
  headphones: { key: "headphones", color: "#287D91" },
  handCoins: ROOT_ICONS.benefits,
  landmark: ROOT_ICONS["taxes-fees"],
  piggyBank: { key: "piggyBank", asset: "savings", color: "#24845C" },
  receipt: { key: "receipt", color: "#D92D3A" },
  qrCode: { key: "qrCode", color: "#3478C8" },
  manual: { key: "manual", color: "#24845C" },
  expense: { key: "expense", color: "#D92D3A" },
  income: { key: "income", color: "#24845C" },
};

const CHILD_ICONS: Record<string, string> = {
  "groceries/milk": "milk",
  "groceries/meat-fish": "fish",
  "groceries/produce": "apple",
  "groceries/bread": "bread",
  "groceries/drinks": "cup",
  "transport/public": "bus",
  "transport/taxi": "car",
  "transport/fuel": "fuel",
  "transport/car-service": "wrench",
  "housing/household": "spray",
  "housing/repairs": "wrench",
  "housing/furniture": "armchair",
  "utilities/internet": "wifi",
  "utilities/mobile": "phone",
  "health/medicine": "pill",
  "shopping/clothes": "shirt",
  "shopping/shoes": "shoe",
  "shopping/electronics": "headphones",
  "eating-out/coffee": "coffee",
  "subscriptions/music": "music",
  "subscriptions/video": "tv",
};

const NAME_ICONS: Array<[RegExp, string]> = [
  [/аптек|лекар|pharmacy|medicine|apotheke|pharmacie/i, "pharmacy"],
  [/питом|кошк|собак|pets?\b|haustier|animaux/i, "pawPrint"],
  [/дети|детск|children|kinder|enfants/i, "baby"],
  [/спорт|фитнес|sport|fitness/i, "dumbbell"],
  [/страхован|insurance|versicherung|assurance/i, "shield"],
  [/космет|уход|personal care|kosmetik|soins/i, "sparkles"],
  [/продукт|grocer|lebensmittel|courses/i, "shoppingCart"],
  [/транспорт|автобус|transport|verkehr/i, "bus"],
  [/кофе|coffee|café|kaffee/i, "coffee"],
  [/кафе|ресторан|dining|restaurant|repas/i, "utensils"],
  [/жиль|аренд|housing|rent|miete|logement/i, "home"],
  [/коммун|utilities|electric|nebenkosten/i, "zap"],
  [/здоров|health|gesund|santé/i, "stethoscope"],
  [/покуп|shopping|einkauf|achats/i, "shoppingBag"],
  [/развлеч|entertainment|unterhaltung|loisir/i, "gamepad"],
  [/подпис|subscription|abonnement/i, "creditCard"],
  [/образован|education|bildung|éducation/i, "book"],
  [/путеше|travel|reise|voyage/i, "plane"],
  [/зарплат|salary|gehalt|salaire/i, "banknote"],
  [/подар|gift|geschenk|cadeau/i, "gift"],
  [/накоп|сбереж|savings|erspar|épargne/i, "savings"],
];

export function resolveCategoryIcon(
  icon?: string | null,
  name?: string | null,
  systemKey?: string | null,
): CategoryIcon | null {
  const rootKey = systemKey?.split("/")[0];
  const root = rootKey ? ROOT_ICONS[rootKey] : undefined;
  const catalogIcon = CATEGORY_CATALOG.find((row) => row[0] === rootKey)?.[1];
  const explicitKey = icon ? (ICON_ALIASES[icon] ?? icon) : null;
  const explicit = explicitKey ? ICONS[explicitKey] : undefined;
  if (root && (!icon || icon === catalogIcon)) {
    const child = systemKey ? CHILD_ICONS[systemKey] : undefined;
    return child
      ? {
          key: child,
          color: root.color,
          asset: ICONS[child]?.asset,
        }
      : root;
  }
  if (explicit) return explicit;
  const inferred = NAME_ICONS.find(([pattern]) =>
    pattern.test(name?.trim() ?? ""),
  );
  return inferred ? ICONS[inferred[1]] : icon ? ICONS.tag : null;
}
