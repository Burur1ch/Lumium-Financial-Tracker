import { nextRecurringDate } from "@/utils/reminders";

export type PaymentFrequency = "once" | "weekly" | "monthly" | "yearly";
export interface ScheduledPayment {
  id: string;
  name: string;
  amount: number;
  type: "expense" | "income";
  frequency: PaymentFrequency;
  nextDate: string;
  anchorDate: string;
  autoCreate: boolean;
  active: boolean;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  lastCreatedAt?: string | null;
}

export interface CalendarPayment {
  key: string;
  templateId: string | null;
  name: string;
  amount: number;
  type: "expense" | "income";
  date: string;
  status: "planned" | "overdue" | "paid";
  autoCreate: boolean;
}

export interface CashflowPlan {
  month: string;
  today: string;
  events: CalendarPayment[];
  forecast: { date: string; balance: number }[];
  projectedBalance: number | null;
  lowestBalance: number | null;
  lowestDate: string | null;
  plannedIncome: number;
  plannedExpense: number;
}

export function planningMonth(raw: string | undefined, today: string) {
  if (!raw || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return today.slice(0, 7);
  const year = Number(raw.slice(0, 4));
  const maximum = Number(today.slice(0, 4)) + 2;
  return year >= 2000 && year <= maximum ? raw : today.slice(0, 7);
}

export function shiftPlanningMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function buildCashflowPlan({ month, today, balance, recurring, recorded }: {
  month: string;
  today: string;
  balance: number | null;
  recurring: ScheduledPayment[];
  recorded: CalendarPayment[];
}): CashflowPlan {
  const end = shiftPlanningMonth(month, 1) + "-01";
  const start = `${month}-01`;
  const planned: CalendarPayment[] = [];
  for (const item of recurring) {
    if (!item.active) continue;
    let date = item.nextDate;
    // At most 101 years of weekly occurrences; bounded even for corrupt input.
    for (let i = 0; date < end && i < 5300; i++) {
      planned.push({ key: `${item.id}:${date}`, templateId: item.id, name: item.name,
        amount: item.amount, type: item.type, date,
        status: date < today ? "overdue" : "planned", autoCreate: item.autoCreate });
      if (item.frequency === "once") break;
      const next = nextRecurringDate(date, item.frequency, item.anchorDate);
      if (next <= date) break;
      date = next;
    }
  }
  const outstanding = [...planned, ...recorded.filter((item) => item.status !== "paid")];
  const events = [...planned, ...recorded].filter((item) =>
    (item.date >= start && item.date < end) ||
    (month === today.slice(0, 7) && item.status === "overdue" && item.date < today),
  ).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  const forecast: CashflowPlan["forecast"] = [];
  let running = balance;
  let lowest = balance;
  let lowestDate = balance === null ? null : today;
  if (balance !== null && end > today) {
    const changes = new Map<string, number>();
    for (const item of outstanding) {
      if (item.date >= end) continue;
      const date = item.date < today ? today : item.date;
      changes.set(date, (changes.get(date) ?? 0) + item.amount * (item.type === "income" ? 1 : -1));
    }
    forecast.push({ date: today, balance });
    for (let date = today; date < end;) {
      running = Math.round(((running ?? 0) + (changes.get(date) ?? 0)) * 1e8) / 1e8;
      forecast.push({ date, balance: running });
      if (lowest === null || running < lowest) { lowest = running; lowestDate = date; }
      const next = new Date(`${date}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
    }
  }
  return { month, today, events, forecast,
    projectedBalance: forecast.length ? running : null,
    lowestBalance: forecast.length ? lowest : null, lowestDate,
    plannedIncome: events.filter((e) => e.status !== "paid" && e.type === "income").reduce((sum, e) => sum + e.amount, 0),
    plannedExpense: events.filter((e) => e.status !== "paid" && e.type === "expense").reduce((sum, e) => sum + e.amount, 0),
  };
}
