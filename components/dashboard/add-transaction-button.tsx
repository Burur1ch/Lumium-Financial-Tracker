"use client";

import { Plus } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

export function AddTransactionButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("lumium:open-add-transaction"))}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-red-600 active:scale-[0.98] ${className}`}
    >
      <Plus className="h-4 w-4" />
      {t("addTransaction")}
    </button>
  );
}
