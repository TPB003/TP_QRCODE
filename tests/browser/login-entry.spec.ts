import { expect, test } from "@playwright/test";

test("login page hides Google entry while keeping GitHub available", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("button:has(.google-mark)")).toBeHidden();
  await expect(page.getByRole("button", { name: /GitHub/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);
});
