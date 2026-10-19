export const CURRENCIES = [
  "USD",
  "EUR",
  "BYN",
  "RUB",
  "GBP",
  "JPY",
  "CNY",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export const RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  BYN: 3.01,
  GBP: 0.79,
  RUB: 92.5,
  JPY: 155,
  CNY: 7.25,
};

export function isCurrency(value: string): value is Currency {
  return CURRENCIES.includes(value as Currency);
}
