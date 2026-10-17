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
  const [navStartKey, setNavStartKey] = useState<string | null>(null);
  const currentKey = `${pathname}?${searchParams}`;

  // Show skeleton on nav-start event
  useEffect(() => {
    const handler = () => {
      setNavStartKey(currentKey);
    };
    window.addEventListener("lumium:nav-start", handler);
    return () => window.removeEventListener("lumium:nav-start", handler);
  }, [currentKey]);

  if (navStartKey === currentKey) return <DashboardLoading />;
  return <>{children}</>;
}
