"use client";

import React from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/store/translations";

interface MetricCardProps {
  amount: number;
  change: number | null;
  type: "income" | "expense" | "net";
  changeLabelKey?: TranslationKey;
}

export default function MetricCard({
  amount,
  change,
  type,
  changeLabelKey,
}: MetricCardProps) {
  const isPositive = (change ?? 0) >= 0;
  const { fmt, t } = useI18n();
  const changeLabel = changeLabelKey ? t(changeLabelKey) : "";

  const title =
    type === "expense"
      ? t("totalExpenses")
      : type === "income"
        ? t("totalIncome")
        : t("netBalance");
  const Icon =
    type === "expense" ? TrendingDown : type === "income" ? TrendingUp : Wallet;

  const accent = {
    expense: {
      icon: "bg-red-100 dark:bg-red-950/50 text-red-500",
      glow: "before:bg-red-500/5",
    },
    income: {
      icon: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500",
      glow: "before:bg-emerald-500/5",
    },
    net: {
      icon: "bg-orange-100 dark:bg-orange-950/50 text-orange-500",
      glow: "before:bg-orange-500/5",
    },
  }[type];

  const badgeColor =
    type === "expense"
      ? isPositive
        ? "bg-red-50 dark:bg-red-950/30 text-red-500"
        : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500"
      : type === "income"
        ? isPositive
          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500"
          : "bg-red-50 dark:bg-red-950/30 text-red-500"
        : isPositive
          ? "bg-orange-50 dark:bg-orange-950/30 text-orange-500"
          : "bg-red-50 dark:bg-red-950/30 text-red-500";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {/* Top row: title + icon */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight">
          {title}
        </p>
        <div
          className={`hidden sm:flex shrink-0 w-9 h-9 rounded-xl items-center justify-center ${accent.icon}`}
        >
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>

      {/* Amount */}
      <p
        className={`mt-2 sm:mt-3 text-base sm:text-3xl font-bold tracking-tight tabular-nums truncate ${
          type === "net"
            ? "text-orange-500"
            : "text-slate-900 dark:text-slate-50"
        }`}
      >
        {fmt(amount)}
      </p>

      {/* Change badge */}
      <div className="mt-2 sm:mt-3 flex items-center gap-1 sm:gap-2">
        {change === null ? (
          <span className="inline-flex items-center text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-tight">
            <span className="hidden sm:inline">— </span>
            {t("noDataShort")}
          </span>
        ) : (
          <>
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold rounded-lg px-1.5 sm:px-2 py-0.5 ${badgeColor}`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              ) : (
                <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              )}
              {isPositive ? `+${change}%` : `${change}%`}
            </span>
            <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-slate-500 truncate">
              {changeLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
