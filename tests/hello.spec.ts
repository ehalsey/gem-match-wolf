import { test, expect } from '@playwright/test';

test('hello world!', async ({ page }) => {
    // use baseURL from playwright config (webServer will serve project root)
    await page.goto('/');
    const title = await page.title();
    // the app sets the title to "Bejeweled"
    expect(title).toBe('Bejeweled');
});