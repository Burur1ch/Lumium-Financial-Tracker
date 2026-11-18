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
    <main className={`auth-shell auth-shell--${mode}`}>
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
              <defs>
                <radialGradient id="auth-body" cx="30%" cy="22%" r="85%">
                  <stop offset="0" stopColor="#fffaf4" />
                  <stop offset=".55" stopColor="#eee8e5" />
                  <stop offset="1" stopColor="#a998a0" />
                </radialGradient>
                <radialGradient id="auth-warmth" cx="22%" cy="82%" r="70%">
                  <stop stopColor="#ffae6e" stopOpacity=".75" />
                  <stop offset="1" stopColor="#ffae6e" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="auth-red" cx="30%" cy="20%" r="85%">
                  <stop stopColor="#ff7770" />
                  <stop offset=".45" stopColor="#ed3340" />
                  <stop offset="1" stopColor="#a80e23" />
                </radialGradient>
                <radialGradient id="auth-glass" cx="30%" cy="20%" r="85%">
                  <stop stopColor="#8b7771" stopOpacity=".8" />
                  <stop offset="1" stopColor="#26333a" stopOpacity=".95" />
                </radialGradient>
                <radialGradient id="auth-ground">
                  <stop stopColor="#ffad79" stopOpacity=".8" />
                  <stop offset=".35" stopColor="#ed775b" stopOpacity=".32" />
                  <stop offset="1" stopColor="#ed775b" stopOpacity="0" />
                </radialGradient>
                <filter id="auth-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="8" />
                </filter>
                <filter id="auth-soft-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>
              <ellipse
                cx="210"
                cy="264"
                rx="104"
                ry="12"
                fill="#0C171D"
                opacity=".48"
              />
              <ellipse cx="210" cy="264" rx="115" ry="18" fill="url(#auth-ground)" />
              <g className="auth-orbit auth-orbit--outer">
                <ellipse
                  cx="210"
                  cy="154"
                  rx="136"
                  ry="75"
                  fill="none"
                  stroke="#d49a7d"
                  strokeOpacity=".65"
                  strokeWidth="1"
                />
              </g>
              <g className="auth-orbit auth-orbit--inner">
                <ellipse
                  cx="210"
                  cy="154"
                  rx="100"
                  ry="47"
                  fill="none"
                  stroke="#d49a7d"
                  strokeOpacity=".45"
                  strokeWidth="1"
                />
              </g>
              <path
                d="M75 199c38-19 65-19 100 0s67 19 103 0 59-18 83-6"
                fill="none"
                stroke="#e4a381"
                strokeWidth="1"
                strokeLinecap="round"
                opacity=".58"
              />
              <g className="auth-companion-float">
                <g className="auth-companion">
                  <path d="M210 65c-37 0-66 29-66 66v36c0 37 29 66 66 66s66-29 66-66v-36c0-37-29-66-66-66z" fill="#ffad79" opacity=".35" filter="url(#auth-glow)" />
                  <path
                    d="M210 65c-37 0-66 29-66 66v36c0 37 29 66 66 66s66-29 66-66v-36c0-37-29-66-66-66z"
                    fill="url(#auth-body)"
                    stroke="#fff8f2"
                    strokeOpacity=".4"
                  />
                  <path d="M210 65c-37 0-66 29-66 66v36c0 37 29 66 66 66s66-29 66-66v-36c0-37-29-66-66-66z" fill="url(#auth-warmth)" />
                  <path
                    d="M210 65V42"
                    fill="none"
                    stroke="#f7d9c5"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <circle cx="210" cy="37" r="14" fill="#ef4a40" opacity=".65" filter="url(#auth-glow)" />
                  <circle cx="210" cy="37" r="9" fill="url(#auth-red)" stroke="#ff9680" strokeWidth=".7" />
                  <g className="auth-companion__eyes-open">
                    <g className="auth-companion__eye">
                      <ellipse
                        cx="188"
                        cy="147"
                        rx="8"
                        ry="10"
                        fill="#d9c9c4"
                      />
                      <circle
                        className="auth-companion__pupil"
                        cx="188"
                        cy="148"
                        r="3.5"
                        fill="#141c22"
                      />
                      <circle cx="189.5" cy="146.5" r="1" fill="#FFFFFF" />
                    </g>
                    <g className="auth-companion__eye">
                      <ellipse
                        cx="232"
                        cy="147"
                        rx="8"
                        ry="10"
                        fill="#d9c9c4"
                      />
                      <circle
                        className="auth-companion__pupil"
                        cx="232"
                        cy="148"
                        r="3.5"
                        fill="#141c22"
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
                    stroke="#263039"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </g>
              </g>
              <g className="auth-companion__coin">
                <circle cx="322" cy="123" r="28" fill="#f43a3f" opacity=".45" filter="url(#auth-glow)" />
                <circle cx="322" cy="123" r="25" fill="url(#auth-red)" stroke="#ff9480" strokeOpacity=".7" />
                <g fill="none" stroke="#fff3e8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="322" cy="115" rx="9" ry="3.5" />
                  <path d="M313 115v15c0 2 4 4 9 4s9-2 9-4v-15m-18 5c0 2 4 4 9 4s9-2 9-4m-18 5c0 2 4 4 9 4s9-2 9-4" />
                </g>
              </g>
              <g fill="url(#auth-glass)" stroke="#d7a88c" strokeOpacity=".65">
                <circle cx="91" cy="94" r="20" />
                <circle cx="96" cy="221" r="20" />
                <circle cx="318" cy="210" r="20" />
              </g>
              <g fill="#ffe0bf">
                <rect x="81" y="96" width="4" height="6" rx="1" />
                <rect x="88" y="91" width="4" height="11" rx="1" />
                <rect x="95" y="85" width="4" height="17" rx="1" />
                <rect x="86" y="214" width="20" height="14" rx="2" />
              </g>
              <path d="M88 219h16m-13 5h5" fill="none" stroke="#715c54" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M309 209c0-4 4-7 9-7 2 0 4 .5 5 1.5l3-1-.5 4c2 1 3 3 3 5v3h-3l-2 4h-3l-.5-2h-5l-.5 2h-3l-1-4-3-2v-4h2zm14-2h.1" fill="none" stroke="#ffe0bf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <g fill="#ffc59c">
                <circle cx="145" cy="91" r="3" /><circle cx="289" cy="126" r="3" />
                <circle cx="63" cy="197" r="3" /><circle cx="351" cy="184" r="3" />
              </g>
              <circle cx="57" cy="145" r="4" fill="url(#auth-red)" />
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
