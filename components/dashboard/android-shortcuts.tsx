"use client";

import Link from "next/link";
import { Camera, Plus, Smartphone, Zap } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { quickLaunchUrl } from "@/utils/quick-launch";

export function AndroidShortcuts() {
  const { t } = useI18n();
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" aria-labelledby="android-shortcuts-title">
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/30"><Smartphone className="h-5 w-5" /></span><div><h2 id="android-shortcuts-title" className="text-base font-bold text-slate-950 dark:text-white">{t("androidShortcutsTitle")}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{t("androidShortcutsHint")}</p></div></div>
    <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600 dark:text-slate-300"><li>{t("androidShortcutStep1")}</li><li>{t("androidShortcutStep2")}</li><li>{t("androidShortcutStep3")}</li></ol>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">{([
      { action: "scan", icon: Camera, label: "shortcutScan" },
      { action: "add", icon: Plus, label: "shortcutAdd" },
      { action: "quick", icon: Zap, label: "shortcutQuick" },
    ] as const).map(({ action, icon: Icon, label }) => <Link key={action} href={quickLaunchUrl(action)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 active:scale-[0.98] dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"><Icon className="h-4 w-4 shrink-0" />{t(label)}</Link>)}</div>
    <p className="mt-3 text-xs leading-5 text-slate-500">{t("androidShortcutsUpdateHint")}</p>
  </section>;
}
