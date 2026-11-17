"use client";

import { useI18n } from "@/hooks/useI18n";
import { ChevronDown } from "lucide-react";
import { CategoryArtwork } from "./category-artwork";

export interface CategoryBreakdownRow {
  id: string;
  name: string;
  system_key?: string | null;
  color: string;
  icon?: string | null;
  income: number;
  expense: number;
  isDirect?: boolean;
}
export function CategoryBreakdown({
  rows,
  type = "expense",
}: {
  rows: Array<CategoryBreakdownRow & { children: CategoryBreakdownRow[] }>;
  type?: "income" | "expense";
}) {
  const { t, fmt, categoryName } = useI18n();
  return (
    <div className="space-y-2">
      {rows
        .filter((row) => row[type] > 0)
        .map((row) => (
          <details
            key={row.id}
            className="group rounded-xl border border-slate-100 px-3 dark:border-slate-800"
          >
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <CategoryArtwork
                  icon={row.icon ?? "tag"}
                  name={row.name}
                  systemKey={row.system_key}
                  className="h-8 w-8 rounded-lg"
                />
                {categoryName(row) ||
                  `${t("uncategorized")} · ${t(row.income > 0 ? "income" : "expense")}`}
              </span>
              <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {fmt(row[type])}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-100 pb-2 dark:border-slate-800">
              {row.children
                .filter((child) => child[type] > 0)
                .map((child) => (
                  <div
                    key={child.id}
                    className="flex min-h-10 items-center justify-between gap-3 pl-4 text-xs text-slate-500"
                  >
                    <span>
                      {child.isDirect
                        ? t(row.name ? "noSubcategory" : "uncategorized")
                        : categoryName(child)}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {fmt(child[type])}
                    </span>
                  </div>
                ))}
            </div>
          </details>
        ))}
    </div>
  );
}
