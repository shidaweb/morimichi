import { expect, test } from "@playwright/test";

test.describe("Global transition guard", () => {
  test("CSS-001 html must not have transition: all", async ({ page }) => {
    await page.goto("/");

    const transition = await page.evaluate(() =>
      getComputedStyle(document.documentElement).transition,
    );

    expect(transition).not.toContain("all");
  });

  test("CSS-003 button/link transition only local", async ({ page }) => {
    await page.goto("/");

    const htmlTransition = await page.evaluate(() =>
      getComputedStyle(document.documentElement).transition,
    );
    const ctaTransition = await page
      .getByRole("link", { name: "相談してみる" })
      .evaluate((el) => getComputedStyle(el as HTMLElement).transition);

    expect(htmlTransition).not.toContain("all");
    expect(ctaTransition).toContain("color");
  });
});
