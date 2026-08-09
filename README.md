# TP QR

TP QR 是一个面向简体中文用户的动态二维码平台。创建者可以用文本、网址或云端图片生成二维码，通过“草稿 → 发布”更新公共内容而无需重新打印，并可使用签到报名、人员管理、设备巡检、信息收集等模板批量生成独立实体码。

当前已完成设计驱动流程、正式视觉素材、React/Vite/Hono 工程骨架与营销首页。首页包含真实二维码即时预览、动态发布流程、六种视觉样式、CSV 字段映射演示、批量实体码、提交记录和 30 天趋势图；工作台、编辑器和 Cloudflare 数据功能仍在当前功能分支继续实现。

## 技术栈

- React、Vite、TypeScript strict、React Router
- TanStack Query、React Hook Form、Zod
- Tailwind CSS v4、Radix UI、Lucide
- Hono、Cloudflare Workers、D1、R2
- Vitest、Playwright、ESLint
- `qr-code-styling`、PapaParse、JSZip、dnd-kit

## 本地复现

需要 Node.js `22.18.0` 或兼容的 Node 22 版本，以及 npm 10。

```powershell
git clone https://github.com/TPB003/TP_QRCODE.git
Set-Location TP_QRCODE
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

前端默认运行在 `http://127.0.0.1:5173`，Worker 默认运行在 `http://127.0.0.1:8787`。只调试静态前端时可运行 `npm run dev:client`。

首次接入本地 D1 后执行：

```powershell
npm run db:migrate:local
```

## 检查命令

```powershell
npm run lint          # ESLint 静态检查
npm run typecheck     # TypeScript 严格类型检查
npm run test          # 单元与 Worker 集成测试
npm run test:browser  # 浏览器端到端测试
npm run build         # 生产构建
npm run check         # 执行完整质量门禁
```

不应将未运行的命令描述为“已验证”。当前营销首页已通过 lint、类型检查、生产构建，并使用应用内浏览器检查 `1440×900` 与 `390×844` 视口、实时二维码更新和控制台状态。

## 目录结构

```text
src/client/       React 路由、features、UI、布局与浏览器工具
src/worker/       Hono 路由、服务、仓储、集成与定时任务
src/shared/       前后端共享契约、Schema、类型与常量
assets/generated/ 已确认并随代码发布的正式图片素材
migrations/       只增不改的 D1 SQL 迁移
tests/            unit、integration、browser 测试
design/           已确认的设计拆解文档
```

参考图、临时截图和生成中间文件按日期保存在本地 `output/`、`tmp/` 或 `archive/`，这些目录不会提交。正式运行时素材由 R2 管理。

## 配置说明

复制 `.dev.vars.example` 后填写本地配置。不要提交验证码、会话密钥、Resend API Key、Turnstile Secret 或个人二维码。`wrangler.jsonc` 中的 D1 ID 目前是本地开发占位值；部署前必须创建真实 D1 数据库和 R2 bucket，并设置生产 `APP_ORIGIN` 与 Worker secrets。

## Git 流程

功能分支使用 `feat#<序号>_<提交人>_<修改内容>` 格式。每个提交只包含一个可复现的逻辑阶段；生成缓存、测试截图、构建产物与归档内容不进入 Git。完成全部测试和视觉验收后才合并到 `main`。

## 设计资料

- [素材拆解与实现边界](design/2026-08-09/asset-breakdown.md)
- 正式素材：`assets/generated/2026-08-09/`
- 本地参考图：`output/imagegen/tp-qr/2026-08-09/concepts/`

完整 Cloudflare 资源创建、部署和自定义域名接入步骤将在功能实现完成后补充，避免把尚未创建的远程资源写成已配置状态。
