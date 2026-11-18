import { expect, test } from "@playwright/test";
import { Client } from "pg";
import * as XLSX from "xlsx";
import {
  allocateTransactions,
  independentBudgets,
  sumCategoryAllocations,
  rebalanceAllocationAmounts,
} from "@/utils/financial-allocations";
import { resolveReceiptCategory } from "@/utils/receipt-scanner";
import {
  categoryDisplayLabel,
  categoryLabel,
  categoryHasName,
} from "@/utils/category-catalog";
import { translations, type TranslationKey } from "@/store/translations";

test("standard category paths follow language and preserve custom names", () => {
  const expected = {
    en: "Groceries / Milk",
    ru: "Продукты / Молоко",
    de: "Lebensmittel / Milch",
    fr: "Courses / Lait",
  };
  for (const language of ["en", "ru", "de", "fr"] as const) {
    const t = (key: TranslationKey) =>
      (translations[language] as Record<string, string>)[key] ??
      translations.en[key];
    expect(
      categoryDisplayLabel(
        {
          name: "Milk",
          system_key: "groceries/milk",
          parent_name: "Groceries",
          parent_system_key: "groceries",
        },
        t,
      ),
    ).toBe(expected[language]);
    expect(
      categoryLabel(
        { name: "My special milk", system_key: "groceries/milk" },
        t,
      ),
    ).toBe("My special milk");
    expect(
      categoryHasName(
        { name: "Milk", system_key: "groceries/milk" },
        " МОЛОКО ",
      ),
    ).toBe(true);
  }
});

test("allocations replace primary category, roll up once, and respect archived receipt categories", () => {
  const categories = [
    { id: "food", name: "Groceries", system_key: "groceries" },
    {
      id: "milk",
      name: "Milk",
      parent_id: "food",
      system_key: "groceries/milk",
    },
    { id: "shop", name: "Shopping", system_key: "shopping" },
    { id: "other", name: "Other", system_key: "other-expense" },
  ];
  const allocations = allocateTransactions(
    [{ id: "receipt", category_id: "shop", amount: "100" }],
    [
      { transaction_id: "receipt", category_id: "milk", amount: "40" },
      { transaction_id: "receipt", category_id: "shop", amount: "60" },
    ],
  );
  const totals = sumCategoryAllocations(allocations, categories);
  expect(totals.get("food")).toBe(40);
  expect(totals.get("milk")).toBe(40);
  expect(totals.get("shop")).toBe(60);
  expect(allocations.reduce((sum, row) => sum + row.amount, 0)).toBe(100);
  expect(
    independentBudgets([
      { category_id: "food" },
      { category_id: "milk", parent_id: "food" },
      { category_id: "shop" },
    ]),
  ).toHaveLength(2);
  expect(
    resolveReceiptCategory({ name: "Молоко 2,5%", price: 5 }, categories),
  ).toBe("milk");
  expect(
    resolveReceiptCategory(
      { name: "MILK", price: 5 },
      categories.map((c) =>
        c.id === "milk" ? { ...c, is_archived: true } : c,
      ),
    ),
  ).toBe("food");
  expect(
    resolveReceiptCategory(
      { name: "MILK", price: 5 },
      categories.map((c) =>
        c.id === "food" ? { ...c, is_archived: true } : c,
      ),
    ),
  ).toBe("other");
  expect(
    rebalanceAllocationAmounts("1.00000000", [
      "1.00000000",
      "1.00000000",
      "1.00000000",
    ]),
  ).toEqual(["0.33333334", "0.33333333", "0.33333333"]);
});

test("category hierarchy preserves history and agrees across budgets, reports, filters and export", async ({
  page,
}) => {
  const db = new Client({
    connectionString:
      process.env.E2E_DATABASE_URL ??
      "postgres://lumium:lumium@127.0.0.1:55432/lumium",
  });
  await db.connect();
  const email = `categories-${Date.now()}@example.test`;
  let userId: string | undefined;
  try {
    await page.addInitScript(() =>
      localStorage.setItem(
        "lumium_prefs",
        JSON.stringify({
          state: { currency: "BYN", language: "en" },
          version: 0,
        }),
      ),
    );
    const response = await page.request.post("/api/auth/sign-up/email", {
      data: { name: "Category Test", email, password: "CategoryTest123!" },
    });
    expect(response.ok(), await response.text()).toBe(true);
    userId = (await db.query('select id from "user" where email=$1', [email]))
      .rows[0].id;
    await page.goto("/dashboard/categories");
    await expect(
      page.getByRole("heading", { name: "Categories", exact: true }).first(),
    ).toBeVisible();
    const categoryRows = (
      await db.query("select * from categories where user_id=$1", [userId])
    ).rows;
    const id = (key: string): string =>
      categoryRows.find((c) => c.system_key === key).id;
    expect(categoryRows.filter((c) => !c.parent_id)).toHaveLength(26);
    expect(categoryRows.find((c) => c.system_key === "pets").is_archived).toBe(
      true,
    );
    await db.query(
      `insert into subscriptions(user_id,plan,status) values($1,'pro','active')`,
      [userId],
    );
    const transaction = (
      await db.query(
        `insert into transactions(user_id, category_id, description, amount, type) values ($1,$2,'Mixed receipt',100,'expense') returning id`,
        [userId, id("shopping")],
      )
    ).rows[0].id;
    await db.query(
      `insert into transaction_splits(user_id,transaction_id,category_id,amount) values ($1,$2,$3,10),($1,$2,$4,60),($1,$2,$5,30)`,
      [
        userId,
        transaction,
        id("groceries/milk"),
        id("groceries"),
        id("shopping"),
      ],
    );
    await db.query(
      `insert into transactions(user_id,category_id,description,amount,type) values($1,$2,'Direct groceries',5,'expense')`,
      [userId, id("groceries")],
    );
    await db.query(
      `insert into budgets(user_id,category_id,monthly_limit,month_year) values($1,$2,100,date_trunc('month',now())),($1,$3,20,date_trunc('month',now())),($1,$4,50,date_trunc('month',now()))`,
      [userId, id("groceries"), id("groceries/milk"), id("shopping")],
    );

    await page.goto("/dashboard/budget");
    await expect(
      page.getByText("150.00 BYN", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("105.00 BYN", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Groceries / Milk", { exact: true }).first(),
    ).toBeVisible();
    await page.goto(`/dashboard/transactions?categoryId=${id("groceries")}`);
    await expect(
      page.getByText("Mixed receipt", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Amount in selected category: 70.00 BYN").first(),
    ).toBeVisible();
    await expect(
      page.getByText("Direct groceries", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page
      .getByRole("button", { name: "Export Excel" })
      .filter({ visible: true })
      .click();
    const download = await downloadPromise;
    const workbook = XLSX.readFile((await download.path())!);
    const exported = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets.Transactions,
    );
    expect(exported.reduce((sum, row) => sum + Number(row.Amount), 0)).toBe(75);
    expect(exported.some((row) => row.Subcategory === "Milk")).toBe(true);
    await page.goto("/dashboard/reports?period=30d");
    await expect(
      page.getByText("105.00 BYN", { exact: true }).first(),
    ).toBeVisible();
    const group = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Groceries" }) });
    await group.locator("summary").click();
    await expect(group.getByText("75.00 BYN", { exact: true })).toBeVisible();
    await expect(
      group.getByText("Without subcategory", { exact: true }),
    ).toBeVisible();
    await expect(group.getByText("65.00 BYN", { exact: true })).toBeVisible();
    await expect(group.getByText("10.00 BYN", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/category-report-mobile.png",
      fullPage: true,
    });
    await page.goto(`/dashboard/transactions?categoryId=${id("groceries")}`);
    await page
      .getByRole("button")
      .filter({ hasText: "Mixed receipt" })
      .first()
      .click();
    const detail = page.getByRole("dialog");
    await detail
      .getByRole("button", { name: "Edit", exact: true })
      .filter({ visible: true })
      .click();
    await detail
      .getByRole("spinbutton", { name: "Amount", exact: true })
      .fill("200");
    await detail
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(detail).toBeHidden();
    await expect
      .poll(
        async () =>
          (
            await db.query(
              "select sum(amount)::float8 as amount from transaction_splits where transaction_id=$1",
              [transaction],
            )
          ).rows[0].amount,
      )
      .toBe(200);
    // Database constraints protect the same invariants as the server actions.
    await expect(
      db.query(
        `insert into categories(user_id,name,type,color,parent_id) values($1,'Third level','expense','#24845C',$2)`,
        [userId, id("groceries/milk")],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query(
        `insert into categories(user_id,name,type,color,parent_id) values($1,' milk ','expense','#24845C',$2)`,
        [userId, id("groceries")],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      db.query(
        `insert into categories(user_id,name,type,color,parent_id) values($1,'Wrong type','income','#24845C',$2)`,
        [userId, id("groceries")],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    const foreignUser = `category-owner-${Date.now()}`;
    await db.query('insert into "user"(id,name,email) values($1,$1,$2)', [
      foreignUser,
      `${foreignUser}@example.test`,
    ]);
    try {
      await expect(
        db.query(
          `insert into categories(user_id,name,type,color,parent_id) values($1,'Wrong owner','expense','#24845C',$2)`,
          [foreignUser, id("groceries")],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    } finally {
      await db.query('delete from "user" where id=$1', [foreignUser]);
    }
    await page.goto("/dashboard/categories");
    const groceries = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: "Groceries" }) });
    await groceries.locator("summary").click();
    await groceries
      .getByRole("button", { name: "Add subcategory", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Cheese");
    await page
      .getByRole("button", { name: "Save category", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(
      (
        await db.query(
          `select parent_id from categories where user_id=$1 and name='Cheese'`,
          [userId],
        )
      ).rows[0].parent_id,
    ).toBe(id("groceries"));
    await expect(page.locator("html")).toHaveJSProperty(
      "scrollWidth",
      await page.evaluate(() => window.innerWidth),
    );
    await page.screenshot({
      path: "test-results/category-management-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "test-results/category-management-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 393, height: 851 });
    await groceries
      .getByRole("button", { name: "Archive", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await db.query("select is_archived from categories where id=$1", [
              id("groceries"),
            ])
          ).rows[0].is_archived,
      )
      .toBe(true);
    await page.goto(
      `/dashboard/transactions?categoryId=${id("groceries/milk")}`,
    );
    await expect(
      page.getByText("Amount in selected category: 20.00 BYN").first(),
    ).toBeVisible();
    expect(
      (
        await db.query(
          "select count(*)::int as n from transaction_splits where transaction_id=$1",
          [transaction],
        )
      ).rows[0].n,
    ).toBe(3);
  } finally {
    if (userId) await db.query('delete from "user" where id=$1', [userId]);
    await db.end();
  }
});
