"use client";

import { useEffect } from "react";
import { useNotifStore, usePrefs } from "@/store/prefs";

export function StoreHydration() {
  useEffect(() => {
    void Promise.all([
      Promise.resolve(usePrefs.persist.rehydrate()),
      Promise.resolve(useNotifStore.persist.rehydrate()),
    ]);
  }, []);

  return null;
}
