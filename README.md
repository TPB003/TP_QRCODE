# TP QR

TP QR is an open-source dynamic QR-code workspace for individuals and small
teams. A stable slug can point to new content after each immutable publish.
The repository contains reproducible source, tests, fictional local fixtures,
and no personal Cloudflare resources.

## Features

- Seven active-code types: image, video, audio, file, URL, contact (vCard), and text.
- Email verification-code login, session protection, draft autosave, preview,
  revision conflict detection, and immutable published versions.
- Browser-generated PNG, SVG, WEBP, and JPG downloads; mobile system sharing
  with a browser-download fallback.
- Private R2 media proxy with MIME, file-signature, size, count, and ownership checks.
- One responsive public content frame with type-specific media, file, contact,
  URL, and text presentation.
- Camera, image-upload, and drag-and-drop QR decoder for TP QR slugs, URLs,
  text, and vCards.
- Scan, download, playback, and external-link events with basic rate limiting.
- Local Cloudflare D1/R2 simulation, Worker integration tests, and Playwright
  desktop/mobile acceptance tests.

Inspection, business forms, and team collaboration are not active product
features. Compatibility code may read legacy records during migration, but the
new public response never emits inspection payloads.

## Workflow

```text
login -> create code -> choose type -> edit draft -> preview -> publish
     -> render/download QR -> scan public page -> download/share -> rescan
```

## Architecture and tree

The browser owns presentation and QR rendering. The Worker owns auth,
authorization, uploads, immutable versions, public reads, and analytics. D1
stores metadata/events and R2 stays private behind Worker routes.

```text
apps/web/                 React/Vite browser app
apps/worker/              Hono/Cloudflare Worker API
packages/domain/          shared IDs, errors, API contracts
packages/content/         seven content models, vCard, safe URLs
packages/qr/              render, download, decode, validation
packages/ui/              visual tokens and responsive primitives
infra/cloudflare/         migrations, fictional seed, deployment templates
tests/                    unit, integration, browser, security, fixtures
docs/                     architecture, development, testing, security, deploy
scripts/                  fixtures and open-source boundary checks
assets/open/              small redistributable assets only
```

See [`docs/architecture/README.md`](docs/architecture/README.md) for trust
boundaries and versioning details.

## Requirements

- Node.js 22.18+
- npm 10+
- Chrome/Chromium for browser tests

## Local setup

```powershell
git clone https://github.com/TPB003/TP_QRCODE.git
Set-Location TP_QRCODE
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run setup:local
npm run dev
```

The Vite app runs at `http://127.0.0.1:5173`; the Worker runs at
`http://127.0.0.1:8787`. Repeat migrations and seed after schema changes:

```powershell
npm run db:migrate:local
npm run db:seed:local
```

Wrangler local bindings are simulations and do not contact production. The
development mail adapter accepts the configured test code (`123456`) and never
sends real email.

## Environment variables

Copy `.dev.vars.example` to `.dev.vars` on your machine; the latter is ignored.
Production secrets belong in Cloudflare or `wrangler secret`, never in JSON.

| Variable | Purpose |
| --- | --- |
| `ENVIRONMENT` | Worker environment (`development` locally) |
| `APP_ORIGIN` | CORS and origin validation |
| `AUTH_DELIVERY_MODE` | `dev` locally; production must use email |
| `AUTH_TEST_CODE` | local test code |
| `AUTH_ALLOWED_EMAILS` | optional comma-separated allow-list |
| `VITE_TURNSTILE_SITE_KEY` | production browser key |
| `TURNSTILE_SECRET_KEY` | production Worker secret |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | production email adapter |

## Testing and release gate

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run test:browser
npm run build
npm run check:opensource
git diff --check
```

The complete local gate is:

```powershell
npm ci
npm run setup:local
npm run check:all
npm run check:opensource
git diff --check
```

Every type must pass create, edit, draft, preview, publish, scan, public
render, download/share, republish, and rescan. Browser tests cover 1440x900,
390x844, and 375x812 with no page-level overflow or console errors. See
[`docs/testing.md`](docs/testing.md).

## Build and preview

```powershell
npm run build
npm run preview
```

The generated `dist/` directory is local output and must not be committed.

## Optional Cloudflare deployment

Cloudflare deployment, custom domains, remote D1, and remote R2 are not local
acceptance requirements. After signing in, a free `workers.dev` subdomain may
be enabled when Cloudflare offers one; a custom top-level domain is optional
and may cost money. Copy `infra/cloudflare/wrangler.production.example.jsonc`,
replace its placeholders with your own account resources, configure secrets,
and follow [`docs/deployment-cloudflare.md`](docs/deployment-cloudflare.md).

This repository never claims that a remote resource, domain, account ID, or
production dataset already exists.

## Limitations and security

Local verification codes are for development only. Production needs real email,
Turnstile, HTTPS cookies, logging, alerts, and backups. R2 is private and is
never exposed as a public bucket. Teams, billing, notifications, plugins, and
super-admin controls are outside the MVP.

Run `npm run check:opensource` before publishing. Review
[`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md), and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## License

MIT License. See [`LICENSE`](LICENSE).
