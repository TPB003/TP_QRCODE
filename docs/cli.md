# TP QR maintainer CLI

The repository includes a small Node.js 22 CLI. It is intentionally a
maintainer tool, not an end-user QR content client, and it never prints secret
values.

Run it from the repository root without a global install:

```powershell
npm run tpqr -- doctor
npm run tpqr -- local setup
npm run tpqr -- check
npm run tpqr -- domain inspect tpqrcode.shop
npm run tpqr -- oauth check
npm run tpqr -- release verify
```

Deployment requires a private configuration file under the ignored `tmp/`
directory:

```powershell
npm run tpqr -- deploy --environment staging --config tmp/wrangler.staging.jsonc --dry-run
npm run tpqr -- deploy --environment production --config tmp/wrangler.production.jsonc --confirm-production
```

Production preflight rejects placeholder IDs, HTTP origins, development auth,
fixed test codes, missing custom-domain routing, and deployments without an
explicit confirmation flag. The CLI does not change registrar Nameservers or
Cloudflare DNS records.
