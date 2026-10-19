"use client";

import React from "react";
import Sidebar from "@/components/dashboard/sidebar";
import { NavigationProgress } from "@/components/navigation-progress";
import { PeriodLoadingWrapper } from "@/components/dashboard/period-loading-wrapper";
import { Suspense } from "react";
import { StoreHydration } from "@/components/store-hydration";
import { MobileAppChrome } from "@/components/dashboard/mobile-app-chrome";
import AddExpenseModal from "@/components/dashboard/add-expense-modal";
import { RecurringProcessor } from "@/components/dashboard/recurring-processor";
import { CurrencyRateSync } from "@/components/currency-rate-sync";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[var(--app-canvas)]">
      <StoreHydration />
      <CurrencyRateSync />
      <RecurringProcessor />
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileAppChrome />

        <main className="dashboard-main flex-1 overflow-y-auto overscroll-contain bg-[var(--app-canvas)]">
          <Suspense>
            <NavigationProgress />
            <PeriodLoadingWrapper>{children}</PeriodLoadingWrapper>
          </Suspense>
        </main>
      </div>
      <AddExpenseModal hideTrigger />
    </div>
  );
}
