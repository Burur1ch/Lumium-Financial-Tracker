"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRef = useRef(`${pathname}?${searchParams}`);

  useEffect(() => {
    const current = `${pathname}?${searchParams}`;
    if (current !== prevRef.current) {
      prevRef.current = current;
      // Clear the increment timer
      if (timerRef.current) clearInterval(timerRef.current);
      // Snap to 100 then fade out
      setWidth(100);
      const t = setTimeout(() => {
        setLoading(false);
        setWidth(0);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [pathname, searchParams]);

  // Start progress when user clicks a period button
  // We detect this via a global event
  useEffect(() => {
    const handler = () => {
      setLoading(true);
      setWidth(20);
      let w = 20;
      timerRef.current = setInterval(() => {
        w = Math.min(w + Math.random() * 15, 85);
        setWidth(w);
      }, 300);
    };
    window.addEventListener("lumium:nav-start", handler);
    return () => {
      window.removeEventListener("lumium:nav-start", handler);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!loading && width === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 z-9999 h-0.5 bg-red-500 transition-all duration-300 ease-out shadow-sm"
      style={{ width: `${width}%`, opacity: loading || width < 100 ? 1 : 0 }}
    />
  );
}
