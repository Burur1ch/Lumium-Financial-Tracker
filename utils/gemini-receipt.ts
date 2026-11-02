import "server-only";

import type {
  ReceiptExpenseCategoryKey,
  ReceiptScanItem,
  ReceiptScanResult,
} from "@/utils/receipt-scanner";

const RECEIPT_CATEGORY_KEYS = [
  "groceries",
  "transport",
  "housing",
  "utilities",
  "health",
  "shopping",
  "eating-out",
  "entertainment",
  "education",
  "subscriptions",
  "other-expense",
] as const satisfies readonly ReceiptExpenseCategoryKey[];

const RECEIPT_CATEGORY_SET = new Set<string>(RECEIPT_CATEGORY_KEYS);

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    amount: {
      type: "NUMBER",
      nullable: true,
      description: "The final amount actually paid, not a subtotal or change.",
    },
    currency: {
      type: "STRING",
      nullable: true,
      description: "ISO 4217 currency code such as BYN, RUB, USD, or EUR.",
    },
    date: {
      type: "STRING",
      nullable: true,
      description: "Receipt date in YYYY-MM-DD format.",
    },
    merchant: {
      type: "STRING",
      nullable: true,
      description: "Readable merchant or store name.",
    },
    items: {
      type: "ARRAY",
      maxItems: 30,
      items: {
        type: "OBJECT",
        properties: {
          name: {
            type: "STRING",
            description: "Readable product name preserving brand, variant, and package size when visible.",
          },
          price: {
            type: "NUMBER",
            description: "Final line total for this item after quantity and item discount.",
          },
          quantity: { type: "NUMBER", nullable: true },
          unitPrice: { type: "NUMBER", nullable: true },
          confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
          categoryKey: {
            type: "STRING",
            enum: RECEIPT_CATEGORY_KEYS,
          },
          categoryConfidence: { type: "NUMBER", minimum: 0, maximum: 1 },
        },
        required: [
          "name",
          "price",
          "quantity",
          "unitPrice",
          "confidence",
          "categoryKey",
          "categoryConfidence",
        ],
      },
    },
    rawText: {
      type: "STRING",
      description: "Clean transcription of meaningful receipt lines in their visual order.",
    },
    confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
  },
  required: [
    "amount",
    "currency",
    "date",
    "merchant",
    "items",
    "rawText",
    "confidence",
  ],
} as const;

const RECEIPT_PROMPT = `You are a precise receipt extraction system for a personal finance app.

Read the receipt image directly. Return only the JSON requested by the schema.

Rules:
- Extract only products or services that were actually purchased. Exclude totals, subtotals, taxes, payment method, loyalty points, cash, change, fiscal identifiers, discounts as separate rows, and advertising.
- Keep every distinct purchased line. The item price is the final line total after quantity and line discount, not the unit price.
- Produce clear item names in the receipt language. Fix obvious OCR spacing or character mistakes, but never invent an unreadable brand or product.
- Preserve useful details such as brand, fat percentage, weight, volume, flavor, and model when visible.
- Use the final amount paid for amount. Use a three-letter ISO currency code when visible or strongly implied.
- categoryKey must be exactly one of the allowed values:
  groceries = food, drinks, and supermarket groceries;
  transport = fuel, public transport, taxi, parking;
  housing = rent, furniture, home repair and materials;
  utilities = electricity, water, gas, internet and phone service;
  health = pharmacy, medicine, personal care and medical services;
  shopping = clothes, electronics, household goods and general retail;
  eating-out = restaurants, cafes, takeaway and prepared meals;
  entertainment = cinema, games, concerts and attractions;
  education = books, courses and stationery;
  subscriptions = recurring digital or membership services;
  other-expense = only when none of the above fits.
- Confidence values are from 0 to 1. Lower them when text or prices are genuinely unclear.
- If a scalar field is not visible, return null. If no real items are readable, return an empty items array.`;

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

function clampConfidence(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

function cleanCurrency(value: unknown) {
  if (typeof value !== "string") return null;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function cleanItem(value: unknown): ReceiptScanItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const name = cleanText(item.name, 100);
  const price = positiveNumber(item.price);
  if (!name || price === null) return null;

  const categoryKey = RECEIPT_CATEGORY_SET.has(String(item.categoryKey))
    ? (item.categoryKey as ReceiptExpenseCategoryKey)
    : "other-expense";
  const quantity = positiveNumber(item.quantity);
  const unitPrice = positiveNumber(item.unitPrice);

  return {
    name,
    price: Math.round(price * 100) / 100,
    quantity: quantity ?? undefined,
    unitPrice: unitPrice === null ? undefined : Math.round(unitPrice * 100) / 100,
    confidence: clampConfidence(item.confidence, 0.6),
    categoryKey,
    categoryConfidence: clampConfidence(item.categoryConfidence, 0.5),
  };
}

function normalizeReceipt(value: unknown): ReceiptScanResult {
  if (!value || typeof value !== "object") throw new Error("GEMINI_INVALID_RESPONSE");
  const receipt = value as Record<string, unknown>;
  const items = Array.isArray(receipt.items)
    ? receipt.items
      .map(cleanItem)
      .filter((item): item is ReceiptScanItem => Boolean(item))
      .slice(0, 30)
    : [];
  const itemTotal = items.reduce((sum, item) => sum + item.price, 0);
  const extractedAmount = positiveNumber(receipt.amount);
  const amount = extractedAmount ?? (itemTotal > 0 ? Math.round(itemTotal * 100) / 100 : null);
  if (amount === null && items.length === 0) throw new Error("GEMINI_EMPTY_RECEIPT");

  let confidence = clampConfidence(receipt.confidence, 0.55);
  if (amount && itemTotal > 0 && Math.abs(amount - itemTotal) / amount > 0.2) {
    confidence = Math.min(confidence, 0.55);
  }

  return {
    source: "receipt",
    amount: amount === null ? null : Math.round(amount * 100) / 100,
    currency: cleanCurrency(receipt.currency),
    date: cleanDate(receipt.date),
    merchant: cleanText(receipt.merchant, 100),
    items,
    rawText: typeof receipt.rawText === "string" ? receipt.rawText.trim().slice(0, 8_000) : "",
    confidence,
  };
}

function responseText(response: GeminiResponse) {
  return response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
}

export async function extractReceiptWithGemini(input: {
  base64: string;
  mimeType: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  const configuredModel = process.env.GEMINI_RECEIPT_MODEL?.trim() || "gemini-3.1-flash-lite";
  const model = configuredModel.replace(/^models\//, "");
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("GEMINI_INVALID_MODEL");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType: input.mimeType, data: input.base64 } },
              { text: RECEIPT_PROMPT },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4_096,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
    const payload = await response.json() as GeminiResponse;
    const text = responseText(payload);
    if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
    const json = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")) as unknown;
    return normalizeReceipt(json);
  } finally {
    clearTimeout(timeout);
  }
}
