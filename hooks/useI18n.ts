import { usePrefs, type Currency } from "@/store/prefs";
import { translations, TranslationKey } from "@/store/translations";
import {
  categoryDisplayLabel,
  type CategoryLike,
} from "@/utils/category-catalog";
import { useCallback, useSyncExternalStore } from "react";

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

function subscribeTimeZone(changed: () => void) {
  window.addEventListener("focus", changed);
  return () => window.removeEventListener("focus", changed);
}

function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function serverTimeZone() {
  return "UTC";
}

export function useI18n() {
  const { currency, language, dateFormat, exchangeRates } = usePrefs();
  // Hydration starts with the same zone as SSR, then uses the device's zone.
  const timeZone = useSyncExternalStore(subscribeTimeZone, deviceTimeZone, serverTimeZone);

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

  const calendarDateKey = (date: Date): string => {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  };

  const fmtDate = (dateStr: string, options?: Intl.DateTimeFormatOptions): string => {
    const date = new Date(dateStr);
    const locale = LANGUAGE_LOCALES[language] ?? "en-US";
    if (options) return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
    const [year, month, day] = calendarDateKey(date).split("-");
    switch (dateFormat) {
      case "DD.MM.YYYY":
        return `${day}.${month}.${year}`;
      case "MM/DD/YYYY":
        return `${month}/${day}/${year}`;
      case "YYYY-MM-DD":
        return date.toISOString().split("T")[0];
      case "MMM D, YYYY":
      default:
        return date.toLocaleDateString(locale, {
          timeZone,
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
    calendarDateKey,
    fmtTime: (dateStr: string) => new Intl.DateTimeFormat(LANGUAGE_LOCALES[language] ?? "en-US", {
      timeZone, hour: "2-digit", minute: "2-digit",
    }).format(new Date(dateStr)).replace(/\u202f/g, " "),
    fmtMonth: (month: string) =>
      new Intl.DateTimeFormat(LANGUAGE_LOCALES[language] ?? "en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${month}-01T12:00:00Z`)),
    currency,
    currencyRate: exchangeRates[currency] ?? 1,
    language,
    dateFormat,
  };
}
