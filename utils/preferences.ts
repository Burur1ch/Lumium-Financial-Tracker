import { isCurrency, type Currency } from "@/utils/currency";

export interface AccountPreferences {
  currency: Currency;
  language: "en" | "ru" | "de" | "fr";
  dateFormat: "MMM D, YYYY" | "DD.MM.YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  avatarColor: string;
  avatarIcon: string;
  avatarPreset: string | null;
  themeMode: "light" | "dark" | "auto";
}

export const DEFAULT_PREFERENCES: AccountPreferences = {
  currency: "BYN",
  language: "ru",
  dateFormat: "DD.MM.YYYY",
  avatarColor: "#D92D3A",
  avatarIcon: "User",
  avatarPreset: null,
  themeMode: "light",
};

export function preferenceValues(value: AccountPreferences): AccountPreferences {
  return {
    currency: value.currency,
    language: value.language,
    dateFormat: value.dateFormat,
    avatarColor: value.avatarColor,
    avatarIcon: value.avatarIcon,
    avatarPreset: value.avatarPreset,
    themeMode: value.themeMode,
  };
}

export function validPreferencePatch(value: unknown): value is Partial<AccountPreferences> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const checks: Record<keyof AccountPreferences, (input: unknown) => boolean> = {
    currency: isCurrency,
    language: (input) => ["en", "ru", "de", "fr"].includes(String(input)),
    dateFormat: (input) => ["MMM D, YYYY", "DD.MM.YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].includes(String(input)),
    avatarColor: (input) => typeof input === "string" && /^#[\da-f]{6}$/i.test(input),
    avatarIcon: (input) => typeof input === "string" && /^[A-Za-z]{1,40}$/.test(input),
    avatarPreset: (input) => input === null || (typeof input === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(input)),
    themeMode: (input) => ["light", "dark", "auto"].includes(String(input)),
  };
  return Object.entries(value).every(([key, input]) =>
    Object.hasOwn(checks, key) && checks[key as keyof AccountPreferences](input),
  );
}
