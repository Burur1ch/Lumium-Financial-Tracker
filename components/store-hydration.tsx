"use client";

import { useEffect } from "react";
import { usePrefs } from "@/store/prefs";

export function StoreHydration() {
  useEffect(() => {
    usePrefs.persist.rehydrate();
  }, []);
  return null;
}
