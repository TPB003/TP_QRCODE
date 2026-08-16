import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Envelope<T> = { data?: T; error?: { code?: string; message?: string } };
type Code = { id: string; slug: string; revision: number; content: { type: string }; publishedVersionId?: string | null };

async function json<T>(response: { json(): Promise<unknown> }): Promise<Envelope<T>> {
  const value: unknown = await response.json();
  return value as Envelope<T>;
}

async function authenticate(page: Page, email: string) {
  const requested = await page.request.post("/api/auth/request-code", { data: { email } });
  expect(requested.status()).toBe(200);
  const requestedBody = await json<{ testCode?: string }>(requested);
  const verified = await page.request.post("/api/auth/verify-code", { data: { email, code: requestedBody.data?.testCode ?? "123456" } });
  expect(verified.status()).toBe(200);
}

async function authenticateThroughUi(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("邮箱地址").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect(page.getByText(/本地测试验证码/)).toBeVisible();
  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test.describe("TP QR 本地核心流程", () => {
  test("未登录跳转、邮箱验证码登录和登录态复用", async ({ page }, testInfo) => {
    await page.context().clearCookies();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?next=/);
    await authenticateThroughUi(page, `guard-${Date.now()}-${testInfo.project.name}-${testInfo.workerIndex}@active.tpqr.test`);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: /ACTIVE/ })).toBeVisible();
  });

  test("工作台创建文字活码、保存草稿、发布、下载真实二维码并打开公共页", async ({ page }, testInfo) => {
    await authenticateThroughUi(page, `editor-${Date.now()}-${testInfo.project.name}-${testInfo.workerIndex}@active.tpqr.test`);
    await page.getByRole("button", { name: "新建活码" }).click();
    await page.getByLabel("活码名称").fill("浏览器文字验收");
    await page.getByLabel("内容类型").selectOption("text");
    await page.getByRole("button", { name: "创建并编辑" }).click();
    await expect(page).toHaveURL(/\/app\/codes\/[0-9a-f-]+\/qr$/);
    expect(await page.locator(".tp-content-editor").evaluate((element) => getComputedStyle(element).display)).toBe("grid");
    expect(await page.locator(".tp-content-types [role=tab]").count()).toBe(7);

    await page.getByLabel("正文").fill("桌面与移动端均可访问的公共文字内容");
    await page.getByRole("button", { name: "保存草稿" }).click();
    await expect(page.getByText("草稿已保存", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "发布" }).click();
    await expect(page.getByText("已发布，新版本立即生效", { exact: true })).toBeVisible();

    if (testInfo.project.name === "mobile") {
      await page.evaluate(() => {
        Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
        Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.resolve() });
      });
      await page.getByRole("button", { name: /下载/ }).click();
      await expect(page.getByRole("status")).toContainText("已打开系统分享", { timeout: 15000 });
    } else {
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: /下载/ }).click();
      const downloaded = await download;
      expect(downloaded.suggestedFilename()).toMatch(/\.png$/);
      const downloadedPath = await downloaded.path();
      if (!downloadedPath) throw new Error("二维码下载没有产生本地文件");
      expect((await fs.stat(downloadedPath)).size).toBeGreaterThan(100);
    }

    const codeId = page.url().split("/app/codes/")[1].split("/")[0];
    const codeResponse = await page.request.get(`/api/codes/${codeId}`);
    const code = (await json<Code>(codeResponse)).data;
    expect(code?.publishedVersionId).toBeTruthy();
    await page.goto(`/s/${code?.slug}`);
    await expect(page.locator(".public-content-card > .public-content-card__title h1")).toHaveText("浏览器文字验收");
    await expect(page.getByText("桌面与移动端均可访问的公共文字内容")).toBeVisible();

    await page.goto(`/app/codes/${codeId}/analytics`);
    await expect(page.getByRole("heading", { name: "浏览器文字验收" })).toBeVisible();
    await expect(page.getByText("最近 30 天扫码趋势")).toBeVisible();
    await page.goto(`/app/codes/${codeId}/versions`);
    await expect(page.getByText("V1", { exact: true })).toBeVisible();
    await page.goto(`/app/codes/${codeId}/settings`);
    await page.getByLabel("活码名称").fill("浏览器文字验收（已设置）");
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByRole("status")).toContainText("设置已保存");
  });

  test("图片活码上传、发布和公共资源代理", async ({ page }, testInfo) => {
    await authenticate(page, `media-${Date.now()}-${testInfo.project.name}-${testInfo.workerIndex}@active.tpqr.test`);
    const created = await page.request.post("/api/codes", { data: { title: "图片资源验收", content: { type: "text", title: "等待上传", text: "请上传图片" } } });
    expect(created.status()).toBe(201);
    const code = (await json<Code>(created)).data;
    if (!code) throw new Error("创建图片活码失败");
    await page.goto(`/app/codes/${code.id}/qr?type=image`);
    await expect(page.getByRole("tab", { name: "图片" })).toBeVisible({ timeout: 20000 });
    const fixture = path.join(process.cwd(), "tmp", "fixtures", "sample-image.png");
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles(fixture);
    await expect(page.getByText("资源已上传，请保存草稿", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "保存草稿" }).click();
    await expect(page.getByText("草稿已保存", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "发布" }).click();
    await expect(page.getByText("已发布，新版本立即生效", { exact: true })).toBeVisible();

    const updated = (await json<Code>(await page.request.get(`/api/codes/${code.id}`))).data;
    const publicResponse = await page.request.get(`/api/public/${updated?.slug}`);
    expect(publicResponse.status()).toBe(200);
    const publicBody = await json<{ code: { content: { type: string; assetId: string } } }>(publicResponse);
    expect(publicBody.data?.code.content.type).toBe("image");
    const assetResponse = await page.request.get(`/api/public/${updated?.slug}/assets/${publicBody.data?.code.content.assetId}`);
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()["content-type"]).toContain("image/png");
    await page.goto(`/s/${updated?.slug}`);
    await expect(page).toHaveTitle("TPQRCODE");
    await expect(page.locator(".public-content-page--image")).toBeVisible();
    await expect(page.locator(".public-content-card__toolbar")).toHaveCount(0);
    await expect(page.locator(".public-content-card__title")).toHaveCount(0);
    await expect(page.locator(".public-content-card--image .public-image-only")).toHaveCount(1);
    expect(await page.locator(".public-content-card--image").locator("button, a, h1, h2, p, header, footer").count()).toBe(0);
    const imageBackground = await page.locator(".public-content-card--image").evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(imageBackground).toBe("rgb(255, 255, 255)");
    await expect(page.locator(".public-content-card--image img")).toBeVisible();
  });

  test("移动端菜单、公共页无横向溢出，未知 slug 显示错误状态", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/decoder");
    await page.getByRole("button", { name: "开启摄像头" }).click();
    await expect(page.getByRole("status")).toContainText(/摄像头|HTTPS|权限/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    await page.goto("/s/UNKNOWNQR00");
    // A cold local Worker can take a few seconds to finish the unknown-slug
    // response after navigation. Keep the assertion deterministic without
    // weakening the actual error-state requirement.
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});
