"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { authClient } from "@/utils/auth/client";

const TOUR_STEPS = [
  {
    target: "overview",
    title: "dashboard",
    description: "tourOverviewDesc",
  },
  {
    target: "add-transaction",
    title: "addTransaction",
    description: "tourAddTransactionDesc",
  },
  {
    target: "quick-actions",
    title: "quickActions",
    description: "tourQuickActionsDesc",
  },
  {
    target: "activity",
    title: "recentTransactions",
    description: "tourActivityDesc",
  },
  {
    target: "main-navigation",
    title: "tourNavigationTitle",
    description: "tourNavigationDesc",
  },
] as const;

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getStorageKey(userId: string) {
  return `lumium_dashboard_tour:${userId}`;
}

export function FirstRunTour() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [manualStart, setManualStart] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const userId = session?.user.id;
  const step = TOUR_STEPS[stepIndex];

  const savePreference = useCallback(
    (value: "completed" | "skipped") => {
      if (!userId) return;
      try {
        window.localStorage.setItem(getStorageKey(userId), value);
      } catch (error) {
        console.error("Could not save dashboard tour preference.", error);
      }
    },
    [userId],
  );

  const closeTour = useCallback(
    (value: "completed" | "skipped") => {
      savePreference(value);
      setIsOpen(false);
      setTargetRect(null);
    },
    [savePreference],
  );

  const skipTour = useCallback(() => closeTour("skipped"), [closeTour]);

  useEffect(() => {
    if (pathname !== "/dashboard" || sessionPending || !userId) return;

    let frame = 0;
    try {
      if (window.localStorage.getItem(getStorageKey(userId)) === null) {
        frame = window.requestAnimationFrame(() => setIsOpen(true));
      }
    } catch (error) {
      console.error("Could not read dashboard tour preference.", error);
    }

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, sessionPending, userId]);

  useEffect(() => {
    const handleStart = () => {
      setStepIndex(0);
      if (pathname === "/dashboard") {
        setIsOpen(true);
      } else {
        setManualStart(true);
        router.push("/dashboard");
      }
    };

    window.addEventListener("lumium:start-tour", handleStart);
    return () => window.removeEventListener("lumium:start-tour", handleStart);
  }, [pathname, router]);

  useEffect(() => {
    if (!manualStart || pathname !== "/dashboard") return;
    const frame = window.requestAnimationFrame(() => {
      setManualStart(false);
      setStepIndex(0);
      setIsOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [manualStart, pathname]);

  useEffect(() => {
    if (!isOpen || !step) return;

    let frame = 0;
    let timeout = 0;
    const updateTarget = () => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-tour="${step.target}"]`,
        ),
      );
      const target = candidates.find((candidate) => {
        const style = window.getComputedStyle(candidate);
        const rect = candidate.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      });

      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const target = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`),
    ).find((candidate) => {
      const style = window.getComputedStyle(candidate);
      return style.display !== "none" && style.visibility !== "hidden";
    });

    target?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateTarget);
    };

    scheduleUpdate();
    timeout = window.setTimeout(updateTarget, 350);
    window.addEventListener("resize", scheduleUpdate);
    document.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", scheduleUpdate);
      document.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skipTour();
      } else if (event.key === "ArrowRight" && stepIndex < TOUR_STEPS.length - 1) {
        setStepIndex((current) => current + 1);
      } else if (event.key === "ArrowLeft" && stepIndex > 0) {
        setStepIndex((current) => current - 1);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, skipTour, stepIndex]);

  if (!isOpen || !step) return null;

  const dialogWidth = Math.min(352, window.innerWidth - 32);
  const dialogHeight = 240;
  const dialogPosition = targetRect
    ? {
        left: Math.max(
          16,
          Math.min(
            targetRect.left + targetRect.width / 2 - dialogWidth / 2,
            window.innerWidth - dialogWidth - 16,
          ),
        ),
        top:
          targetRect.top + targetRect.height + dialogHeight + 24 <
          window.innerHeight
            ? targetRect.top + targetRect.height + 16
            : Math.max(16, targetRect.top - dialogHeight - 16),
      }
    : null;

  const padding = 8;
  const top = targetRect ? Math.max(0, targetRect.top - padding) : 0;
  const left = targetRect ? Math.max(0, targetRect.left - padding) : 0;
  const right = targetRect
    ? Math.min(window.innerWidth, targetRect.left + targetRect.width + padding)
    : 0;
  const bottom = targetRect
    ? Math.min(window.innerHeight, targetRect.top + targetRect.height + padding)
    : 0;
  const pieces = targetRect
    ? [
        { top: 0, left: 0, width: "100vw", height: `${top}px` },
        {
          top: `${bottom}px`,
          left: 0,
          width: "100vw",
          height: `${Math.max(0, window.innerHeight - bottom)}px`,
        },
        {
          top: `${top}px`,
          left: 0,
          width: `${left}px`,
          height: `${Math.max(0, bottom - top)}px`,
        },
        {
          top: `${top}px`,
          left: `${right}px`,
          width: `${Math.max(0, window.innerWidth - right)}px`,
          height: `${Math.max(0, bottom - top)}px`,
        },
      ]
    : [{ top: 0, left: 0, width: "100vw", height: "100vh" }];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      {pieces.map((piece, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="tour-backdrop"
          style={piece}
        />
      ))}
      {targetRect && (
        <div
          aria-hidden="true"
          className="tour-highlight"
          style={{
            top,
            left,
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - top),
          }}
        />
      )}
      <div
        ref={dialogRef}
        className="tour-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-dialog-title"
        aria-describedby="tour-dialog-description"
        tabIndex={-1}
        style={dialogPosition ?? {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t("tourStep")} {stepIndex + 1} {t("of")} {TOUR_STEPS.length}
          </p>
          <button
            type="button"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={skipTour}
            aria-label={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2
          id="tour-dialog-title"
          className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-slate-50"
        >
          {t(step.title)}
        </h2>
        <p
          id="tour-dialog-description"
          className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
        >
          {t(step.description)}
        </p>
        <div className="tour-dialog__actions">
          <button
            type="button"
            onClick={skipTour}
            className="min-h-11 px-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {t("tourSkip")}
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((current) => current - 1)}
                className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("tourBack")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  closeTour("completed");
                } else {
                  setStepIndex((current) => current + 1);
                }
              }}
              className="flex min-h-11 items-center gap-1 rounded-xl bg-[var(--app-accent)] px-4 text-sm font-bold text-white hover:bg-[var(--app-accent-strong)]"
            >
              {isLastStep ? t("tourFinish") : t("tourNext")}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
