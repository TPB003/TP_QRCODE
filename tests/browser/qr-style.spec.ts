import { expect, test, type Page } from "@playwright/test";

type Envelope<T = Record<string, unknown>> = { data?: T; error?: { code?: string; message?: string } };
async function json<T>(response: { json(): Promise<unknown> }): Promise<Envelope<T>> { return (await response.json()) as Envelope<T>; }

async function authenticate(page: Page, email: string) {
  const request = await page.request.post("/api/auth/request-code", { data: { email } });
  expect(request.status()).toBe(200);
  const requested = await json<{ testCode?: string }>(request);
  const verify = await page.request.post("/api/auth/verify-code", { data: { email, code: requested.data?.testCode ?? "123456" } });
  expect(verify.status()).toBe(200);
}

test.describe("QR visual style editor", () => {
  test("saves visual choices, frame text, dimensions and an uploaded center logo", async ({ page }, testInfo) => {
    await authenticate(page, `qr-style-${Date.now()}-${testInfo.project.name}@active.tpqr.test`);
    const created = await page.request.post("/api/codes", { data: { title: "Style regression", content: { type: "text", title: "Style", text: "Style preview" } } });
    expect(created.status()).toBe(201);
    const code = (await json<{ id: string; revision: number }>(created)).data;
    if (!code) throw new Error("code creation failed");

    await page.goto(`/app/codes/${code.id}/qr`);
    await expect(page.locator("#qr-style-panel")).toBeVisible({ timeout: 20000 });
    await page.locator(".tp-style-options--dots button").nth(2).click();
    await page.locator(".tp-style-options:not(.tp-style-options--dots) button").nth(1).click();
    await page.getByLabel("前景色 Hex").fill("#123456");
    await page.getByLabel("显示边框说明").check();
    await page.getByLabel("边框说明文字").fill("扫码打开内容");
    await page.getByLabel("二维码尺寸").fill("640");
    await page.getByLabel("安全边距").fill("24");

    const fixture = "tmp/fixtures/sample-image.png";
    await page.locator(".tp-style-panel input[type=file]").setInputFiles(fixture);
    await expect(page.getByText("中心 Logo 已上传，请保存样式", { exact: true })).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "保存草稿" }).click();
    await expect(page.getByText("草稿已保存", { exact: true })).toBeVisible({ timeout: 20000 });

    const updated = await json<{ revision: number; render: { dotStyle: string; cornerSquareStyle: string; foreground: string; frameText: string; showFrame: boolean; size: number; margin: number; logoAssetId: string | null; errorCorrectionLevel: string } }>(await page.request.get(`/api/codes/${code.id}`));
    expect(updated.data?.render.dotStyle).toBe("dots");
    expect(updated.data?.render.cornerSquareStyle).toBe("square");
    expect(updated.data?.render.foreground).toBe("#123456");
    expect(updated.data?.render.frameText).toBe("扫码打开内容");
    expect(updated.data?.render.showFrame).toBe(true);
    expect(updated.data?.render.size).toBe(640);
    expect(updated.data?.render.margin).toBe(24);
    expect(updated.data?.render.logoAssetId).toBeTruthy();
    expect(updated.data?.render.errorCorrectionLevel).toBe("H");
    await expect(page.getByLabel("边框说明预览")).toContainText("扫码打开内容");
  });
});
