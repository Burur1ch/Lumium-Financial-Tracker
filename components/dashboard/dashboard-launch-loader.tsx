"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

const BAR_HEIGHTS = [36, 58, 45, 76, 62, 94];

export function DashboardLaunchLoader() {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const hideTimer = window.setTimeout(
      () => setExiting(true),
      reducedMotion ? 250 : 1000,
    );
    const removeTimer = window.setTimeout(
      () => setVisible(false),
      reducedMotion ? 270 : 1180,
    );

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`dashboard-launch-screen${exiting ? " is-exiting" : ""}`}
      role="status"
      aria-label={t("loadingDashboard")}
    >
      <div className="dashboard-launch-content" aria-hidden="true">
        <div className="dashboard-launch-wordmark">Lumium</div>
        <div className="dashboard-launch-chart">
          {BAR_HEIGHTS.map((height, index) => (
            <span
              key={index}
              className="dashboard-launch-bar"
              style={{
                height: `${height}%`,
                animationDelay: `${index * 70}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
