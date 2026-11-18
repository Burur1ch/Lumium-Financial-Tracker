"use client";

import { useEffect } from "react";
import { getAccountPreferences, saveAccountPreferences } from "@/app/dashboard/actions";
import { usePrefs } from "@/store/prefs";
import { DEFAULT_PREFERENCES, preferenceValues } from "@/utils/preferences";

export function AccountSync() {
  useEffect(() => {
    let active = true;
    let running = false;
    let timer: ReturnType<typeof setTimeout>;

    async function sync() {
      if (running || !navigator.onLine || !usePrefs.persist.hasHydrated()) return;
      running = true;
      try {
        const remote = await getAccountPreferences();
        if (!active || !remote) return;
        let state = usePrefs.getState();
        const sameAccount = !state.ownerId || state.ownerId === remote.userId;
        const initial = sameAccount ? preferenceValues(state) : DEFAULT_PREFERENCES;
        state.applyAccountPreferences(remote.userId, remote.preferences ?? initial);
        state = usePrefs.getState();
        const pending = { ...state.pendingPreferences };
        const patch = remote.preferences ? pending : preferenceValues(state);
        if (Object.keys(patch).length) {
          let saved = await saveAccountPreferences(patch, !remote.preferences);
          if (saved.success && !remote.preferences && Object.keys(pending).length)
            saved = await saveAccountPreferences(pending);
          if (active && saved.success && usePrefs.getState().ownerId === remote.userId) {
            usePrefs.getState().acknowledgePreferences(patch);
            usePrefs.getState().applyAccountPreferences(remote.userId, saved.preferences);
          }
        }
      } catch {
        // Pending fields stay in the persisted store until the next connection.
      } finally {
        running = false;
        if (active && Object.keys(usePrefs.getState().pendingPreferences).length)
          timer = setTimeout(() => void sync(), 5000);
      }
    }

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), 600);
    };
    const unsubscribe = usePrefs.subscribe((state, previous) => {
      if (state.pendingPreferences !== previous.pendingPreferences && Object.keys(state.pendingPreferences).length) schedule();
    });
    const hydrated = usePrefs.persist.onFinishHydration(schedule);
    const interval = setInterval(() => void sync(), 30000);
    window.addEventListener("online", schedule);
    window.addEventListener("focus", schedule);
    schedule();
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      hydrated();
      window.removeEventListener("online", schedule);
      window.removeEventListener("focus", schedule);
    };
  }, []);
  return null;
}
