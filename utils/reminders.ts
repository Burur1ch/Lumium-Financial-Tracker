export const REMINDER_HOURS = [14, 21] as const;

export function localDate(now: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function reminderSlot(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(value("hour"));
  if (
    !REMINDER_HOURS.some((slot) => slot === hour) ||
    Number(value("minute")) >= 15
  )
    return null;
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour };
}

export function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function nextRecurringDate(value: string, frequency: string, anchorDate = value) {
  const [year, month, day] = value.split("-").map(Number);
  const [, anchorMonth, anchorDay] = anchorDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else {
    const targetMonth = frequency === "yearly" ? anchorMonth - 1 + 12 : month;
    const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
    date.setUTCFullYear(year, targetMonth, Math.min(anchorDay, lastDay));
  }
  return date.toISOString().slice(0, 10);
}
