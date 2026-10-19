import { usePrefs } from "@/store/prefs";
import { translations, TranslationKey } from "@/store/translations";

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  RUB: "ru-RU",
  GBP: "en-GB",
  JPY: "ja-JP",
  CNY: "zh-CN",
  BYN: "be-BY",
};

const LANGUAGE_LOCALES: Record<string, string> = {
  en: "en-US",
  ru: "ru-RU",
  de: "de-DE",
  fr: "fr-FR",
};

export function useI18n() {
  const { currency, language, dateFormat, exchangeRates } = usePrefs();

  const t = (key: TranslationKey): string => {
    return (
      (translations[language] as Record<TranslationKey, string>)[key] ??
      translations.en[key] ??
      key
    );
  };

  const fmt = (
    amount: number,
    opts?: { decimals?: boolean; noConvert?: boolean },
  ): string => {
    const converted = opts?.noConvert
      ? amount
      : amount * (exchangeRates[currency] ?? 1);
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency] ?? "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: opts?.decimals ? 2 : 0,
    }).format(converted);
  };

  const fmtDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const locale = LANGUAGE_LOCALES[language] ?? "en-US";
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
    fmt,
    fmtDate,
    currency,
    currencyRate: exchangeRates[currency] ?? 1,
    language,
    dateFormat,
  };
}
