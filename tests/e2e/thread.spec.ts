import { expect, test } from "@playwright/test";

import { createTestConsultation, loginAs } from "../helpers/auth";

test.describe("Thread display and replies", () => {
  test("THR-001 detail page renders title/body sections", async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      "consulter credentials are required",
    );

    await loginAs(page, "consulter");
    await createTestConsultation(page, {
      title: `THR QA ${Date.now()}`,
      body: "スレッド表示確認用の本文です。",
    });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "回答" })).toBeVisible();
    await expect(page.getByText("スレッド表示確認用の本文です。")).toBeVisible();
  });

  test("THR-010 unauthenticated users can read but are prompted to login for reply", async ({ page }) => {
    await page.goto("/consultations");
    const first = page.locator('a[href^="/consultations/"]').first();
    await first.click();
    await page.waitForURL(/\/consultations\/[a-z0-9-]+/);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("ログイン", { exact: false })).toBeVisible();
  });

  test("THR-004 depth=2 reply cannot open further nested reply form", async ({
    page,
    browser,
  }) => {
    test.skip(
      !(
        process.env.TEST_CONSULTER_EMAIL &&
        process.env.TEST_CONSULTER_PASSWORD &&
        process.env.TEST_ADVISOR_EMAIL &&
        process.env.TEST_ADVISOR_PASSWORD
      ),
      "consulter and advisor credentials are required",
    );

    // 相談作成（consulter）
    await loginAs(page, "consulter");
    await createTestConsultation(page, {
      title: `THR depth test ${Date.now()}`,
      body: "depthテスト用の相談です。",
    });
    const detailUrl = page.url();

    // advisor でトップレベル返信 + 深い返信
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await loginAs(p2, "advisor");
    await p2.goto(detailUrl);

    await p2.getByText("個人的な経験・見解としてお伝えします").click();
    await p2.getByPlaceholder("経験や気づきを丁寧に書いてください").fill("トップ回答");
    await p2.getByRole("button", { name: "回答する" }).click();
    await expect(p2.getByText("トップ回答")).toBeVisible();

    await p2.getByRole("button", { name: "この回答に返信" }).first().click();
    await p2.getByPlaceholder("返信を入力してください").fill("深い返信");
    await p2.getByRole("button", { name: "返信する" }).click();
    await expect(p2.getByText("深い返信")).toBeVisible();

    // 深い返信（depth=2）では「この回答に返信」ボタンが増えない
    await expect(p2.getByRole("button", { name: "この回答に返信" })).toHaveCount(1);
    await ctx.close();
  });

  test("THR-006 empty reply is rejected by validation", async ({ page }) => {
    test.skip(
      !(process.env.TEST_ADVISOR_EMAIL && process.env.TEST_ADVISOR_PASSWORD),
      "advisor credentials are required",
    );

    await loginAs(page, "advisor");
    await page.goto("/consultations");
    await page.locator('a[href^="/consultations/"]').first().click();
    await page.waitForURL(/\/consultations\/[a-z0-9-]+/);

    await page.getByText("個人的な経験・見解としてお伝えします").click();
    await page.getByRole("button", { name: "回答する" }).click();
    await expect(page.getByText("本文を入力してください")).toBeVisible();
  });
});
