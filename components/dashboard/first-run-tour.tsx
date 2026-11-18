"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { authClient } from "@/utils/auth/client";
import type { TranslationKey } from "@/store/translations";
import { quickLaunchAction } from "@/utils/quick-launch";

interface TourStep {
  target: string;
  route: string;
  title: TranslationKey;
  description: TranslationKey;
  panel?: "chooser" | "entry" | "budget" | "navigation";
}

const INTRO: TourStep[] = [
  {
    target: "overview",
    route: "/dashboard",
    title: "dashboard",
    description: "tourOverviewDesc",
  },
  {
    target: "period",
    route: "/dashboard",
    title: "tourPeriodTitle",
    description: "tourPeriodDesc",
  },
  {
    target: "add-transaction",
    route: "/dashboard",
    title: "addTransaction",
    description: "tourAddTransactionDesc",
  },
];
const DETAILS: TourStep[] = [
  {
    target: "transaction-category",
    route: "/dashboard",
    title: "newTransaction",
    description: "tourEntryDesc",
    panel: "entry",
  },
  {
    target: "quick-actions",
    route: "/dashboard",
    title: "quickActions",
    description: "tourQuickActionsDesc",
  },
  {
    target: "activity",
    route: "/dashboard",
    title: "recentTransactions",
    description: "tourActivityDesc",
  },
  {
    target: "budget-overview",
    route: "/dashboard/budget",
    title: "budgetsLimits",
    description: "tourBudgetDesc",
  },
  {
    target: "budget-limit-fields",
    route: "/dashboard/budget",
    title: "budgetLimitTitle",
    description: "tourBudgetLimitDesc",
    panel: "budget",
  },
  {
    target: "category-management",
    route: "/dashboard/categories",
    title: "categories",
    description: "tourCategoriesDesc",
  },
  {
    target: "main-navigation",
    route: "/dashboard/categories",
    title: "tourNavigationTitle",
    description: "tourNavigationDesc",
    panel: "navigation",
  },
];
const DESKTOP_STEPS = [...INTRO, ...DETAILS];
const MOBILE_STEPS: TourStep[] = [
  ...INTRO,
  {
    target: "entry-methods",
    route: "/dashboard",
    title: "addOperation",
    description: "tourMethodsDesc",
    panel: "chooser",
  },
  ...DETAILS,
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}
interface Geometry {
  stepTarget: string;
  target: Rect | null;
  viewport: Rect;
  dialogHeight: number;
}
const initialGeometry: Geometry = {
  stepTarget: "",
  target: null,
  viewport: { top: 0, left: 0, width: 1024, height: 768 },
  dialogHeight: 240,
};

function visibleTarget(target: string) {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`),
  ).find((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  });
}

function targetBounds(
  element: HTMLElement,
  viewport: Rect,
  dialogHeight: number,
): Rect | null {
  const focused = [
    ...element.querySelectorAll<HTMLElement>("[data-tour-focus]"),
  ];
  const compact =
    element.getBoundingClientRect().height + dialogHeight + 120 >
      viewport.height && focused.length > 0;
  const rects = [
    ...(compact
      ? focused
      : [
          element,
          ...element.querySelectorAll<HTMLElement>("[data-tour-bounds]"),
        ]),
  ]
    .map((item) => item.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  let left = Math.max(
    viewport.left,
    Math.min(...rects.map((rect) => rect.left)) - 8,
  );
  let top = Math.max(
    viewport.top,
    Math.min(...rects.map((rect) => rect.top)) - 8,
  );
  let right = Math.min(
    viewport.left + viewport.width,
    Math.max(...rects.map((rect) => rect.right)) + 8,
  );
  let bottom = Math.min(
    viewport.top + viewport.height,
    Math.max(...rects.map((rect) => rect.bottom)) + 8,
  );
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    const rect = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      left = Math.max(left, rect.left);
      right = Math.min(right, rect.right);
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
  }
  return right > left && bottom > top
    ? { top, left, width: right - left, height: bottom - top }
    : null;
}

function dialogPosition({ target, viewport, dialogHeight }: Geometry) {
  const width = Math.min(352, viewport.width - 24);
  const height = Math.min(dialogHeight, viewport.height - 24);
  const clampX = (left: number) =>
    Math.max(
      viewport.left + 12,
      Math.min(left, viewport.left + viewport.width - width - 12),
    );
  const clampY = (top: number) =>
    Math.max(
      viewport.top + 12,
      Math.min(top, viewport.top + viewport.height - height - 12),
    );
  if (!target)
    return {
      left: clampX(viewport.left + (viewport.width - width) / 2),
      top: clampY(viewport.top + (viewport.height - height) / 2),
      width,
      maxHeight: viewport.height - 24,
    };
  const centered = clampX(target.left + (target.width - width) / 2);
  const candidates = [
    { left: centered, top: target.top + target.height + 12 },
    { left: centered, top: target.top - height - 12 },
    { left: target.left + target.width + 12, top: clampY(target.top) },
    { left: target.left - width - 12, top: clampY(target.top) },
  ];
  const fitting = candidates.find(
    (position) =>
      position.left >= viewport.left + 12 &&
      position.top >= viewport.top + 12 &&
      position.left + width <= viewport.left + viewport.width - 12 &&
      position.top + height <= viewport.top + viewport.height - 12,
  );
  const fallback =
    target.top - viewport.top >
    viewport.top + viewport.height - target.top - target.height
      ? candidates[1]
      : candidates[0];
  return {
    left: clampX((fitting ?? fallback).left),
    top: clampY((fitting ?? fallback).top),
    width,
    maxHeight: viewport.height - 24,
  };
}

function geometryMatches(left: Geometry, right: Geometry) {
  const close = (a: number, b: number) => Math.abs(a - b) < 0.5;
  const sameRect = (a: Rect | null, b: Rect | null) =>
    a === b ||
    Boolean(
      a &&
        b &&
        close(a.top, b.top) &&
        close(a.left, b.left) &&
        close(a.width, b.width) &&
        close(a.height, b.height),
    );
  return (
    left.stepTarget === right.stepTarget &&
    sameRect(left.target, right.target) &&
    sameRect(left.viewport, right.viewport) &&
    close(left.dialogHeight, right.dialogHeight)
  );
}

export function FirstRunTour() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [manualStart, setManualStart] = useState(false);
  const [geometry, setGeometry] = useState(initialGeometry);
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const shortcutUser = useRef<string | null>(null);
  const userId = session?.user.id;
  const steps = mobile ? MOBILE_STEPS : DESKTOP_STEPS;
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  const closeTour = useCallback(
    (preference: "completed" | "skipped") => {
      if (userId) {
        try {
          localStorage.setItem(`lumium_dashboard_tour:${userId}`, preference);
        } catch {}
      }
      window.dispatchEvent(new Event("lumium:close-entry-panels"));
      setIsOpen(false);
      if (
        previousFocus.current instanceof HTMLElement &&
        previousFocus.current.isConnected
      )
        previousFocus.current.focus({ preventScroll: true });
    },
    [userId],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobile(media.matches);
    const frame = requestAnimationFrame(update);
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (isOpen || pathname !== "/dashboard" || sessionPending || !userId)
      return;
    // Keep an explicit shortcut ahead of onboarding for this visit, even after
    // its URL is consumed and a resize switches the mobile/desktop step list.
    if (!manualStart && (shortcutUser.current === userId || quickLaunchAction(new URLSearchParams(window.location.search).get("launch")))) {
      shortcutUser.current = userId;
      return;
    }
    let wanted = manualStart;
    try {
      wanted ||=
        localStorage.getItem(`lumium_dashboard_tour:${userId}`) === null;
    } catch {}
    if (!wanted) return;
    let frame = 0;
    const start = () => {
      if (document.querySelector("[data-dashboard-loading]")) {
        frame = requestAnimationFrame(start);
        return;
      }
      // A notification or a quick user action can open entry before the launch
      // screen finishes. Automatic onboarding must not close that form.
      if (!manualStart && document.querySelector('[role="dialog"]')) return;
      previousFocus.current = document.activeElement;
      setStepIndex(0);
      setIsOpen(true);
      setManualStart(false);
    };
    frame = requestAnimationFrame(start);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, manualStart, pathname, sessionPending, userId]);

  useEffect(() => {
    const start = () => {
      setManualStart(true);
      if (pathname !== "/dashboard") router.push("/dashboard");
    };
    window.addEventListener("lumium:start-tour", start);
    return () => window.removeEventListener("lumium:start-tour", start);
  }, [pathname, router]);

  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.dataset.tourActive = "true";
    return () => {
      delete document.documentElement.dataset.tourActive;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.dispatchEvent(new Event("lumium:close-entry-panels"));
    if (pathname !== step.route) {
      router.push(step.route);
      return;
    }
    let frame = 0;
    let prepared = false;
    let scrolled = false;
    const update = () => {
      if (!prepared) {
        const anchor =
          step.panel === "budget"
            ? visibleTarget("set-budget-limit")
            : step.panel === "navigation" && mobile
              ? visibleTarget("navigation-trigger")
              : step.panel === "chooser"
                ? visibleTarget("add-transaction")
                : document.body;
        if (anchor) {
          if (step.panel === "budget")
            window.dispatchEvent(new Event("lumium:open-budget-limit"));
          if (step.panel === "chooser")
            window.dispatchEvent(new Event("lumium:open-mobile-add"));
          if (step.panel === "entry")
            window.dispatchEvent(new Event("lumium:open-add-transaction"));
          if (step.panel === "navigation" && mobile)
            window.dispatchEvent(new Event("lumium:open-navigation"));
          prepared = true;
        }
      }
      const target = prepared ? visibleTarget(step.target) : undefined;
      if (target && !scrolled) {
        if (!target.closest(".mobile-bottom-nav, .mobile-topbar"))
          target.scrollIntoView({
            block: "start",
            inline: "nearest",
            behavior: "instant",
          });
        scrolled = true;
      }
      const visual = window.visualViewport;
      const viewport = {
        left: visual?.offsetLeft ?? 0,
        top: visual?.offsetTop ?? 0,
        width: visual?.width ?? document.documentElement.clientWidth,
        height: visual?.height ?? window.innerHeight,
      };
      const next = {
        stepTarget: step.target,
        viewport,
        target: target
          ? targetBounds(
              target,
              viewport,
              dialog.current?.getBoundingClientRect().height ?? 240,
            )
          : null,
        dialogHeight: dialog.current?.getBoundingClientRect().height ?? 240,
      };
      setGeometry((current) =>
        geometryMatches(current, next) ? current : next,
      );
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, step, pathname, router, mobile]);

  useEffect(() => {
    if (!isOpen) return;
    dialog.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeTour("skipped");
        return;
      }
      if (event.key === "ArrowRight" && stepIndex < steps.length - 1)
        setStepIndex((index) => index + 1);
      if (event.key === "ArrowLeft" && stepIndex > 0)
        setStepIndex((index) => index - 1);
      if (event.key !== "Tab") return;
      const controls = dialog.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [isOpen, stepIndex, steps.length, closeTour]);

  if (!isOpen) return null;
  const { viewport } = geometry;
  const target = geometry.stepTarget === step.target ? geometry.target : null;
  const right = target ? target.left + target.width : viewport.left;
  const bottom = target ? target.top + target.height : viewport.top;
  const pieces = target
    ? [
        {
          left: viewport.left,
          top: viewport.top,
          width: viewport.width,
          height: target.top - viewport.top,
        },
        {
          left: viewport.left,
          top: bottom,
          width: viewport.width,
          height: viewport.top + viewport.height - bottom,
        },
        {
          left: viewport.left,
          top: target.top,
          width: target.left - viewport.left,
          height: target.height,
        },
        {
          left: right,
          top: target.top,
          width: viewport.left + viewport.width - right,
          height: target.height,
        },
      ]
    : [viewport];
  const last = stepIndex === steps.length - 1;
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
      {target && (
        <div
          aria-hidden="true"
          className="tour-highlight"
          data-tour-highlight={step.target}
          style={target}
        />
      )}
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-dialog-title"
        aria-describedby="tour-dialog-description"
        tabIndex={-1}
        className="tour-dialog"
        data-tour-step={step.target}
        style={dialogPosition({ ...geometry, target })}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t("tourStep")} {stepIndex + 1} {t("of")} {steps.length}
          </p>
          <button
            type="button"
            onClick={() => closeTour("skipped")}
            aria-label={t("close")}
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
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
            onClick={() => closeTour("skipped")}
            className="min-h-11 px-2 text-sm font-semibold text-slate-500"
          >
            {t("tourSkip")}
          </button>
          <div className="flex items-center gap-1">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((index) => index - 1)}
                className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("tourBack")}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                last
                  ? closeTour("completed")
                  : setStepIndex((index) => index + 1)
              }
              className="flex min-h-11 items-center gap-1 rounded-xl bg-[var(--app-accent)] px-3 text-sm font-bold text-white hover:bg-[var(--app-accent-strong)]"
            >
              {t(last ? "tourFinish" : "tourNext")}
              {!last && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
