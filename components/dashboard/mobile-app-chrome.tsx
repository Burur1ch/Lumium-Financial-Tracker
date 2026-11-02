"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  CreditCard,
  Grid2X2,
  HelpCircle,
  Home,
  MoreHorizontal,
  Plus,
  Settings,
  Users,
  Wallet,
  X,
  ArrowLeftRight,
  ChevronDown,
  Search,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { useNotifStore, usePrefs } from "@/store/prefs";
import { UserAvatar } from "@/components/user-avatar";
import { BrandLogo } from "@/components/brand-logo";
import {
  getCurrentMonthKey,
  isValidMonthKey,
  monthKeyToDate,
  MonthSelector,
} from "@/components/dashboard/month-selector";

const moreItems = [
  { key: "categories" as const, href: "/dashboard/categories", icon: Grid2X2 },
  { key: "budget" as const, href: "/dashboard/budget", icon: Wallet },
  { key: "planning" as const, href: "/dashboard/planning", icon: CalendarClock },
  { key: "users" as const, href: "/dashboard/users", icon: Users },
  { key: "pricing" as const, href: "/dashboard/pricing", icon: CreditCard },
  { key: "settings" as const, href: "/dashboard/settings", icon: Settings },
  { key: "help" as const, href: "/dashboard/help", icon: HelpCircle },
] as const;

export function MobileAppChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { avatarColor, avatarIcon, avatarPreset, language } = usePrefs();
  const { notifications, markAllRead, markRead } = useNotifStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const unreadCount = notifications.filter((item) => item.unread).length;
  const isHome = pathname === "/dashboard";
  const isTransactions = pathname.startsWith("/dashboard/transactions");
  const showMonthControl = isHome || isTransactions;
  const pageTitle = isTransactions
    ? t("transactions")
    : pathname.startsWith("/dashboard/reports")
      ? t("reports")
      : pathname.startsWith("/dashboard/categories")
        ? t("categories")
        : pathname.startsWith("/dashboard/budget")
          ? t("budget")
          : pathname.startsWith("/dashboard/planning")
            ? t("planning")
            : pathname.startsWith("/dashboard/settings")
              ? t("settings")
              : pathname.startsWith("/dashboard/help")
                ? t("help")
                : pathname.startsWith("/dashboard/pricing")
                  ? t("pricing")
                  : pathname.startsWith("/dashboard/users")
                    ? t("sharedFinances")
                    : t("dashboard");
  const monthLocale = {
    en: "en-US",
    ru: "ru-RU",
    de: "de-DE",
    fr: "fr-FR",
  }[language];
  const rawMonth = searchParams.get("month");
  const selectedMonth = isValidMonthKey(rawMonth)
    ? rawMonth
    : getCurrentMonthKey();
  const selectedMonthDate = monthKeyToDate(selectedMonth);
  const currentYear = new Date().getFullYear();
  const monthLabel = new Intl.DateTimeFormat(monthLocale, {
    month: "long",
    year: selectedMonthDate.getFullYear() === currentYear ? undefined : "numeric",
  }).format(selectedMonthDate);

  useEffect(() => {
    if (!moreOpen && !notificationsOpen && !monthOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        setNotificationsOpen(false);
        setMonthOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen, notificationsOpen, monthOpen]);

  const openAddTransaction = () => {
    window.dispatchEvent(new Event("lumium:open-mobile-add"));
  };

  const primaryItems = [
    {
      label: t("home"),
      href: "/dashboard",
      icon: Home,
      active: pathname === "/dashboard",
    },
    {
      label: t("transactions"),
      href: "/dashboard/transactions",
      icon: ArrowLeftRight,
      active: pathname.startsWith("/dashboard/transactions"),
    },
    {
      label: t("reports"),
      href: "/dashboard/reports",
      icon: BarChart3,
      active: pathname.startsWith("/dashboard/reports"),
    },
  ];

  return (
    <>
      <header className="mobile-topbar lg:hidden">
        {isHome ? (
          <Link
            href="/dashboard"
            className="mobile-topbar-brand min-w-0 rounded-xl active:scale-[0.98]"
            aria-label={t("home")}
          >
            <BrandLogo
              showMark={false}
              className="min-w-0"
              wordmarkClassName="text-[1.45rem] font-extrabold"
            />
          </Link>
        ) : (
          <div className="mobile-topbar-title truncate">{pageTitle}</div>
        )}

        {showMonthControl && (
          <button
            type="button"
            onClick={() => {
              setMonthOpen(true);
              setNotificationsOpen(false);
              setMoreOpen(false);
            }}
            className="mobile-topbar-period"
            aria-haspopup="dialog"
            aria-expanded={monthOpen}
            aria-controls="month-sheet"
          >
            <span className="truncate">{monthLabel}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${monthOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
        )}

        <div className="mobile-topbar-actions">
          {isTransactions ? (
            <button
              type="button"
              onClick={() => {
                const search = document.getElementById("mobile-transactions-search") as HTMLInputElement | null;
                search?.scrollIntoView({ behavior: "smooth", block: "center" });
                search?.focus({ preventScroll: true });
              }}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 active:scale-[0.96] dark:text-slate-200 dark:hover:bg-white/[0.06]"
              aria-label={t("searchTransactions")}
            >
              <Search className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.9} />
            </button>
          ) : (
            <>
              <Link
                href="/dashboard/settings"
                className="flex h-11 w-11 items-center justify-center rounded-full active:scale-[0.96]"
                aria-label={t("settings")}
              >
                <UserAvatar
                  color={avatarColor}
                  iconKey={avatarIcon}
                  imageKey={avatarPreset}
                  size="sm"
                />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(true);
                  setMonthOpen(false);
                  setMoreOpen(false);
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 active:scale-[0.96] dark:text-slate-200 dark:hover:bg-white/[0.06]"
                aria-label={t("notifications")}
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                aria-controls="notifications-sheet"
              >
                <Bell className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.9} />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[11px] font-bold leading-none text-white ring-2 ring-[var(--app-canvas)]">
                    {Math.min(unreadCount, 9)}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </header>

      <nav className="mobile-bottom-nav lg:hidden" aria-label={t("mobileNavigation")}>
        <Link className={`mobile-nav-item ${primaryItems[0].active ? "is-active" : ""}`} href={primaryItems[0].href} aria-current={primaryItems[0].active ? "page" : undefined}>
          <Home className="h-5 w-5" strokeWidth={1.8} />
          <span>{primaryItems[0].label}</span>
        </Link>
        <Link className={`mobile-nav-item ${primaryItems[1].active ? "is-active" : ""}`} href={primaryItems[1].href} aria-current={primaryItems[1].active ? "page" : undefined}>
          <ArrowLeftRight className="h-5 w-5" strokeWidth={1.8} />
          <span>{primaryItems[1].label}</span>
        </Link>
        <button
          type="button"
          onClick={openAddTransaction}
          className="mobile-add-button"
          aria-label={t("addTransaction")}
        >
          <span className="mobile-add-button-circle">
            <Plus className="h-6 w-6" strokeWidth={2.15} />
          </span>
          <span>{t("addNew")}</span>
        </button>
        <Link className={`mobile-nav-item ${primaryItems[2].active ? "is-active" : ""}`} href={primaryItems[2].href} aria-current={primaryItems[2].active ? "page" : undefined}>
          <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
          <span>{primaryItems[2].label}</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            setMoreOpen(true);
            setMonthOpen(false);
            setNotificationsOpen(false);
          }}
          className={`mobile-nav-item ${moreOpen || moreItems.some((item) => pathname.startsWith(item.href)) ? "is-active" : ""}`}
          aria-label={t("more")}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="more-sheet"
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.8} />
          <span>{t("more")}</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-sheet-layer lg:hidden" onMouseDown={() => setMoreOpen(false)}>
          <section
            id="more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-sheet-title"
            className="mobile-sheet"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-sheet-handle" />
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h2 id="more-sheet-title" className="text-lg font-bold text-slate-950 dark:text-slate-50">
                {t("more")}
              </h2>
              <button type="button" className="icon-button" onClick={() => setMoreOpen(false)} aria-label={t("close")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-5">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="more-menu-item">
                    <Icon className="h-5 w-5 text-red-500" strokeWidth={1.8} />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {monthOpen && showMonthControl && (
        <div className="mobile-sheet-layer lg:hidden" onMouseDown={() => setMonthOpen(false)}>
          <section
            id="month-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="month-sheet-title"
            className="mobile-sheet"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-sheet-handle" />
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h2 id="month-sheet-title" className="text-lg font-bold text-slate-950 dark:text-slate-50">
                {t("selectMonth")}
              </h2>
              <button type="button" className="icon-button" onClick={() => setMonthOpen(false)} aria-label={t("close")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 pb-5">
              <MonthSelector onSelect={() => setMonthOpen(false)} />
            </div>
          </section>
        </div>
      )}

      {notificationsOpen && (
        <div className="mobile-sheet-layer lg:hidden" onMouseDown={() => setNotificationsOpen(false)}>
          <section
            id="notifications-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-sheet-title"
            className="mobile-sheet"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-sheet-handle" />
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h2 id="notifications-sheet-title" className="text-lg font-bold text-slate-950 dark:text-slate-50">
                {t("notifications")}
              </h2>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="min-h-11 px-3 text-xs font-bold text-red-500">
                    {t("markAllRead")}
                  </button>
                )}
                <button type="button" className="icon-button" onClick={() => setNotificationsOpen(false)} aria-label={t("close")}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="max-h-[55dvh] overflow-y-auto px-4 pb-5">
              {notifications.length === 0 ? (
                <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
                  <BookOpen className="h-6 w-6" strokeWidth={1.7} />
                  <p>{t("allCaughtUp")}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => markRead(item.id)}
                      className="flex w-full min-h-16 items-start gap-3 py-3 text-left"
                    >
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.unread ? "bg-red-500" : "bg-slate-300 dark:bg-slate-700"}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
