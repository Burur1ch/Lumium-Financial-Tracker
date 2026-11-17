export const CURRENCIES = ["BYN", "USD", "EUR"] as const;

export type Currency = (typeof CURRENCIES)[number];
export const BASE_CURRENCY = "BYN" as const;

export const RATES: Record<Currency, number> = {
  BYN: 1,
  USD: 1 / 3.01,
  EUR: 0.92 / 3.01,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  BYN: "Br",
  USD: "$",
  EUR: "€",
};

export function normalizeExchangeRates(
  rates?: Partial<Record<Currency, number>>,
): Record<Currency, number> {
  const normalized = { ...RATES };
  for (const currency of CURRENCIES) {
    const rate = rates?.[currency];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0)
      normalized[currency] = rate;
  }
  normalized.BYN = 1;
  return normalized;
}

export function formatBaseStorageAmount(amount: number): string {
  return amount.toFixed(8);
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCIES.includes(value as Currency);
}
