"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Передаем full_name в метаданные, чтобы наш триггер в БД подхватил его
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      // Перенаправляем на дашборд после успешной регистрации
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Создать аккаунт
          </h1>
          <p className="text-sm text-slate-500">
            Добро пожаловать в финансовый трекер Lumium
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Имя
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иван Иванов"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder-slate-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 text-black"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder-slate-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 text-black"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder-slate-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 text-black"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? "Создание..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-semibold text-red-500 hover:underline"
          >
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
