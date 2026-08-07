import { usePrefs, RATES } from "@/store/prefs";
import { translations, TranslationKey } from "@/store/translations";

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  RUB: "ru-RU",
  GBP: "en-GB",
  JPY: "ja-JP",
  CNY: "zh-CN",
};

export function useI18n() {
  const { currency, language, dateFormat } = usePrefs();

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
      : amount * (RATES[currency] ?? 1);
    return new Intl.NumberFormat(CURRENCY_LOCALES[currency] ?? "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: opts?.decimals ? 2 : 0,
    }).format(converted);
  };

  const fmtDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    switch (dateFormat) {
      case "DD.MM.YYYY":
        return date.toLocaleDateString("ru-RU");
      case "MM/DD/YYYY":
        return date.toLocaleDateString("en-US");
      case "YYYY-MM-DD":
        return date.toISOString().split("T")[0];
      case "MMM D, YYYY":
      default:
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
    }
  };

  return { t, fmt, fmtDate, currency, language, dateFormat };
}
