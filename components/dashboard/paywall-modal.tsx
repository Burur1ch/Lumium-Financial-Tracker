"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Clock3, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

export function PaywallModal({
  trigger,
  title,
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
  const opened = isOpen ?? internalOpen;
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    onClose?.();
    if (isOpen === undefined) setInternalOpen(false);
  };
  useEffect(() => {
    if (!opened) return;
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [opened]);
  return (
    <>
      {trigger && (
        <span
          onClick={() => setInternalOpen(true)}
          className="contents cursor-pointer"
        >
          {trigger}
        </span>
      )}
      {opened && (
        <div
          className="ui-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
            if (event.key === "Tab") {
              event.preventDefault();
              closeRef.current?.focus();
            }
          }}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("close")}
            onClick={close}
            className="absolute inset-0 bg-slate-950/65"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-soon-title"
            className="ui-modal-panel relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              ref={closeRef}
              type="button"
              aria-label={t("close")}
              onClick={close}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            <Clock3 className="mb-5 h-9 w-9 text-slate-400" />
            <p className="text-xs font-semibold text-slate-500">
              {t("comingSoon")}
            </p>
            <h2
              id="billing-soon-title"
              className="mt-2 pr-8 text-xl font-bold text-slate-900 dark:text-slate-100"
            >
              {featureLabel ?? title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {t("billingComingSoonDesc")}
            </p>
          </section>
        </div>
      )}
    </>
  );
}
