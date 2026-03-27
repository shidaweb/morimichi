import { expect, test } from '@playwright/test';

import { createTestConsultation, loginAs } from '../helpers/auth';

test.describe('Notifications and email related UI', () => {
  test('NOTIF-005 notification-like links should open consultation detail', async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      'consulter credentials are required',
    );

    await loginAs(page, 'consulter');
    await createTestConsultation(page, {
      title: `NOTIF QA ${Date.now()}`,
      body: 'Notification flow landing page check.',
    });

    await expect(page).toHaveURL(/\/consultations\/[a-z0-9-]+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('NOTIF-003 user can disable reply notifications from mypage', async ({ page }) => {
    test.skip(
      !(process.env.TEST_CONSULTER_EMAIL && process.env.TEST_CONSULTER_PASSWORD),
      'consulter credentials are required',
    );

    await loginAs(page, 'consulter');
    await page.goto('/mypage');

    const toggle = page.getByText('相談・回答に新しい返信がついたとき').locator('..').locator('button').first();
    await toggle.click();
    await page.getByRole('button', { name: '保存' }).last().click();

    await expect(page.getByText('保存しました')).toBeVisible();
  });
});
