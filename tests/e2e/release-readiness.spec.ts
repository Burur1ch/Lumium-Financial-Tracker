import { expect, test } from "@playwright/test";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { takeRequestLimit } from "@/utils/request-limits";
import { readFileSync, readdirSync } from "node:fs";
import { createECDH, randomBytes } from "node:crypto";
import { reminderSlot, nextRecurringDate } from "@/utils/reminders";
import { translations } from "@/store/translations";

const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgres://lumium:lumium@127.0.0.1:55432/lumium";
const cronSecret = "lumium-local-scheduler-secret-at-least-32-characters";

test("recognition quotas are atomic, isolated by user and reset in the next window", async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const database = drizzle(pool, { schema });
  const user = `quota-${Date.now()}`,
    other = `${user}-other`;
  try {
    await pool.query(
      'insert into "user"(id,name,email) values($1,$1,$2),($3,$3,$4)',
      [user, `${user}@example.test`, other, `${other}@example.test`],
    );
    const now = new Date("2026-11-17T14:00:00Z");
    const claims = await Promise.all(
      Array.from({ length: 12 }, () =>
        takeRequestLimit(database, user, "receipt-minute", 3, 60, now),
      ),
    );
    expect(claims.filter(Boolean)).toHaveLength(3);
    expect(
      await takeRequestLimit(database, other, "receipt-minute", 3, 60, now),
    ).toBe(true);
    expect(
      await takeRequestLimit(
        database,
        user,
        "receipt-minute",
        3,
        60,
        new Date(now.getTime() + 60000),
      ),
    ).toBe(true);
  } finally {
    await pool.query('delete from "user" where id in ($1,$2)', [user, other]);
    await pool.end();
  }
});

test("reminders use local dates, two daily slots and a bounded retry window", () => {
  expect(
    reminderSlot(new Date("2026-11-17T11:00:00Z"), "Europe/Minsk"),
  ).toEqual({ date: "2026-11-17", hour: 14 });
  expect(
    reminderSlot(new Date("2026-11-17T18:14:59Z"), "Europe/Minsk"),
  ).toEqual({ date: "2026-11-17", hour: 21 });
  expect(
    reminderSlot(new Date("2026-11-17T18:15:00Z"), "Europe/Minsk"),
  ).toBeNull();
  expect(
    reminderSlot(new Date("2026-11-17T21:00:00Z"), "Europe/Minsk"),
  ).toBeNull();
  expect(
    reminderSlot(new Date("2026-11-18T07:00:00Z"), "Pacific/Honolulu"),
  ).toEqual({ date: "2026-11-17", hour: 21 });
  expect(
    reminderSlot(new Date("2026-11-17T11:00:00Z"), "America/New_York"),
  ).toBeNull();
  expect(nextRecurringDate("2028-01-31", "monthly")).toBe("2028-02-29");
  expect(nextRecurringDate("2028-02-29", "yearly")).toBe("2029-02-28");
});

test("BYN migration refuses an unverified rate and converts every money table exactly", async () => {
  const admin = new Client({ connectionString: databaseUrl });
  await admin.connect();
  const name = `lumium_migration_${Date.now()}`;
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  let fixture: Client | undefined;
  try {
    await admin.query(`create database "${name}"`);
    fixture = new Client({ connectionString: url.toString() });
    await fixture.connect();
    const migrations = readdirSync("db/migrations")
      .filter((file) => /^000[0-5]_.*\.sql$/.test(file))
      .sort();
    for (const file of migrations)
      await fixture.query(readFileSync(`db/migrations/${file}`, "utf8"));
    await fixture.query(
      "insert into \"user\"(id,name,email) values('migration-check','Migration check','migration@example.test')",
    );
    const category = (
      await fixture.query(
        "insert into categories(user_id,name,type,color,icon) values('migration-check','Fixture','expense','#123456','tag') returning id",
      )
    ).rows[0].id;
    const transaction = (
      await fixture.query(
        "insert into transactions(user_id,category_id,description,amount,type) values('migration-check',$1,'Legacy USD',1,'expense') returning id",
        [category],
      )
    ).rows[0].id;
    await fixture.query(
      "insert into transaction_splits(user_id,transaction_id,category_id,amount) values('migration-check',$1,$2,0.33333333),('migration-check',$1,$2,0.33333333),('migration-check',$1,$2,0.33333334)",
      [transaction, category],
    );
    await fixture.query(
      "insert into budgets(user_id,category_id,monthly_limit,month_year) values('migration-check',$1,100,'2026-11-01')",
      [category],
    );
    await fixture.query(
      "insert into quick_transaction_presets(user_id,name,amount) values('migration-check','Preset',2)",
    );
    await fixture.query(
      "insert into recurring_transactions(user_id,name,amount,frequency,next_date) values('migration-check','Recurring',3,'monthly','2026-12-01')",
    );
    await fixture.query(
      "insert into savings_goals(user_id,name,target_amount,current_amount) values('migration-check','Goal',50,5)",
    );
    const conversion = readFileSync(
      "db/migrations/0006_byn_and_push.sql",
      "utf8",
    );
    await fixture.query("begin");
    await expect(fixture.query(conversion)).rejects.toThrow(
      /verified USD\/BYN/,
    );
    await fixture.query("rollback");
    expect(
      Number(
        (await fixture.query("select amount from transactions")).rows[0].amount,
      ),
    ).toBe(1);
    await fixture.query(
      "select set_config('lumium.usd_to_byn_rate','3.25',false)",
    );
    await fixture.query("begin");
    await fixture.query(conversion);
    await fixture.query("commit");
    const check =
      await fixture.query(`select (select amount from transactions)::float8 as amount,
      (select sum(amount) from transaction_splits)::float8 as shares,
      (select monthly_limit from budgets)::float8 as budget,
      (select amount from quick_transaction_presets)::float8 as preset,
      (select amount from recurring_transactions)::float8 as recurring,
      (select target_amount from savings_goals)::float8 as target,
      (select current_amount from savings_goals)::float8 as saved,
      (select rate from currency_migration_audit)::float8 as rate`);
    expect(check.rows[0]).toEqual({
      amount: 3.25,
      shares: 3.25,
      budget: 325,
      preset: 6.5,
      recurring: 9.75,
      target: 162.5,
      saved: 16.25,
      rate: 3.25,
    });
  } finally {
    await fixture?.end();
    await admin.query(`drop database if exists "${name}"`);
    await admin.end();
  }
});

test("release controls preserve BYN, export private data, run jobs and manage opt-in reminders", async ({
  page,
}, testInfo) => {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  let userId: string | undefined;
  const other = `release-other-${Date.now()}`;
  const key = createECDH("prime256v1");
  key.generateKeys();
  const device = {
    endpoint: `https://wns2-am3p.notify.windows.com/w/?token=release-${Date.now()}`,
    keys: {
      p256dh: key.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  try {
    await page.addInitScript((input) => {
      if (!localStorage.getItem("lumium_prefs"))
        localStorage.setItem(
          "lumium_prefs",
          JSON.stringify({
            state: { currency: "BYN", language: "en" },
            version: 0,
          }),
        );
      let subscription: {
        endpoint: string;
        toJSON: () => typeof input;
        unsubscribe: () => Promise<boolean>;
      } | null = null;
      const registration = {
        pushManager: {
          getSubscription: async () => subscription,
          subscribe: async () => {
            subscription = {
              endpoint: input.endpoint,
              toJSON: () => input,
              unsubscribe: async () => {
                subscription = null;
                return true;
              },
            };
            return subscription;
          },
        },
      };
      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          register: async () => registration,
          ready: Promise.resolve(registration),
        },
        configurable: true,
      });
      Object.defineProperty(window, "Notification", {
        value: class {
          static permission = "default";
          static requestPermission = async () => "granted";
        },
        configurable: true,
      });
      Object.defineProperty(window, "PushManager", {
        value: class {},
        configurable: true,
      });
    }, device);
    await page.route("**/api/exchange-rates", (route) =>
      route.fulfill({
        json: {
          base: "BYN",
          rates: { BYN: 1, USD: 0.5, EUR: 0.4 },
          source: "nbrb",
          rateDate: "2026-11-17",
        },
      }),
    );
    await page.goto("/login");
    await expect(
      page.getByText(translations.en.passwordRecoverySoon, { exact: true }),
    ).toBeVisible();
    const email = `release-${Date.now()}@example.test`;
    const signup = await page.request.post("/api/auth/sign-up/email", {
      headers: { "x-real-ip": "192.0.2.23" },
      data: { name: "Release check", email, password: "ReleaseCheck123!" },
    });
    expect(signup.ok()).toBe(true);
    userId = (await db.query('select id from "user" where email=$1', [email]))
      .rows[0].id;
    await db.query('insert into "user"(id,name,email) values($1,$1,$2)', [
      other,
      `${other}@example.test`,
    ]);
    await db.query(
      "insert into transactions(user_id,description,amount,type,date) values($1,'Own BYN expense',50,'expense',now()),($1,'Old private expense',30,'expense','2020-01-01'),($2,'Foreign expense',999,'expense',now())",
      [userId, other],
    );
    await page.goto("/dashboard/reports");
    await expect(page.getByTestId("report-summary")).toContainText("BYN 50.00");
    await page.goto("/dashboard/settings");
    await page
      .getByRole("combobox", { name: translations.en.currency, exact: true })
      .selectOption("USD");
    await page
      .getByRole("button", { name: translations.en.saveChanges, exact: true })
      .and(page.locator('button:not([type="submit"])'))
      .click();
    // The test's init script resets preferences on full loads; SPA navigation preserves the selection.
    await page
      .getByRole("navigation", { name: translations.en.mobileNavigation })
      .getByRole("link", { name: translations.en.reports, exact: true })
      .click();
    await expect(page.getByTestId("report-summary")).toContainText("$25.00");
    expect(
      Number(
        (
          await db.query(
            "select amount from transactions where user_id=$1 and description='Own BYN expense'",
            [userId],
          )
        ).rows[0].amount,
      ),
    ).toBe(50);
    await page.goto("/dashboard/settings");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: translations.en.accountExportButton })
      .click();
    const data = JSON.parse(
      readFileSync((await (await download).path())!, "utf8"),
    );
    expect(data.baseCurrency).toBe("BYN");
    expect(
      data.transactions
        .map((row: { description: string }) => row.description)
        .sort(),
    ).toEqual(["Old private expense", "Own BYN expense"]);
    expect(JSON.stringify(data)).not.toMatch(
      /password|p256dh|session_token|stripe_customer_id/,
    );
    const reminders = page.getByRole("region", {
      name: translations.en.pushSettingsTitle,
    });
    await reminders
      .getByRole("button", { name: translations.en.pushEnable, exact: true })
      .click();
    await expect(
      reminders.getByRole("button", {
        name: translations.en.pushDisable,
        exact: true,
      }),
    ).toBeVisible();
    const saved = (
      await db.query(
        "select user_id,endpoint,timezone from push_subscriptions where user_id=$1",
        [userId],
      )
    ).rows;
    expect(saved).toHaveLength(1);
    expect(saved[0].endpoint).toBe(device.endpoint);
    await reminders.screenshot({
      path: testInfo.outputPath("push-settings.png"),
    });
    await reminders
      .getByRole("button", { name: translations.en.pushDisable, exact: true })
      .click();
    await expect(
      reminders.getByRole("button", {
        name: translations.en.pushEnable,
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (
        await db.query("select id from push_subscriptions where user_id=$1", [
          userId,
        ])
      ).rowCount,
    ).toBe(0);
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    await db.query(
      "insert into recurring_transactions(user_id,name,amount,frequency,next_date,auto_create) values($1,'Background recurring',25,'weekly',$2,true)",
      [userId, yesterday],
    );
    expect((await page.request.post("/api/internal/jobs")).status()).toBe(401);
    expect(
      (
        await page.request.post("/api/internal/jobs", {
          headers: { authorization: `Bearer ${"é".repeat(cronSecret.length)}` },
        })
      ).status(),
    ).toBe(401);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await page.request.post("/api/internal/jobs", {
            headers: { authorization: `Bearer ${cronSecret}` },
          })
        ).ok(),
      ).toBe(true);
    expect(
      (
        await db.query(
          "select id from transactions where user_id=$1 and description='Background recurring'",
          [userId],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (await page.request.post("/api/stripe/webhook", { data: {} })).status(),
    ).toBe(503);
    expect(
      (await page.request.get("/sw.js")).headers()["content-type"],
    ).toMatch(/javascript/);
    await page.goto("/dashboard/pricing");
    await expect(
      page.getByRole("heading", {
        name: translations.en.billingComingSoonTitle,
      }),
    ).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.goto("/dashboard/help");
    await page
      .getByRole("button", {
        name: translations.en.contactSupport,
        exact: true,
      })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: translations.en.emailComingSoonTitle }),
    ).toBeVisible();
    await expect(page.locator("textarea")).toHaveCount(0);
    await page.goto("/dashboard?add=expense");
    await expect(
      page.getByRole("dialog", {
        name: translations.en.newTransaction,
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await page.goto("about:blank");
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.query('delete from "user" where id=$1', [other]);
    await db.end();
  }
});
