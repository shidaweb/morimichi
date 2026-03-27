import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = ["/", "/consultations", "/support", "/login", "/register"];

test.describe("Accessibility", () => {
  for (const path of pages) {
    test(`A11Y-001 no critical/serious violations on ${path}`, async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      expect(blocking, `${path} has critical/serious axe violations`).toEqual([]);
    });
  }
});
