export const CURRENCIES = ["BYN", "USD", "EUR"] as const;

export type Currency = (typeof CURRENCIES)[number];

export const RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  BYN: 3.01,
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
  normalized.USD = 1;
  return normalized;
}

export function formatUsdStorageAmount(amount: number): string {
  return amount.toFixed(8);
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCIES.includes(value as Currency);
}
