import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_PREFERENCES, type AccountPreferences } from "@/utils/preferences";
import type { PlanKey } from "@/utils/monetization/plans";
import {
  isCurrency,
  normalizeExchangeRates,
  RATES,
  type Currency,
} from "@/utils/currency";

export { RATES } from "@/utils/currency";
export type { Currency } from "@/utils/currency";

// ── Notifications store (persisted to localStorage) ─────────────────────────
// Icons are not stored. They are mapped by iconType at render time.
export type NotifIconType = "warning" | "over-limit" | "income" | "on-track";

export interface Notification {
  id: number;
  iconType: NotifIconType;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [];

interface NotifState {
  notifications: Notification[];
  setNotifications: (items: Notification[]) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
  dismiss: (id: number) => void;
}

export const useNotifStore = create<NotifState>()(
  persist(
    (set) => ({
      notifications: INITIAL_NOTIFICATIONS,
      setNotifications: (items) =>
        set((s) => {
          const unreadById = new Map(
            s.notifications.map((n) => [n.id, n.unread]),
          );
          return {
            notifications: items.map((n) => ({
              ...n,
              unread: unreadById.get(n.id) ?? n.unread,
            })),
          };
        }),
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, unread: false } : n,
          ),
        })),
      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, unread: false })),
        })),
      dismiss: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),
    }),
    {
      name: "lumium_notifs",
      // Keep the server snapshot and the first client snapshot identical.
      // StoreHydration starts the localStorage rehydration after React mounts.
      skipHydration: true,
    },
  ),
);
interface ProfileState {
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
}

export const useProfileStore = create<ProfileState>()((set) => ({
  avatarUrl: null,
  setAvatarUrl: (avatarUrl) => set({ avatarUrl }),
}));

export type Language = "en" | "ru" | "de" | "fr";
export type DateFormat =
  | "MMM D, YYYY"
  | "DD.MM.YYYY"
  | "MM/DD/YYYY"
  | "YYYY-MM-DD";

interface PrefsState extends AccountPreferences {
  ownerId: string | null;
  pendingPreferences: Partial<AccountPreferences>;
  setThemeMode: (value: AccountPreferences["themeMode"]) => void;
  applyAccountPreferences: (ownerId: string, values: AccountPreferences) => void;
  acknowledgePreferences: (values: Partial<AccountPreferences>) => void;
  plan: PlanKey;
  currency: Currency;
  language: Language;
  dateFormat: DateFormat;
  avatarColor: string;
  avatarIcon: string;
  avatarPreset: string | null;
  balanceHidden: boolean;
  exchangeRates: Record<Currency, number>;
  exchangeRateSource: "nbrb" | "fallback";
  exchangeRateDate: string | null;
  setPlan: (p: PlanKey) => void;
  setCurrency: (c: Currency) => void;
  setLanguage: (l: Language) => void;
  setDateFormat: (d: DateFormat) => void;
  setAvatarColor: (c: string) => void;
  setAvatarIcon: (i: string) => void;
  setAvatarPreset: (preset: string | null) => void;
  toggleBalanceHidden: () => void;
  setExchangeRates: (
    rates: Partial<Record<Currency, number>>,
    source: "nbrb" | "fallback",
    rateDate: string | null,
  ) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => {
      const change = (patch: Partial<AccountPreferences>) => set((state) => ({
        ...patch,
        pendingPreferences: { ...state.pendingPreferences, ...patch },
      }));
      return {
        plan: "free",
        ...DEFAULT_PREFERENCES,
        ownerId: null,
        pendingPreferences: {},
        balanceHidden: false,
        exchangeRates: { ...RATES },
        exchangeRateSource: "fallback",
        exchangeRateDate: null,
        setPlan: (plan) => set({ plan }),
        setCurrency: (currency) =>
          change({ currency: isCurrency(currency) ? currency : "BYN" }),
        setLanguage: (language) => change({ language }),
        setDateFormat: (dateFormat) => change({ dateFormat }),
        setAvatarColor: (avatarColor) => change({ avatarColor }),
        setAvatarIcon: (avatarIcon) => change({ avatarIcon }),
        setAvatarPreset: (avatarPreset) => change({ avatarPreset }),
        setThemeMode: (themeMode) => change({ themeMode }),
        applyAccountPreferences: (ownerId, values) => set((state) => {
          const pending = !state.ownerId || state.ownerId === ownerId ? state.pendingPreferences : {};
          return { ...values, ...pending, ownerId, pendingPreferences: pending };
        }),
        acknowledgePreferences: (values) => set((state) => ({
          pendingPreferences: Object.fromEntries(Object.entries(state.pendingPreferences)
            .filter(([key, value]) => values[key as keyof AccountPreferences] !== value)),
        })),
        toggleBalanceHidden: () =>
          set((state) => ({ balanceHidden: !state.balanceHidden })),
        setExchangeRates: (rates, exchangeRateSource, exchangeRateDate) =>
          set({
            exchangeRates: normalizeExchangeRates(rates),
            exchangeRateSource,
            exchangeRateDate,
          }),
      };
    },
    {
      name: "lumium_prefs",
      merge: (persistedState, currentState) => {
        const stored = persistedState as Partial<PrefsState> | undefined;
        return {
          ...currentState,
          ...stored,
          currency: isCurrency(stored?.currency)
            ? stored.currency
            : currentState.currency,
          themeMode: stored?.themeMode ?? (localStorage.getItem("lumium_auto_theme") === "true" ? "auto" : localStorage.getItem("theme") === "dark" ? "dark" : "light"),
          // Old persisted rates used a USD base. Fetch a fresh BYN snapshot.
          exchangeRates: { ...RATES },
          exchangeRateSource: "fallback",
          exchangeRateDate: null,
        };
      },
      // Reading localStorage while the client store is being created makes its
      // first render differ from SSR. Rehydrate explicitly after mount instead.
      skipHydration: true,
    },
  ),
);
