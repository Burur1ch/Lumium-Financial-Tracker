"use client";

import React, { useState } from "react";
import { authClient } from "@/utils/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";
import {
  AuthExperience,
  type AuthFocusStage,
} from "@/components/auth/auth-experience";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusStage, setFocusStage] = useState<AuthFocusStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFocusStage("loading");
    setError(null);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message ?? t("signInFailed"));
      setFocusStage("error");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <AuthExperience
      mode="login"
      focusStage={focusStage}
      onFocusStageChange={setFocusStage}
    >
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
            {t("signInTitle")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("signInSubtitle")}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {t("email")}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onFocus={() => setFocusStage("email")}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@company.by"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {t("password")}
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onFocus={() => setFocusStage("password")}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            onFocus={() => setFocusStage("idle")}
            className="min-h-12 w-full rounded-xl bg-[var(--app-accent)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--app-accent-strong)] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t("noAccount")}{" "}
          <Link
            href="/register"
            className="font-semibold text-[var(--app-accent-strong)] hover:underline dark:text-red-400"
          >
            {t("signUp")}
          </Link>
        </p>
      </div>
    </AuthExperience>
  );
}
