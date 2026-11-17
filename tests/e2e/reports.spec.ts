import { expect, test } from "@playwright/test";
import { Client } from "pg";
import * as XLSX from "xlsx";
import { translations } from "@/store/translations";

const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgres://lumium:lumium@127.0.0.1:55432/lumium";

test("reports are available on Free and preserve period boundaries, ownership and split totals", async ({
  page,
}, testInfo) => {
  const db = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  await db.connect();
  const email = `reports-${Date.now()}@example.test`;
  const otherUser = `reports-other-${Date.now()}`;
  let userId: string | undefined;
  try {
    const signup = await page.request.post("/api/auth/sign-up/email", {
      headers: { "x-real-ip": "192.0.2.21" },
      data: { name: "Report check", email, password: "ReportsCheck123!" },
    });
    expect(signup.ok()).toBe(true);
    userId = (await db.query('select id from "user" where email=$1', [email]))
      .rows[0].id;
    await page.addInitScript(() =>
      localStorage.setItem(
        "lumium_prefs",
        JSON.stringify({
          state: { currency: "USD", language: "en", plan: "free" },
          version: 0,
        }),
      ),
    );
    await page.goto("/dashboard/categories");
    const categories = (
      await db.query("select id,system_key from categories where user_id=$1", [
        userId,
      ])
    ).rows;
    const id = (key: string) =>
      categories.find((category) => category.system_key === key).id as string;
    const day = (offset: number, hour = 12) => {
      const now = new Date();
      return new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + offset,
          hour,
        ),
      ).toISOString();
    };
    const receipt = (
      await db.query(
        "insert into transactions(user_id,category_id,description,amount,type,date) values($1,$2,'Mixed receipt',100,'expense',$3) returning id",
        [userId, id("shopping"), day(-1)],
      )
    ).rows[0].id;
    await db.query(
      "insert into transaction_splits(user_id,transaction_id,category_id,amount) values($1,$2,$3,30),($1,$2,$4,20),($1,$2,$5,50)",
      [userId, receipt, id("groceries/milk"), id("groceries"), id("transport")],
    );
    await db.query(
      "insert into transactions(user_id,category_id,description,amount,type,date,status) values($1,$2,'Monthly salary',1000,'income',$5,'completed'),($1,$3,'Boundary rent',15,'expense',$6,'completed'),($1,$4,'Fraction one',0.1,'expense',$7,'completed'),($1,$4,'Fraction two',0.2,'expense',$7,'completed'),($1,$3,'Earlier expense',40,'expense',$8,'completed'),($1,$3,'Old expense',88,'expense',$9,'completed'),($1,$3,'Future expense',10000,'expense',$10,'completed'),($1,$3,'Pending expense',9999,'expense',$7,'pending')",
      [
        userId,
        id("salary"),
        id("housing"),
        id("groceries"),
        day(-2),
        day(-6, 0),
        day(0),
        day(-7),
        day(-30),
        day(1),
      ],
    );
    await db.query('insert into "user"(id,name,email) values($1,$1,$2)', [
      otherUser,
      `${otherUser}@example.test`,
    ]);
    await db.query(
      "insert into transactions(user_id,description,amount,type,date) values($1,'Foreign private expense',8888,'expense',$2)",
      [otherUser, day(0)],
    );
    await db.query("update categories set is_archived=true where id=$1", [
      id("groceries"),
    ]);
    await page
      .getByRole("navigation", { name: translations.en.mobileNavigation })
      .getByRole("link", { name: translations.en.reports, exact: true })
      .click();
    const summary = page.getByTestId("report-summary");
    await expect(summary).toContainText("$1,000.00");
    await expect(summary).toContainText("$155.30");
    await expect(summary).toContainText("+$844.70");
    await expect(page.getByText("Future expense", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Foreign private expense", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: translations.en.cashFlow,
        exact: true,
      }),
    ).toBeVisible();
    await page.setViewportSize({ width: 360, height: 640 });
    await page.screenshot({ path: testInfo.outputPath("reports-mobile.png") });
    expect(
      await page
        .locator(".dashboard-main")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    await page.getByRole("button", { name: "7d", exact: true }).click();
    await expect(page).toHaveURL(/period=7d/);
    await expect(summary).toContainText("$115.30");
    const expenseBreakdown = page.getByRole("region", {
      name: translations.en.expensesByCategory,
      exact: true,
    });
    const groceries = expenseBreakdown
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Groceries" }) });
    await expect(groceries.locator("summary")).toContainText("$50.30");
    await groceries.locator("summary").click();
    await expect(groceries.getByText("$30.00", { exact: true })).toBeVisible();
    await expect(groceries.getByText("$20.30", { exact: true })).toBeVisible();
    await expect(
      expenseBreakdown.getByText("Shopping", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("reports-categories.png"),
    });
    await page.goto("/dashboard/reports?period=all");
    await expect(page).toHaveURL(/period=30d/);
    await expect(summary).toContainText("$155.30");

    await db.query(
      "insert into subscriptions(user_id,plan,status) values($1,'pro','active')",
      [userId],
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard/reports?period=all");
    await expect(
      page.getByRole("button", { name: translations.en.all, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(summary).toContainText("$243.30");
    await expect(
      page.getByRole("link", { name: translations.en.reports, exact: true }),
    ).toBeVisible();
    // Let chart entry animations finish before capturing the visual review.
    await page.waitForTimeout(1800);
    await page.screenshot({ path: testInfo.outputPath("reports-desktop.png") });
    const downloadReady = page.waitForEvent("download");
    await page
      .getByRole("button", { name: translations.en.exportExcel })
      .click();
    const workbook = XLSX.readFile((await (await downloadReady).path())!);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets.Transactions,
    );
    expect(
      rows.some(
        (row) =>
          row.Description === "Future expense" ||
          row.Description === "Foreign private expense" ||
          row.Description === "Pending expense",
      ),
    ).toBe(false);
    expect(
      rows
        .filter((row) => row.Type === translations.en.expense)
        .reduce((sum, row) => sum + Number(row.Amount), 0),
    ).toBeCloseTo(243.3, 8);
    const totals = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets.Summary,
    );
    expect(
      totals.find((row) => row.Reports === translations.en.totalExpenses)
        ?.Amount,
    ).toBe(243.3);
  } finally {
    await page.goto("about:blank");
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.query('delete from "user" where id=$1', [otherUser]);
    await db.end();
  }
});

test("new accounts see a report empty state and can reach every main page", async ({
  page,
}) => {
  const db = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  await db.connect();
  const email = `reports-empty-${Date.now()}@example.test`;
  let userId: string | undefined;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const signup = await page.request.post("/api/auth/sign-up/email", {
      headers: { "x-real-ip": "192.0.2.22" },
      data: { name: "Readiness check", email, password: "ReportsCheck123!" },
    });
    expect(signup.ok()).toBe(true);
    userId = (await db.query('select id from "user" where email=$1', [email]))
      .rows[0].id;
    await page.addInitScript((id) => {
      localStorage.setItem(`lumium_dashboard_tour:${id}`, "skipped");
      localStorage.setItem(
        "lumium_prefs",
        JSON.stringify({
          state: { currency: "BYN", language: "ru" },
          version: 0,
        }),
      );
    }, userId!);
    await page.goto("/dashboard/reports");
    await expect(
      page.getByRole("heading", {
        name: translations.ru.noDataPeriod,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("report-summary")).toHaveCount(0);
    await page
      .locator(".dashboard-main")
      .getByRole("button", {
        name: translations.ru.addTransaction,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("dialog", {
        name: translations.ru.newTransaction,
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("dialog", {
        name: translations.ru.newTransaction,
        exact: true,
      })
      .getByRole("button", { name: translations.ru.close, exact: true })
      .click();
    for (const route of [
      "/dashboard",
      "/dashboard/transactions",
      "/dashboard/categories",
      "/dashboard/budget",
      "/dashboard/planning",
      "/dashboard/settings",
      "/dashboard/help",
      "/dashboard/users",
      "/dashboard/pricing",
    ]) {
      const response = await page.goto(route);
      expect(response?.ok(), route).toBe(true);
      await expect(page.locator(".dashboard-main")).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.end();
  }
});
