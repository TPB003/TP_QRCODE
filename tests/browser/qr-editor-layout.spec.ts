import { expect, test, type Page } from "@playwright/test";

type Envelope<T = Record<string, unknown>> = { data?: T; error?: { code?: string; message?: string } };

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

test.describe("QR editor workbench layout", () => {
  test("keeps the publish proof visible and lets draft preview close safely", async ({ page }, testInfo) => {
    if (testInfo.project.name === "chromium") await page.setViewportSize({ width: 1440, height: 900 });
    await authenticate(page, `qr-layout-${Date.now()}-${testInfo.project.name}@active.tpqr.test`);
    const created = await page.request.post("/api/codes", {
      data: { title: "布局验收", content: { type: "text", title: "预览标题", text: "预览内容" } },
    });
    expect(created.status()).toBe(201);
    const code = (await json<{ id: string }>(created)).data;
    if (!code) throw new Error("code creation failed");

    await page.goto(`/app/codes/${code.id}/qr`);
    await expect(page.locator(".tp-qr-preview")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".tp-style-panel")).toBeVisible();
    await expect(page.locator(".tp-publish-panel")).toBeVisible();
    await expect(page.locator(".tp-qr-editor__stage-tabs")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "发布", exact: true })).toBeVisible();

    const viewport = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
    if (testInfo.project.name === "chromium") expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.height + 2);

    await page.getByRole("button", { name: "预览", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "草稿预览" })).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭预览" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "草稿预览" })).toHaveCount(0);

    await page.getByRole("button", { name: "预览", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "草稿预览" })).toBeVisible();
    await page.locator(".tp-preview-modal").click({ position: { x: 4, y: 4 } });
    await expect(page.getByRole("dialog", { name: "草稿预览" })).toHaveCount(0);
  });

  test("keeps the mobile action bar usable at 375px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile viewport coverage");
    await page.setViewportSize({ width: 375, height: 812 });
    await authenticate(page, `qr-layout-375-${Date.now()}@active.tpqr.test`);
    const created = await page.request.post("/api/codes", {
      data: { title: "移动布局验收", content: { type: "text", title: "预览标题", text: "预览内容" } },
    });
    expect(created.status()).toBe(201);
    const code = (await json<{ id: string }>(created)).data;
    if (!code) throw new Error("code creation failed");

    await page.goto(`/app/codes/${code.id}/qr`);
    await expect(page.locator(".tp-qr-preview")).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".tp-publish-panel__actions")).toBeVisible();
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
  });
});
