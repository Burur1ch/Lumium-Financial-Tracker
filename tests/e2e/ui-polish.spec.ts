import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { resolveCategoryIcon } from "@/utils/category-icons";
import { translations } from "@/store/translations";
import {
  CURRENCIES,
  isCurrency,
  normalizeExchangeRates,
} from "@/utils/currency";

const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgres://lumium:lumium@127.0.0.1:55432/lumium";

test("only BYN, USD and EUR are accepted and exchange rates use the BYN base", () => {
  expect(CURRENCIES).toEqual(["BYN", "USD", "EUR"]);
  for (const currency of CURRENCIES) expect(isCurrency(currency)).toBe(true);
  for (const currency of ["RUB", "GBP", "JPY", "CNY", "euro", "", null])
    expect(isCurrency(currency)).toBe(false);
  expect(
    normalizeExchangeRates({ USD: 10, BYN: 3.2, EUR: 0.9, ...{ GBP: 0.8 } }),
  ).toEqual({ USD: 10, BYN: 1, EUR: 0.9 });
});

test("currency settings recover an old preference and offer the three supported currencies", async ({
  page,
}) => {
  const db = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  await db.connect();
  const email = `currency-${Date.now()}@example.test`;
  try {
    const response = await page.request.post("/api/auth/sign-up/email", {
      headers: { "x-real-ip": "192.0.2.9" },
      data: { name: "Currency check", email, password: "CurrencyCheck123!" },
    });
    expect(response.ok()).toBe(true);
    await page.addInitScript(() => {
      if (!localStorage.getItem("lumium_prefs"))
        localStorage.setItem(
          "lumium_prefs",
          JSON.stringify({
            state: {
              currency: "GBP",
              language: "en",
              exchangeRates: { USD: 1, BYN: 3.2, EUR: 0.9, GBP: 0.8 },
            },
            version: 0,
          }),
        );
    });
    await page.route("**/api/exchange-rates", (route) =>
      route.fulfill({
        json: {
          base: "BYN",
          rates: { USD: 1, BYN: 3.2, EUR: 0.9, GBP: 0.8 },
          source: "fallback",
          rateDate: null,
        },
      }),
    );
    await page.goto("/dashboard/settings");
    await expect(page.locator(".dashboard-launch-screen")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: translations.en.appearance,
        exact: true,
      }),
    ).toBeVisible();
    const select = page.getByRole("combobox", {
      name: translations.en.currency,
      exact: true,
    });
    await expect(select).toHaveValue("BYN");
    expect(
      await select
        .locator("option")
        .evaluateAll((options) =>
          options.map((option) => (option as HTMLOptionElement).value),
        ),
    ).toEqual(["BYN", "USD", "EUR"]);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(
            JSON.parse(localStorage.getItem("lumium_prefs")!).state
              .exchangeRates,
          ).sort(),
        ),
      )
      .toEqual(["BYN", "EUR", "USD"]);
    await select.selectOption("EUR");
    await expect(select).toHaveValue("EUR");
    await page
      .getByRole("button", { name: translations.en.saveChanges, exact: true })
      .and(page.locator('button:not([type="submit"])'))
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("lumium_prefs")!).state.currency,
        ),
      )
      .toBe("EUR");
    await page.reload();
    await expect(select).toHaveValue("EUR");
  } finally {
    await page.goto("about:blank");
    await db.query('delete from "user" where email=$1', [email]);
    await db.end();
  }
});

for (const viewport of [
  { width: 393, height: 851, language: "en" as const, clientIp: "192.0.2.1" },
  { width: 360, height: 640, language: "en" as const, clientIp: "192.0.2.2" },
  { width: 360, height: 640, language: "ru" as const, clientIp: "192.0.2.3" },
  { width: 1440, height: 1000, language: "en" as const, clientIp: "192.0.2.4" },
]) {
  test(`tour follows all targets at ${viewport.width}x${viewport.height} in ${viewport.language}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const db = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
    });
    await db.connect();
    const email = `tour-polish-${Date.now()}@example.test`;
    const copy = translations[viewport.language];
    try {
      await page.addInitScript(
        (language) =>
          localStorage.setItem(
            "lumium_prefs",
            JSON.stringify({
              state: { currency: "BYN", language },
              version: 0,
            }),
          ),
        viewport.language,
      );
      const response = await page.request.post("/api/auth/sign-up/email", {
        headers: { "x-real-ip": viewport.clientIp },
        data: { name: "Tour check", email, password: "TourPolish123!" },
      });
      expect(response.ok()).toBe(true);
      await page.goto("/dashboard");
      await expect(page.locator(".dashboard-launch-screen")).toHaveCount(0);
      const tour = page.locator(".tour-dialog");
      await expect(tour).toBeVisible();
      const targets = [
        "overview",
        "period",
        "add-transaction",
        ...(viewport.width < 1024 ? ["entry-methods"] : []),
        "transaction-category",
        "quick-actions",
        "activity",
        "budget-overview",
        "budget-limit-fields",
        "category-management",
        "main-navigation",
      ];
      for (const target of targets) {
        await expect(tour).toHaveAttribute("data-tour-step", target);
        await expect(page.locator(".tour-highlight")).toHaveAttribute(
          "data-tour-highlight",
          target,
        );
        await expect
          .poll(
            () =>
              page.evaluate(() => {
                const highlight = document
                  .querySelector(".tour-highlight")
                  ?.getBoundingClientRect();
                if (!highlight) return false;
                const dialog = document
                  .querySelector(".tour-dialog")!
                  .getBoundingClientRect();
                const overlap =
                  Math.max(
                    0,
                    Math.min(highlight.right, dialog.right) -
                      Math.max(highlight.left, dialog.left),
                  ) *
                  Math.max(
                    0,
                    Math.min(highlight.bottom, dialog.bottom) -
                      Math.max(highlight.top, dialog.top),
                  );
                return (
                  dialog.left >= 0 &&
                  dialog.top >= 0 &&
                  dialog.right <= innerWidth + 1 &&
                  dialog.bottom <= innerHeight + 1 &&
                  overlap < 1
                );
              }),
            { message: `tooltip fits beside ${target}` },
          )
          .toBe(true);
        if (target === "add-transaction" && viewport.width < 1024) {
          const circle = await page
            .locator(".mobile-add-button-circle")
            .boundingBox();
          expect(circle).not.toBeNull();
          await expect
            .poll(
              async () =>
                (await page.locator(".tour-highlight").boundingBox())?.y ??
                Infinity,
            )
            .toBeLessThanOrEqual(circle!.y);
        }
        if (
          [
            "entry-methods",
            "transaction-category",
            "budget-limit-fields",
          ].includes(target)
        )
          await page.screenshot({ path: testInfo.outputPath(`${target}.png`) });
        if (target === targets.at(-1)) break;
        await tour
          .getByRole("button", { name: copy.tourNext, exact: true })
          .click();
      }
      await tour
        .getByRole("button", { name: copy.tourFinish, exact: true })
        .click();
      await expect(tour).toBeHidden();
      await expect(
        page.locator("[data-tour='main-navigation']").filter({ visible: true }),
      ).toHaveCount(viewport.width < 1024 ? 0 : 1);
      expect(
        (
          await db.query(
            'select count(*)::int as count from budgets where user_id=(select id from "user" where email=$1)',
            [email],
          )
        ).rows[0].count,
      ).toBe(0);
    } finally {
      await page.goto("about:blank");
      await db.query('delete from "user" where email=$1', [email]);
      await db.end();
    }
  });
}

test("budget limit can be created for the selected month with an 85 percent alert", async ({
  page,
}) => {
  const db = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  await db.connect();
  const email = `budget-polish-${Date.now()}@example.test`;
  let userId: string | undefined;
  try {
    const response = await page.request.post("/api/auth/sign-up/email", {
      headers: { "x-real-ip": "192.0.2.5" },
      data: { name: "Budget check", email, password: "BudgetPolish123!" },
    });
    expect(response.ok()).toBe(true);
    userId = (await db.query('select id from "user" where email=$1', [email]))
      .rows[0].id;
    await page.addInitScript(() =>
      localStorage.setItem(
        "lumium_prefs",
        JSON.stringify({
          state: { currency: "BYN", language: "en" },
          version: 0,
        }),
      ),
    );
    const previous = new Date();
    previous.setUTCMonth(previous.getUTCMonth() - 1, 1);
    const month = previous.toISOString().slice(0, 7);
    await page.goto(`/dashboard/budget?month=${month}`);
    await page
      .getByRole("button", { name: "Set Category Limit", exact: true })
      .click();
    const modal = page.getByRole("dialog", {
      name: translations.en.budgetLimitTitle,
      exact: true,
    });
    await expect(modal).toBeVisible();
    const category = (
      await db.query(
        "select id from categories where user_id=$1 and system_key='groceries'",
        [userId],
      )
    ).rows[0].id;
    await modal
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption(category);
    await expect(
      modal.locator('[data-category-icon="shoppingCart"]'),
    ).toBeVisible();
    await modal.getByRole("spinbutton", { name: /Monthly Limit/ }).fill("250");
    await modal
      .getByRole("spinbutton", { name: /Warning threshold/ })
      .fill("85");
    await modal
      .getByRole("button", { name: translations.en.saveLimit, exact: true })
      .click();
    await expect(modal).toBeHidden();
    const saved = (
      await db.query(
        "select monthly_limit::float8 as amount, alert_threshold, month_year::text as month from budgets where user_id=$1",
        [userId],
      )
    ).rows;
    expect(saved).toEqual([
      { amount: 250, alert_threshold: 85, month: `${month}-01` },
    ]);
  } finally {
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.end();
  }
});

test("category icons preserve choices and resolve legacy defaults and subcategories", () => {
  expect(resolveCategoryIcon("fuel", "Transport")?.key).toBe("fuel");
  expect(resolveCategoryIcon("heart", "Pets", "pets")?.key).toBe("pawPrint");
  expect(resolveCategoryIcon("heart", "Children", "children")?.key).toBe(
    "baby",
  );
  expect(
    resolveCategoryIcon("shoppingCart", "Milk", "groceries/milk")?.key,
  ).toBe("milk");
  expect(resolveCategoryIcon("wallet", "Salary", "salary")?.asset).toBe(
    "salary",
  );
  expect(resolveCategoryIcon("wallet", "Custom wallet")?.key).toBe("wallet");
  expect(resolveCategoryIcon("coffee", "Groceries", "groceries")?.key).toBe(
    "coffee",
  );
  expect(resolveCategoryIcon(null, "Питомцы")?.key).toBe("pawPrint");
});

test("budget rollover, overspend, archived editing and plan quota stay consistent", async ({
  page,
}) => {
  const db = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  await db.connect();
  const email = `budget-limits-${Date.now()}@example.test`;
  let userId: string | undefined;
  try {
    const response = await page.request.post("/api/auth/sign-up/email", {
      headers: { "x-real-ip": "192.0.2.6" },
      data: { name: "Limits check", email, password: "BudgetPolish123!" },
    });
    expect(response.ok()).toBe(true);
    userId = (await db.query('select id from "user" where email=$1', [email]))
      .rows[0].id;
    await page.addInitScript(() =>
      localStorage.setItem(
        "lumium_prefs",
        JSON.stringify({
          state: { currency: "BYN", language: "en" },
          version: 0,
        }),
      ),
    );
    await page.goto("/dashboard/budget");
    const categories = (
      await db.query("select id, system_key from categories where user_id=$1", [
        userId,
      ])
    ).rows;
    const id = (key: string) =>
      categories.find((category) => category.system_key === key).id as string;
    const month = new Date().toISOString().slice(0, 7);
    const previousDate = new Date();
    previousDate.setUTCMonth(previousDate.getUTCMonth() - 1, 1);
    const previous = previousDate.toISOString().slice(0, 7);
    for (const key of [
      "groceries",
      "transport",
      "housing",
      "utilities",
      "health",
    ]) {
      await db.query(
        "insert into budgets(user_id,category_id,monthly_limit,month_year,rollover_enabled,alert_threshold) values($1,$2,$5,$3,$4,$6)",
        [
          userId,
          id(key),
          `${month}-01`,
          key === "groceries",
          key === "housing" ? 0.3 : key === "health" ? 0.1 : 100,
          key === "health" ? 90 : 85,
        ],
      );
    }
    await db.query(
      "insert into budgets(user_id,category_id,monthly_limit,month_year) values($1,$2,200,$3)",
      [userId, id("groceries"), `${previous}-01`],
    );
    await db.query(
      "insert into transactions(user_id,category_id,description,amount,type,date) values($1,$2,'Previous groceries',50,'expense',$3),($1,$4,'Current milk',250,'expense',$5),($1,$6,'Current transport',125,'expense',$5)",
      [
        userId,
        id("groceries/milk"),
        `${previous}-15T12:00:00Z`,
        id("groceries/milk"),
        `${month}-15T12:00:00Z`,
        id("transport"),
      ],
    );
    await db.query("update categories set is_archived=true where id=$1", [
      id("groceries"),
    ]);
    await db.query(
      "insert into transactions(user_id,category_id,description,amount,type,date) values($1,$2,'Fraction one',0.1,'expense',$4),($1,$2,'Fraction two',0.2,'expense',$4),($1,$3,'Threshold fraction',0.09,'expense',$4)",
      [userId, id("housing"), id("health"), `${month}-15T12:00:00Z`],
    );
    await page.reload();
    const groceries = page.getByRole("button", {
      name: `${translations.en.openBudgetSettings} Groceries`,
      exact: true,
    });
    const transport = page.getByRole("button", {
      name: `${translations.en.openBudgetSettings} Transport`,
      exact: true,
    });
    await expect(groceries).toContainText("Limit reached");
    await expect(groceries).toContainText("100% used");
    await expect(groceries).toContainText("BYN 150.00");
    await expect(transport).toContainText("125% used");
    await expect(transport).toContainText("Over limit");
    await expect(
      page.getByRole("button", {
        name: `${translations.en.openBudgetSettings} Housing`,
        exact: true,
      }),
    ).toContainText("Limit reached");
    await expect(
      page.getByRole("button", {
        name: `${translations.en.openBudgetSettings} Health`,
        exact: true,
      }),
    ).toContainText("Warning");
    await groceries.click();
    const modal = page.locator('[data-tour="budget-limit"]');
    await expect(
      modal.getByRole("combobox", { name: "Category", exact: true }),
    ).toBeDisabled();
    await expect(
      modal.getByRole("spinbutton", { name: /Monthly Limit/ }),
    ).toHaveValue("100");
    await modal.getByRole("spinbutton", { name: /Monthly Limit/ }).fill("150");
    await modal
      .getByRole("spinbutton", { name: /Warning threshold/ })
      .fill("100");
    await modal
      .getByRole("button", { name: translations.en.saveLimit, exact: true })
      .click();
    await expect(modal).toBeHidden();
    await page
      .getByRole("button", {
        name: translations.en.setCategoryLimit,
        exact: true,
      })
      .click();
    await modal
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption(id("transport"));
    await expect(
      modal.getByRole("spinbutton", { name: /Monthly Limit/ }),
    ).toHaveValue("100");
    await expect(
      modal.getByRole("spinbutton", { name: /Warning threshold/ }),
    ).toHaveValue("85");
    await modal.getByRole("spinbutton", { name: /Monthly Limit/ }).fill("200");
    await modal
      .getByRole("spinbutton", { name: /Warning threshold/ })
      .fill("50");
    await modal
      .getByRole("button", { name: translations.en.saveLimit, exact: true })
      .click();
    await expect(modal).toBeHidden();
    await page
      .getByRole("button", {
        name: translations.en.setCategoryLimit,
        exact: true,
      })
      .click();
    await modal
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption(id("shopping"));
    await modal.getByRole("spinbutton", { name: /Monthly Limit/ }).fill("60");
    await modal
      .getByRole("button", { name: translations.en.saveLimit, exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText(translations.en.billingComingSoonDesc, { exact: true }),
    ).toBeVisible();
    const saved = (
      await db.query(
        "select category_id,monthly_limit::float8 as amount,alert_threshold from budgets where user_id=$1 and month_year=$2",
        [userId, `${month}-01`],
      )
    ).rows;
    expect(saved).toHaveLength(5);
    expect(
      saved.find((budget) => budget.category_id === id("transport")),
    ).toMatchObject({ amount: 200, alert_threshold: 50 });
    expect(
      saved.find((budget) => budget.category_id === id("groceries")),
    ).toMatchObject({ amount: 150, alert_threshold: 100 });
    await page.goto("/dashboard/categories");
    const add = page
      .getByRole("navigation", { name: translations.en.mobileNavigation })
      .getByRole("button", {
        name: translations.en.addTransaction,
        exact: true,
      });
    await add.click();
    await page
      .getByRole("button", { name: new RegExp(translations.en.enterManually) })
      .click();
    const manual = page.getByRole("dialog", {
      name: translations.en.newTransaction,
      exact: true,
    });
    await expect(
      manual.getByRole("combobox", {
        name: translations.en.category,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      manual
        .getByRole("combobox", { name: translations.en.category, exact: true })
        .getByRole("option", { name: "Transport", exact: true }),
    ).toHaveCount(1);
    await manual
      .getByRole("button", { name: translations.en.close, exact: true })
      .click();
    await expect(manual).toBeHidden();
    await page
      .getByRole("button", {
        name: translations.en.createCategory,
        exact: true,
      })
      .click();
    const editor = page.getByRole("dialog");
    await editor.locator('input[name="name"]').fill("My milk");
    const icon = editor.locator('select[name="icon"]');
    await expect(icon.locator('option[value="baby"]')).toHaveCount(1);
    await expect(icon.locator('option[value="pawPrint"]')).toHaveCount(1);
    await icon.selectOption("milk");
    await expect(editor.locator('[data-category-icon="milk"]')).toBeVisible();
    await editor
      .getByRole("button", { name: translations.en.categorySave, exact: true })
      .click();
    await expect(editor).toBeHidden();
    expect(
      (
        await db.query(
          "select icon from categories where user_id=$1 and name='My milk'",
          [userId],
        )
      ).rows,
    ).toEqual([{ icon: "milk" }]);
    await add.click();
    await page
      .getByRole("button", { name: new RegExp(translations.en.enterManually) })
      .click();
    const categorySelect = manual.getByRole("combobox", {
      name: translations.en.category,
      exact: true,
    });
    await expect(
      categorySelect.getByRole("option", { name: "My milk", exact: true }),
    ).toHaveCount(1);
    await categorySelect.selectOption({ label: "My milk" });
    await expect(manual.locator('[data-category-icon="milk"]')).toBeVisible();
    await expect(
      manual.locator('[data-category-icon="expense"]'),
    ).toBeVisible();
    await manual
      .getByRole("spinbutton", { name: translations.en.amount, exact: true })
      .fill("3");
    await manual
      .getByRole("textbox", { name: translations.en.description, exact: true })
      .fill("Milk icon check");
    await manual
      .getByRole("button", { name: translations.en.saveChanges, exact: true })
      .click();
    await expect(manual).toBeHidden();
    expect(
      (
        await db.query(
          "select c.icon from transactions t join categories c on c.id=t.category_id where t.user_id=$1 and t.description='Milk icon check'",
          [userId],
        )
      ).rows,
    ).toEqual([{ icon: "milk" }]);
  } finally {
    await page.goto("about:blank");
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.end();
  }
});
