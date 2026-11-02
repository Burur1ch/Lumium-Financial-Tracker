import { expect, test } from "@playwright/test";
import {
  inferReceiptCategory,
  parseReceiptText,
  receiptRecognitionNeedsRetry,
} from "@/utils/receipt-scanner";

test("parses wrapped receipt rows and quantity lines", () => {
  const result = parseReceiptText(`
ООО ЕВРООПТ
01.11.2026
МОЛОКО 2,5%
1 x 3,80 3,80
КАБЕЛЬ USB 19,90
ИТОГО 23,70 BYN
`, 94);

  expect(result.merchant).toBe("ООО ЕВРООПТ");
  expect(result.amount).toBe(23.7);
  expect(result.items).toEqual([
    expect.objectContaining({ name: "Молоко 2,5%", price: 3.8, quantity: 1, unitPrice: 3.8 }),
    expect.objectContaining({ name: "Кабель USB", price: 19.9 }),
  ]);
  expect(receiptRecognitionNeedsRetry(result)).toBe(false);
});

test("uses product meaning instead of ambiguous utility words", () => {
  expect(inferReceiptCategory("Вода минеральная 1,5 л").key).toBe("groceries");
  expect(inferReceiptCategory("Смартфон Samsung").key).toBe("shopping");
  expect(inferReceiptCategory("Оплата водоканала").key).toBe("utilities");
});
