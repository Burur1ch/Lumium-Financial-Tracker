import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { DEFAULT_PREFERENCES } from "@/utils/preferences";
import { buildCashflowPlan, shiftPlanningMonth, type ScheduledPayment } from "@/utils/planning";
import { formatMoney } from "@/utils/currency";

const databaseUrl = process.env.E2E_DATABASE_URL ?? "postgres://lumium:lumium@127.0.0.1:55432/lumium";
async function signUp(page: Page, db: Client, suffix: "period" | "planning" | "automation") {
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { "x-real-ip": { period: "192.0.2.61", planning: "192.0.2.62", automation: "192.0.2.63" }[suffix] },
    data: { name: "Period check", email: `period-${suffix}-${Date.now()}@example.test`, password: "PeriodCheck123!" },
  });
  expect(response.ok()).toBe(true);
  const id: string = (await response.json()).user.id;
  await db.query("insert into user_preferences(user_id,data) values($1,$2)", [id, JSON.stringify({ ...DEFAULT_PREFERENCES, language: "en" })]);
  await page.addInitScript((userId) => {
    localStorage.setItem(`lumium_dashboard_tour:${userId}`, "dismissed");
    if (!localStorage.getItem("lumium_prefs")) localStorage.setItem("lumium_prefs", JSON.stringify({ state: { language: "en", currency: "BYN" }, version: 0 }));
  }, id);
  return id;
}

test("currency follows positive, negative and zero amounts", () => {
  for (const currency of ["BYN", "USD", "EUR"] as const) for (const locale of ["en-US", "ru-RU", "de-DE", "fr-FR"]) {
    expect(formatMoney(-16, currency, locale)).toMatch(new RegExp(`^-16[.,]00\\s${currency}$`));
    expect(formatMoney(16, currency, locale, false)).toBe(`16\u00a0${currency}`);
    expect(formatMoney(-0, currency, locale)).not.toContain("-");
  }
});

const payment: ScheduledPayment = { id: "rent", name: "Rent", amount: 100, type: "expense", frequency: "monthly", nextDate: "2027-01-31", anchorDate: "2027-01-31", autoCreate: false, active: true, categoryId: null, categoryName: null, categoryColor: null };
test("forecast starts each month at zero and retains recurring calendar anchors", () => {
  const result = buildCashflowPlan({ today: "2027-02-01", month: "2027-03", actual: [],
    recurring: [payment, { ...payment, id: "paused", active: false, amount: 999 }, { ...payment, id: "salary", type: "income", frequency: "once", amount: 500, nextDate: "2027-03-02" }],
    recorded: [{ key: "future", templateId: null, name: "Known future", amount: 30, type: "expense", date: "2027-03-03", status: "planned", autoCreate: false }],
  });
  expect(result.events.filter((event) => event.templateId === "rent").map((event) => event.date)).toEqual(["2027-03-31"]);
  expect(result.projectedNet).toBe(370);
  expect(result.actualNet).toBe(0);
  expect(result.forecast[0].net).toBe(0);
  expect(result.events.some((event) => event.date < "2027-03-01")).toBe(false);
});

test("period forecast excludes other months and never counts recorded payments twice", () => {
  const input = { today: "2027-02-15", month: "2027-02", actual: [
    { date: "2027-01-31", amount: 999, type: "income" as const },
    { date: "2027-02-01", amount: 100, type: "income" as const },
    { date: "2027-02-02", amount: 30, type: "expense" as const },
    { date: "2027-03-01", amount: 999, type: "income" as const },
  ], recurring: [{ ...payment, frequency: "once" as const, nextDate: "2027-02-20", amount: 20, type: "income" as const }], recorded: [
    { key: "paid", templateId: null, name: "Paid", amount: 30, type: "expense" as const, date: "2027-02-02", status: "paid" as const, autoCreate: false },
    { key: "pending", templateId: null, name: "Pending", amount: 40, type: "expense" as const, date: "2027-02-16", status: "planned" as const, autoCreate: false },
  ] };
  const result = buildCashflowPlan(input);
  expect(result.actualNet).toBe(70);
  expect(result.projectedNet).toBe(50);
  expect(result.forecast.find((point) => point.date === "2027-02-16")?.net).toBe(30);
  const past = buildCashflowPlan({ ...input, today: "2027-04-01" });
  expect(past.projectedNet).toBeNull();
  expect(past.forecast.at(-1)?.net).toBe(70);
});

test("dashboard shows the signed selected-month result and has no card management", async ({ page }) => {
  const db = new Client({ connectionString: databaseUrl }); await db.connect(); let id: string | undefined;
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  try {
    id = await signUp(page, db, "period");
    const today = new Date().toISOString().slice(0, 10); const month = today.slice(0, 7); const previous = shiftPlanningMonth(month, -1);
    const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await db.query("insert into transactions(user_id,description,amount,type,status,date) values($1,'Income',500,'income','completed',$2),($1,'Expense',200,'expense','completed',$2),($1,'Pending',999,'expense','pending',$2),($1,'Future',999,'income','completed',$3),($1,'Old income',50,'income','completed',$4),($1,'Old expense',100,'expense','completed',$5)", [id, `${today}T12:00:00Z`, tomorrow, `${previous}-01T12:00:00Z`, `${previous}-02T12:00:00Z`]);
    // Existing checkpoint records must have no influence on the product result.
    await db.query("insert into card_balances(user_id,confirmed_amount,ledger_income,ledger_expense) values($1,1000000,0,0)", [id]);
    await page.goto(`/dashboard?month=${month}`);
    await expect(page.getByTestId("period-net-value")).toHaveText("+300.00 BYN");
    await expect(page.getByTestId("card-balance")).toHaveCount(0);
    await expect(page.locator('a[href="/dashboard/card"]')).toHaveCount(0);
    await expect(page.locator("[data-dashboard-loading]")).toBeHidden();
    await page.getByTestId("period-summary").screenshot({ path: ".local/monthly-result-positive.png" });
    await page.goto(`/dashboard?month=${previous}`);
    await expect(page.getByTestId("period-net-value")).toHaveText("-50.00 BYN");
    const summary = page.getByTestId("period-summary");
    await expect(summary.getByTestId("period-chart-selection")).toContainText("-50.00 BYN");
    const daySlider = summary.getByRole("slider", { name: "Select a day to see the result" });
    await daySlider.fill("0");
    await expect(summary.getByTestId("period-chart-selection")).toContainText("+50.00 BYN");
    await summary.getByRole("button", { name: /Transactions on this day/ }).click();
    await expect(summary.getByTestId("period-day-transactions")).toContainText("Old income");
    await expect(summary.getByTestId("period-day-transactions")).toContainText("+50.00 BYN");
    await daySlider.fill("1");
    await expect(summary.getByTestId("period-day-transactions")).toContainText("Old expense");
    await daySlider.fill("0");
    await summary.getByRole("button", { name: "Hide balance" }).click();
    await expect(summary.getByTestId("period-chart-selection")).toHaveCount(0);
    await expect(summary.getByRole("slider")).toHaveCount(0);
    await summary.getByRole("button", { name: "Show balance" }).click();
    await expect(summary.getByTestId("period-chart-selection")).toContainText("+50.00 BYN");
    await db.query("update transactions set amount=600 where user_id=$1 and description='Expense'", [id]);
    await page.goto(`/dashboard?month=${month}`);
    await expect(page.getByTestId("period-net-value")).toHaveText("-100.00 BYN");
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.locator("[data-dashboard-loading]")).toBeHidden();
    await page.getByTestId("period-summary").screenshot({ path: ".local/monthly-result-negative.png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/dashboard/card"); await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("period-net-value")).toHaveText("-100.00 BYN");
    await page.goto(`/dashboard/transactions?month=${month}&search=600%2C00`);
    await expect(page.getByText("Expense", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Income", { exact: true })).toHaveCount(0);
    const category = (await db.query("insert into categories(user_id,name,type,color,icon) values($1,'Custom search category','expense','#112233','tag') returning id", [id])).rows[0].id;
    await db.query("update transactions set category_id=$2 where user_id=$1 and description='Expense'", [id, category]);
    await page.goto(`/dashboard/transactions?month=${month}&search=Custom%20search`);
    await expect(page.getByText("Expense", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Income", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await page.goto("about:blank"); if (id) await db.query('delete from "user" where id=$1', [id]); await db.end(); }
});

test("calendar forecasts the monthly result and recording a payment does not double expenses", async ({ page }) => {
  const db = new Client({ connectionString: databaseUrl }); await db.connect(); let id: string | undefined;
  try {
    id = await signUp(page, db, "planning");
    await db.query("insert into transactions(user_id,description,amount,type) values($1,'Monthly income',100,'income')", [id]);
    await page.goto("/dashboard/planning");
    await expect(page.getByTestId("forecast-end-net")).toHaveText("+100.00 BYN");
    await page.getByRole("button", { name: "Plan a payment", exact: true }).first().click();
    const form = page.getByRole("form", { name: "Plan a payment" });
    await form.getByRole("textbox", { name: "Description", exact: true }).fill("One-time bill");
    await form.getByRole("spinbutton", { name: /Amount/ }).fill("70");
    await form.getByRole("button", { name: "Save", exact: true }).click(); await expect(form).toBeHidden();
    await expect(page.getByTestId("forecast-end-net")).toHaveText("+30.00 BYN");
    await page.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(page.getByRole("button", { name: "Record payment", exact: true })).toBeHidden();
    await expect(page.getByTestId("forecast-end-net")).toHaveText("+30.00 BYN");
    const today = new Date().toISOString().slice(0, 10);
    await db.query("insert into recurring_transactions(user_id,name,amount,frequency,next_date,anchor_date) values($1,'Paused candidate',50,'monthly',$2,$2)", [id, today]);
    await page.reload(); await expect(page.getByTestId("forecast-end-net")).toHaveText("-20.00 BYN");
    await page.getByRole("button", { name: /Manage all payments/ }).click();
    await page.getByRole("button", { name: "Pause: Paused candidate", exact: true }).click();
    await expect(page.getByTestId("forecast-end-net")).toHaveText("+30.00 BYN");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete: One-time bill", exact: true }).click();
    await expect(page.getByRole("button", { name: "Delete: One-time bill", exact: true })).toBeHidden();
    expect((await db.query("select count(*)::int as n from transactions where user_id=$1 and description='One-time bill'", [id])).rows[0].n).toBe(1);
    await page.getByRole("link", { name: "Next month", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`month=${shiftPlanningMonth(today.slice(0, 7), 1)}`));
    // Previous months do not become a starting balance for the next month.
    await expect(page.getByTestId("forecast-end-net")).toHaveText("0.00 BYN");
  } finally { await page.goto("about:blank"); if (id) await db.query('delete from "user" where id=$1', [id]); await db.end(); }
});

test("automatic one-time payments stay unique and tiny foreign amounts remain exact", async ({ page }) => {
  const db = new Client({ connectionString: databaseUrl }); await db.connect(); let id: string | undefined;
  try {
    id = await signUp(page, db, "automation"); const today = new Date().toISOString().slice(0, 10);
    await db.query("insert into transactions(user_id,description,amount,type) values($1,'Monthly income',100,'income')", [id]);
    await db.query("insert into recurring_transactions(user_id,name,amount,frequency,next_date,anchor_date,auto_create) values($1,'Automatic once',9.75,'once',$2,$2,true),($1,'Tiny planned',0.01,'monthly',$2,$2,false)", [id, today]);
    const jobs = await Promise.all([0, 1].map(() => page.request.post("/api/internal/jobs", { headers: { authorization: "Bearer lumium-local-scheduler-secret-at-least-32-characters" } })));
    expect(jobs.every((response) => response.ok())).toBe(true);
    expect((await db.query("select count(*)::int as n from transactions where user_id=$1 and description='Automatic once'", [id])).rows[0].n).toBe(1);
    await page.goto("/dashboard"); await expect(page.getByTestId("period-net-value")).toHaveText("+90.25 BYN");
    await db.query("update user_preferences set data=data || '{\"currency\":\"USD\"}'::jsonb where user_id=$1", [id]);
    await page.goto("/dashboard/planning");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lumium_prefs")!).state.currency)).toBe("USD");
    await page.getByRole("button", { name: /Manage all payments/ }).click();
    await page.getByRole("button", { name: "Edit: Tiny planned", exact: true }).click();
    const form = page.getByRole("form", { name: "Edit planned payment" });
    await form.getByRole("textbox", { name: "Description", exact: true }).fill("Tiny renamed");
    await form.getByRole("button", { name: "Save", exact: true }).click(); await expect(form).toBeHidden();
    expect((await db.query("select amount from recurring_transactions where user_id=$1 and name='Tiny renamed'", [id])).rows[0].amount).toBe("0.01000000");
  } finally { await page.goto("about:blank"); if (id) await db.query('delete from "user" where id=$1', [id]); await db.end(); }
});
