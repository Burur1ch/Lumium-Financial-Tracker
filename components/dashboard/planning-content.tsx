"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  Loader2,
  Plus,
  Repeat2,
  Sparkles,
  Target,
  Trash2,
  WandSparkles,
} from "lucide-react";
import {
  applyTransactionRule,
  createRecurringTransaction,
  createSavingsGoal,
  createTransactionRule,
  deleteRecurringTransaction,
  deleteSavingsGoal,
  deleteTransactionRule,
  materializeRecurringTransaction,
  setSavingsGoalProgress,
} from "@/app/dashboard/actions";
import { Money } from "@/components/money";
import { useI18n } from "@/hooks/useI18n";
import { RATES, usePrefs } from "@/store/prefs";

interface CategoryOption {
  id: string;
  name: string;
  color: string;
  type: "expense" | "income";
}

interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  type: "expense" | "income";
  frequency: "weekly" | "monthly" | "yearly";
  nextDate: string;
  autoCreate: boolean;
  active: boolean;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

interface RuleItem {
  id: string;
  name: string;
  matchText: string;
  type: "expense" | "income" | null;
  active: boolean;
  markReviewed: boolean;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

interface GoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  color: string;
  status: "active" | "completed";
}

export function PlanningContent({
  categories,
  recurring,
  rules,
  goals,
}: {
  categories: CategoryOption[];
  recurring: RecurringItem[];
  rules: RuleItem[];
  goals: GoalItem[];
}) {
  const router = useRouter();
  const { t, fmtDate } = useI18n();
  const { currency } = usePrefs();
  const rate = RATES[currency] ?? 1;
  const [tab, setTab] = useState<"recurring" | "rules" | "goals">("recurring");
  const [showForm, setShowForm] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ruleType, setRuleType] = useState<"expense" | "income">("expense");
  const [recurringType, setRecurringType] = useState<"expense" | "income">("expense");
  const [goalProgress, setGoalProgress] = useState<Record<string, string>>({});

  const refresh = () => {
    setShowForm(false);
    setError(null);
    router.refresh();
  };

  const run = async (
    id: string,
    action: () => Promise<{ success: boolean }>,
  ) => {
    setPendingId(id);
    setError(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(t("genericError"));
        return;
      }
      refresh();
    } catch {
      setError(t("genericError"));
    } finally {
      setPendingId(null);
    }
  };

  const submitForm = async (
    event: React.FormEvent<HTMLFormElement>,
    action: (formData: FormData) => Promise<{ success: boolean }>,
  ) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("currency", currency);
      const result = await action(formData);
      if (!result.success) {
        setError(t("genericError"));
        return;
      }
      refresh();
    } catch {
      setError(t("genericError"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100";
  const tabs = [
    { key: "recurring" as const, label: t("recurringTransactions"), icon: Repeat2, count: recurring.length },
    { key: "rules" as const, label: t("automationRules"), icon: WandSparkles, count: rules.length },
    { key: "goals" as const, label: t("savingsGoals"), icon: Target, count: goals.length },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:space-y-7 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-50 md:text-3xl">{t("planning")}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("planningSubtitle")}</p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-bold text-white hover:bg-red-600">
          <Plus className="h-4 w-4" /> {t("addNew")}
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button key={key} type="button" onClick={() => { setTab(key); setShowForm(false); setError(null); }} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold ${tab === key ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950" : "bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800"}`}>
            <Icon className="h-4 w-4" /> {label} <span className="opacity-60">{count}</span>
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}

      {showForm && tab === "recurring" && (
        <form onSubmit={(event) => void submitForm(event, createRecurringTransaction)} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3">
          <input name="name" required placeholder={t("recurringNamePlaceholder")} className={inputClass} />
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder={t("amount")} className={inputClass} />
          <select name="type" value={recurringType} onChange={(event) => setRecurringType(event.target.value as "expense" | "income")} className={inputClass}><option value="expense">{t("expense")}</option><option value="income">{t("income")}</option></select>
          <select name="category_id" className={inputClass}><option value="">{t("uncategorizedOption")}</option>{categories.filter((category) => category.type === recurringType).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <select name="frequency" className={inputClass}><option value="weekly">{t("weekly")}</option><option value="monthly">{t("monthly")}</option><option value="yearly">{t("yearly")}</option></select>
          <input name="next_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><input name="auto_create" type="checkbox" className="h-4 w-4 accent-red-500" />{t("autoCreateTransaction")}</label>
          <button type="submit" disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-1">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("save")}</button>
        </form>
      )}

      {showForm && tab === "rules" && (
        <form onSubmit={(event) => void submitForm(event, createTransactionRule)} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3">
          <input name="name" required placeholder={t("ruleNamePlaceholder")} className={inputClass} />
          <input name="match_text" required minLength={2} placeholder={t("matchTextPlaceholder")} className={inputClass} />
          <select name="type" value={ruleType} onChange={(event) => setRuleType(event.target.value as "expense" | "income")} className={inputClass}><option value="expense">{t("expense")}</option><option value="income">{t("income")}</option></select>
          <select name="category_id" className={inputClass}><option value="">{t("uncategorizedOption")}</option>{categories.filter((category) => category.type === ruleType).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><input name="mark_reviewed" type="checkbox" defaultChecked className="h-4 w-4 accent-red-500" />{t("markMatchingReviewed")}</label>
          <button type="submit" disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{t("createRule")}</button>
        </form>
      )}

      {showForm && tab === "goals" && (
        <form onSubmit={(event) => void submitForm(event, createSavingsGoal)} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-3">
          <input name="name" required placeholder={t("goalNamePlaceholder")} className={inputClass} />
          <input name="target_amount" type="number" min="0.01" step="0.01" required placeholder={t("targetAmount")} className={inputClass} />
          <input name="current_amount" type="number" min="0" step="0.01" placeholder={t("savedAlready")} className={inputClass} />
          <input name="target_date" type="date" className={inputClass} />
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{t("goalColor")}<input name="color" type="color" defaultValue="#ef4444" className="ml-auto h-8 w-10" /></label>
          <button type="submit" disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}{t("createGoal")}</button>
        </form>
      )}

      {tab === "recurring" && (
        <section className="space-y-3">
          {recurring.length === 0 ? <EmptyState icon={CalendarClock} title={t("noRecurringTransactions")} description={t("noRecurringTransactionsHint")} /> : recurring.map((item) => (
            <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: item.categoryColor ?? "#ef4444" }}><Repeat2 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{item.name}</h3><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.categoryName ?? t("uncategorized")} · {t(item.frequency)} · {t("nextPayment")}: {fmtDate(item.nextDate)}</p></div>
              <strong className={item.type === "income" ? "text-emerald-500" : "text-slate-900 dark:text-slate-100"}>{item.type === "income" ? "+" : "-"}<Money amount={item.amount} decimals /></strong>
              <div className="flex gap-1"><button type="button" disabled={pendingId === item.id} onClick={() => void run(item.id, () => materializeRecurringTransaction(item.id))} className="min-h-11 rounded-xl bg-red-500 px-3 text-xs font-bold text-white disabled:opacity-50">{pendingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("createNow")}</button><button type="button" disabled={pendingId === item.id} onClick={() => void run(item.id, () => deleteRecurringTransaction(item.id))} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" aria-label={t("deleteButton")}><Trash2 className="h-4 w-4" /></button></div>
            </article>
          ))}
        </section>
      )}

      {tab === "rules" && (
        <section className="space-y-3">
          {rules.length === 0 ? <EmptyState icon={WandSparkles} title={t("noAutomationRules")} description={t("noAutomationRulesHint")} /> : rules.map((rule) => (
            <article key={rule.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/30"><WandSparkles className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{rule.name}</h3><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t("containsText")}: “{rule.matchText}” → {rule.categoryName ?? t("uncategorized")}</p></div>
              <div className="flex gap-1"><button type="button" disabled={pendingId === rule.id} onClick={() => void run(rule.id, () => applyTransactionRule(rule.id))} className="min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-800 dark:text-slate-300">{pendingId === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("applyToExisting")}</button><button type="button" disabled={pendingId === rule.id} onClick={() => void run(rule.id, () => deleteTransactionRule(rule.id))} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" aria-label={t("deleteButton")}><Trash2 className="h-4 w-4" /></button></div>
            </article>
          ))}
        </section>
      )}

      {tab === "goals" && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {goals.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={Target} title={t("noSavingsGoals")} description={t("noSavingsGoalsHint")} /></div> : goals.map((goal) => {
            const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            return <article key={goal.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{goal.name}</h3><p className="mt-1 text-xs text-slate-500">{goal.targetDate ? `${t("targetDate")}: ${fmtDate(goal.targetDate)}` : t("withoutDeadline")}</p></div><button type="button" onClick={() => void run(goal.id, () => deleteSavingsGoal(goal.id))} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-500" aria-label={t("deleteButton")}><Trash2 className="h-4 w-4" /></button></div>
              <div className="mt-4 flex items-end justify-between"><strong className="text-xl text-slate-900 dark:text-slate-100"><Money amount={goal.currentAmount} /></strong><span className="text-xs text-slate-500">{t("of")} <Money amount={goal.targetAmount} /></span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: goal.color }} /></div>
              <p className="mt-1 text-right text-[11px] font-bold text-slate-500">{percentage.toFixed(0)}%</p>
              <div className="mt-3 flex gap-2"><input type="number" min="0" step="0.01" value={goalProgress[goal.id] ?? String(Number((goal.currentAmount * rate).toFixed(2)))} onChange={(event) => setGoalProgress((current) => ({ ...current, [goal.id]: event.target.value }))} className={inputClass} aria-label={t("savedAlready")} /><button type="button" disabled={pendingId === goal.id} onClick={() => void run(goal.id, () => setSavingsGoalProgress({ id: goal.id, amount: Number(goalProgress[goal.id] ?? goal.currentAmount * rate), currency }))} className="min-h-11 rounded-xl bg-red-500 px-3 text-xs font-bold text-white disabled:opacity-50">{t("update")}</button></div>
            </article>;
          })}
        </section>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Target; title: string; description: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800"><Icon className="h-6 w-6" /></span><h2 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h2><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p></div>;
}
