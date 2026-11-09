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

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [focusStage, setFocusStage] = useState<AuthFocusStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFocusStage("loading");
    setError(null);

    const { error: signUpError } = await authClient.signUp.email({
      email,
      password,
      name: fullName,
      callbackURL: "/dashboard",
    });

    if (signUpError) {
      setError(signUpError.message ?? t("signUpFailed"));
      setFocusStage("error");
      setLoading(false);
    } else {
      // Перенаправляем на дашборд после успешной регистрации
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <AuthExperience
      mode="register"
      focusStage={focusStage}
      onFocusStageChange={setFocusStage}
    >
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
            {t("createAccountTitle")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("createAccountSubtitle")}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label
              htmlFor="register-name"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {t("name")}
            </label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onFocus={() => setFocusStage("name")}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иван Иванов"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="register-email"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {t("email")}
            </label>
            <input
              id="register-email"
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
              htmlFor="register-password"
              className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {t("password")}
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
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
            {loading ? t("creatingAccount") : t("signUp")}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t("alreadyHaveAccount")}{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--app-accent-strong)] hover:underline dark:text-red-400"
          >
            {t("signIn")}
          </Link>
        </p>
      </div>
    </AuthExperience>
  );
}
