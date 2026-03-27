import { expect, test } from "@playwright/test";

import { createTestConsultation, loginAs } from "../helpers/auth";

function has(role: "consulter" | "advisor") {
  if (role === "consulter") {
    return !!(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD);
  }
  return !!(process.env.TEST_ADVISOR_EMAIL && process.env.TEST_ADVISOR_PASSWORD);
}

test.describe("Consultation create flow", () => {
  test("POST-004 title required", async ({ page }) => {
    test.skip(!has("consulter"), "consulter credentials are required");

    await loginAs(page, "consulter");
    await page.goto("/consultations/new");

    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page.getByText("フェーズを選んでください")).toBeVisible();
  });

  test("POST-007 advisor cannot access consultation create", async ({ page }) => {
    test.skip(!has("advisor"), "advisor credentials are required");

    await loginAs(page, "advisor");
    await page.goto("/consultations/new");

    await expect(page.getByText("いまの登録では相談の投稿ができません")).toBeVisible();
  });

  test("POST-001/002 phase switch updates concern step", async ({ page }) => {
    test.skip(!has("consulter"), "consulter credentials are required");

    await loginAs(page, "consulter");
    await page.goto("/consultations/new");

    await page.getByRole("tab", { name: /資金繰り/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page.getByText("Step 2 — 困りごと（複数選択）")).toBeVisible();

    await page.getByRole("button", { name: "戻る" }).click();
    await page.getByRole("tab", { name: /税金/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page.getByText("Step 2 — 困りごと（複数選択）")).toBeVisible();
  });

  test("POST-003 successful submit redirects to detail", async ({ page }) => {
    test.skip(!has("consulter"), "consulter credentials are required");

    await loginAs(page, "consulter");
    await createTestConsultation(page, {
      title: `QA投稿 ${Date.now()}`,
      body: "QA E2E から投稿しています。",
    });

    await expect(page).toHaveURL(/\/consultations\/[a-z0-9-]+/);
    await expect(page.getByRole("link", { name: "一覧へ戻る" })).toBeVisible();
  });

  test("POST-005 body required at step 4", async ({ page }) => {
    test.skip(!has("consulter"), "consulter credentials are required");

    await loginAs(page, "consulter");
    await page.goto("/consultations/new");
    await page.getByRole("tab", { name: /資金繰り/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByText("困りごとを選ぶ（複数可）").first().click();
    await page.getByRole("checkbox").first().click();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByLabel("タイトル").fill("本文必須テスト");
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByRole("button", { name: "次へ" }).click();

    await expect(page.getByText("本文を1〜10,000文字で入力してください")).toBeVisible();
  });

  test("POST-008 selecting crisis concern shows crisis banner", async ({ page }) => {
    test.skip(!has("consulter"), "consulter credentials are required");

    await loginAs(page, "consulter");
    await page.goto("/consultations/new");
    await page.getByRole("tab", { name: /メンタル|その他|資金繰り|税金/ }).first().click();
    await page.getByRole("button", { name: "次へ" }).click();

    await page.getByText("困りごとを選ぶ（複数可）").first().click();
    const crisisOption = page.getByText("要配慮").first();
    const exists = (await crisisOption.count()) > 0;
    test.skip(!exists, "no crisis concern found in current seed");
    await crisisOption.click();

    await expect(
      page.getByText("いのちや身体の安全が心配な内容が含まれています"),
    ).toBeVisible();
  });

  test("POST-010 double submit does not break flow", async ({ page }) => {
    test.skip(!has("consulter"), "consulter credentials are required");

    await loginAs(page, "consulter");
    await page.goto("/consultations/new");
    await page.getByRole("tab", { name: /資金繰り/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByText("困りごとを選ぶ（複数可）").first().click();
    await page.getByRole("checkbox").first().click();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByLabel("タイトル").fill(`ダブル送信 ${Date.now()}`);
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByLabel("本文").fill("ダブル送信防止確認の本文です。");
    await page.getByRole("button", { name: "次へ" }).click();

    const submit = page.getByRole("button", { name: "この内容で投稿する" });
    await submit.dblclick();

    await expect(page).toHaveURL(/\/consultations\/[a-z0-9-]+/);
  });
});
