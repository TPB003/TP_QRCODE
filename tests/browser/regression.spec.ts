import fs from "node:fs/promises";
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

test.describe("second-pass product regressions", () => {
  test("the public text page has one title and reports copy success through the fallback path", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      try {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: { writeText: () => Promise.reject(new Error("clipboard permission denied")) },
        });
      } catch {
        // The browser may expose a non-configurable clipboard object; the test still checks visible feedback.
      }
      try {
        Object.defineProperty(document, "execCommand", { configurable: true, value: (command: string) => command === "copy" });
      } catch {
        // Use the native implementation when the browser does not allow replacement.
      }
    });
    await authenticate(page, `public-copy-${Date.now()}-${testInfo.project.name}@active.tpqr.test`);
    const created = await page.request.post("/api/codes", { data: { title: "标题只显示一次", content: { type: "text", title: "标题只显示一次", text: "可复制的正文" } } });
    expect(created.status()).toBe(201);
    const code = (await json<{ id: string; slug: string; revision: number }>(created)).data;
    if (!code) throw new Error("创建回归活码失败");
    const published = await page.request.post(`/api/codes/${code.id}/publish`, { data: { revision: code.revision } });
    expect(published.status()).toBe(200);

    await page.goto(`/s/${code.slug}`);
    await expect(page.locator(".public-content-card__title h1")).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator(".public-text h2")).toHaveCount(0);
    await page.getByRole("button", { name: "复制文字" }).click();
    await expect(page.getByText("已复制", { exact: true })).toBeVisible();
  });

  test("QR actions use a real desktop download or mobile share flow", async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === "mobile";
    if (mobile) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
        Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.resolve() });
      });
    }
    await authenticate(page, `qr-download-${Date.now()}-${testInfo.project.name}@active.tpqr.test`);
    const created = await page.request.post("/api/codes", { data: { title: "二维码下载回归", content: { type: "text", title: "二维码下载回归", text: "download" } } });
    expect(created.status()).toBe(201);
    const code = (await json<{ id: string }>(created)).data;
    if (!code) throw new Error("创建下载回归活码失败");
    await page.goto(`/app/codes/${code.id}/qr`);
    await expect(page.getByAltText("活码二维码预览")).toBeVisible({ timeout: 20000 });
    const action = page.getByRole("button", { name: mobile ? "分享 / 下载" : "下载", exact: true });
    await expect(action).toBeVisible();
    if (mobile) {
      await action.click();
      await expect(page.getByRole("status")).toContainText("已打开系统分享");
    } else {
      const downloadEvent = page.waitForEvent("download");
      await action.click();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toMatch(/\.png$/i);
      const downloadPath = await download.path();
      if (!downloadPath) throw new Error("二维码下载没有生成本地文件");
      expect((await fs.stat(downloadPath)).size).toBeGreaterThan(100);
    }
  });

  test("dashboard navigation exposes separate codes and analytics views", async ({ page }, testInfo) => {
    await authenticate(page, `dashboard-views-${Date.now()}-${testInfo.project.name}@active.tpqr.test`);
    await page.goto("/app");
    const mobile = testInfo.project.name === "mobile";
    if (mobile) await page.getByRole("button", { name: /打开工作台导航/ }).click();
    const analytics = page.getByRole("link", { name: "扫码统计" });
    await expect(analytics).toBeVisible();
    await analytics.click();
    await expect(page).toHaveURL(/\/app\?view=analytics$/);
    await expect(page.getByRole("heading", { name: /扫码统计|SCAN DATA/ })).toBeVisible({ timeout: 20000 });

    if (mobile) await page.getByRole("button", { name: /打开工作台导航/ }).click();
    const codes = page.getByRole("link", { name: "我的活码" });
    await expect(codes).toBeVisible();
    await codes.click();
    await expect(page).toHaveURL(/\/app\?view=codes$/);
    await expect(page.getByRole("heading", { name: /我的活码|MY CODES/ })).toBeVisible({ timeout: 20000 });
  });

  test("homepage no longer advertises retired inspection, batch, or fake QR examples", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("tab", { name: "图片" }).first()).toBeVisible({ timeout: 20000 });
    const text = await page.locator("body").innerText();
    for (const retired of ["巡检", "设备巡检", "批量导入", "提交记录", "提交数据", "QR-7F3A", "QR-20260810-A9F7"]) {
      expect(text, `homepage contains retired text: ${retired}`).not.toContain(retired);
    }
    for (const activeType of ["图片", "视频", "音频", "文件", "网址", "名片", "文字"]) {
      expect(text, `homepage is missing active type: ${activeType}`).toContain(activeType);
    }
  });

  test("public scan does not show a branded loading card while content is pending", async ({ page }) => {
    let releaseResponse!: () => void;
    const responsePending = new Promise<void>((resolve) => { releaseResponse = resolve; });
    await page.route("**/api/public/loading-screen-regression", async (route) => {
      await responsePending;
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND", message: "not found" } }),
      });
    });

    await page.goto("/s/loading-screen-regression");
    const loadingPage = page.locator(".public-content-page--loading");
    await expect(loadingPage).toBeVisible({ timeout: 20000 });
    await expect(loadingPage).toHaveText("");
    await expect(page.locator(".public-content-card")).toHaveCount(0);
    await expect(page.getByText("正在打开活码", { exact: false })).toHaveCount(0);

    releaseResponse();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 20000 });
    await page.unroute("**/api/public/loading-screen-regression");
  });
});
