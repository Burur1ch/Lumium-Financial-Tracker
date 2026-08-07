"use client";

import { useEffect, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import DashboardLoading from "@/app/dashboard/loading";

export function PeriodLoadingWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [prevKey, setPrevKey] = useState(() => `${pathname}?${searchParams}`);

  // Show skeleton on nav-start event
  useEffect(() => {
    const handler = () => setLoading(true);
    window.addEventListener("lumium:nav-start", handler);
    return () => window.removeEventListener("lumium:nav-start", handler);
  }, []);

  // Hide skeleton once URL actually changes (server response arrived)
  useEffect(() => {
    const current = `${pathname}?${searchParams}`;
    if (current !== prevKey) {
      setPrevKey(current);
      setLoading(false);
    }
  }, [pathname, searchParams, prevKey]);

  if (loading) return <DashboardLoading />;
  return <>{children}</>;
}
