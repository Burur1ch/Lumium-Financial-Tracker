"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { authClient } from "@/utils/auth/client";
import { quickLaunchAction } from "@/utils/quick-launch";
import { cachedOfflineAccount } from "@/utils/offline-transactions";
import { usePrefs } from "@/store/prefs";

/** Launchers open UI only; financial writes still use the existing explicit actions. */
export function QuickLaunch() {
  const pathname = usePathname();
  const params = useSearchParams();
  const action = quickLaunchAction(params.get("launch"));
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!action || pathname !== "/dashboard" || isPending || !userId) return;
    let frame = 0;
    const launch = () => {
      // Account preferences, offline drafts and all entry listeners must be ready.
      if (usePrefs.getState().ownerId !== userId || cachedOfflineAccount()?.userId !== userId
        || document.querySelector("[data-dashboard-loading]")) {
        frame = requestAnimationFrame(launch); return;
      }
      if (action === "quick") {
        const target = Array.from(document.querySelectorAll<HTMLElement>('[data-tour="quick-actions"]'))
          .find((element) => element.getBoundingClientRect().width > 0);
        if (!target) { frame = requestAnimationFrame(launch); return; }
        target.scrollIntoView({ block: "start" });
        target.focus({ preventScroll: true });
      }
      // Consume before opening: refreshing, closing or rerendering cannot replay it.
      const url = new URL(window.location.href);
      url.searchParams.delete("launch");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      window.dispatchEvent(new Event("lumium:close-entry-panels"));
      if (action === "scan") window.dispatchEvent(new Event("lumium:open-receipt-scanner"));
      if (action === "add") window.dispatchEvent(new Event("lumium:open-add-transaction"));
    };
    frame = requestAnimationFrame(launch);
    return () => cancelAnimationFrame(frame);
  }, [action, pathname, isPending, userId]);
  return null;
}
