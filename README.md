# TP QR

TP QR 是一个面向中文团队的动态二维码与业务表单平台。二维码地址保持不变，创建者可以在本地工作台中编辑草稿、发布不可变版本，再通过公共扫码页收集表单和图片提交。

本仓库当前以“本地完整可运行”为交付目标：本地使用 Wrangler 的 D1/R2 模拟能力，不需要域名、不需要 Cloudflare 远程资源，也不会调用真实邮件服务。Cloudflare 域名和线上部署只在文末作为后续可选步骤说明。

## 功能

- 邮箱验证码登录、会话 cookie、登出和登录保护。
- 文本、网址、图片二维码编辑；浏览器端生成 PNG/SVG。
- 四类业务模板：签到报名、人员管理、设备巡检、信息收集。
- 草稿保存、revision 冲突检测、发布不可变版本；公共页只读取已发布版本。
- 项目、实体码和项目设置管理；每个项目创建时自动生成一个默认实体码。
- CSV 实体导入、字段映射、最多 200 条实体批量导入。
- 批量 ZIP 导出，包含真实二维码 PNG、`mapping.csv` 和说明文件。
- 公共扫码表单、最多 5 个图片附件、服务端字段校验和本地 R2 模拟存储。
- 提交记录、CSV 导出、最近 30 天扫码/提交统计。
- D1 迁移、虚构种子数据、Worker 集成测试和 Playwright 桌面/移动端验收。

## 业务流程

```text
登录 → 创建项目/选择模板 → 编辑表单与二维码样式 → 保存草稿
                                              ↓
                                     发布不可变版本
                                              ↓
      公共 /s/:slug 页面读取已发布版本 → 填写表单/上传图片 → 提交入库
                                              ↓
                          工作台查看提交、统计并导出 CSV
```

## 技术栈与架构

- 前端：React、React Router、Vite、TypeScript strict、Lucide、dnd-kit。
- 共享契约：Zod Schema、共享领域类型、产品限制和错误码。
- Worker：Hono，负责认证、项目 CRUD、发布、实体、资源、公共提交和定时清理。
- 数据：Cloudflare D1（SQLite）保存业务数据，Cloudflare R2 保存上传对象；本地均由 Wrangler 模拟。
- 二维码：`qr-code-styling` 在浏览器端生成预览和下载文件；批量 ZIP 使用 JSZip。
- 测试：Vitest 单元测试、`@cloudflare/vitest-pool-workers` Worker 集成测试、Playwright 浏览器测试。

所有 API 响应使用统一结构：成功为 `{ "data": ... }`，失败为 `{ "error": { "code", "message", "fieldErrors?" } }`。

主要接口如下：

| 能力 | 接口 |
| --- | --- |
| 认证 | `POST /api/auth/request-code`、`POST /api/auth/verify-code`、`POST /api/auth/logout`、`GET /api/auth/me` |
| 模板 | `GET /api/templates` |
| 项目 | `GET/POST /api/projects`、`GET/PATCH/DELETE /api/projects/:projectId` |
| 发布 | `POST /api/projects/:projectId/publish` |
| 资源 | `POST /api/assets`、`DELETE /api/assets/:assetId` |
| 实体 | `GET /api/projects/:projectId/entities`、`POST /api/projects/:projectId/entities/import` |
| 提交与统计 | `GET /api/projects/:projectId/submissions`、`GET /api/projects/:projectId/submissions/export`、`GET /api/projects/:projectId/analytics?days=30` |
| 公共页面 | `GET /api/public/:slug`、`POST /api/public/:slug/submissions` |

## 目录结构

```text
src/client/                 React 页面、features、布局与客户端 API
src/worker/                 Hono Worker、路由、认证、D1/R2 访问与定时任务
src/shared/                 前后端共享 Schema、类型、常量和契约
migrations/                 只增不改的 D1 SQL 迁移
tests/unit/                 共享 Schema 与边界单元测试
tests/integration/          Cloudflare Worker + D1/R2 集成测试
tests/browser/              Playwright 桌面/移动端验收
tests/fixtures/             本地种子 SQL
assets/generated/           随仓库发布的正式演示素材
design/                     已确认的设计拆解文档
public/                     Vite 静态资源（包含本地 favicon）
```

## 环境要求

- Node.js `22.18.0` 或更高的 Node 22 版本。
- npm `10` 或更高版本。
- Windows、macOS 或 Linux 均可运行 Wrangler 本地模拟；Windows PowerShell 命令见下文。
- 浏览器测试默认使用 Windows Chrome：`C:\Program Files\Google\Chrome\Application\chrome.exe`。其他环境请设置 `PLAYWRIGHT_EXECUTABLE_PATH`，或在本地安装可执行的 Chromium。

## 本地安装与启动

```powershell
git clone https://github.com/TPB003/TP_QRCODE.git
Set-Location TP_QRCODE
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

开发服务器：

- 前端：<http://127.0.0.1:5173>
- Worker：<http://127.0.0.1:8787>
- 健康检查：<http://127.0.0.1:8787/api/health>
- 种子公共页：<http://127.0.0.1:5173/s/TPQRDEMO01>

只启动前端可以使用 `npm run dev:client`，只启动 Worker 可以使用 `npm run dev:worker`。首次运行或迁移变更后重新执行：

```powershell
npm run db:migrate:local
npm run db:seed:local
```

种子数据使用虚构的设备、姓名和时间；脚本可以重复执行，不包含真实个人数据。

## 本地验证码与环境变量

`.dev.vars.example` 是本地配置模板，实际 `.dev.vars` 不得提交。开发环境使用固定验证码适配器，不发送邮件：

| 变量 | 用途 | 本地示例 |
| --- | --- | --- |
| `ENVIRONMENT` | Worker 环境 | `development` |
| `APP_ORIGIN` | CORS 与生产来源校验 | `http://127.0.0.1:5173` |
| `AUTH_DELIVERY_MODE` | 验证码发送适配器 | `dev` |
| `AUTH_TEST_CODE` | 本地固定验证码 | `123456` |
| `AUTH_ALLOWED_EMAILS` | 邮箱白名单，逗号分隔 | `*` |
| `TURNSTILE_SITE_KEY` | 生产公共表单站点 key | 本地留空 |
| `TURNSTILE_SECRET_KEY` | 生产 Worker secret | 本地留空 |
| `RESEND_API_KEY`、`RESEND_FROM_EMAIL` | 后续真实邮件适配器 | 本地留空 |
| `SESSION_COOKIE_SECRET` | 后续扩展的会话密钥 | 本地留空 |

生产环境不能使用 `AUTH_DELIVERY_MODE=dev` 或固定验证码，必须接入真实邮件适配器、Turnstile 和 Worker secrets。

## 测试、构建与验收

分层命令：

```powershell
npm run lint             # ESLint
npm run typecheck        # TypeScript strict
npm run test:unit        # 共享 Schema、Unicode、边界和认证输入
npm run test:integration # Cloudflare Worker 测试池、真实测试 D1/R2 binding
npm run test             # unit + integration
npm run build            # typecheck + Vite production build
npm run test:browser     # Playwright 桌面与移动端
```

最终本地门禁：

```powershell
npm ci
npm run db:migrate:local
npm run db:seed:local
npm run check:local
```

`check:local` 固定执行 `lint && typecheck && test && build && test:browser`。浏览器验收覆盖登录、创建巡检项目、发布、动态公共 slug、必填表单、图片上传、提交成功、移动视口、无效 slug 和控制台错误检查。若本机 Chrome 路径不同，请先设置：

```powershell
$env:PLAYWRIGHT_EXECUTABLE_PATH = "C:\path\to\chrome.exe"
npm run test:browser
```

运行测试产生的报告、截图、trace 和临时数据库均位于 `tmp/`、`output/` 或 `.wrangler/`，不会进入 Git。

## 产品限制

- Logo 最大 2 MB，普通图片和公共附件最大 10 MB。
- 每个表单最多 50 个字段。
- 单次 CSV 导入最多 200 个实体。
- 公共 slug 固定为 10 位 ASCII 字符。
- 公共提交最多 5 个图片附件。
- 删除数据保留 30 天后由 Worker 定时任务清理。
- 公共页面只读取已发布版本；更新项目必须携带当前 `revision`，冲突返回 `REVISION_CONFLICT`。
- 当前本地验证码不会发送真实邮件，生产 Resend/其他邮件服务仍需接入实现。

## 当前限制

- 本阶段没有注册域名、没有创建远程 D1/R2、没有线上 Worker 部署。
- 本地 R2 只通过 Worker 访问；没有公开 bucket URL。
- 生产 Turnstile、真实邮件、日志告警和自定义域名需要在后续部署阶段配置。
- 团队、计费、通知、插件和超级管理员不在本阶段范围内。

## Cloudflare 后续部署（可选，不是本阶段门槛）

Cloudflare 登录和域名注册是两件事。登录 Cloudflare 后，如果还没有域名，可以选择：

1. 在 Cloudflare Dashboard 的 **Domain Registration / Registrar** 中搜索可注册的顶级域名并购买（是否可用、价格和地区支持以页面实时结果为准）；或者在任意域名注册商购买域名。
2. 如果域名是在其他注册商购买的，在 Cloudflare Dashboard 选择 **Websites → Add a domain**，输入根域名并选择计划。Cloudflare 会给出两个 nameserver。
3. 回到原注册商的域名管理页面，把 nameserver 替换为 Cloudflare 提供的 nameserver，等待状态变为 **Active**。这一步只接管 DNS，不会自动创建本项目的 D1/R2。
4. 域名激活后再为 Worker 配置自定义域名/路由，并把生产 `APP_ORIGIN`、Turnstile、邮件服务和 secrets 配好。

真正准备部署时，先确认 Wrangler 登录状态，再创建资源；以下命令只作为后续参考，本阶段不要执行：

```powershell
npx wrangler whoami
npx wrangler d1 create tp-qr-db
npx wrangler r2 bucket create tp-qr-assets
npx wrangler d1 migrations apply tp-qr-db --remote
npm run build
npx wrangler deploy
```

创建 D1 后，将命令返回的真实 `database_id` 写入 `wrangler.jsonc`；当前文件中的全零 ID 只是本地占位值，不能当作已创建资源。R2 bucket 必须保持私有，资源上传、删除和公共提交附件都通过 Worker 访问。生产部署前还应启用 Turnstile、真实验证码发送、HTTPS cookie、安全响应头、日志和备份策略。

## 开源安全检查

提交或创建 Pull Request 前执行：

```powershell
git diff --check
npm run check:local
git status --short
```

确认以下内容没有进入 Git：

- `.dev.vars`、`.env`、API keys、session secrets、Turnstile secret。
- 真实个人二维码、真实提交、真实图片和邮件地址。
- `node_modules/`、`dist/`、`.wrangler/`、`tmp/`、`output/`、`archive/`、coverage 和 Playwright 报告。
- 伪装成真实资源的 D1 ID、R2 公开 URL 或未配置的 Cloudflare 状态。

## 贡献方式

1. Fork 仓库并创建功能分支。
2. 为行为变更补充 `tests/unit`、`tests/integration` 或 `tests/browser` 测试。
3. 执行 `npm run check:local` 和 `git diff --check`。
4. 提交清晰、单一目的的 commit，并创建 Pull Request，说明实现方式、测试命令和已知限制。

## License

本项目使用 [MIT License](LICENSE)。
