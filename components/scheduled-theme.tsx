"use client";

import { useTheme } from "next-themes";
import { useEffect, useSyncExternalStore } from "react";
import { usePrefs } from "@/store/prefs";

const AUTO_KEY = "lumium_auto_theme";

function getTimeBasedTheme(): "light" | "dark" {
  const h = new Date().getHours();
  return h >= 7 && h < 20 ? "light" : "dark";
}

/** Returns ms until the next 07:00 or 20:00 transition */
function msUntilNextTransition(): number {
  const now = new Date();
  const h = now.getHours();
  const next = new Date(now);

  if (h < 7) {
    next.setHours(7, 0, 0, 0);
  } else if (h < 20) {
    next.setHours(20, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(7, 0, 0, 0);
  }

  return next.getTime() - now.getTime();
}

export function ScheduledTheme() {
  const { setTheme } = useTheme();
  const mode = usePrefs((state) => state.themeMode);
  const hydrated = useSyncExternalStore(
    (changed) => usePrefs.persist.onFinishHydration(changed),
    () => usePrefs.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;
    if (mode !== "auto") {
      localStorage.removeItem(AUTO_KEY);
      setTheme(mode);
      return;
    }
    localStorage.setItem(AUTO_KEY, "true");

    const apply = () => setTheme(getTimeBasedTheme());
    apply();

    // Schedule exact switch at 07:00 / 20:00
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(() => {
        apply();
        schedule(); // re-schedule for the next transition
      }, msUntilNextTransition());
    };
    schedule();

    return () => clearTimeout(timeout);
  }, [setTheme, mode, hydrated]);

  return null;
}

/** Call when user selects Auto */
export function enableAutoTheme(setTheme: (t: string) => void) {
  usePrefs.getState().setThemeMode("auto");
  localStorage.setItem(AUTO_KEY, "true");
  setTheme(getTimeBasedTheme());
}

/** Call when user selects Light or Dark manually */
export function disableAutoTheme() {
  localStorage.removeItem(AUTO_KEY);
}

export function isAutoThemeEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_KEY) === "true";
}
