"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Grid,
  Users,
  BarChart3,
  Wallet,
  Settings,
  HelpCircle,
  Bell,
  LogOut,
  X,
  ChevronRight,
  BellOff, // eslint-disable-line @typescript-eslint/no-unused-vars
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut, getProfile } from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";
import {
  useProfileStore,
  useNotifStore,
  NotifIconType,
  usePrefs,
} from "@/store/prefs";
import { UserAvatar } from "@/components/user-avatar";
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

const NOTIF_ICON_MAP: Record<
  NotifIconType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  warning: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  "over-limit": {
    icon: TrendingDown,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
  },
  income: {
    icon: TrendingUp,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  "on-track": {
    icon: CheckCircle2,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
};

const menuItemDefs = [
  { key: "dashboard" as const, href: "/dashboard", icon: LayoutDashboard },
  {
    key: "transactions" as const,
    href: "/dashboard/transactions",
    icon: ArrowLeftRight,
  },
  { key: "categories" as const, href: "/dashboard/categories", icon: Grid },
  { key: "users" as const, href: "/dashboard/users", icon: Users },
  { key: "reports" as const, href: "/dashboard/reports", icon: BarChart3 },
  { key: "budget" as const, href: "/dashboard/budget", icon: Wallet },
  { key: "settings" as const, href: "/dashboard/settings", icon: Settings },
  { key: "help" as const, href: "/dashboard/help", icon: HelpCircle },
] as const;

// Sample notifications — in a real app these would come from the DB
// (moved to useNotifStore in store/prefs.ts)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getInitials(name: string, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email ? email[0].toUpperCase() : "U";
}

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { avatarColor, avatarIcon } = usePrefs();
  const [profile, setProfile] = useState<{
    name: string | null;
    email: string;
  } | null>(null);
  const setStoreAvatarUrl = useProfileStore((s) => s.setAvatarUrl);
  const [showNotifs, setShowNotifs] = useState(false);
  const { notifications, markRead, markAllRead, dismiss } = useNotifStore();
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    getProfile().then((p) => {
      if (p) {
        setProfile({ name: p.name, email: p.email });
        setStoreAvatarUrl(null);
      }
    });
  }, [setStoreAvatarUrl]);

  // Close on outside click
  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifs]);

  const displayName =
    profile?.name?.trim() || profile?.email?.split("@")[0] || "User";

  return (
    <aside className="w-64 h-screen border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col justify-between p-4 select-none transition-colors duration-200">
      {/* Top */}
      <div className="flex flex-col gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white font-bold text-lg">
            L
          </div>
          <span className="font-semibold text-lg text-slate-800 dark:text-slate-200">
            Lumium
          </span>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5">
            ⌘
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {menuItemDefs.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-red-50 dark:bg-red-950/30 text-red-500"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`}
                />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
        {/* Notifications button + popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs((p) => !p)}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              showNotifs
                ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span>{t("notifications")}</span>
            </div>
            <ChevronRight
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showNotifs ? "rotate-90" : ""}`}
            />
          </button>

          {/* Popover — inline below button, not absolute/fixed to avoid clipping */}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              showNotifs
                ? "max-h-96 opacity-100 mt-2"
                : "max-h-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {t("notifications")}
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors"
                  >
                    {t("markAllRead")}
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    {t("allCaughtUp")}
                  </div>
                ) : (
                  notifications.map((n) => {
                    const {
                      icon: Icon,
                      color,
                      bg,
                    } = NOTIF_ICON_MAP[n.iconType];
                    return (
                      <div
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          n.unread ? "bg-red-50/40 dark:bg-red-950/10" : ""
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                              {n.title}
                            </p>
                            {n.unread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                            {n.desc}
                          </p>
                          <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                            {n.time}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(n.id);
                          }}
                          className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 p-0.5 mt-0.5 rounded transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile card */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Avatar */}
          <Link href="/dashboard/settings" className="shrink-0">
            <div className="hover:opacity-80 transition-opacity">
              <UserAvatar color={avatarColor} iconKey={avatarIcon} size="sm" />
            </div>
          </Link>

          {/* Name + email */}
          <Link
            href="/dashboard/settings"
            className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
          >
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
              {profile?.email ?? ""}
            </p>
          </Link>

          {/* Sign out */}
          <button
            onClick={async () => {
              await signOut();
              window.location.href = "/login";
            }}
            className="shrink-0 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </aside>
  );
}
