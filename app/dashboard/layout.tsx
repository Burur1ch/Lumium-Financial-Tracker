"use client";

import React, { useState } from "react";
import Sidebar from "@/components/dashboard/sidebar";
import { Menu } from "lucide-react";
import { NavigationProgress } from "@/components/navigation-progress";
import { PeriodLoadingWrapper } from "@/components/dashboard/period-loading-wrapper";
import { Suspense } from "react";
import { StoreHydration } from "@/components/store-hydration";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <StoreHydration />
      {/* 1. ДЕСКТОПНЫЙ САЙДБАР (Виден от lg экрана и выше) */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* 2. МОБИЛЬНЫЙ САЙДБАР (Выдвижной оверлей для экранов < lg) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-white dark:bg-slate-950">
            <Sidebar onNavigate={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* 3. ОСНОВНАЯ КОНТЕНТНАЯ ОБЛАСТЬ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ВЕРХНЯЯ МОБИЛЬНАЯ ШАПКА (Появляется только на мобилках и планшетах) */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 h-16 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center text-white font-bold text-sm">
              E
            </div>
            <span className="font-semibold text-base text-slate-800 dark:text-slate-200">
              Lumium
            </span>
          </div>

          {/* Кнопка Гамбургер */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Рабочая область контента конкретной страницы */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/20">
          <Suspense>
            <NavigationProgress />
            <PeriodLoadingWrapper>{children}</PeriodLoadingWrapper>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
