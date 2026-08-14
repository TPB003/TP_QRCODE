import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { expect, test } from "@playwright/test";

interface BrowserProjectResponse {
  data: { entities: Array<{ slug: string }> };
}

test.describe("TP QR 本地核心流程", () => {
  test("登录、创建、发布并提交公共表单", async ({ page }, testInfo) => {
    const email = `browser-${testInfo.project.name}@tpqr.local`;
    const consoleErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${message.text()} @ ${message.location().url}`); });
    page.on("response", (response) => { if (response.status() >= 400) consoleErrors.push(`HTTP ${response.status()} ${response.url()}`); });
    page.on("requestfailed", (request) => { consoleErrors.push(`FAILED ${request.url()} ${request.failure()?.errorText ?? "unknown"}`); });
    await page.goto("/login");
    await page.getByLabel("邮箱地址").fill(email);
    await page.getByRole("button", { name: /发送验证码/ }).click();
    await expect(page.getByText(/本地测试验证码/)).toBeVisible();
    await page.getByLabel("验证码").fill("123456");
    await page.getByRole("button", { name: /验证并登录/ }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.getByRole("button", { name: /新建项目/ }).click();
    await page.getByLabel("项目名称").fill("浏览器验收巡检");
    await page.getByRole("button", { name: "创建项目" }).click();
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+\/qr$/);
    const projectId = page.url().split("/projects/")[1].split("/")[0];
    await page.goto(`/app/projects/${projectId}/form`);
    await expect(page.getByText(/单选 · 运行正常/)).toBeVisible();
    await expect(page.getByRole("button", { name: "添加附件 / 图片字段" })).toBeVisible();
    await expect(page.getByText(/附件字段会在公共表单显示图片选择器/)).toBeVisible();
    await expect(page.locator('.form-preview__phone input[type="file"]')).toBeVisible();
    await page.getByRole("button", { name: /发布更新/ }).click();
    await expect(page.getByText("发布成功")).toBeVisible();
    await page.goto(`/app/projects/${projectId}/qr`);
    await page.getByRole("button", { name: /发布更新/ }).click();
    await expect(page.getByText("发布成功，新版本已生效", { exact: true })).toBeVisible();

    const publicData = await page.evaluate(async (id): Promise<BrowserProjectResponse> => {
      const response = await fetch(`/api/projects/${id}`, { credentials: "include" });
      return response.json();
    }, projectId);
    const slug = publicData.data.entities[0].slug;
    await page.goto(`/s/${slug}`);
    await expect(page.getByRole("heading", { name: /浏览器验收巡检/ })).toBeVisible();
    await expect(page.getByText("附件 / 现场图片")).toBeVisible();
    await expect(page.getByText("添加附件")).toBeVisible();
    await page.locator(".public-form-field input").nth(1).fill("浏览器测试巡检人");
    await page.locator(".public-form-field input").nth(2).fill("2026-08-14");
    await page.locator(".scan-photos input[type=file]").setInputFiles(path.join(process.cwd(), "assets", "generated", "2026-08-09", "submission-gauge.webp"));
    await page.getByRole("button", { name: /提交巡检记录/ }).click();
    await expect(page.getByRole("dialog", { name: "提交成功" })).toBeVisible();
    await page.getByRole("button", { name: "完成" }).click();
    await page.goto(`/app/projects/${projectId}/submissions`);
    await expect(page.getByText("浏览器测试巡检人").first()).toBeVisible();
    await expect(page.getByText("表单内容")).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("移动端公共页面可访问", async ({ page }) => {
    await page.goto("/s/TPQRDEMO01");
    await expect(page.locator("main.public-scan-page")).toBeVisible();
    await expect(page.getByRole("button", { name: /提交巡检记录/ })).toBeVisible();
  });

  test("无效 slug 显示可理解的 404 状态", async ({ page }) => {
    await page.goto("/s/INVALID0000");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("二维码页面不可用")).toBeVisible();
  });

  test("二维码编辑、项目设置和批量 ZIP 导出", async ({ page }, testInfo) => {
    const email = `batch-${testInfo.project.name}@tpqr.local`;
    await page.goto("/login");
    await page.getByLabel("邮箱地址").fill(email);
    await page.getByRole("button", { name: /发送验证码/ }).click();
    await page.getByLabel("验证码").fill("123456");
    await page.getByRole("button", { name: /验证并登录/ }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.getByRole("button", { name: /新建项目/ }).click();
    await page.getByLabel("项目名称").fill("批量导出验收");
    await page.getByRole("button", { name: "创建项目" }).click();
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+\/qr$/);
    const projectId = page.url().split("/projects/")[1].split("/")[0];

    const pngDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /PNG 1024px/ }).click();
    expect((await pngDownload).suggestedFilename()).toContain("批量导出验收-qr.png");
    const svgDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /^SVG/ }).click();
    expect((await svgDownload).suggestedFilename()).toContain("批量导出验收-qr.svg");

    await page.getByRole("button", { name: /发布更新/ }).click();
    await expect(page.getByText("发布成功，新版本已生效", { exact: true })).toBeVisible();
    await page.goto(`/app/projects/${projectId}/settings`);
    await page.getByLabel("项目名称").fill("批量导出验收（已设置）");
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByText("项目设置已保存")).toBeVisible();

    await page.goto(`/app/projects/${projectId}/batch`);
    await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles(path.join(process.cwd(), "tests", "fixtures", "entities.csv"));
    await expect(page.getByText(/已读取 2 条记录/)).toBeVisible();
    await page.getByRole("button", { name: "确认映射并导入" }).click();
    await expect(page.getByText("已导入 2 条实体")).toBeVisible();
    const zipDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "批量生成并下载 ZIP" }).click();
    const zipPath = await (await zipDownload).path();
    expect(zipPath).toBeTruthy();
    const zip = await JSZip.loadAsync(await fs.readFile(zipPath));
    expect(zip.file("mapping.csv")).toBeTruthy();
    expect(zip.file("version.json")).toBeTruthy();
    expect(zip.file("README.txt")).toBeTruthy();
    expect(Object.keys(zip.files).filter((name) => name.endsWith(".png"))).toHaveLength(2);
  });
});
