"use client";

import { useI18n } from "@/hooks/useI18n";

interface MoneyProps {
  amount: number;
  decimals?: boolean;
  noConvert?: boolean;
  className?: string;
}

/** Inline span that formats and converts a USD amount to the user's selected currency. */
export function Money({ amount, decimals, noConvert, className }: MoneyProps) {
  const { fmt } = useI18n();
  return (
    <span suppressHydrationWarning className={className}>
      {fmt(amount, { decimals, noConvert })}
    </span>
  );
}
