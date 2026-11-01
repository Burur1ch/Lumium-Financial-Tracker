export type ReceiptScanSource = "receipt" | "qr";

export interface ReceiptScanItem {
  name: string;
  price: number;
}

export interface ReceiptScanResult {
  source: ReceiptScanSource;
  amount: number | null;
  currency: string | null;
  date: string | null;
  merchant: string | null;
  items: ReceiptScanItem[];
  rawText: string;
  confidence: number;
}

export type ReceiptExpenseCategoryKey =
  | "groceries"
  | "transport"
  | "housing"
  | "utilities"
  | "health"
  | "shopping"
  | "eating-out"
  | "entertainment"
  | "education"
  | "subscriptions"
  | "other-expense";

const CATEGORY_KEYWORDS: Array<{
  key: ReceiptExpenseCategoryKey;
  words: string[];
}> = [
  {
    key: "health",
    words: [
      "аптек", "лекар", "таблет", "витамин", "шампун", "мыло", "зубн", "pharmacy",
      "medicine", "medical", "vitamin", "toothpaste", "shampoo",
    ],
  },
  {
    key: "transport",
    words: [
      "бензин", "дизел", "топлив", "такси", "проезд", "метро", "билет", "fuel", "diesel",
      "petrol", "gasoline", "taxi", "metro", "bus ticket", "parking",
    ],
  },
  {
    key: "eating-out",
    words: [
      "кафе", "ресторан", "бургер", "пицц", "суши", "кофейня", "латте", "капучино", "cafe",
      "restaurant", "burger", "pizza", "sushi", "latte", "cappuccino",
    ],
  },
  {
    key: "education",
    words: [
      "книг", "учеб", "курс", "тетрад", "канцеляр", "book", "course", "textbook", "notebook",
      "stationery",
    ],
  },
  {
    key: "entertainment",
    words: [
      "кино", "театр", "игр", "боулинг", "музей", "cinema", "movie", "theatre", "game", "museum",
    ],
  },
  {
    key: "utilities",
    words: ["электр", "вода", "газ", "интернет", "телефон", "electricity", "water bill", "internet"],
  },
  {
    key: "housing",
    words: ["аренд", "квартир", "ремонт", "мебел", "rent", "apartment", "furniture", "repair"],
  },
  {
    key: "subscriptions",
    words: ["подписк", "spotify", "netflix", "youtube premium", "subscription"],
  },
  {
    key: "shopping",
    words: [
      "usb", "кабель", "заряд", "телефон", "наушник", "одежд", "футболк", "обув", "носк", "игрушк",
      "батарей", "ламп", "чехол", "cable", "charger", "phone", "headphone", "shirt", "shoes", "socks",
      "toy", "battery", "adapter", "case",
    ],
  },
  {
    key: "groceries",
    words: [
      "молок", "хлеб", "сыр", "масло", "мяс", "куриц", "рыб", "колбас", "яйц", "овощ", "фрукт",
      "яблок", "банан", "картоф", "сок", "вода", "чай", "кофе", "сахар", "рис", "макарон", "йогурт",
      "milk", "bread", "cheese", "butter", "meat", "chicken", "fish", "sausage", "egg", "vegetable",
      "fruit", "apple", "banana", "potato", "juice", "water", "tea", "coffee", "sugar", "rice", "pasta",
      "yogurt", "yoghurt",
    ],
  },
];

export function inferReceiptCategoryKey(value: string): ReceiptExpenseCategoryKey {
  const normalized = value.toLocaleLowerCase().replace(/ё/g, "е");
  return CATEGORY_KEYWORDS.find(({ words }) => words.some((word) => normalized.includes(word)))?.key
    ?? "other-expense";
}

export function allocateReceiptCategorySplits(
  items: ReceiptScanItem[],
  categoryIds: string[],
  total: number,
) {
  const grouped = new Map<string, { sourceAmount: number; names: string[] }>();
  items.forEach((item, index) => {
    const categoryId = categoryIds[index];
    if (!categoryId || !Number.isFinite(item.price) || item.price <= 0) return;
    const group = grouped.get(categoryId) ?? { sourceAmount: 0, names: [] };
    group.sourceAmount += item.price;
    group.names.push(item.name);
    grouped.set(categoryId, group);
  });

  const groups = [...grouped.entries()];
  const sourceTotal = groups.reduce((sum, [, group]) => sum + group.sourceAmount, 0);
  const targetCents = Math.round(total * 100);
  if (groups.length === 0 || sourceTotal <= 0 || targetCents <= 0) return [];

  const allocated = groups.map(([categoryId, group]) => {
    const exactCents = (group.sourceAmount / sourceTotal) * targetCents;
    const cents = Math.floor(exactCents);
    return { categoryId, group, cents, remainder: exactCents - cents };
  });
  let missingCents = targetCents - allocated.reduce((sum, item) => sum + item.cents, 0);
  allocated.sort((left, right) => right.remainder - left.remainder);
  for (let index = 0; missingCents > 0; index = (index + 1) % allocated.length) {
    allocated[index].cents += 1;
    missingCents -= 1;
  }

  return allocated.map(({ categoryId, group, cents }) => ({
    categoryId,
    amount: cents / 100,
    note: group.names.join(", ").slice(0, 500),
  }));
}

const TOTAL_MARKERS = [
  "итог",
  "всего",
  "к оплате",
  "сумма",
  "total",
  "amount due",
  "grand total",
  "summe",
  "gesamt",
  "total ttc",
];

const NON_ITEM_MARKERS = [
  ...TOTAL_MARKERS,
  "ндс",
  "налог",
  "tax",
  "vat",
  "сдача",
  "налич",
  "карта",
  "оплата",
  "кассир",
  "чек",
  "receipt",
  "invoice",
  "скидка",
  "discount",
];

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseMoney(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .replace(/[\s\u00a0]/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/,(?=\d{1,2}$)/, ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

function moneyAtEnd(line: string) {
  const match = line.match(/(?:^|\s)(\d{1,7}(?:[\s.]\d{3})*(?:[,.]\d{2}))\s*(?:BYN|BR|RUB|₽|EUR|€|USD|\$)?\s*$/i);
  return parseMoney(match?.[1]);
}

function toIsoDate(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(value: string) {
  const fiscal = value.match(/(?:^|\D)(20\d{2})(\d{2})(\d{2})T?\d{0,6}(?:\D|$)/i);
  if (fiscal) return toIsoDate(Number(fiscal[1]), Number(fiscal[2]), Number(fiscal[3]));

  const iso = value.match(/(?:^|\D)(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D|$)/);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const local = value.match(/(?:^|\D)(\d{1,2})[./-](\d{1,2})[./-](20\d{2})(?:\D|$)/);
  if (local) return toIsoDate(Number(local[3]), Number(local[2]), Number(local[1]));
  return null;
}

function detectCurrency(text: string) {
  if (/\bBYN\b|\bBR\b/i.test(text)) return "BYN";
  if (/\bRUB\b|₽/i.test(text)) return "RUB";
  if (/\bEUR\b|€/i.test(text)) return "EUR";
  if (/\bUSD\b|\$/i.test(text)) return "USD";
  return null;
}

function findMerchant(lines: string[]) {
  const ignored = [
    ...NON_ITEM_MARKERS,
    "унп",
    "инн",
    "www.",
    "http",
    "добро пожаловать",
    "спасибо",
    "магазин №",
  ];
  return (
    lines.slice(0, 12).find((line) => {
      const lower = line.toLowerCase();
      const letters = line.match(/[\p{L}]/gu)?.length ?? 0;
      return letters >= 3 && line.length <= 80 && !ignored.some((marker) => lower.includes(marker));
    }) ?? null
  );
}

function findTotal(lines: string[]) {
  for (const line of [...lines].reverse()) {
    const lower = line.toLowerCase();
    if (!TOTAL_MARKERS.some((marker) => lower.includes(marker))) continue;
    const values = [...line.matchAll(/\d{1,7}(?:[\s.]\d{3})*(?:[,.]\d{2})/g)]
      .map((match) => parseMoney(match[0]))
      .filter((value): value is number => value !== null);
    if (values.length) return Math.max(...values);
  }

  const fallback = lines
    .map(moneyAtEnd)
    .filter((value): value is number => value !== null);
  return fallback.length ? Math.max(...fallback) : null;
}

function findItems(lines: string[]) {
  const items: ReceiptScanItem[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (NON_ITEM_MARKERS.some((marker) => lower.includes(marker))) continue;
    const price = moneyAtEnd(line);
    if (price === null) continue;
    const name = normalizeLine(
      line
        .replace(/\d{1,7}(?:[\s.]\d{3})*(?:[,.]\d{2})\s*(?:BYN|BR|RUB|₽|EUR|€|USD|\$)?\s*$/i, "")
        .replace(/^\d+[.)-]?\s*/, ""),
    );
    const letters = name.match(/[\p{L}]/gu)?.length ?? 0;
    if (letters < 2 || name.length > 90) continue;
    items.push({ name, price });
    if (items.length === 30) break;
  }
  return items;
}

export function parseReceiptText(rawText: string, confidence = 0): ReceiptScanResult {
  const lines = rawText.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  return {
    source: "receipt",
    amount: findTotal(lines),
    currency: detectCurrency(rawText),
    date: lines.map(parseDate).find((value): value is string => Boolean(value)) ?? null,
    merchant: findMerchant(lines),
    items: findItems(lines),
    rawText: rawText.trim(),
    confidence: Math.max(0, Math.min(1, confidence / 100)),
  };
}

function getQrParams(rawText: string) {
  const trimmed = rawText.trim();
  try {
    const url = new URL(trimmed);
    return { params: url.searchParams, host: url.hostname.replace(/^www\./, "") };
  } catch {
    const query = trimmed.includes("?") ? trimmed.slice(trimmed.indexOf("?") + 1) : trimmed;
    return { params: new URLSearchParams(query.replace(/;/g, "&")), host: null };
  }
}

function firstParam(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key) ?? params.get(key.toUpperCase());
    if (value) return value;
  }
  return null;
}

export function parseReceiptQr(rawText: string): ReceiptScanResult {
  let json: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) json = parsed as Record<string, unknown>;
  } catch {
    json = null;
  }

  const { params, host } = getQrParams(rawText);
  const jsonAmount = json?.amount ?? json?.sum ?? json?.total;
  const amount = parseMoney(
    typeof jsonAmount === "number" || typeof jsonAmount === "string"
      ? String(jsonAmount)
      : firstParam(params, ["s", "sum", "total", "amount"]),
  );
  const dateValue = String(json?.date ?? json?.time ?? firstParam(params, ["t", "date", "time", "dt"]) ?? rawText);
  const merchantValue = json?.merchant ?? json?.seller ?? json?.name ?? firstParam(params, ["merchant", "seller", "name"]);
  const merchant = typeof merchantValue === "string" && merchantValue.trim()
    ? merchantValue.trim()
    : host;

  return {
    source: "qr",
    amount,
    currency: detectCurrency(rawText),
    date: parseDate(dateValue),
    merchant,
    items: [],
    rawText: rawText.trim(),
    confidence: 1,
  };
}
