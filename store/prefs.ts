import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Notifications store (persisted to localStorage) ─────────────────────────
// Icons are NOT stored — they are mapped by iconType at render time.
export type NotifIconType = "warning" | "over-limit" | "income" | "on-track";

export interface Notification {
  id: number;
  iconType: NotifIconType;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    iconType: "warning",
    title: "Budget warning",
    desc: "Food & Dining is at 82% of limit",
    time: "2h ago",
    unread: true,
  },
  {
    id: 2,
    iconType: "over-limit",
    title: "Over limit",
    desc: "Entertainment exceeded monthly limit",
    time: "5h ago",
    unread: true,
  },
  {
    id: 3,
    iconType: "income",
    title: "Income received",
    desc: "Salary +$3,200 added",
    time: "1d ago",
    unread: false,
  },
  {
    id: 4,
    iconType: "on-track",
    title: "Budget on track",
    desc: "Transport is within limits this month",
    time: "2d ago",
    unread: false,
  },
];

interface NotifState {
  notifications: Notification[];
  markRead: (id: number) => void;
  markAllRead: () => void;
  dismiss: (id: number) => void;
}

export const useNotifStore = create<NotifState>()(
  persist(
    (set) => ({
      notifications: INITIAL_NOTIFICATIONS,
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
    { name: "lumium_notifs" },
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

export type Currency = "USD" | "EUR" | "RUB" | "GBP" | "JPY" | "CNY";
export type Language = "en" | "ru" | "de" | "fr";
export type DateFormat =
  | "MMM D, YYYY"
  | "DD.MM.YYYY"
  | "MM/DD/YYYY"
  | "YYYY-MM-DD";

// Approximate exchange rates relative to USD (base currency of stored data)
export const RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  RUB: 92.5,
  JPY: 155,
  CNY: 7.25,
};

interface PrefsState {
  currency: Currency;
  language: Language;
  dateFormat: DateFormat;
  setCurrency: (c: Currency) => void;
  setLanguage: (l: Language) => void;
  setDateFormat: (d: DateFormat) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      currency: "USD",
      language: "en",
      dateFormat: "MMM D, YYYY",
      setCurrency: (currency) => set({ currency }),
      setLanguage: (language) => set({ language }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
    }),
    { name: "lumium_prefs", skipHydration: true },
  ),
);
