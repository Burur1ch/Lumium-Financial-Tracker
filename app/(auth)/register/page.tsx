"use client";

import React, { useState } from "react";
import { authClient } from "@/utils/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signUpError } = await authClient.signUp.email({
      email,
      password,
      name: fullName,
      callbackURL: "/dashboard",
    });

    if (signUpError) {
      setError(signUpError.message ?? t("signUpFailed"));
      setLoading(false);
    } else {
      // Перенаправляем на дашборд после успешной регистрации
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-8 dark:bg-[#0b0f1a]">
      <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))]">
        <ThemeToggle compact />
      </div>
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2.5" aria-label="Lumium">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 font-black text-white">L</span>
          <span className="text-xl font-bold tracking-[-0.03em] text-slate-950 dark:text-slate-50">Lumium</span>
        </Link>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
            {t("createAccountTitle")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("createAccountSubtitle")}</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t("name")}
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иван Иванов"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t("email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t("password")}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? t("creatingAccount") : t("signUp")}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t("alreadyHaveAccount")}{" "}
          <Link
            href="/login"
            className="font-semibold text-red-500 hover:underline"
          >
            {t("signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
