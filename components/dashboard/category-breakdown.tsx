"use client";

import { useI18n } from "@/hooks/useI18n";

export interface CategoryBreakdownRow {
  id: string;
  name: string;
  system_key?: string | null;
  color: string;
  income: number;
  expense: number;
  isDirect?: boolean;
}
export function CategoryBreakdown({
  rows,
}: {
  rows: Array<CategoryBreakdownRow & { children: CategoryBreakdownRow[] }>;
}) {
  const { t, fmt, categoryName } = useI18n();
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <details
          key={row.id}
          className="rounded-xl border border-slate-100 px-3 dark:border-slate-800"
        >
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              {categoryName(row) ||
                `${t("uncategorized")} · ${t(row.income > 0 ? "income" : "expense")}`}
            </span>
            <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">
              {fmt(row.expense || row.income)}
            </span>
          </summary>
          <div className="border-t border-slate-100 pb-2 dark:border-slate-800">
            {row.children.map((child) => (
              <div
                key={child.id}
                className="flex min-h-10 items-center justify-between gap-3 pl-4 text-xs text-slate-500"
              >
                <span>
                  {child.isDirect
                    ? t(row.name ? "noSubcategory" : "uncategorized")
                    : categoryName(child)}
                </span>
                <span>{fmt(child.expense || child.income)}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
