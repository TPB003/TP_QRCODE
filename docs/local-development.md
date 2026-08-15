# Local development

## Requirements

- Node.js 22.18 or newer
- npm 10 or newer
- Chromium or Google Chrome for Playwright browser tests

## First run

```powershell
git clone https://github.com/TPB003/TP_QRCODE.git
Set-Location TP_QRCODE
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run setup:local
npm run dev
```

The Vite app is `http://127.0.0.1:5173` and the Worker is
`http://127.0.0.1:8787`. Local D1 and R2 are Wrangler simulations; they do not
create or contact Cloudflare production resources. The development mail
adapter accepts the configured test code (`123456`) and never sends an email.

## Database reset

Run migrations and seed data after a schema change:

```powershell
npm run db:migrate:local
npm run db:seed:local
```

The seed uses fictional Chinese names, devices, and timestamps. It is safe to
reset and must never be replaced with personal submissions.

## Environment files

`.dev.vars.example` documents local variables. Copy it to `.dev.vars` only on
your machine; the latter is ignored by Git. Production secrets belong in the
Cloudflare dashboard or `wrangler secret`, never in JSON configuration.

## Troubleshooting

- If port 5173 or 8787 is busy, stop the old Vite/Wrangler process first.
- If browser tests cannot find Chrome, set
  `$env:PLAYWRIGHT_EXECUTABLE_PATH` to the local executable.
- If local D1 appears stale, stop Wrangler and repeat the migration and seed
  commands. Do not delete a directory outside `tmp/` or `.wrangler/`.
