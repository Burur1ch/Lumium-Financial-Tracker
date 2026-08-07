"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  User,
  Globe,
  Palette,
  ShieldAlert,
  Save,
  LogOut,
  Trash2,
  Sun,
  Moon,
  Clock,
  Check,
} from "lucide-react";
import {
  getProfile,
  updateProfile,
  deleteAccount,
  signOut,
} from "@/app/dashboard/actions";
import {
  usePrefs,
  useProfileStore,
  Currency,
  Language,
  DateFormat,
} from "@/store/prefs";
import {
  UserAvatar,
  AVATAR_COLORS,
  AVATAR_ICONS,
} from "@/components/user-avatar";
import { useI18n } from "@/hooks/useI18n";
import {
  enableAutoTheme,
  disableAutoTheme,
  isAutoThemeEnabled,
} from "@/components/scheduled-theme";

interface Profile {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "USD", label: "$ USD — US Dollar" },
  { value: "EUR", label: "€ EUR — Euro" },
  { value: "RUB", label: "₽ RUB — Russian Ruble" },
  { value: "GBP", label: "£ GBP — British Pound" },
  { value: "JPY", label: "¥ JPY — Japanese Yen" },
  { value: "CNY", label: "¥ CNY — Chinese Yuan" },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "🇺🇸 English" },
  { value: "ru", label: "🇷🇺 Русский" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "fr", label: "🇫🇷 Français" },
];

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "MMM D, YYYY", label: "Aug 6, 2026" },
  { value: "DD.MM.YYYY", label: "06.08.2026" },
  { value: "MM/DD/YYYY", label: "08/06/2026" },
  { value: "YYYY-MM-DD", label: "2026-08-06" },
];

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {title}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {description}
          </p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 sm:w-32">
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const {
    setCurrency,
    setLanguage,
    setDateFormat,
    setAvatarColor,
    setAvatarIcon,
  } = usePrefs();

  const [mounted, setMounted] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const setStoreAvatarUrl = useProfileStore((s) => s.setAvatarUrl);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [profileSaved, setProfileSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  // Pending (unsaved) prefs — initialized from store (already hydrated on client)
  const [pendingCurrency, setPendingCurrency] = useState<Currency>(
    () => usePrefs.getState().currency,
  );
  const [pendingLanguage, setPendingLanguage] = useState<Language>(
    () => usePrefs.getState().language,
  );
  const [pendingDateFormat, setPendingDateFormat] = useState<DateFormat>(
    () => usePrefs.getState().dateFormat,
  );
  const [pendingColor, setPendingColor] = useState(
    () => usePrefs.getState().avatarColor,
  );
  const [pendingIcon, setPendingIcon] = useState(
    () => usePrefs.getState().avatarIcon,
  );

  useEffect(() => {
    getProfile().then((p) => {
      if (p) {
        setProfile(p as Profile);
        setName(p.name ?? "");
        setStoreAvatarUrl(null);
      }
      setMounted(true);
      setIsAuto(isAutoThemeEnabled());
    });
  }, [setStoreAvatarUrl]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setAvatarColor(pendingColor);
    setAvatarIcon(pendingIcon);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("name", name);
      const result = await updateProfile(fd);
      if (result.success) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      }
    });
  };

  const handleSavePrefs = () => {
    setCurrency(pendingCurrency);
    setLanguage(pendingLanguage);
    setDateFormat(pendingDateFormat);
    setSavedPrefs(true);
    setTimeout(() => setSavedPrefs(false), 2000);
  };

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
      router.push("/login");
    });
  };

  const handleDeleteAccount = () => {
    if (deleteInput !== "DELETE") return;
    startTransition(async () => {
      await deleteAccount();
      router.push("/login");
    });
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
  const selectCls = inputCls + " cursor-pointer";

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t("settings")}
        </h1>
        <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-1">
          {t("manageAccountDesc")}
        </p>
      </div>

      {/* ── Profile ── */}
      <Section icon={User} title={t("profile")} description={t("personalInfo")}>
        <div className="space-y-5">
          {/* Avatar picker */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                color={pendingColor}
                iconKey={pendingIcon}
                size="lg"
              />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Profile avatar
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Choose a color and icon
                </p>
              </div>
            </div>
            {/* Color swatches */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Color
              </p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPendingColor(c)}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: pendingColor === c ? `3px solid ${c}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Icon grid */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Icon
              </p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_ICONS.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPendingIcon(key)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      pendingIcon === key
                        ? "text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                    style={
                      pendingIcon === key
                        ? { backgroundColor: pendingColor }
                        : {}
                    }
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Name + email */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Field label={t("displayName")}>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </Field>
            <Field label={t("email")}>
              <input
                className={inputCls + " opacity-60 cursor-not-allowed"}
                value={profile?.email ?? ""}
                disabled
                title="Email cannot be changed here"
              />
            </Field>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {profileSaved ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {profileSaved ? t("saved") : t("saveChanges")}
              </button>
            </div>
          </form>
        </div>
      </Section>

      {/* ── Preferences ── */}
      <Section
        icon={Globe}
        title={t("preferences")}
        description={
          t("currency") + ", " + t("language") + ", " + t("dateFormat")
        }
      >
        <div className="space-y-4">
          <Field label={t("currency")}>
            <select
              className={selectCls}
              value={pendingCurrency}
              onChange={(e) => setPendingCurrency(e.target.value as Currency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("language")}>
            <select
              className={selectCls}
              value={pendingLanguage}
              onChange={(e) => setPendingLanguage(e.target.value as Language)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("dateFormat")}>
            <select
              className={selectCls}
              value={pendingDateFormat}
              onChange={(e) =>
                setPendingDateFormat(e.target.value as DateFormat)
              }
            >
              {DATE_FORMATS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSavePrefs}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
            >
              {savedPrefs ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {savedPrefs ? t("saved") : t("saveChanges")}
            </button>
          </div>
        </div>
      </Section>

      {/* ── Appearance ── */}
      {mounted && (
        <Section
          icon={Palette}
          title={t("appearance")}
          description={t("chooseTheme")}
        >
          <div className="space-y-4">
            {/* Light / Dark buttons */}
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "light", label: t("light"), icon: Sun },
                  { value: "dark", label: t("dark"), icon: Moon },
                ] as { value: string; label: string; icon: React.ElementType }[]
              ).map(({ value, label, icon: Icon }) => {
                const isActive = !isAuto && theme === value;
                return (
                  <button
                    key={value}
                    onClick={() => {
                      setIsAuto(false);
                      disableAutoTheme();
                      setTheme(value);
                    }}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-xs font-semibold ${
                      isActive
                        ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-500"
                        : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                        <Check
                          className="w-2.5 h-2.5 text-white"
                          strokeWidth={3}
                        />
                      </span>
                    )}
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Auto-schedule toggle */}
            <div
              role="button"
              tabIndex={0}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                isAuto
                  ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
              onClick={() => {
                if (isAuto) {
                  setIsAuto(false);
                  disableAutoTheme();
                  setTheme("light");
                } else {
                  setIsAuto(true);
                  enableAutoTheme(setTheme);
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    isAuto
                      ? "bg-red-100 dark:bg-red-950/50 text-red-500"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p
                    className={`text-xs font-bold ${
                      isAuto
                        ? "text-red-500"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {t("autoTheme")}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {t("autoThemeHint")}
                  </p>
                </div>
              </div>
              {/* Toggle pill */}
              <div
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                  isAuto ? "bg-red-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                    isAuto ? "left-6" : "left-1"
                  }`}
                />
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Danger zone ── */}
      <Section
        icon={ShieldAlert}
        title={t("dangerZone")}
        description={t("irreversibleDesc")}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t("signOut")}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {t("signOutDesc")}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isPending}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" /> {t("signOut")}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {t("deleteAccount")}
                </p>
                <p className="text-xs text-red-400 dark:text-red-500 mt-0.5">
                  {t("deleteAccountDesc")}
                </p>
              </div>
              {!deleteConfirm && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t("deleteButton")}
                </button>
              )}
            </div>
            {deleteConfirm && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-red-500 font-semibold">
                  Type{" "}
                  <span className="font-mono bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">
                    DELETE
                  </span>{" "}
                  to confirm
                </p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-red-300 dark:border-red-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-red-500 focus:outline-none"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="DELETE"
                  />
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== "DELETE" || isPending}
                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition-colors disabled:opacity-40"
                  >
                    {t("confirm")}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirm(false);
                      setDeleteInput("");
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
