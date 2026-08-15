# Optional Cloudflare deployment

Cloudflare deployment is deliberately not required for local development or
for the open-source test gate. A free `workers.dev` subdomain can be enabled
from the Cloudflare dashboard without buying a custom domain; availability and
the chosen subdomain are controlled by Cloudflare. A custom domain is optional
and may have registrar costs.

## Preparation

1. Sign in to Cloudflare and enable a Workers account and the desired
   `workers.dev` subdomain.
2. Create a D1 database and an R2 bucket in your own account.
3. Copy `infra/cloudflare/wrangler.production.example.jsonc` to a private local
   config, replacing placeholders with your own IDs and names.
4. Configure production secrets (`RESEND_API_KEY`, Turnstile secret, and any
   session secret) with `wrangler secret put`. Never commit them.
5. Set `APP_ORIGIN` and the Vite Turnstile site key to the final HTTPS origin.

## Deploy

```powershell
npx wrangler whoami
npm run db:migrate:remote
npm run build
npx wrangler deploy --config apps/worker/wrangler.jsonc
```

Run the complete browser and security suite against the deployed origin before
calling the deployment production-ready. Keep the R2 bucket private and verify
that direct bucket URLs are not reachable. This repository intentionally does
not claim that a remote D1, R2, domain, or Worker has already been created.
