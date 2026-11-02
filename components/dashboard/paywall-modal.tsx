"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Lock, Sparkles, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { getPlan } from "@/utils/monetization/plans";

export function PaywallModal({
  trigger,
  title,
  description,
  featureLabel,
  isOpen,
  onClose,
}: {
  trigger?: ReactNode;
  title: string;
  description: string;
  featureLabel?: string;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { t } = useI18n();
  const proPlan = getPlan("pro");
  const opened = isOpen ?? internalOpen;

  const open = () => {
    if (onClose && isOpen !== undefined) return;
    setInternalOpen(true);
  };

  const close = () => {
    onClose?.();
    if (isOpen === undefined) {
      setInternalOpen(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={open} className="contents cursor-pointer">
          {trigger}
        </span>
      ) : null}

      {opened && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/65"
            onClick={close}
            aria-label="Close paywall"
          />

          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-36 bg-red-50 dark:bg-red-950/20" />
            <div className="absolute right-[-10%] top-[-18%] h-40 w-40 rounded-full bg-red-200/30 blur-3xl dark:bg-red-700/10" />

            <div className="relative p-6 md:p-7">
              <button
                type="button"
                onClick={close}
                className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-900/40 dark:bg-slate-900 dark:text-red-300">
                <Lock className="w-3.5 h-3.5" />
                {t("proAccess")}
              </div>

              <div className="mt-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0 text-red-500">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-red-100 dark:border-red-900/40 bg-white/90 dark:bg-slate-950/60 px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    <span className="text-red-500">
                      ${proPlan.price.monthly}/mo
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      or ${proPlan.price.yearly}/yr
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Pro
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t("csvImport")}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Pro
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t("aiInsights")}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Pro
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {featureLabel ?? t("unlockAdvancedReports")}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("includedFeatures")}
                </p>
                <div className="mt-3 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  {[
                    featureLabel ?? t("unlockAdvancedReports"),
                    t("csvImport"),
                    t("aiInsights"),
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t("cancel")}
                </button>
                <Link
                  href="/dashboard/pricing"
                  onClick={close}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-colors"
                >
                  {t("upgradeToPro")}
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
