import { expect, test } from "@playwright/test";

import { loginAs } from "../helpers/auth";

function hasConsulterCreds() {
  return !!(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD);
}

test.describe("Authentication flow", () => {
  test("AUTH-001/002/003 role selector options are available", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText("相談したい")).toBeVisible();
    await expect(page.getByText("回答したい")).toBeVisible();
    await expect(page.getByText("両方")).toBeVisible();
  });

  test("AUTH-004/005/006/007 register validation errors", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("ニックネーム（2〜20文字）").fill("a");
    await page.getByLabel("メールアドレス").fill("invalid-email");
    await page.getByLabel("パスワード（8文字以上）").fill("1234567");
    await page.getByRole("button", { name: "登録する" }).click();

    await expect(page.getByText("ニックネームは2文字以上にしてください")).toBeVisible();
    await expect(page.getByText("有効なメールアドレスを入力してください")).toBeVisible();
    await expect(page.getByText("パスワードは8文字以上にしてください")).toBeVisible();
    await expect(page.getByText("利用規約に同意してください")).toBeVisible();

    await page.getByLabel("ニックネーム（2〜20文字）").fill("a".repeat(21));
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page.getByText("ニックネームは20文字以内にしてください")).toBeVisible();
  });

  test("AUTH-013 terms agreement is required", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("ニックネーム（2〜20文字）").fill("テスト太郎");
    await page.getByLabel("メールアドレス").fill("qa-auth013@example.com");
    await page.getByLabel("パスワード（8文字以上）").fill("TestPass123!");
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page.getByText("利用規約に同意してください")).toBeVisible();
  });

  test("AUTH-008 registering with existing email shows error", async ({ page }) => {
    test.skip(!process.env.TEST_CONSULTER_EMAIL, "TEST_CONSULTER_EMAIL is required");

    await page.goto("/register");
    await page.getByLabel("ニックネーム（2〜20文字）").fill(`qa${Date.now()}`);
    await page.getByLabel("メールアドレス").fill(process.env.TEST_CONSULTER_EMAIL!);
    await page.getByLabel("パスワード（8文字以上）").fill("TestPass123!");
    await page.getByRole("checkbox").first().click();
    await page.getByRole("button", { name: "登録する" }).click();

    await expect(page.getByText("登録できませんでした")).toBeVisible();
  });

  test("AUTH-010 wrong password shows error and keeps input", async ({ page }) => {
    test.skip(!process.env.TEST_CONSULTER_EMAIL, "TEST_CONSULTER_EMAIL is required");

    await page.goto("/login");
    const email = process.env.TEST_CONSULTER_EMAIL!;
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill("WrongPassword123!");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page.getByText("メールアドレスまたはパスワードが正しくありません。"))
      .toBeVisible();
    await expect(page.getByLabel("メールアドレス")).toHaveValue(email);
  });

  test("AUTH-009/011 successful login and logout", async ({ page }) => {
    test.skip(!hasConsulterCreds(), "consulter credentials are required");

    await loginAs(page, "consulter");
    await expect(page.getByRole("link", { name: "マイページ" })).toBeVisible();

    await page.getByRole("button", { name: "ログアウト" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
  });

  test("AUTH-015 session persists after reload", async ({ page }) => {
    test.skip(!hasConsulterCreds(), "consulter credentials are required");

    await loginAs(page, "consulter");
    await page.reload();
    await expect(page.getByRole("link", { name: "マイページ" })).toBeVisible();
  });

  test("AUTH-012 forgot password sends success message", async ({ page }) => {
    test.skip(!process.env.TEST_CONSULTER_EMAIL, "TEST_CONSULTER_EMAIL is required");

    await page.goto("/forgot-password");
    await page.getByLabel("メールアドレス").fill(process.env.TEST_CONSULTER_EMAIL!);
    await page.getByRole("button", { name: "リンクを送る" }).click();
    await expect(page.getByText("メールを送信しました")).toBeVisible();
  });

  test("AUTH-014 unauthenticated protected route redirects to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/mypage");
    await page.waitForURL(/\/login\?next=%2Fmypage/);
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  });
});
