import { expect, test, type Page, type Route } from "@playwright/test";

type Envelope<T = Record<string, unknown>> = { data?: T };

async function json<T>(response: { json(): Promise<unknown> }): Promise<Envelope<T>> {
  return (await response.json()) as Envelope<T>;
}

async function authenticate(page: Page, email: string) {
  const request = await page.request.post("/api/auth/request-code", { data: { email } });
  expect(request.status()).toBe(200);
  const requestBody = await json<{ testCode?: string }>(request);
  const verify = await page.request.post("/api/auth/verify-code", { data: { email, code: requestBody.data?.testCode ?? "123456" } });
  expect(verify.status()).toBe(200);
}

async function openCreateDialog(page: Page) {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /ACTIVE/ })).toBeVisible();
  await page.getByRole("button", { name: "新建活码" }).click();
  await expect(page.getByRole("dialog", { name: "新建活码" })).toBeVisible();
  await expect(page.getByLabel("活码名称")).toBeFocused();
}

test.describe("新建活码对话框", () => {
  test("循环焦点，并用 Esc 或遮罩关闭后回到新建按钮", async ({ page }, testInfo) => {
    await authenticate(page, `create-dialog-focus-${Date.now()}-${testInfo.project.name}@active.tpqr.test`);
    await openCreateDialog(page);

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "创建并编辑" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("活码名称")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "新建活码" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "新建活码" })).toBeFocused();

    await page.getByRole("button", { name: "新建活码" }).click();
    await expect(page.getByLabel("活码名称")).toBeFocused();
    await page.getByRole("button", { name: "关闭新建活码" }).click({ position: { x: 8, y: 8 } });
    await expect(page.getByRole("dialog", { name: "新建活码" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "新建活码" })).toBeFocused();
  });

  test("创建请求未完成时不能重复提交或关闭", async ({ page }, testInfo) => {
    await authenticate(page, `create-dialog-pending-${Date.now()}-${testInfo.project.name}@active.tpqr.test`);
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: /ACTIVE/ })).toBeVisible();

    let posts = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const handleRoute = async (route: Route) => {
      if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/api/codes") {
        posts += 1;
        await gate;
      }
      await route.continue();
    };
    await page.route("**/api/codes", handleRoute);

    try {
      await page.getByRole("button", { name: "新建活码" }).click();
      await page.getByLabel("活码名称").fill("延迟创建");
      await page.getByRole("button", { name: "创建并编辑" }).click();
      await expect(page.getByRole("button", { name: "创建中…" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "取消" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "关闭新建活码" })).toBeDisabled();
      await expect(page.getByRole("dialog", { name: "新建活码" })).toHaveAttribute("aria-busy", "true");

      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "创建中…" }).click({ force: true });
      await page.waitForTimeout(250);
      expect(posts).toBe(1);
      await expect(page.getByRole("dialog", { name: "新建活码" })).toBeVisible();

      release();
      await expect(page).toHaveURL(/\/app\/codes\/[0-9a-f-]+\/qr(?:\?type=[a-z]+)?$/);
      expect(posts).toBe(1);
    } finally {
      release();
      await page.unroute("**/api/codes", handleRoute);
    }
  });
});
