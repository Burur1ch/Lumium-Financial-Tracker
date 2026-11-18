import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { DEFAULT_PREFERENCES } from "@/utils/preferences";
import { buildCashflowPlan, shiftPlanningMonth, type ScheduledPayment } from "@/utils/planning";
import { formatMoney } from "@/utils/currency";

const databaseUrl = process.env.E2E_DATABASE_URL ?? "postgres://lumium:lumium@127.0.0.1:55432/lumium";
async function signUp(page: Page, db: Client, suffix: string) {
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { "x-real-ip": suffix === "balance" ? "192.0.2.61" : suffix === "planning" ? "192.0.2.62" : "192.0.2.63" },
    data: { name: "Card check", email: `card-${suffix}-${Date.now()}@example.test`, password: "CardCheck123!" },
  });
  expect(response.ok()).toBe(true);
  const id: string = (await response.json()).user.id;
  await db.query("insert into user_preferences(user_id,data) values($1,$2)", [id, JSON.stringify({ ...DEFAULT_PREFERENCES, language: "en" })]);
  await page.addInitScript((userId) => {
    localStorage.setItem(`lumium_dashboard_tour:${userId}`, "dismissed");
    localStorage.setItem("lumium_prefs", JSON.stringify({ state: { language: "en", currency: "BYN" }, version: 0 }));
  }, id);
  return id;
}

test("currency always follows positive, negative and zero amounts", () => {
  for (const currency of ["BYN", "USD", "EUR"] as const) {
    for (const locale of ["en-US", "ru-RU", "de-DE", "fr-FR"]) {
      expect(formatMoney(-16, currency, locale)).toMatch(new RegExp(`^-16[.,]00\\s${currency}$`));
      expect(formatMoney(16, currency, locale, false)).toBe(`16\u00a0${currency}`);
      expect(formatMoney(-0, currency, locale)).not.toContain("-");
    }
  }
});

test("forecast includes overdue and future payments once and preserves monthly anchors", () => {
  const payment: ScheduledPayment = { id: "rent", name: "Rent", amount: 100, type: "expense", frequency: "monthly", nextDate: "2027-01-31", anchorDate: "2027-01-31", autoCreate: false, active: true, categoryId: null, categoryName: null, categoryColor: null };
  const result = buildCashflowPlan({ today: "2027-02-01", month: "2027-03", balance: 250,
    recurring: [payment, { ...payment, id: "paused", active: false, amount: 999 }, { ...payment, id: "salary", type: "income", frequency: "once", amount: 500, nextDate: "2027-03-02" }],
    recorded: [{ key: "paid", templateId: null, name: "Paid", amount: 20, type: "expense", date: "2027-02-01", status: "paid", autoCreate: false }, { key: "future", templateId: null, name: "Known future", amount: 30, type: "expense", date: "2027-03-03", status: "planned", autoCreate: false }],
  });
  expect(result.events.filter((event) => event.templateId === "rent").map((event) => event.date)).toEqual(["2027-03-31"]);
  expect(result.projectedBalance).toBe(420); // 250 - 3 rent + 500 income - 30 future expense
  expect(result.lowestBalance).toBe(50);
  expect(result.forecast.find((point) => point.date === "2027-02-28")?.balance).toBe(50);
});

test("current balance excludes pre-existing history and future or pending entries", async ({ page }) => {
  const db = new Client({ connectionString: databaseUrl }); await db.connect();
  let id: string | undefined;
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  try {
    id = await signUp(page, db, "balance");
    const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await db.query("insert into transactions(user_id,description,amount,type,status,date) values($1,'Existing income',500,'income','completed',now()),($1,'Existing expense',25,'expense','completed',now()),($1,'Pending',40,'expense','pending',now()),($1,'Future',100,'expense','completed',$2)", [id, tomorrow]);
    await page.goto("/dashboard/card");
    await page.getByRole("spinbutton", { name: "Balance shown by your bank" }).fill("1000");
    await page.getByRole("button", { name: "Confirm balance", exact: true }).click();
    await expect(page.getByTestId("current-card-amount")).toHaveText("1,000.00 BYN");
    expect((await db.query("select sum(amount)::float8 as sum from transactions where user_id=$1", [id])).rows[0].sum).toBe(665);
    await db.query("insert into transactions(user_id,description,amount,type) values($1,'New expense',16,'expense'),($1,'New income',30,'income')", [id]);
    await page.reload();
    await expect(page.getByTestId("current-card-amount")).toHaveText("1,014.00 BYN");
    await db.query("update transactions set amount=20 where user_id=$1 and description='New expense'", [id]);
    await page.reload(); await expect(page.getByTestId("current-card-amount")).toHaveText("1,010.00 BYN");
    await page.getByRole("spinbutton", { name: "Balance shown by your bank" }).fill("800");
    await page.getByRole("button", { name: "Confirm balance", exact: true }).click();
    await expect(page.getByTestId("current-card-amount")).toHaveText("800.00 BYN");
    await db.query("insert into transactions(user_id,description,amount,type) values($1,'After reconciliation',10,'expense')", [id]);
    await page.goto("/dashboard");
    await expect(page.getByTestId("card-balance").filter({ visible: true }).getByTestId("current-card-amount")).toHaveText("790.00 BYN");
    expect(errors).toEqual([]);
  } finally { if (id) await db.query('delete from "user" where id=$1', [id]); await db.end(); }
});

test("calendar records one-time payments once, pauses schedules and keeps paid history", async ({ page }) => {
  const db = new Client({ connectionString: databaseUrl }); await db.connect();
  let id: string | undefined;
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  try {
    id = await signUp(page, db, "planning");
    await page.goto("/dashboard/card");
    await page.getByRole("spinbutton", { name: "Balance shown by your bank" }).fill("100");
    await page.getByRole("button", { name: "Confirm balance", exact: true }).click();
    await expect(page.getByTestId("current-card-amount")).toHaveText("100.00 BYN");
    await page.goto("/dashboard/planning");
    await page.getByRole("button", { name: "Plan a payment", exact: true }).first().click();
    const form = page.getByRole("form", { name: "Plan a payment" });
    await form.getByRole("textbox", { name: "Description", exact: true }).fill("One-time bill");
    await form.getByRole("spinbutton", { name: /Amount/ }).fill("70");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(form).toBeHidden();
    await expect(page.getByTestId("forecast-end-balance")).toHaveText("30.00 BYN");
    await page.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(page.getByRole("button", { name: "Record payment", exact: true })).toBeHidden();
    await expect(page.getByTestId("forecast-end-balance")).toHaveText("30.00 BYN");
    await page.reload();
    expect((await db.query("select count(*)::int as n from transactions where user_id=$1 and description='One-time bill'", [id])).rows[0].n).toBe(1);
    const today = new Date().toISOString().slice(0, 10);
    await db.query("insert into recurring_transactions(user_id,name,amount,frequency,next_date,anchor_date) values($1,'Paused candidate',50,'monthly',$2,$2)", [id, today]);
    await page.reload();
    await expect(page.getByTestId("forecast-end-balance")).toHaveText("-20.00 BYN");
    await page.getByRole("button", { name: /Manage all payments/ }).click();
    await page.getByRole("button", { name: "Pause: Paused candidate", exact: true }).click();
    await expect(page.getByTestId("forecast-end-balance")).toHaveText("30.00 BYN");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete: One-time bill", exact: true }).click();
    await expect(page.getByRole("button", { name: "Delete: One-time bill", exact: true })).toBeHidden();
    expect((await db.query("select count(*)::int as n from transactions where user_id=$1 and description='One-time bill'", [id])).rows[0].n).toBe(1);
    await page.getByRole("link", { name: "Next month", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`month=${shiftPlanningMonth(today.slice(0, 7), 1)}`));
    await page.setViewportSize({ width: 360, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator(".dashboard-launch-screen")).toBeHidden();
    await page.locator("main").evaluate((main) => { main.scrollTop = 0; });
    await page.screenshot({ path: ".local/planning-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.locator("main").evaluate((main) => { main.scrollTop = 0; });
    await page.screenshot({ path: ".local/planning-desktop.png", fullPage: true });
    expect(errors).toEqual([]);
  } finally { if (id) await db.query('delete from "user" where id=$1', [id]); await db.end(); }
});

test("automatic one-time recording is concurrent-safe and unchanged tiny foreign amounts stay exact", async ({ page }) => {
  const db = new Client({ connectionString: databaseUrl }); await db.connect();
  let id: string | undefined;
  try {
    id = await signUp(page, db, "automation");
    const today = new Date().toISOString().slice(0, 10);
    await db.query("insert into card_balances(user_id,confirmed_amount,ledger_income,ledger_expense) values($1,100,0,0)", [id]);
    await db.query("insert into recurring_transactions(user_id,name,amount,frequency,next_date,anchor_date,auto_create) values($1,'Automatic once',9.75,'once',$2,$2,true),($1,'Tiny planned',0.01,'monthly',$2,$2,false)", [id, today]);
    const jobs = await Promise.all([0, 1].map(() => page.request.post("/api/internal/jobs", { headers: { authorization: "Bearer lumium-local-scheduler-secret-at-least-32-characters" } })));
    expect(jobs.every((response) => response.ok())).toBe(true);
    expect((await db.query("select count(*)::int as n from transactions where user_id=$1 and description='Automatic once'", [id])).rows[0].n).toBe(1);
    expect((await db.query("select active from recurring_transactions where user_id=$1 and name='Automatic once'", [id])).rows[0].active).toBe(false);
    await page.goto("/dashboard/card");
    await expect(page.getByTestId("current-card-amount")).toHaveText("90.25 BYN");
    await db.query("update user_preferences set data=data || '{\"currency\":\"USD\"}'::jsonb where user_id=$1", [id]);
    await page.goto("/dashboard/planning");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lumium_prefs")!).state.currency)).toBe("USD");
    await page.getByRole("button", { name: /Manage all payments/ }).click();
    await page.getByRole("button", { name: "Edit: Tiny planned", exact: true }).click();
    const form = page.getByRole("form", { name: "Edit planned payment" });
    await form.getByRole("textbox", { name: "Description", exact: true }).fill("Tiny renamed");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(form).toBeHidden();
    expect((await db.query("select amount from recurring_transactions where user_id=$1 and name='Tiny renamed'", [id])).rows[0].amount).toBe("0.01000000");
    await db.query("update user_preferences set data=data || '{\"currency\":\"BYN\",\"language\":\"ru\"}'::jsonb where user_id=$1", [id]);
    const dateAfter = (days: number) => { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
    await db.query("insert into recurring_transactions(user_id,name,amount,type,frequency,next_date,anchor_date) values($1,'Аренда квартиры',650,'expense','monthly',$2,$2),($1,'Зарплата',1200,'income','monthly',$3,$3)", [id, dateAfter(2), dateAfter(5)]);
    await page.goto("/dashboard/planning");
    await expect(page.getByRole("heading", { name: "Прогноз остатка", exact: true })).toBeVisible();
    await expect(page.locator(".dashboard-launch-screen")).toBeHidden();
    await page.locator("main").evaluate((main) => { main.scrollTop = 0; });
    await page.screenshot({ path: ".local/planning-ru-mobile.png" });
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.locator("main").evaluate((main) => { main.scrollTop = 0; });
    await page.screenshot({ path: ".local/planning-ru-desktop.png" });
  } finally { if (id) await db.query('delete from "user" where id=$1', [id]); await db.end(); }
});
