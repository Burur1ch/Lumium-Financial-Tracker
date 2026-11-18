"use client";

import React from "react";
import Sidebar from "@/components/dashboard/sidebar";
import { NavigationProgress } from "@/components/navigation-progress";
import { PeriodLoadingWrapper } from "@/components/dashboard/period-loading-wrapper";
import { Suspense } from "react";
import { MobileAppChrome } from "@/components/dashboard/mobile-app-chrome";
import AddExpenseModal from "@/components/dashboard/add-expense-modal";
import { RecurringProcessor } from "@/components/dashboard/recurring-processor";
import { CurrencyRateSync } from "@/components/currency-rate-sync";
import { MobileReceiptScanner } from "@/components/dashboard/mobile-receipt-scanner";
import { DashboardLaunchLoader } from "@/components/dashboard/dashboard-launch-loader";
import { FirstRunTour } from "@/components/dashboard/first-run-tour";
import { ConnectionNotice, PushEntry } from "@/components/dashboard/connection-notice";
import { AccountSync } from "@/components/dashboard/account-sync";
import { OfflineTransactions } from "@/components/dashboard/offline-transactions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[var(--app-canvas)]">
      <DashboardLaunchLoader />
      <AccountSync />
      <CurrencyRateSync />
      <RecurringProcessor />
      <FirstRunTour />
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Suspense fallback={null}>
          <MobileAppChrome />
        </Suspense>
        <ConnectionNotice />
        <OfflineTransactions />

        <main className="dashboard-main flex-1 overflow-y-auto overscroll-contain bg-[var(--app-canvas)]">
          <Suspense>
            <NavigationProgress />
            <PeriodLoadingWrapper>{children}</PeriodLoadingWrapper>
          </Suspense>
        </main>
      </div>
      <MobileReceiptScanner />
      <AddExpenseModal hideTrigger />
      <PushEntry />
    </div>
  );
}
