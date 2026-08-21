import { expect, test, type Page } from "@playwright/test";

type Envelope<T> = { data?: T };

async function json<T>(response: { json(): Promise<unknown> }): Promise<Envelope<T>> {
  return (await response.json()) as Envelope<T>;
}

async function authenticate(page: Page, email: string) {
  const requested = await page.request.post("/api/auth/request-code", { data: { email } });
  expect(requested.status()).toBe(200);
  const body = await json<{ testCode?: string }>(requested);
  const verified = await page.request.post("/api/auth/verify-code", { data: { email, code: body.data?.testCode ?? "123456" } });
  expect(verified.status()).toBe(200);
}

test("mobile drawer exposes account actions and content types stays in the app", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "This is a mobile navigation regression.");
  await authenticate(page, `mobile-account-${Date.now()}@active.tpqr.test`);
  await page.goto("/app");

  await page.getByRole("button", { name: "打开工作台导航" }).click();
  const accountCard = page.locator(".shell-account-card");
  await expect(accountCard).toBeVisible();
  await expect(accountCard.getByText("个人账号", { exact: true })).toBeVisible();
  await expect(accountCard.getByRole("button", { name: "退出登录" })).toBeVisible();

  await page.getByRole("link", { name: "内容类型" }).click();
  await expect(page).toHaveURL(/\/app\?view=types$/);
  await expect(page.getByRole("heading", { name: /CONTENT\s*TYPES/ })).toBeVisible();
  await expect(page.getByRole("article", { name: "内容类型" })).toBeVisible();

  await page.goto("/app");
  await page.getByRole("button", { name: "打开工作台导航" }).click();
  await page.locator(".shell-account-card").getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
