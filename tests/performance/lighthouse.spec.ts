import { expect, test } from '@playwright/test';

// Lightweight perf guard (Playwright-based) until Lighthouse CI is wired.
test.describe('Performance budget smoke checks', () => {
  test('PERF-001 home load should be under soft threshold', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const elapsed = Date.now() - start;

    // Soft threshold for CI instability; replace with Lighthouse in CI pipeline.
    expect(elapsed).toBeLessThan(5000);
  });

  test('PERF-004 consultations TTFB-ish response under soft threshold', async ({ request }) => {
    const t0 = Date.now();
    const res = await request.get('/consultations');
    const elapsed = Date.now() - t0;

    expect(res.ok()).toBeTruthy();
    expect(elapsed).toBeLessThan(5000);
  });
});
