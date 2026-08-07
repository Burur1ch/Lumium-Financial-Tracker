import React from 'react'

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 w-full max-w-7xl mx-auto animate-pulse select-none">
      
      {/* 1. Скелетон Шапки */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="h-10 w-full sm:w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>

      {/* 2. Скелетон Карточек Метрик */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[140px] rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
              <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            </div>
            <div className="h-5 w-28 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
          </div>
        ))}
      </div>

      {/* 3. Скелетон Графиков (2/3 и 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[380px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-3 w-40 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
            </div>
            <div className="h-7 w-24 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          </div>
          <div className="w-full h-48 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-100 dark:border-slate-800/80" />
        </div>
        
        <div className="h-[380px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
          </div>
          <div className="w-32 h-32 rounded-full border-8 border-slate-100 dark:border-slate-800 mx-auto my-4" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-6 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* 4. Скелетон Таблицы */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
        <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800/40 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                  <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
                </div>
              </div>
              <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
