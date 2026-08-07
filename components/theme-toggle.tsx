"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { startTransition, useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
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
      <div className="h-10 w-full bg-slate-100 dark:bg-slate-900 rounded-xl animate-pulse" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/70 transition-colors duration-200 group"
      aria-label="Toggle theme"
    >
      <span className="flex items-center gap-2">
        {isDark ? (
          <Moon className="w-4 h-4 text-indigo-400" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
        {isDark ? "Dark mode" : "Light mode"}
      </span>

      {/* Toggle pill */}
      <span className="relative w-10 h-5 rounded-full bg-slate-300 dark:bg-indigo-500 transition-colors duration-300 flex items-center px-0.5">
        <span
          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${
            isDark ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
