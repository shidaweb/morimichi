import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

test.describe("Form validation", () => {
  test("FORM-001 register required fields", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "登録する" }).click();

    await expect(page.getByText("有効なメールアドレスを入力してください")).toBeVisible();
    await expect(page.getByText("パスワードは8文字以上にしてください")).toBeVisible();
    await expect(page.getByText("ニックネームは2文字以上にしてください")).toBeVisible();
  });

  test("FORM-003 consultation title/body length limit in wizard", async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      "consulter credentials are required",
    );

    await loginAs(page, "consulter");
    await page.goto("/consultations/new");
    await page.getByRole("tab", { name: /資金繰り/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByText("困りごとを選ぶ（複数可）").first().click();
    await page.getByRole("checkbox").first().click();
    await page.getByRole("button", { name: "次へ" }).click();

    await page.getByLabel("タイトル").fill("a".repeat(101));
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page.getByText("タイトルを1〜100文字で入力してください")).toBeVisible();
  });

  test("FORM-006 server-side login error keeps typed email", async ({ page }) => {
    test.skip(!process.env.TEST_CONSULTER_EMAIL, "TEST_CONSULTER_EMAIL is required");

    const email = process.env.TEST_CONSULTER_EMAIL!;
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill("WrongPassword123!");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page.getByText("メールアドレスまたはパスワードが正しくありません。")).toBeVisible();
    await expect(page.getByLabel("メールアドレス")).toHaveValue(email);
  });
});
