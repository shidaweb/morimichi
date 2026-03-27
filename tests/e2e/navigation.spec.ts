import { expect, test } from "@playwright/test";

test.describe("Navigation and loading", () => {
  test("NAV-001 top to consultations shows quickly without blank", async ({ page }) => {
    await page.goto("/");

    const start = Date.now();
    await page.getByRole("link", { name: "相談一覧" }).first().click();
    await page.waitForURL("/consultations");
    await expect(page.getByRole("heading", { name: "相談一覧" })).toBeVisible();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  test("NAV-002 detail route shows loading and then content", async ({ page }) => {
    await page.goto("/consultations");
    await page.locator('a[href^="/consultations/"]').first().click();
    await page.waitForURL(/\/consultations\/[a-z0-9-]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("NAV-005 unknown page returns not-found UI", async ({ page }) => {
    const response = await page.goto("/this-path-does-not-exist-qa");
    expect(response?.status()).toBe(404);
  });

  test("NAV-004 unauthenticated is redirected to login for new consultation", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/consultations/new");
    await page.waitForURL(/\/login\?next=%2Fconsultations%2Fnew/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });

  test("NAV-007 rapid repeated clicks should end in correct page", async ({
    page,
  }) => {
    await page.goto("/");

    const link = page.getByRole("link", { name: "相談一覧" }).first();
    await Promise.all([link.click(), link.click(), link.click()]);
    await page.waitForURL("/consultations");
    await expect(page.getByRole("heading", { name: "相談一覧" })).toBeVisible();
  });
});
