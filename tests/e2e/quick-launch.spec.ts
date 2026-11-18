import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { DEFAULT_PREFERENCES } from "@/utils/preferences";
import { translations } from "@/store/translations";
import { QUICK_LAUNCH_ACTIONS, quickLaunchAction, quickLaunchAuthUrl, quickLaunchUrl } from "@/utils/quick-launch";

const databaseUrl = process.env.E2E_DATABASE_URL ?? "postgres://lumium:lumium@127.0.0.1:55432/lumium";
const password = "QuickLaunchCheck123!";
async function account(page: Page, db: Client, suffix: "draft" | "auth") {
  const email = `quick-launch-${suffix}-${Date.now()}@example.test`;
  const response = await page.request.post("/api/auth/sign-up/email", { headers: { "x-real-ip": suffix === "draft" ? "192.0.2.71" : "192.0.2.72" }, data: { name: "Quick launch", email, password } });
  expect(response.ok()).toBe(true);
  const id: string = (await response.json()).user.id;
  await db.query("insert into user_preferences(user_id,data) values($1,$2)", [id, JSON.stringify({ ...DEFAULT_PREFERENCES, language: "en" })]);
  await page.addInitScript(() => {
    if (!localStorage.getItem("lumium_prefs")) localStorage.setItem("lumium_prefs", JSON.stringify({ state: { currency: "BYN", language: "en" }, version: 0 }));
  });
  return { id, email };
}

test("launch actions are allowlisted and never form an external redirect", () => {
  for (const action of QUICK_LAUNCH_ACTIONS) {
    expect(quickLaunchAction(action)).toBe(action);
    expect(quickLaunchUrl(action)).toBe(`/dashboard?launch=${action}`);
    expect(quickLaunchAuthUrl("login", action)).toBe(`/login?launch=${action}`);
  }
  for (const action of [null, undefined, [], ["scan"], "delete", "https://example.com", "//example.com", "scan&redirect=evil"]) {
    expect(quickLaunchAction(action)).toBeNull();
  }
  expect(quickLaunchUrl(null)).toBe("/dashboard");
});

test("installed app exposes three distinct shortcut icons and keeps its original identity", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest"); expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.start_url).toBe("/dashboard");
  expect(manifest.id).toBeUndefined();
  expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual(QUICK_LAUNCH_ACTIONS.map(quickLaunchUrl));
  for (const shortcut of manifest.shortcuts) {
    const image = await request.get(shortcut.icons[0].src); expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toContain("image/png");
    const bytes = await image.body();
    expect(bytes.readUInt32BE(16)).toBe(96); expect(bytes.readUInt32BE(20)).toBe(96);
  }
});

test("manual shortcut resumes the draft once and quick actions do not create transactions on launch", async ({ page }) => {
  const db = new Client({ connectionString: databaseUrl }); await db.connect();
  let id: string | undefined;
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  try {
    const user = await account(page, db, "draft"); id = user.id;
    await page.goto("/dashboard/settings");
    await page.waitForFunction((userId) => JSON.parse(localStorage.getItem("lumium_offline_account") ?? "null")?.userId === userId, id);
    await page.evaluate(() => window.dispatchEvent(new Event("lumium:open-add-transaction")));
    let dialog = page.getByRole("dialog", { name: translations.en.newTransaction, exact: true });
    await dialog.getByRole("textbox", { name: translations.en.description, exact: true }).fill("Draft from launcher");
    await dialog.getByRole("spinbutton", { name: translations.en.amount, exact: true }).fill("12.34");
    await dialog.getByRole("button", { name: translations.en.close, exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.goto("/dashboard?launch=add&month=2026-10");
    dialog = page.getByRole("dialog", { name: translations.en.newTransaction, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: translations.en.description, exact: true })).toHaveValue("Draft from launcher");
    await expect(dialog.getByRole("spinbutton", { name: translations.en.amount, exact: true })).toHaveValue("12.34");
    await expect(page).toHaveURL(/\/dashboard\?month=2026-10$/);
    await expect(page.locator(".tour-dialog")).toHaveCount(0);
    await dialog.getByRole("button", { name: translations.en.saveChanges, exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.reload(); await expect(dialog).toBeHidden();
    expect((await db.query("select count(*)::int as n from transactions where user_id=$1", [id])).rows[0].n).toBe(1);
    await page.goto("/dashboard?launch=quick");
    await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.tour)).toBe("quick-actions");
    await expect(page).toHaveURL(/\/dashboard$/);
    expect((await db.query("select count(*)::int as n from transactions where user_id=$1", [id])).rows[0].n).toBe(1);
    await page.goto("/dashboard/settings");
    await page.getByRole("link", { name: translations.en.shortcutAdd, exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await dialog.getByRole("button", { name: translations.en.close, exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await page.goto("about:blank"); if (id) await db.query('delete from "user" where id=$1', [id]); await db.end(); }
});

test("scanner shortcut survives expired authentication and handles denied camera permission", async ({ page, context }) => {
  const db = new Client({ connectionString: databaseUrl }); await db.connect();
  let id: string | undefined;
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  try {
    const user = await account(page, db, "auth"); id = user.id;
    await context.clearCookies();
    await context.addCookies([{ name: "better-auth.session_token", value: "expired.quick-launch", url: "http://127.0.0.1:3100" }]);
    await page.addInitScript(() => Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } } }));
    await page.goto("/dashboard?launch=scan");
    await expect(page).toHaveURL(/\/login\?launch=scan$/);
    await expect(page.getByRole("link", { name: translations.en.signUp, exact: true })).toHaveAttribute("href", "/register?launch=scan");
    await page.getByRole("link", { name: translations.en.signUp, exact: true }).click();
    await expect(page.getByRole("link", { name: translations.en.signIn, exact: true })).toHaveAttribute("href", "/login?launch=scan");
    await page.getByRole("link", { name: translations.en.signIn, exact: true }).click();
    await page.getByRole("textbox", { name: translations.en.email, exact: true }).fill(user.email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: translations.en.signIn, exact: true }).click();
    const scanner = page.getByRole("dialog", { name: translations.en.scanReceipt, exact: true });
    await expect(scanner).toBeVisible();
    await expect(scanner.getByText(translations.en.cameraUnavailable, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator(".tour-dialog")).toHaveCount(0);
    await page.setViewportSize({ width: 1365, height: 900 }); await expect(scanner).toBeVisible();
    await page.keyboard.press("Escape"); await expect(scanner).toBeHidden();
    await page.goto("/dashboard/settings");
    await page.setViewportSize({ width: 393, height: 851 });
    await expect(page.locator("[data-dashboard-loading]")).toBeHidden();
    await page.locator('section[aria-labelledby="android-shortcuts-title"]').screenshot({ path: ".local/android-shortcuts-settings.png" });
    expect((await db.query("select count(*)::int as n from transactions where user_id=$1", [id])).rows[0].n).toBe(0);
    expect(errors).toEqual([]);
  } finally { await page.goto("about:blank"); if (id) await db.query('delete from "user" where id=$1', [id]); await db.end(); }
});
