import type { Page } from "@playwright/test";

type AuthEnvKey =
  | "TEST_CONSULTER_EMAIL"
  | "TEST_CONSULTER_PASSWORD"
  | "TEST_ADVISOR_EMAIL"
  | "TEST_ADVISOR_PASSWORD"
  | "TEST_BOTH_EMAIL"
  | "TEST_BOTH_PASSWORD"
  | "TEST_ADMIN_EMAIL"
  | "TEST_ADMIN_PASSWORD";

function getEnv(name: AuthEnvKey) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function loginAs(
  page: Page,
  role: "consulter" | "advisor" | "both" | "admin",
) {
  const credentials = {
    consulter: {
      email: getEnv("TEST_CONSULTER_EMAIL"),
      password: getEnv("TEST_CONSULTER_PASSWORD"),
    },
    advisor: {
      email: getEnv("TEST_ADVISOR_EMAIL"),
      password: getEnv("TEST_ADVISOR_PASSWORD"),
    },
    both: {
      email: getEnv("TEST_BOTH_EMAIL"),
      password: getEnv("TEST_BOTH_PASSWORD"),
    },
    admin: {
      email: getEnv("TEST_ADMIN_EMAIL"),
      password: getEnv("TEST_ADMIN_PASSWORD"),
    },
  } as const;

  const { email, password } = credentials[role];

  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("/");
}

export async function createTestConsultation(
  page: Page,
  options?: { phase?: string; title?: string; body?: string },
) {
  await page.goto("/consultations/new");

  const phase = options?.phase || "資金繰り";
  await page.getByRole("tab", { name: phase }).click();
  await page.getByRole("button", { name: "次へ" }).click();

  const trigger = page.getByText("困りごとを選ぶ（複数可）").first();
  await trigger.click();
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: "次へ" }).click();

  await page.getByLabel("タイトル").fill(options?.title || "テスト相談タイトル");
  await page.getByRole("button", { name: "次へ" }).click();

  await page
    .getByLabel("本文")
    .fill(options?.body || "テスト相談の本文です。資金繰りについて悩んでいます。");
  await page.getByRole("button", { name: "次へ" }).click();

  await page.getByRole("button", { name: "この内容で投稿する" }).click();
  await page.waitForURL(/\/consultations\/[a-z0-9-]+/);
}
