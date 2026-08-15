# TP QR repository guidelines

## Project structure

TP QR is an npm-workspaces monorepo. Keep the root limited to shared tooling,
documentation, licensing, and workspace configuration.

```text
apps/web/                 React/Vite browser application
apps/worker/              Hono/Cloudflare Worker API
packages/domain/          shared API and domain contracts
packages/content/         seven active-content models and validators
packages/qr/              rendering, download, and decoding primitives
packages/ui/              visual tokens and reusable interface primitives
infra/cloudflare/         migrations, local seed, and deployment templates
tests/                    unit, integration, browser, security, and fixtures
docs/                     architecture, operations, testing, and security notes
scripts/                  deterministic fixture and repository checks
assets/open/              small, redistributable assets only
```

The public repository must contain reproducible source only. Never commit
`.dev.vars`, `.env` files, production identifiers, private QR payloads,
personal submissions, generated reports, or local Cloudflare state. Keep
generated output in `tmp/`, `output/`, or `.wrangler/`; these directories are
ignored by Git.

## Development commands

Use Node.js 22.18+ and npm 10+. From the repository root:

```powershell
npm ci
npm run setup:local
npm run dev
```

The browser runs on `http://127.0.0.1:5173`; the Worker runs on
`http://127.0.0.1:8787`. Useful gates are:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run test:browser
npm run check:all
npm run check:opensource
git diff --check
```

Do not describe a change as tested unless the exact command has completed
successfully. Browser tests require a local Chromium/Chrome installation and
must cover both desktop and mobile viewports.

## Code and test conventions

Use spaces, TypeScript strict mode, focused modules, and the formatter/linter
already configured in the repository. New behavior needs a deterministic test.
Mirror source paths under `tests/` where practical. Validate normal, empty,
Unicode, malicious, and boundary input. Prefer structural QR assertions or
decode/round-trip checks over screenshot-only assertions.

Do not modify another workstream's owned contract without coordination. Keep
shared public types in `packages/domain`, content validation in `packages/content`,
and browser-independent QR behavior in `packages/qr`.

## Commits and pull requests

Use short imperative commit subjects and keep commits logically focused. A PR
must explain the behavior, tests run, compatibility decisions, and known
limitations. Attach screenshots or a short recording for visual changes.

## Security

Treat all uploaded content and public links as untrusted. Enforce safe URL
schemes, MIME/file-header checks, size limits, authorization, rate limiting,
and immutable published versions in the Worker. R2 remains private and is
accessed through authorized Worker routes only. Report vulnerabilities through
the process in `SECURITY.md`; do not publish exploit payloads in issues.
