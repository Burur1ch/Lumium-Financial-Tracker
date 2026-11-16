import { expect, test } from "@playwright/test";
import {
  allocateReceiptCategorySplits,
  inferReceiptCategory,
  parseReceiptText,
  resolveReceiptCategory,
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

test("ignores an item discount line even when OCR misses its first letter", () => {
  const result = parseReceiptText(
    `Молоко Минская марка
2,19
кидка на поз. -0,60
ИТОГО 1,59 BYN`,
    90,
  );

  expect(result.amount).toBe(1.59);
  expect(result.items).toEqual([
    expect.objectContaining({ name: "Молоко Минская марка", price: 2.19 }),
  ]);
});

test("keeps a product name across OCR quantity noise and fixes obvious brand typos", () => {
  const result = parseReceiptText(
    `1981724 Нап,пив,б/а "АПИВАРИЯ ПШЕНИЧНОЕ" (Жб
)0. 45л
1,99`,
    68,
  );

  expect(result.items).toEqual([
    expect.objectContaining({
      name: expect.stringContaining("Аливария"),
      price: 1.99,
    }),
  ]);
  expect(result.items[0].name).not.toContain("1981724");
  expect(result.items[0].name).toContain("Пшеничное");
});

test("retries OCR when the receipt total is missing, even when several items were found", () => {
  const result = parseReceiptText(
    `Напиток "ШВЕГПС" (линон) 3,19
Напиток "Фанта" 4,69
Пиво "Аливария" 1,99
Карамель "Halls" 1,55
Напиток "Sprite" 14,07`,
    90,
  );

  expect(result.items).toHaveLength(5);
  expect(result.amount).toBeNull();
  expect(receiptRecognitionNeedsRetry(result)).toBe(true);
});

test("categorizes Russian supermarket drinks and confectionery into grocery subcategories", () => {
  const categories = [
    { id: "groceries", name: "Groceries", system_key: "groceries" },
    ...["milk", "drinks", "pantry"].map((key) => ({
      id: `groceries/${key}`,
      name: key,
      system_key: `groceries/${key}`,
      parent_id: "groceries",
    })),
    { id: "other-expense", name: "Other expenses", system_key: "other-expense" },
  ];
  const items = [
    { name: 'Молоко "Минская марка" 2,5%', price: 2.19 },
    { name: 'Напиток "Бонаква" вкус малины', price: 2.49 },
    { name: 'Пиво "Koronet Unfiltered"', price: 4.99 },
    { name: 'Пиво "Koronet Lager"', price: 4.99 },
    { name: 'Вода минеральная "Дарида" газированная', price: 0.99 },
    { name: 'Напиток пивной безалкогольный "Аливария"', price: 1.99 },
    { name: 'Напиток "Швеппс" лимон', price: 3.19 },
    { name: 'Напиток безалкогольный "Фанта" апельсин', price: 4.69 },
    { name: 'Напиток пивной "Garage Black Cherry"', price: 11.56 },
    { name: 'Водка "Туманы" 40%', price: 25.22 },
    { name: 'Напиток "Спрайт"', price: 14.07 },
    { name: 'Карамель леденцовая "Halls" мёд-лимон', price: 1.55 },
    { name: 'Вода питьевая "Дарида" негазированная', price: 3.59 },
  ];
  const categoryIds = items.map((item) =>
    resolveReceiptCategory(item, categories),
  );

  expect(categoryIds).toEqual([
    "groceries/milk",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/drinks",
    "groceries/pantry",
    "groceries/drinks",
  ]);
  for (const brand of ["Бонаква", "Коронет", "Швеппс", "Фанта", "Спрайт", "Аливария"]) {
    expect(resolveReceiptCategory({ name: brand, price: 1 }, categories)).toBe(
      "groceries/drinks",
    );
  }
  expect(inferReceiptCategory("Ивария").key).toBe("groceries");
  expect(resolveReceiptCategory({
    name: "Ивария",
    price: 1,
    categoryKey: "other-expense",
    categoryId: "other-expense",
  }, categories)).toBe("groceries/drinks");
  expect(resolveReceiptCategory({ name: "Halls", price: 1 }, categories)).toBe(
    "groceries/pantry",
  );
  const visibleItemsTotal = items.reduce((sum, item) => sum + item.price, 0);
  expect(
    allocateReceiptCategorySplits(items, categoryIds, visibleItemsTotal).map((split) => ({
      categoryId: split.categoryId,
      amount: split.amount,
    })),
  ).toEqual([
    { categoryId: "groceries/milk", amount: 2.19 },
    { categoryId: "groceries/drinks", amount: 77.77 },
    { categoryId: "groceries/pantry", amount: 1.55 },
  ]);
});
