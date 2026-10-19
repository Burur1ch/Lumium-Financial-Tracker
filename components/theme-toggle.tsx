"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => setMounted(true));
  }, []);

  const toggleTheme = async () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    const hasVT = "startViewTransition" in document;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!hasVT || reduceMotion) {
      setTheme(nextTheme);
      return;
    }

    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    const endRadius = Math.hypot(window.innerWidth / 2, window.innerHeight / 2);

    const transition = (
      document as Document & {
        startViewTransition: (cb: () => void) => { ready: Promise<void> };
      }
    ).startViewTransition(() => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(nextTheme);
      setTheme(nextTheme);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 600,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
          fill: "forwards",
        },
      );

      document.documentElement.animate(
        { opacity: [1, 1] },
        {
          duration: 600,
          pseudoElement: "::view-transition-old(root)",
          fill: "forwards",
        },
      );
    });
  };

  if (!mounted) {
    return (
      <div className={compact ? "h-11 w-11 rounded-xl bg-slate-100 dark:bg-slate-900" : "h-10 w-full rounded-xl bg-slate-100 dark:bg-slate-900"} />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className={compact
        ? "relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        : "group relative flex w-full items-center justify-between rounded-xl border border-slate-200/60 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70"}
      aria-label={t("chooseTheme")}
    >
      <span className="flex items-center gap-2">
        {isDark ? (
          <Moon className="w-4 h-4 text-red-400" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
        {!compact && (isDark ? t("dark") : t("light"))}
      </span>

      {!compact && (
        <span className="relative flex h-5 w-10 items-center rounded-full bg-slate-300 px-0.5 transition-colors duration-300 dark:bg-red-500">
          <span
            className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${
              isDark ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      )}
    </button>
  );
}
