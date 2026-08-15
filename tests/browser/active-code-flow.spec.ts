import { expect, test, type Page } from "@playwright/test";

type Api<T = Record<string, unknown>> = { data?: T; error?: { code?: string } };
async function apiJson<T = Record<string, unknown>>(response: { json(): Promise<unknown> }): Promise<Api<T>> { const value: unknown = await response.json(); return value as Api<T>; }

async function authenticate(page: Page, email: string) {
  const request = await page.request.post("/api/auth/request-code", { data: { email } });
  expect(request.ok()).toBeTruthy();
  const requested = await apiJson<{ testCode?: string }>(request);
  const verify = await page.request.post("/api/auth/verify-code", { data: { email, code: requested.data?.testCode ?? "123456" } });
  expect(verify.ok()).toBeTruthy();
}

test.describe("active QR public flow", () => {
  test("creates and publishes text content through the API, then renders the public page", async ({ page }, testInfo) => {
    const email = `browser-active-${testInfo.project.name}-${testInfo.workerIndex}@active.tpqr.test`;
    await authenticate(page, email);
    const createdResponse = await page.request.post("/api/codes", { data: { title: "Browser active text", content: { type: "text", title: "浏览器验收", text: "七类活码公共内容" } } });
    expect(createdResponse.status()).toBe(201);
    const created = await apiJson<{ id: string; slug: string; revision: number }>(createdResponse);
    const code = created.data as { id: string; slug: string; revision: number };
    const publish = await page.request.post(`/api/codes/${code.id}/publish`, { data: { revision: code.revision } });
    expect(publish.status()).toBe(200);

    const publicApi = await page.request.get(`/api/public/${code.slug}`);
    expect(publicApi.status()).toBe(200);
    expect((await apiJson<{ code: { content: { type: string } } }>(publicApi)).data?.code.content.type).toBe("text");
    await page.goto(`/s/${code.slug}`);
    await expect(page.locator(".public-content-card")).toBeVisible();
    await expect(page.locator("h1", { hasText: "浏览器验收" })).toBeVisible();
    await expect(page.getByText("七类活码公共内容")).toBeVisible();
  });

  test("renders a published URL with safe-opening affordance on mobile", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const email = `browser-url-${testInfo.project.name}-${testInfo.workerIndex}@active.tpqr.test`;
    await authenticate(page, email);
    const createdResponse = await page.request.post("/api/codes", { data: { title: "Mobile URL", content: { type: "url", title: "安全网址", url: "https://example.com/docs", description: "来源网站" } } });
    expect(createdResponse.status()).toBe(201);
    const code = (await apiJson<{ id: string; slug: string; revision: number }>(createdResponse)).data as { id: string; slug: string; revision: number };
    expect((await page.request.post(`/api/codes/${code.id}/publish`, { data: { revision: code.revision } })).status()).toBe(200);
    await page.goto(`/s/${code.slug}`);
    await expect(page.getByRole("heading", { name: "安全网址" })).toBeVisible();
    const link = page.getByRole("link", { name: "安全打开" });
    await expect(link).toHaveAttribute("href", "https://example.com/docs");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("keeps inactive or unknown slugs out of the public page", async ({ page }, testInfo) => {
    const email = `browser-state-${testInfo.project.name}-${testInfo.workerIndex}@active.tpqr.test`;
    await authenticate(page, email);
    const createdResponse = await page.request.post("/api/codes", { data: { title: "Unpublished", content: { type: "text", title: "未发布", text: "draft" } } });
    expect(createdResponse.status()).toBe(201);
    const code = (await apiJson<{ slug: string }>(createdResponse)).data as { slug: string };
    expect((await page.request.get(`/api/public/${code.slug}`)).status()).toBe(404);
    expect((await page.request.get("/api/public/UNKNOWNACTIVE0")).status()).toBe(404);
    await page.goto(`/s/${code.slug}`);
    await expect(page.getByRole("heading", { name: /页面暂不可用|活码/ })).toBeVisible();
  });
});
