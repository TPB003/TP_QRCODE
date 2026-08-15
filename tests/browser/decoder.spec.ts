import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function installDetector(page: Page, raw: string) {
  await page.addInitScript((value: string) => {
    (window as unknown as { __decoderRaw: string }).__decoderRaw = value;
    class FakeBarcodeDetector {
      detect() { return Promise.resolve([{ rawValue: (window as unknown as { __decoderRaw: string }).__decoderRaw }]); }
    }
    (window as unknown as { BarcodeDetector: typeof FakeBarcodeDetector }).BarcodeDetector = FakeBarcodeDetector;
  }, raw);
}

test.describe("二维码解码器", () => {
  test("图片上传识别普通文字并提供复制操作", async ({ page }) => {
    await installDetector(page, "TP QR 测试文字");
    await page.goto("/decoder");
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "tmp", "fixtures", "sample-image.png"));
    await expect(page.getByText("文字内容")).toBeVisible();
    await expect(page.getByText("TP QR 测试文字")).toBeVisible();
    await expect(page.getByRole("button", { name: "复制文字" })).toBeVisible();
  });

  test("安全网址需要二次确认，危险协议被拦截", async ({ page }) => {
    await installDetector(page, "https://example.com/docs");
    await page.goto("/decoder");
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "tmp", "fixtures", "sample-image.png"));
    await expect(page.getByText("检测到网址", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "确认打开" })).toBeVisible();

    await page.addInitScript(() => { (window as unknown as { __decoderRaw: string }).__decoderRaw = "javascript:alert(1)"; });
    await page.reload();
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "tmp", "fixtures", "sample-image.png"));
    await expect(page.getByText(/无法识别此二维码/)).toBeVisible();
    await expect(page.getByRole("button", { name: "确认打开" })).not.toBeVisible();
  });

  test("vCard 识别后提供联系人文件保存", async ({ page }) => {
    await installDetector(page, "BEGIN:VCARD\nVERSION:3.0\nFN:TP QR\nORG:TP QR\nEND:VCARD");
    await page.goto("/decoder");
    await page.locator('input[type="file"]').setInputFiles(path.join(process.cwd(), "tmp", "fixtures", "sample-image.png"));
    await expect(page.getByText("电子名片")).toBeVisible();
    await expect(page.getByRole("link", { name: "保存名片" })).toHaveAttribute("download", "contact.vcf");
  });
});
