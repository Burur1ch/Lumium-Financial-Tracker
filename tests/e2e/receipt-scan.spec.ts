import { expect, test } from "@playwright/test";
import { Client } from "pg";
import sharp from "sharp";

const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgres://lumium:lumium@127.0.0.1:55432/lumium";
const email = `receipt-e2e-${Date.now()}@example.test`;

async function createReceiptPng() {
  const lines = [
    "TEST MARKET",
    "01.11.2026",
    "MILK 3.80 USD",
    "USB CABLE 19.90 USD",
    "TOTAL 23.70 USD",
  ];
  const text = lines
    .map((line, index) => `<text x="70" y="${160 + index * 130}" font-family="Arial" font-size="58" font-weight="600" fill="#111">${line}</text>`)
    .join("");
  return sharp(Buffer.from(`<svg width="1000" height="900" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${text}</svg>`))
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
    expect(schema.rows[0]).toEqual({ transactions: "transactions", splits: "transaction_splits" });

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

    await page.evaluate(() => window.dispatchEvent(new Event("lumium:open-mobile-add")));
    await page.getByTestId("receipt-photo-choice").click();
    await page.getByTestId("receipt-gallery-input").setInputFiles({
      name: "mixed-receipt.png",
      mimeType: "image/png",
      buffer: await createReceiptPng(),
    });

    await expect(page.getByTestId("save-scanned-receipt")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("save-scanned-receipt")).toBeEnabled({ timeout: 30_000 });
    const categorySelects = page.locator('[data-testid^="receipt-item-category-"]');
    await expect(categorySelects).toHaveCount(2);
    const selectedLabels = await categorySelects.evaluateAll((selects) =>
      selects.map((select) => {
        const element = select as HTMLSelectElement;
        return element.options[element.selectedIndex]?.textContent;
      }),
    );
    expect(new Set(selectedLabels).size).toBe(2);
    expect(selectedLabels).toEqual(expect.arrayContaining(["Groceries", "Shopping"]));

    await page.getByTestId("save-scanned-receipt").click();
    await expect(page.getByTestId("save-scanned-receipt")).toBeHidden({ timeout: 30_000 });

    await expect.poll(async () => {
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
    }).toEqual([
      { system_key: "groceries", amount: 3.8 },
      { system_key: "shopping", amount: 19.9 },
    ]);
  } finally {
    await client.query('delete from "user" where email = $1', [email]);
    await client.end();
  }
});
