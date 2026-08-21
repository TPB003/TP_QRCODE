# Testing strategy

TP QR uses four layers. Each layer is deterministic and runs locally.

| Layer | Command | Scope |
| --- | --- | --- |
| Unit | `npm run test:unit` | content validators, safe URLs, vCards, QR primitives, contracts |
| Worker integration | `npm run test:integration` | D1/R2 bindings, auth, CRUD, publish, public reads and events |
| Security | `npm run test:security` | authorization, upload limits, unsafe schemes, rate-limit behavior |
| Browser | `npm run test:browser` | desktop/mobile workflows, downloads, decoder and navigation |

The release gate is:

```powershell
npm run check:all
npm run check:opensource
git diff --check
```

Every active content type must pass the lifecycle `create -> edit -> draft ->
preview -> publish -> scan -> render -> download/share -> edit -> rescan`.
Browser coverage uses 1440×900, 390×844, and 375×812 viewports and asserts no
page-level horizontal overflow or console errors.

Tests must use the deterministic fixtures under `tests/fixtures`. Do not place
real QR codes, personal data, or generated screenshots in the repository.

The Playwright configuration starts Vite and Wrangler through
`scripts/start-test-servers.mjs` as independent processes. This keeps the
browser gate stable on Windows; `npm run dev` remains the interactive shortcut
for local manual work.

The user-facing acceptance matrix, severity definitions, and manual black-box
pass are documented in [`docs/qa-ux-acceptance.md`](qa-ux-acceptance.md).
