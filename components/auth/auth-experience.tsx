"use client";

import {
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
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
  onFocusStageChange,
  children,
}: {
  mode: "login" | "register";
  focusStage: AuthFocusStage;
  onFocusStageChange: (stage: AuthFocusStage) => void;
  children: ReactNode;
}) {
  const [gazeOffset, setGazeOffset] = useState(0);
  const { t } = useI18n();
  const updateGaze = (target: EventTarget | null) => {
    if (!(target instanceof HTMLInputElement) || target.type === "password") {
      setGazeOffset(0);
      return;
    }

    const textLength = Math.max(target.value.length, target.placeholder.length, 10);
    const caretPosition = target.selectionStart ?? target.value.length;
    const progress = Math.min(1, caretPosition / textLength);
    setGazeOffset((progress - 0.5) * 5);
  };
  const handleBlurCapture = (event: FocusEvent<HTMLElement>) => {
    updateGaze(event.relatedTarget);
    if (!(event.relatedTarget instanceof HTMLInputElement)) {
      onFocusStageChange("idle");
    }
  };
  const handleInputCapture = (event: SyntheticEvent<HTMLElement>) => {
    updateGaze(event.target);
  };
  const sceneStyle: CSSProperties & { "--gaze-x": string } = {
    "--gaze-x": `${gazeOffset}px`,
  };

  return (
    <main className="auth-shell">
      <div className="auth-theme-toggle">
        <ThemeToggle compact />
      </div>

      <div className="auth-layout">
        <section
          className="auth-scene"
          data-focus={focusStage}
          style={sceneStyle}
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
              <g className="auth-companion-float">
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
                  <g className="auth-companion__eyes-open">
                    <g className="auth-companion__eye">
                      <ellipse
                        cx="188"
                        cy="147"
                        rx="8"
                        ry="10"
                        fill="#FFFFFF"
                      />
                      <circle
                        className="auth-companion__pupil"
                        cx="188"
                        cy="148"
                        r="3.5"
                        fill="#23343A"
                      />
                      <circle cx="189.5" cy="146.5" r="1" fill="#FFFFFF" />
                    </g>
                    <g className="auth-companion__eye">
                      <ellipse
                        cx="232"
                        cy="147"
                        rx="8"
                        ry="10"
                        fill="#FFFFFF"
                      />
                      <circle
                        className="auth-companion__pupil"
                        cx="232"
                        cy="148"
                        r="3.5"
                        fill="#23343A"
                      />
                      <circle cx="233.5" cy="146.5" r="1" fill="#FFFFFF" />
                    </g>
                  </g>
                  <g className="auth-companion__eyes-closed">
                    <path
                      d="M179 148c5 5 13 5 18 0m26 0c5 5 13 5 18 0"
                      fill="none"
                      stroke="#23343A"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </g>
                  <path
                    d="M199 176c6 7 16 7 22 0"
                    fill="none"
                    stroke="#66787B"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>
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

        <section
          className="auth-form-side"
          onBlurCapture={handleBlurCapture}
          onChangeCapture={handleInputCapture}
          onClickCapture={handleInputCapture}
          onFocusCapture={handleInputCapture}
          onKeyUpCapture={handleInputCapture}
          onSelectCapture={handleInputCapture}
        >
          {children}
        </section>
      </div>
    </main>
  );
}
