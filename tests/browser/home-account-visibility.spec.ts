import { expect, test, type Page } from "@playwright/test";

async function authenticate(page: Page, email: string) {
  const request = await page.request.post("/api/auth/request-code", { data: { email } });
  expect(request.status()).toBe(200);
  const body = (await request.json()) as { data?: { testCode?: string } };
  const verify = await page.request.post("/api/auth/verify-code", { data: { email, code: body.data?.testCode ?? "123456" } });
  expect(verify.status()).toBe(200);
}

test("home header reflects the active account instead of showing login", async ({ page }, testInfo) => {
  const email = `home-account-${Date.now()}@active.tpqr.test`;
  await authenticate(page, email);
  await page.goto("/");

  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "打开导航菜单" }).click();
  }

  const accountLink = page.locator(".site-header__account-link");
  await expect(accountLink).toBeVisible({ timeout: 20_000 });
  await expect(accountLink).toHaveText(email);
  await expect(page.locator(".site-header__login")).toHaveCount(0);
  await expect(accountLink).toHaveAttribute("href", "/app");

  await page.locator(".site-header__logout").click();
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "打开导航菜单" }).click();
  await expect(page.locator(".site-header__login")).toBeVisible();
  await expect(accountLink).toHaveCount(0);
});
