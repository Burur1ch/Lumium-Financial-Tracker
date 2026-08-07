import React from "react";

export default function TransactionsLoading() {
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 w-full max-w-7xl mx-auto animate-pulse select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-44 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-4 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>
      <div className="h-14 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
      <div className="h-[400px] w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800" />
    </div>
  );
}
