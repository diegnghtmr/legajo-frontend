import { expect, test } from '@playwright/test';

test.describe('not-found route', () => {
  test('the recovery action names and goes to the similarity screen, in both languages', async ({
    page,
  }) => {
    await page.goto('/does-not-exist');

    const cta = page.getByRole('link', { name: 'Ir a Similitud' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/similarity');

    await cta.click();
    await expect(page).toHaveURL(/\/similarity$/);
    await expect(page.getByRole('heading', { name: 'Comparación de similitud' })).toBeVisible();
  });

  test('English: the recovery action reads "Go to Similarity"', async ({ page }) => {
    await page.goto('/does-not-exist');
    await page.getByRole('button', { name: 'English' }).click();

    const cta = page.getByRole('link', { name: 'Go to Similarity' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/similarity');
  });
});
