# Open-source boundary

The repository is intended to be reproducible without access to any personal
Cloudflare account. Public files may contain source code, migrations, fictional
seed data, documentation, tests, and redistributable assets in `assets/open/`.

Never commit:

- `.dev.vars`, `.env`, API keys, cookies, OAuth tokens, or private certificates;
- real D1 IDs, private R2 names, account identifiers, or production hostnames;
- personal QR payloads, customer submissions, uploaded media, or screenshots;
- `node_modules`, `dist`, `.wrangler`, `tmp`, `output`, `archive`, coverage,
  Playwright reports, and generated ImageGen prompts/assets;
- any local file copied from a Cloudflare dashboard.

Use placeholders such as `replace-with-your-d1-id` in deployment examples. The
scanner (`npm run check:opensource`) is intentionally conservative and fails
on suspicious secrets, UUID resource IDs, private environment files, and
concrete `workers.dev` hosts. If a false positive is safe and reproducible,
replace the value with a documented placeholder rather than weakening the
scanner.
