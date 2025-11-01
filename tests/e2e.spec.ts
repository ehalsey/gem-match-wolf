import { test, expect } from '@playwright/test';

test.describe('app smoke', () => {
  test('loads, has canvas and phaser', async ({ page }) => {
    await page.goto('/');

    // title check
    await expect(page).toHaveTitle(/Bejeweled/);

    // canvas element (Phaser renders to a canvas inside the .CanvasContainer)
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // ensure Phaser object is available on window
    const phaserPresent = await page.evaluate(() => !!(window as any).Phaser);
    expect(phaserPresent).toBeTruthy();
  });
});
