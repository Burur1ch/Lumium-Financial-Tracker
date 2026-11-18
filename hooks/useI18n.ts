import { usePrefs, type Currency } from "@/store/prefs";
import { translations, TranslationKey } from "@/store/translations";
import {
  categoryDisplayLabel,
  type CategoryLike,
} from "@/utils/category-catalog";
import { useCallback } from "react";

const CURRENCY_LOCALES: Record<Currency, string> = {
  USD: "en-US",
  EUR: "de-DE",
  // Keep the ISO-code presentation used by the product design. Some browser
  // ICU builds render be-BY as `BYN 0.00`, while Node renders `0,00 Br`, which
  // makes otherwise identical SSR and client renders fail hydration.
  BYN: "en-US",
};

const LANGUAGE_LOCALES: Record<string, string> = {
  en: "en-US",
  ru: "ru-RU",
  de: "de-DE",
  fr: "fr-FR",
};

export function useI18n() {
  const { currency, language, dateFormat, exchangeRates } = usePrefs();

  const t = useCallback(
    (key: TranslationKey): string => {
      return (
        (translations[language] as Record<TranslationKey, string>)[key] ??
        translations.en[key] ??
        key
      );
    },
    [language],
  );
  const categoryName = useCallback(
    (category: Omit<CategoryLike, "id">) => categoryDisplayLabel(category, t),
    [t],
  );

  const fmt = (
    amount: number,
    opts?: { decimals?: boolean; noConvert?: boolean; currency?: Currency },
  ): string => {
    const displayCurrency = opts?.currency ?? currency;
    const converted = opts?.noConvert
      ? amount
      : amount * (exchangeRates[displayCurrency] ?? 1);
    const decimals = opts?.decimals ?? true;
    return new Intl.NumberFormat(CURRENCY_LOCALES[displayCurrency] ?? "en-US", {
      style: "currency",
      currency: displayCurrency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    }).format(converted);
  };

  const fmtDate = (dateStr: string, options?: Intl.DateTimeFormatOptions): string => {
    const date = new Date(dateStr);
    const locale = LANGUAGE_LOCALES[language] ?? "en-US";
    if (options) return date.toLocaleDateString(locale, options);
    switch (dateFormat) {
      case "DD.MM.YYYY":
        return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
      case "MM/DD/YYYY":
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
      case "YYYY-MM-DD":
        return date.toISOString().split("T")[0];
      case "MMM D, YYYY":
      default:
        return date.toLocaleDateString(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
    }
  };

  return {
    t,
    categoryName,
    fmt,
    fmtDate,
    fmtMonth: (month: string) =>
      new Intl.DateTimeFormat(LANGUAGE_LOCALES[language] ?? "en-US", {
        month: "long",
        year: "numeric",
      }).format(new Date(`${month}-01T12:00:00`)),
    currency,
    currencyRate: exchangeRates[currency] ?? 1,
    language,
    dateFormat,
  };
}
