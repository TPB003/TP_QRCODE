import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  test(`首页在 ${viewport.width}x${viewport.height} 无页面级溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
}

