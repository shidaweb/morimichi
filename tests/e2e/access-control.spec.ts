import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

test.describe("Access control", () => {
  test("ACL-001 unauthenticated can read consultations list", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/consultations");
    await expect(page.getByRole("heading", { name: "相談一覧" })).toBeVisible();
  });

  test("ACL-002 unauthenticated cannot open new consultation directly", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/consultations/new");
    await page.waitForURL(/\/login\?next=%2Fconsultations%2Fnew/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });

  test("ACL-003 consulter can open new consultation page", async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      "consulter credentials are required",
    );

    await loginAs(page, "consulter");
    await page.goto("/consultations/new");
    await expect(page.getByRole("heading", { name: "相談を投稿" })).toBeVisible();
  });

  test("ACL-004 advisor cannot create consultation", async ({ page }) => {
    test.skip(
      !(process.env.TEST_ADVISOR_EMAIL && process.env.TEST_ADVISOR_PASSWORD),
      "advisor credentials are required",
    );

    await loginAs(page, "advisor");
    await page.goto("/consultations/new");
    await expect(page.getByText("いまの登録では相談の投稿ができません")).toBeVisible();
  });

  test("ACL-005 advisor can post top-level reply section", async ({ page }) => {
    test.skip(
      !(process.env.TEST_ADVISOR_EMAIL && process.env.TEST_ADVISOR_PASSWORD),
      "advisor credentials are required",
    );

    await loginAs(page, "advisor");
    await page.goto("/consultations");
    await page.locator('a[href^="/consultations/"]').first().click();
    await page.waitForURL(/\/consultations\/[a-z0-9-]+/);

    await expect(page.getByRole("heading", { name: "回答を投稿" })).toBeVisible();
  });

  test("ACL-009 general user cannot access admin pages", async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      "consulter credentials are required",
    );

    await loginAs(page, "consulter");
    await page.goto("/admin/reports");
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { name: /経営のしんどさを/ })).toBeVisible();
  });

  test("ACL-008 admin can access admin moderation pages", async ({ page }) => {
    test.skip(
      !(process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD),
      "admin credentials are required",
    );

    await loginAs(page, "admin");
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: "通報一覧" })).toBeVisible();
  });
});
