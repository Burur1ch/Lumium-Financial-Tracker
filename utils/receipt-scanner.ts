export type ReceiptScanSource = "receipt" | "qr";

export interface ReceiptScanItem {
  name: string;
  price: number;
  quantity?: number;
  unitPrice?: number;
  confidence?: number;
  categoryKey?: ReceiptExpenseCategoryKey;
  categoryConfidence?: number;
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

export interface ReceiptCategoryInference {
  key: ReceiptExpenseCategoryKey;
  confidence: number;
  matched: string[];
}

const CATEGORY_RULES: Array<{
  key: ReceiptExpenseCategoryKey;
  phrases?: string[];
  roots: string[];
}> = [
  {
    key: "health",
    phrases: ["медицинские услуги", "зубная паста", "medical service"],
    roots: [
      "аптек", "лекар", "таблет", "витамин", "шампун", "гигиен", "стоматолог", "антисепт",
      "pharmacy", "medicine", "medical", "vitamin", "toothpaste", "shampoo", "clinic",
    ],
  },
  {
    key: "transport",
    phrases: ["проездной билет", "bus ticket", "train ticket", "fuel station"],
    roots: [
      "бензин", "дизел", "топлив", "такси", "проезд", "метро", "автобус", "парковк", "fuel",
      "diesel", "petrol", "gasoline", "taxi", "metro", "parking", "uber", "yandex go",
    ],
  },
  {
    key: "eating-out",
    phrases: ["готовое блюдо", "business lunch", "fast food"],
    roots: [
      "кафе", "ресторан", "бургер", "пицц", "суши", "кофейня", "латте", "капучино", "шаурм",
      "cafe", "restaurant", "burger", "pizza", "sushi", "latte", "cappuccino", "mcdonald",
    ],
  },
  {
    key: "education",
    phrases: ["онлайн курс", "школьные товары", "online course"],
    roots: [
      "книг", "учеб", "курс", "тетрад", "канцеляр", "ручка", "карандаш", "book", "course",
      "textbook", "notebook", "stationery", "pencil",
    ],
  },
  {
    key: "entertainment",
    phrases: ["входной билет", "concert ticket", "movie ticket"],
    roots: [
      "кино", "театр", "боулинг", "музей", "концерт", "аттракцион", "cinema", "movie", "theatre",
      "game", "museum", "concert",
    ],
  },
  {
    key: "utilities",
    phrases: [
      "коммунальные услуги", "мобильная связь", "домашний интернет", "water bill", "electricity bill",
      "mobile service",
    ],
    roots: ["коммун", "водоканал", "водоснаб", "электроэнерг", "газоснаб", "internet provider", "utility"],
  },
  {
    key: "housing",
    phrases: ["аренда квартиры", "home repair"],
    roots: ["аренд", "квартир", "ремонт", "мебел", "стройматериал", "rent", "apartment", "furniture", "repair"],
  },
  {
    key: "subscriptions",
    phrases: ["youtube premium", "apple music", "cloud storage"],
    roots: ["подписк", "spotify", "netflix", "subscription", "kinopoisk", "ivi.ru"],
  },
  {
    key: "shopping",
    phrases: ["usb cable", "защитное стекло", "бытовая химия", "стиральный порошок"],
    roots: [
      "usb", "кабель", "заряд", "телефон", "смартфон", "наушник", "одежд", "футболк", "обув", "носк",
      "игрушк", "батарей", "ламп", "чехол", "порошок", "салфет", "губк", "пакет мусор", "cable",
      "charger", "phone", "headphone", "shirt", "shoes", "socks", "toy", "battery", "adapter", "case",
      "detergent",
    ],
  },
  {
    key: "groceries",
    phrases: ["детское питание", "питьевая вода", "минеральная вода", "baby food", "mineral water"],
    roots: [
      "молок", "хлеб", "сыр", "масло", "мяс", "куриц", "рыб", "колбас", "яйц", "овощ", "фрукт",
      "яблок", "банан", "картоф", "сок", "вода", "чай", "кофе", "сахар", "рис", "макарон", "йогурт",
      "кефир", "творог", "сметан", "печень", "конфет", "шоколад", "круп", "мука", "хлопья", "milk",
      "bread", "cheese", "butter", "meat", "chicken", "fish", "sausage", "egg", "vegetable", "fruit",
      "apple", "banana", "potato", "juice", "water", "tea", "coffee", "sugar", "rice", "pasta", "yogurt",
      "yoghurt", "cereal", "flour", "chocolate",
    ],
  },
];

function normalizeCategoryText(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferReceiptCategory(value: string): ReceiptCategoryInference {
  const normalized = normalizeCategoryText(value);
  let best: ReceiptCategoryInference = { key: "other-expense", confidence: 0.25, matched: [] };
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    const matched = [
      ...(rule.phrases ?? []).filter((phrase) => normalized.includes(phrase)),
      ...rule.roots.filter((root) => normalized.includes(root)),
    ];
    const score = matched.reduce((sum, match) =>
      sum + (match.includes(" ") ? 5 : Math.min(4, Math.max(2, Math.floor(match.length / 3)))), 0);
    if (score > bestScore) {
      bestScore = score;
      best = {
        key: rule.key,
        confidence: Math.min(0.97, 0.58 + score * 0.06),
        matched,
      };
    }
  }
  return best;
}

export function inferReceiptCategoryKey(value: string): ReceiptExpenseCategoryKey {
  return inferReceiptCategory(value).key;
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
  "итого",
  "всего",
  "к оплате",
  "оплате",
  "сумма",
  "total",
  "t0tal",
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
  "бонус",
  "кассовый чек",
  "фискальный",
  "subtotal",
  "подытог",
];

function normalizeLine(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoney(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .replace(/[OoОо]/g, "0")
    .replace(/[IlІ|]/g, "1")
    .replace(/[\s\u00a0]/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/\.(?=.*\.)/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

const MONEY_TOKEN = "[0-9OoОоIlІ|]{1,7}\\s*[,.]\\s*[0-9OoОоIlІ|]{1,2}";
const CURRENCY_TOKEN = "(?:BYN|BR|RUB|₽|EUR|€|USD|\\$)";

function moneyAtEnd(line: string) {
  const pattern = new RegExp(`(${MONEY_TOKEN})\\s*${CURRENCY_TOKEN}?\\s*$`, "iu");
  const match = pattern.exec(line);
  const amount = parseMoney(match?.[1]);
  return amount === null || !match
    ? null
    : { amount, index: match.index, raw: match[0] };
}

function moneyValues(line: string) {
  const pattern = new RegExp(MONEY_TOKEN, "giu");
  return [...line.matchAll(pattern)]
    .map((match) => parseMoney(match[0]))
    .filter((value): value is number => value !== null);
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

function isReceiptMetaLine(line: string) {
  const lower = line.toLocaleLowerCase().replace(/ё/g, "е");
  return (
    NON_ITEM_MARKERS.some((marker) => lower.includes(marker)) ||
    Boolean(parseDate(line)) ||
    /(?:^|\s)(?:унп|инн|кпп|бик|р\/с|кассир|смена|касса|чек\s*№|receipt\s*#)/iu.test(lower) ||
    /(?:https?:\/\/|www\.|@|\+?\d[\d\s()-]{7,})/iu.test(line) ||
    /^[-=*#_\s]{3,}$/.test(line)
  );
}

function readableItemName(value: string) {
  let name = normalizeLine(value)
    .replace(/\b\d{8,14}\b/g, " ")
    .replace(/^\s*\d{1,3}[.)-]\s*/, "")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:шт|pcs|pc|кг|kg|гр|g|л|l|мл|ml)\b/giu, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%+./()-]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return "";

  const letters = name.match(/[\p{L}]/gu) ?? [];
  const upper = name.match(/[\p{Lu}]/gu) ?? [];
  if (letters.length >= 4 && upper.length / letters.length > 0.82) {
    name = name
      .split(" ")
      .map((word) => {
        if (/^[A-ZА-ЯЁ0-9-]{2,4}$/u.test(word)) return word;
        const lowered = word.toLocaleLowerCase();
        return lowered.charAt(0).toLocaleUpperCase() + lowered.slice(1);
      })
      .join(" ");
  }
  return name;
}

function quantityDetails(line: string) {
  const pattern = new RegExp(`(\\d+(?:[,.]\\d+)?)\\s*(?:x|х|×|\\*)\\s*(${MONEY_TOKEN})`, "iu");
  const match = pattern.exec(line);
  const quantity = match ? Number(match[1].replace(",", ".")) : NaN;
  const unitPrice = parseMoney(match?.[2]);
  return {
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
    unitPrice: unitPrice ?? undefined,
    expression: match?.[0] ?? null,
  };
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
      return (
        letters >= 3 &&
        line.length <= 80 &&
        !isReceiptMetaLine(line) &&
        !ignored.some((marker) => lower.includes(marker)) &&
        !moneyAtEnd(line)
      );
    }) ?? null
  );
}

function findTotal(lines: string[], items: ReceiptScanItem[]) {
  for (const line of [...lines].reverse()) {
    const lower = line.toLowerCase();
    if (!TOTAL_MARKERS.some((marker) => lower.includes(marker))) continue;
    const values = moneyValues(line);
    if (values.length) return Math.max(...values);
  }

  const itemTotal = items.reduce((sum, item) => sum + item.price, 0);
  if (itemTotal > 0) return Math.round(itemTotal * 100) / 100;

  const fallback = lines.flatMap((line) => moneyAtEnd(line)?.amount ?? []);
  return fallback.length ? Math.max(...fallback) : null;
}

function findItems(lines: string[], receiptConfidence: number) {
  const items: ReceiptScanItem[] = [];
  let pendingName: string | null = null;
  for (const line of lines) {
    if (isReceiptMetaLine(line)) {
      pendingName = null;
      continue;
    }

    const priceMatch = moneyAtEnd(line);
    if (!priceMatch) {
      const candidate = readableItemName(line);
      const letters = candidate.match(/[\p{L}]/gu)?.length ?? 0;
      pendingName = letters >= 2 && candidate.length <= 100 ? candidate : null;
      continue;
    }

    const beforePrice = line.slice(0, priceMatch.index);
    const quantity = quantityDetails(beforePrice);
    const withoutQuantity = quantity.expression
      ? beforePrice.replace(quantity.expression, " ")
      : beforePrice;
    let name = readableItemName(withoutQuantity);
    let usedWrappedName = false;
    if ((name.match(/[\p{L}]/gu)?.length ?? 0) < 2 && pendingName) {
      name = pendingName;
      usedWrappedName = true;
    }
    pendingName = null;

    const letters = name.match(/[\p{L}]/gu)?.length ?? 0;
    if (letters < 2 || name.length > 100) continue;
    items.push({
      name,
      price: priceMatch.amount,
      quantity: quantity.quantity,
      unitPrice: quantity.unitPrice,
      confidence: Math.max(
        0.25,
        Math.min(receiptConfidence / 100, usedWrappedName ? 0.78 : 0.94),
      ),
    });
    if (items.length === 30) break;
  }
  return items;
}

export function parseReceiptText(rawText: string, confidence = 0): ReceiptScanResult {
  const lines = rawText.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const items = findItems(lines, confidence);
  return {
    source: "receipt",
    amount: findTotal(lines, items),
    currency: detectCurrency(rawText),
    date: lines.map(parseDate).find((value): value is string => Boolean(value)) ?? null,
    merchant: findMerchant(lines),
    items,
    rawText: rawText.trim(),
    confidence: Math.max(0, Math.min(1, confidence / 100)),
  };
}

function receiptResultScore(result: ReceiptScanResult) {
  const itemTotal = result.items.reduce((sum, item) => sum + item.price, 0);
  const totalAgreement = result.amount && itemTotal
    ? Math.max(0, 1 - Math.abs(result.amount - itemTotal) / result.amount)
    : 0;
  return (
    (result.amount ? 4 : 0) +
    (result.merchant ? 1 : 0) +
    (result.date ? 1 : 0) +
    Math.min(6, result.items.length * 1.4) +
    totalAgreement * 3 +
    result.confidence * 2
  );
}

export function receiptRecognitionNeedsRetry(result: ReceiptScanResult) {
  const itemTotal = result.items.reduce((sum, item) => sum + item.price, 0);
  const mismatch = result.amount && itemTotal
    ? Math.abs(result.amount - itemTotal) / result.amount
    : 1;
  return (
    result.amount === null ||
    result.items.length === 0 ||
    result.confidence < 0.6 ||
    mismatch > 0.35
  );
}

export function chooseBestReceiptResult(results: ReceiptScanResult[]) {
  const ranked = [...results].sort((left, right) => receiptResultScore(right) - receiptResultScore(left));
  const best = ranked[0];
  if (!best) return parseReceiptText("");
  return {
    ...best,
    amount: best.amount ?? ranked.find((result) => result.amount)?.amount ?? null,
    date: best.date ?? ranked.find((result) => result.date)?.date ?? null,
    merchant: best.merchant ?? ranked.find((result) => result.merchant)?.merchant ?? null,
    confidence: Math.max(...ranked.map((result) => result.confidence)),
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
