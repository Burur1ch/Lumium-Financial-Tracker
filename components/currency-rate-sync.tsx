"use client";

import { useEffect } from "react";
import { usePrefs } from "@/store/prefs";
import type { Currency } from "@/utils/currency";

interface ExchangeRateResponse {
  rates: Partial<Record<Currency, number>>;
  source: "nbrb" | "fallback";
  rateDate: string | null;
}

export function CurrencyRateSync() {
  const setExchangeRates = usePrefs((state) => state.setExchangeRates);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/exchange-rates", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ExchangeRateResponse;
      })
      .then((snapshot) => {
        if (snapshot) {
          setExchangeRates(
            snapshot.rates,
            snapshot.source,
            snapshot.rateDate,
          );
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [setExchangeRates]);

  return null;
}
