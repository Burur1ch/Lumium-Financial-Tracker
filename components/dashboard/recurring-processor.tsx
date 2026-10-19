"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { processDueRecurringTransactions } from "@/app/dashboard/actions";

export function RecurringProcessor() {
  const router = useRouter();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    void processDueRecurringTransactions().then((result) => {
      if (result.success && result.createdCount > 0) router.refresh();
    });
  }, [router]);

  return null;
}
