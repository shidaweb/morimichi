import { expect, test } from "@playwright/test";

test.describe("Modal and popover controls", () => {
  test("MOD-001 report dialog closes with ESC", async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      "consulter credentials are required",
    );

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(process.env.TEST_CONSULTER_EMAIL!);
    await page.getByLabel("パスワード").fill(process.env.TEST_CONSULTER_PASSWORD!);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForURL("/");

    await page.goto("/consultations");
    await page.locator('a[href^="/consultations/"]').first().click();
    await page.waitForURL(/\/consultations\/[a-z0-9-]+/);

    await page.getByRole("button", { name: "通報" }).first().click();
    await expect(page.getByRole("heading", { name: "通報する" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "通報する" })).toHaveCount(0);
  });

  test("MOD-009 concern popover closes on outside click", async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      "consulter credentials are required",
    );

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(process.env.TEST_CONSULTER_EMAIL!);
    await page.getByLabel("パスワード").fill(process.env.TEST_CONSULTER_PASSWORD!);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForURL("/");

    await page.goto("/consultations/new");
    await page.getByRole("tab", { name: /資金繰り/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    const trigger = page.getByText("困りごとを選ぶ（複数可）").first();
    await trigger.click();
    await expect(page.getByText("Step 2 — 困りごと（複数選択）")).toBeVisible();

    await page.mouse.click(5, 5);
    await expect(page.locator("[role='dialog']")).toHaveCount(0);
  });

  test("MOD-002 report dialog closes on overlay click", async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      "consulter credentials are required",
    );

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(process.env.TEST_CONSULTER_EMAIL!);
    await page.getByLabel("パスワード").fill(process.env.TEST_CONSULTER_PASSWORD!);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForURL("/");

    await page.goto("/consultations");
    await page.locator('a[href^="/consultations/"]').first().click();
    await page.waitForURL(/\/consultations\/[a-z0-9-]+/);

    await page.getByRole("button", { name: "通報" }).first().click();
    await expect(page.getByRole("heading", { name: "通報する" })).toBeVisible();
    await page.locator('[data-slot="dialog-overlay"]').click();
    await expect(page.getByRole("heading", { name: "通報する" })).toHaveCount(0);
  });

  test("MOD-006/MOD-007 report dialog can reopen and cancel closes", async ({
    page,
  }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      "consulter credentials are required",
    );

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(process.env.TEST_CONSULTER_EMAIL!);
    await page.getByLabel("パスワード").fill(process.env.TEST_CONSULTER_PASSWORD!);
    await page.getByRole("button", { name: "ログイン" }).click();
    await page.waitForURL("/");

    await page.goto("/consultations");
    await page.locator('a[href^="/consultations/"]').first().click();
    await page.waitForURL(/\/consultations\/[a-z0-9-]+/);

    const report = page.getByRole("button", { name: "通報" }).first();
    await report.click();
    await expect(page.getByRole("heading", { name: "通報する" })).toBeVisible();
    await page.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("heading", { name: "通報する" })).toHaveCount(0);

    await report.click();
    await expect(page.getByRole("heading", { name: "通報する" })).toBeVisible();
  });
});
