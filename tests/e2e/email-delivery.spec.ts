import { test } from "@playwright/test";

/**
 * メール実送信は RESEND_API_KEY・テストアカウントに依存するため、
 * ここではスモーク用のプレースホルダのみ置く。
 * 結合検証は `pnpm test:integration:email` と Resend ダッシュボードで行ってください。
 */
test.describe("メール送信（E2E）", () => {
  test.skip(true, "ステージング＋テストユーザーで手動または今後モック化して有効化");
});
