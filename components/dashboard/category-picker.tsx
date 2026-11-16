"use client";

import { useState, type SelectHTMLAttributes } from "react";
import { useI18n } from "@/hooks/useI18n";
import {
  categoryPath,
  isCategoryArchived,
  type CategoryLike,
} from "@/utils/category-catalog";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  categories: CategoryLike[];
  emptyLabel?: string;
  emptyValue?: string;
  includeArchived?: boolean;
};

export function CategoryPicker({
  categories,
  emptyLabel,
  emptyValue = "",
  includeArchived = false,
  value,
  defaultValue,
  onChange,
  className,
  ...props
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [localValue, setLocalValue] = useState(defaultValue ?? emptyValue);
  const selected = value ?? localValue;
  const available = categories.filter(
    (c) =>
      includeArchived ||
      !isCategoryArchived(c, categories) ||
      c.id === selected,
  );
  const options = available.filter(
    (c) =>
      c.id === selected ||
      categoryPath(c, categories, t)
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="min-w-0 space-y-1.5">
      {available.length > 10 && !props.disabled && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("categorySearch")}
          aria-label={t("categorySearch")}
          className="min-h-10 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-sm text-slate-800 outline-none focus:border-red-500 dark:border-slate-700 dark:text-slate-100"
        />
      )}
      <select
        {...props}
        className={
          className ??
          "min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        }
        value={selected}
        onChange={(event) => {
          setLocalValue(event.target.value);
          onChange?.(event);
        }}
      >
        <option value={emptyValue}>
          {emptyLabel ?? t("uncategorizedOption")}
        </option>
        {categories
          .filter((c) => !c.parent_id)
          .map((root) => {
            const group = options.filter(
              (c) => c.id === root.id || c.parent_id === root.id,
            );
            return group.length ? (
              <optgroup key={root.id} label={categoryPath(root, categories, t)}>
                {group.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryPath(c, categories, t)}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
      </select>
    </div>
  );
}
