import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { DEFAULT_PREFERENCES } from "@/utils/preferences";
import { nextRecurringDate } from "@/utils/reminders";
import { translations } from "@/store/translations";

const databaseUrl = process.env.E2E_DATABASE_URL ?? "postgres://lumium:lumium@127.0.0.1:55432/lumium";

async function signUp(page: Page, db: Client, suffix: "money" | "settings" | "offline" | "timezone") {
  const clientIp = { money: "192.0.2.41", settings: "192.0.2.42", offline: "192.0.2.43", timezone: "192.0.2.44" }[suffix];
  const email = `usability-${suffix}-${Date.now()}@example.test`;
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { "x-real-ip": clientIp },
    data: { name: "Product check", email, password: "ProductCheck123!" },
  });
  expect(response.ok(), `Sign-up returned HTTP ${response.status()}`).toBe(true);
  const userId: string = (await response.json()).user.id;
  await db.query("insert into user_preferences(user_id,data) values($1,$2)", [userId, JSON.stringify({ ...DEFAULT_PREFERENCES, language: "en" })]);
  await page.addInitScript((id) => {
    localStorage.setItem(`lumium_dashboard_tour:${id}`, "dismissed");
    if (!localStorage.getItem("lumium_prefs")) localStorage.setItem("lumium_prefs", JSON.stringify({ state: { language: "en", currency: "BYN" }, version: 0 }));
  }, userId);
  return userId;
}

test("monthly and yearly schedules retain the original calendar date", () => {
  let date = "2027-01-31";
  date = nextRecurringDate(date, "monthly", "2027-01-31");
  expect(date).toBe("2027-02-28");
  expect(nextRecurringDate(date, "monthly", "2027-01-31")).toBe("2027-03-31");
  date = "2028-02-29";
  for (let year = 2029; year <= 2032; year++) date = nextRecurringDate(date, "yearly", "2028-02-29");
  expect(date).toBe("2032-02-29");
});

test("transaction times hydrate correctly in a different device time zone", async ({ browser }) => {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, timezoneId: "America/New_York" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let userId: string | undefined;
  try {
    userId = await signUp(page, db, "timezone");
    const date = new Date();
    date.setUTCHours(12, 0, 0, 0);
    await db.query("insert into transactions(user_id,description,amount,type,date) values($1,'Time zone check',1,'expense',$2)", [userId, date.toISOString()]);
    const expectedTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", hour: "2-digit", minute: "2-digit",
    }).format(date).replace(/\u202f/g, " ");
    await page.goto("/dashboard/transactions");
    await expect(page.getByRole("button", { name: /Time zone check/ })).toContainText(expectedTime);
    await page.reload();
    await expect(page.getByRole("button", { name: /Time zone check/ })).toContainText(expectedTime);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.end();
  }
});

test("editing a description or a budget warning in USD preserves exact BYN amounts", async ({ page }) => {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  let userId: string | undefined;
  try {
    userId = await signUp(page, db, "money");
    await db.query("update user_preferences set data=data || '{\"currency\":\"USD\"}'::jsonb where user_id=$1", [userId]);
    await page.goto("/dashboard/categories");
    const categoryId: string = (await db.query("select id from categories where user_id=$1 and system_key='groceries'", [userId])).rows[0].id;
    const transactionId: string = (await db.query("insert into transactions(user_id,category_id,description,amount,type) values($1,$2,'Exact original',100.12345678,'expense') returning id", [userId, categoryId])).rows[0].id;
    const month = new Date().toISOString().slice(0, 7);
    await db.query("insert into budgets(user_id,category_id,monthly_limit,month_year) values($1,$2,300.12345678,$3)", [userId, categoryId, `${month}-01`]);
    await page.goto("/dashboard/transactions");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lumium_prefs")!).state.currency)).toBe("USD");
    await page.getByRole("button", { name: /Exact original/ }).click();
    await page.getByRole("button", { name: translations.en.edit, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: translations.en.description, exact: true }).fill("Edited description");
    await dialog.getByRole("button", { name: translations.en.saveChanges, exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await db.query("select amount from transactions where id=$1", [transactionId])).rows[0].amount).toBe("100.12345678");
    await page.goto(`/dashboard/budget?month=${month}`);
    await page.getByRole("button", { name: /Open limit settings for/ }).first().click();
    await page.getByRole("dialog").getByRole("spinbutton", { name: /Warning threshold/ }).fill("90");
    await page.getByRole("dialog").getByRole("button", { name: translations.en.saveLimit, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect((await db.query("select monthly_limit from budgets where user_id=$1", [userId])).rows[0].monthly_limit).toBe("300.12345678");
    await db.query("update transactions set amount=0.01,description='One kopeck' where id=$1", [transactionId]);
    await page.goto("/dashboard/transactions");
    await page.getByRole("button", { name: /One kopeck/ }).click();
    await page.getByRole("button", { name: translations.en.edit, exact: true }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: translations.en.description, exact: true }).fill("Edited one kopeck");
    await page.getByRole("dialog").getByRole("button", { name: translations.en.saveChanges, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect((await db.query("select amount from transactions where id=$1", [transactionId])).rows[0].amount).toBe("0.01000000");
    await db.query("update budgets set monthly_limit=0.01 where user_id=$1", [userId]);
    await page.goto(`/dashboard/budget?month=${month}`);
    await page.getByRole("button", { name: /Open limit settings for/ }).first().click();
    await page.getByRole("dialog").getByRole("spinbutton", { name: /Warning threshold/ }).fill("95");
    await page.getByRole("dialog").getByRole("button", { name: translations.en.saveLimit, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect((await db.query("select monthly_limit from budgets where user_id=$1", [userId])).rows[0].monthly_limit).toBe("0.01000000");
  } finally {
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.end();
  }
});

test("account settings sync to another device and reminder actions are authenticated", async ({ page, browser }) => {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  let userId: string | undefined;
  const second = await browser.newContext();
  try {
    userId = await signUp(page, db, "settings");
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("combobox", { name: translations.en.currency, exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: translations.en.currency, exact: true }).selectOption("EUR");
    await page.getByRole("combobox", { name: translations.en.dateFormat, exact: true }).selectOption("YYYY-MM-DD");
    await page.getByRole("button", { name: translations.en.saveChanges, exact: true }).last().click();
    await expect.poll(async () => (await db.query("select data->>'currency' as currency from user_preferences where user_id=$1", [userId])).rows[0].currency).toBe("EUR");
    await second.addCookies(await page.context().cookies());
    const otherDevice = await second.newPage();
    await otherDevice.addInitScript((id) => localStorage.setItem(`lumium_dashboard_tour:${id}`, "dismissed"), userId);
    await otherDevice.goto("http://127.0.0.1:3100/dashboard/settings");
    await expect(otherDevice.getByRole("combobox", { name: translations.en.currency, exact: true })).toHaveValue("EUR");
    await expect(otherDevice.getByRole("combobox", { name: translations.en.dateFormat, exact: true })).toHaveValue("YYYY-MM-DD");
    await expect(otherDevice.getByText(translations.en.upgradeToPro, { exact: true })).toHaveCount(0);
    expect((await page.request.post("/api/reminders", { headers: { origin: "http://127.0.0.1:3100" }, data: { action: "snooze", timezone: "Europe/Minsk" } })).ok()).toBe(true);
    expect((await db.query("select snoozed_until>now() as snoozed from reminder_days where user_id=$1", [userId])).rows[0].snoozed).toBe(true);
    expect((await page.request.post("/api/reminders", { data: { action: "done", timezone: "Europe/Minsk" } })).ok()).toBe(true);
    expect((await db.query("select completed,snoozed_until from reminder_days where user_id=$1", [userId])).rows[0]).toMatchObject({ completed: true, snoozed_until: null });
    expect((await page.request.post("/api/reminders", { headers: { origin: "https://foreign.example" }, data: { action: "done", timezone: "Europe/Minsk" } })).status()).toBe(403);
    await page.evaluate(() => Object.defineProperty(navigator.serviceWorker, "getRegistration", { value: async () => ({}) }));
    await page.getByRole("button", { name: translations.en.signOut, exact: true }).click();
    await expect(page).toHaveURL(/login/);
    await expect(page.getByRole("heading", { name: translations.en.signInTitle, exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("lumium_offline_account"))).toBeNull();
  } finally {
    await second.close();
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.end();
  }
});

test("offline drafts survive reload and queued entries sync exactly once", async ({ page, context }) => {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  let userId: string | undefined;
  try {
    userId = await signUp(page, db, "offline");
    await page.goto("/dashboard");
    await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("lumium_offline_account")))).toBe(true);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("lumium:open-add-transaction")));
    let dialog = page.getByRole("dialog", { name: translations.en.newTransaction, exact: true });
    await dialog.getByRole("spinbutton", { name: translations.en.amount, exact: true }).fill("12.34");
    await dialog.getByRole("textbox", { name: translations.en.transactionNote, exact: true }).fill("Offline purchase");
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("lumium_draft_")))).toBe(true);
    await context.setOffline(true);
    await page.reload();
    dialog = page.getByRole("dialog", { name: translations.en.newTransaction, exact: true });
    await expect(dialog.getByRole("textbox", { name: translations.en.transactionNote, exact: true })).toHaveValue("Offline purchase");
    await expect(dialog.getByRole("spinbutton", { name: translations.en.amount, exact: true })).toHaveValue("12.34");
    await dialog.locator('button[type="submit"]').click();
    await expect(page.getByText(translations.en.offlineQueued, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("lumium_pending_")).length)).toBe(1);
    const queued = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) => item.startsWith("lumium_pending_"))!;
      return { key, value: localStorage.getItem(key)! };
    });
    expect((await db.query("select count(*)::int as count from transactions where user_id=$1", [userId])).rows[0].count).toBe(0);
    await context.setOffline(false);
    await page.goto("/dashboard");
    await expect.poll(async () => (await db.query("select count(*)::int as count from transactions where user_id=$1 and note='Offline purchase'", [userId])).rows[0].count).toBe(1);
    await page.evaluate((retry) => {
      localStorage.setItem(retry.key, retry.value);
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("lumium:retry-queue"));
    }, queued);
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("lumium_pending_")).length)).toBe(0);
    expect((await db.query("select amount from transactions where user_id=$1", [userId])).rows[0].amount).toBe("12.34000000");
  } finally {
    await context.setOffline(false);
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.end();
  }
});
