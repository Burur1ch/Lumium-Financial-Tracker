import "server-only";

import {
  CURRENCIES,
  type Currency,
  RATES,
} from "@/utils/currency";

const NBRB_RATES_URL = "https://api.nbrb.by/exrates/rates?periodicity=0";

interface NbrbRate {
  Date: string;
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_OfficialRate: number;
}

export interface ExchangeRateSnapshot {
  base: "USD";
  rates: Record<Currency, number>;
  source: "nbrb" | "fallback";
  rateDate: string | null;
}

function fallbackSnapshot(): ExchangeRateSnapshot {
  return {
    base: "USD",
    rates: { ...RATES },
    source: "fallback",
    rateDate: null,
  };
}

export async function getExchangeRateSnapshot(): Promise<ExchangeRateSnapshot> {
  try {
    const response = await fetch(NBRB_RATES_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 21600 },
    });

    if (!response.ok) return fallbackSnapshot();

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return fallbackSnapshot();

    const bynPerUnit = new Map<string, number>();
    let rateDate: string | null = null;

    for (const item of payload as NbrbRate[]) {
      if (
        typeof item?.Cur_Abbreviation !== "string" ||
        !Number.isFinite(item.Cur_Scale) ||
        item.Cur_Scale <= 0 ||
        !Number.isFinite(item.Cur_OfficialRate) ||
        item.Cur_OfficialRate <= 0
      ) {
        continue;
      }

      bynPerUnit.set(
        item.Cur_Abbreviation,
        item.Cur_OfficialRate / item.Cur_Scale,
      );
      rateDate ??= typeof item.Date === "string" ? item.Date : null;
    }

    const bynPerUsd = bynPerUnit.get("USD");
    if (!bynPerUsd) return fallbackSnapshot();

    const rates = { ...RATES };
    for (const currency of CURRENCIES) {
      if (currency === "USD") {
        rates.USD = 1;
      } else if (currency === "BYN") {
        rates.BYN = bynPerUsd;
      } else {
        const targetBynPerUnit = bynPerUnit.get(currency);
        if (targetBynPerUnit) {
          rates[currency] = bynPerUsd / targetBynPerUnit;
        }
      }
    }

    return {
      base: "USD",
      rates,
      source: "nbrb",
      rateDate,
    };
  } catch {
    return fallbackSnapshot();
  }
}

export async function getCurrencyRate(currency: Currency): Promise<number> {
  const snapshot = await getExchangeRateSnapshot();
  return snapshot.rates[currency];
}
