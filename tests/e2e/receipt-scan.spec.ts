import { expect, test } from "@playwright/test";
import { Client } from "pg";
import sharp from "sharp";
import { translations } from "@/store/translations";

const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgres://lumium:lumium@127.0.0.1:55432/lumium";
const email = `receipt-e2e-${Date.now()}@example.test`;

async function createReceiptPng(currency = "BYN") {
  const lines = [
    "TEST MARKET",
    "01.11.2026",
    "MILK 2.5%",
    `1 x 3.80 3.80 ${currency}`,
    `USB CABLE 19.90 ${currency}`,
    `TOTAL 23.70 ${currency}`,
  ];
  const text = lines
    .map(
      (line, index) =>
        `<text x="70" y="${160 + index * 130}" font-family="Arial" font-size="58" font-weight="600" fill="#111">${line}</text>`,
    )
    .join("");
  return sharp(
    Buffer.from(
      `<svg width="1000" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${text}</svg>`,
    ),
  )
    .png()
    .toBuffer();
}

test("receipt OCR creates categorized transaction splits", async ({ page }) => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const schema = await client.query(
      "select to_regclass('public.transactions') as transactions, to_regclass('public.transaction_splits') as splits",
    );
    expect(schema.rows[0]).toEqual({
      transactions: "transactions",
      splits: "transaction_splits",
    });

    const signUp = await page.request.post("/api/auth/sign-up/email", {
      data: {
        name: "Receipt E2E",
        email,
        password: "ReceiptTest123!",
        callbackURL: "/dashboard",
      },
    });
    expect(signUp.ok(), await signUp.text()).toBe(true);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    await page.getByRole("button", { name: "Skip tour", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("button", { name: "Add Transaction", exact: true })
      .click();
    await page.getByTestId("receipt-photo-choice").click();
    await page.getByTestId("receipt-gallery-input").setInputFiles({
      name: "mixed-receipt.png",
      mimeType: "image/png",
      buffer: await createReceiptPng(),
    });

    await expect(page.getByTestId("save-scanned-receipt")).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByTestId("save-scanned-receipt")).toBeEnabled({
      timeout: 30_000,
    });
    const categorySelects = page.locator(
      '[data-testid^="receipt-item-category-"]',
    );
    await expect(categorySelects).toHaveCount(2);
    await expect(page.getByTestId("receipt-item-name-0")).toHaveValue(
      "MILK 2.5%",
    );
    await expect(page.getByTestId("receipt-item-price-0")).toHaveValue("3.8");
    const selectedLabels = await categorySelects.evaluateAll((selects) =>
      selects.map((select) => {
        const element = select as HTMLSelectElement;
        return element.options[element.selectedIndex]?.textContent;
      }),
    );
    expect(new Set(selectedLabels).size).toBe(2);
    expect(selectedLabels).toEqual(
      expect.arrayContaining(["Groceries / Milk", "Shopping / Electronics"]),
    );

    await page.getByTestId("save-scanned-receipt").click();
    await expect(page.getByTestId("save-scanned-receipt")).toBeHidden({
      timeout: 30_000,
    });

    await expect
      .poll(async () => {
        const saved = await client.query(
          `select c.system_key, s.amount::numeric::float8 as amount
           from "user" u
           join transactions t on t.user_id = u.id
           join transaction_splits s on s.transaction_id = t.id
           join categories c on c.id = s.category_id
          where u.email = $1 and t.description = 'TEST MARKET'
          order by c.system_key`,
          [email],
        );
        return saved.rows;
      })
      .toEqual([
        { system_key: "groceries/milk", amount: 3.8 },
        { system_key: "shopping/electronics", amount: 19.9 },
      ]);
  } finally {
    await client.query('delete from "user" where email = $1', [email]);
    await client.end();
  }
});

test("receipt in an unsupported currency requires manual entry without relabeling its amount", async ({
  page,
}) => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const receiptEmail = `receipt-currency-${Date.now()}@example.test`;
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
      headers: { "x-real-ip": "192.0.2.10" },
      data: {
        name: "Receipt currency check",
        email: receiptEmail,
        password: "ReceiptTest123!",
      },
    });
    expect(response.ok()).toBe(true);
    await page.goto("/dashboard");
    await page
      .getByRole("button", { name: translations.en.tourSkip, exact: true })
      .click();
    await page
      .getByRole("navigation", { name: translations.en.mobileNavigation })
      .getByRole("button", {
        name: translations.en.addTransaction,
        exact: true,
      })
      .click();
    await page.getByTestId("receipt-photo-choice").click();
    await page.getByTestId("receipt-gallery-input").setInputFiles({
      name: "unsupported-currency.png",
      mimeType: "image/png",
      buffer: await createReceiptPng("RUB"),
    });
    await expect(page.getByTestId("save-scanned-receipt")).toBeVisible({
      timeout: 120_000,
    });
    await expect(
      page
        .getByRole("dialog", {
          name: translations.en.checkPurchase,
          exact: true,
        })
        .getByRole("alert"),
    ).toContainText(translations.en.receiptUnsupportedCurrency);
    await expect(page.getByTestId("save-scanned-receipt")).toBeDisabled();
    await page
      .getByRole("button", { name: translations.en.enterManually, exact: true })
      .click();
    const manual = page.getByRole("dialog", {
      name: translations.en.newTransaction,
      exact: true,
    });
    await expect(
      manual.getByRole("spinbutton", {
        name: translations.en.amount,
        exact: true,
      }),
    ).toBeEmpty();
    await expect(manual.locator('input[name="currency"]')).toHaveValue("BYN");
    expect(
      (
        await client.query(
          'select count(*)::int as count from transactions where user_id=(select id from "user" where email=$1)',
          [receiptEmail],
        )
      ).rows[0].count,
    ).toBe(0);
  } finally {
    await page.goto("about:blank");
    await client.query('delete from "user" where email=$1', [receiptEmail]);
    await client.end();
  }
});
