"use client";

import { useEffect } from "react";
import { useNotifStore, usePrefs } from "@/store/prefs";

export function StoreHydration() {
  const language = usePrefs((state) => state.language);

  useEffect(() => {
    void Promise.all([
      Promise.resolve(usePrefs.persist.rehydrate()),
      Promise.resolve(useNotifStore.persist.rehydrate()),
    ]);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
