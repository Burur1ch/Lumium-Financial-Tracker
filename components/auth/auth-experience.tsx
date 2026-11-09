"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/hooks/useI18n";

export type AuthFocusStage =
  | "idle"
  | "name"
  | "email"
  | "password"
  | "loading"
  | "error";

export function AuthExperience({
  mode,
  focusStage,
  children,
}: {
  mode: "login" | "register";
  focusStage: AuthFocusStage;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <main className="auth-shell">
      <div className="auth-theme-toggle">
        <ThemeToggle compact />
      </div>

      <div className="auth-layout">
        <section
          className="auth-scene"
          data-focus={focusStage}
          aria-label={t("authSceneLabel")}
        >
          <div className="auth-scene__brand">
            <BrandLogo wordmarkClassName="text-white" />
          </div>

          <div
            className="auth-scene__art"
            role="img"
            aria-label={t("authCompanionName")}
          >
            <svg
              viewBox="0 0 420 300"
              className="h-full w-full"
              aria-hidden="true"
            >
              <ellipse
                cx="210"
                cy="264"
                rx="104"
                ry="12"
                fill="#0C171D"
                opacity=".48"
              />
              <g className="auth-orbit auth-orbit--outer">
                <ellipse
                  cx="210"
                  cy="154"
                  rx="136"
                  ry="75"
                  fill="none"
                  stroke="#56676D"
                  strokeWidth="1.5"
                />
              </g>
              <g className="auth-orbit auth-orbit--inner">
                <ellipse
                  cx="210"
                  cy="154"
                  rx="100"
                  ry="47"
                  fill="none"
                  stroke="#34464E"
                  strokeWidth="1.5"
                />
              </g>
              <path
                d="M75 199c38-19 65-19 100 0s67 19 103 0 59-18 83-6"
                fill="none"
                stroke="#718186"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".58"
              />
              <g className="auth-companion">
                <path
                  d="M210 65c-37 0-66 29-66 66v36c0 37 29 66 66 66s66-29 66-66v-36c0-37-29-66-66-66z"
                  fill="#F4F5F0"
                  stroke="#D8DEDA"
                  strokeWidth="2"
                />
                <path
                  d="M210 65V42"
                  fill="none"
                  stroke="#D8DEDA"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle cx="210" cy="37" r="8" fill="#D92D3A" />
                <circle cx="188" cy="153" r="5.5" fill="#23343A" />
                <circle cx="232" cy="153" r="5.5" fill="#23343A" />
                <path
                  d="M199 172c6 7 16 7 22 0"
                  fill="none"
                  stroke="#66787B"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  className="auth-companion__visor"
                  d="M174 146h72v21c0 11-9 20-20 20h-32c-11 0-20-9-20-20z"
                  fill="#D92D3A"
                />
                <path
                  d="M192 153h36"
                  stroke="#F8E8E8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="auth-companion__visor-mark"
                />
              </g>
              <g className="auth-companion__coin">
                <circle cx="322" cy="123" r="21" fill="#D92D3A" />
                <circle
                  cx="322"
                  cy="123"
                  r="13"
                  fill="none"
                  stroke="#F7D8D9"
                  strokeWidth="2"
                />
                <path
                  d="M322 114v18m6-14c-2-3-9-3-11 1-3 5 10 5 10 10-1 5-9 6-13 2"
                  fill="none"
                  stroke="#FFF8F6"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
              <circle cx="96" cy="111" r="4" fill="#D92D3A" />
              <circle cx="338" cy="207" r="3" fill="#BCC9C8" />
              <circle cx="111" cy="220" r="2.5" fill="#718186" />
            </svg>
          </div>

          <div className="auth-scene__copy">
            <h2>
              {mode === "login"
                ? t("authSceneLoginTitle")
                : t("authSceneRegisterTitle")}
            </h2>
            <p>
              {mode === "login"
                ? t("authSceneLoginCopy")
                : t("authSceneRegisterCopy")}
            </p>
          </div>
        </section>

        <section className="auth-form-side">{children}</section>
      </div>
    </main>
  );
}
