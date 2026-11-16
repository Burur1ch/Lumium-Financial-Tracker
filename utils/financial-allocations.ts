import type { CategoryLike } from "./category-catalog";

export interface AllocationTransaction {
  id: string;
  amount: string | number;
  category_id: string | null;
}
export interface AllocationSplit {
  transaction_id: string;
  category_id: string | null;
  amount: string | number;
}

// Store shares in the same 8-decimal units as transactions. Distribute the
// remainder rather than rounding each converted share independently.
export function rebalanceAllocationAmounts(total: string, weights: string[]) {
  const zero = BigInt(0),
    one = BigInt(1),
    scale = BigInt(100000000);
  const units = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * scale + BigInt(fraction.padEnd(8, "0").slice(0, 8));
  };
  const target = units(total);
  const values = weights.map(units);
  const sum = values.reduce((a, b) => a + b, zero);
  if (target <= zero || sum <= zero || target < BigInt(values.length))
    throw new Error("INVALID_SPLITS");
  const parts = values.map((weight, index) => ({
    index,
    value: (target * weight) / sum,
    remainder: (target * weight) % sum,
  }));
  let left = target - parts.reduce((sum, part) => sum + part.value, zero);
  for (const part of [...parts].sort((a, b) =>
    a.remainder > b.remainder
      ? -1
      : a.remainder < b.remainder
        ? 1
        : a.index - b.index,
  )) {
    if (left === zero) break;
    part.value += one;
    left -= one;
  }
  if (parts.some((part) => part.value <= zero))
    throw new Error("INVALID_SPLITS");
  return parts.map(
    (part) =>
      `${part.value / scale}.${String(part.value % scale).padStart(8, "0")}`,
  );
}

// A split replaces the transaction's primary category; it never adds to it.
export function allocateTransactions<T extends AllocationTransaction>(
  rows: T[],
  splits: AllocationSplit[],
) {
  const byTransaction = new Map<string, AllocationSplit[]>();
  for (const split of splits) {
    const list = byTransaction.get(split.transaction_id) ?? [];
    list.push(split);
    byTransaction.set(split.transaction_id, list);
  }
  return rows.flatMap((row) => {
    const parts = byTransaction.get(row.id);
    return parts?.length
      ? parts.map((part) => ({
          ...row,
          category_id: part.category_id,
          amount: Number(part.amount),
        }))
      : [{ ...row, amount: Number(row.amount) }];
  });
}

export function sumCategoryAllocations(
  rows: { category_id: string | null; amount: string | number }[],
  categories: CategoryLike[],
) {
  const parents = new Map(
    categories.map((category) => [category.id, category.parent_id]),
  );
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.category_id) continue;
    const amount = Number(row.amount);
    totals.set(row.category_id, (totals.get(row.category_id) ?? 0) + amount);
    const parent = parents.get(row.category_id);
    if (parent) totals.set(parent, (totals.get(parent) ?? 0) + amount);
  }
  return totals;
}

// A parent budget covers its child budgets. Sum only non-overlapping scopes.
export function independentBudgets<
  T extends { category_id: string; parent_id?: string | null },
>(rows: T[]) {
  const ids = new Set(rows.map((row) => row.category_id));
  return rows.filter((row) => !row.parent_id || !ids.has(row.parent_id));
}
