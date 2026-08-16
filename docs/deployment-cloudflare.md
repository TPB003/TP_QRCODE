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
4. Verify a sender identity in Resend, then configure the production mail
   adapter. `RESEND_FROM_EMAIL` must be the verified sender address (or an
   address on a verified Resend domain):

   ```powershell
   npx wrangler secret put RESEND_API_KEY --config <private-production-config>
   ```

   Set `AUTH_DELIVERY_MODE=resend` and `RESEND_FROM_EMAIL` in the private
   production configuration. Never put the API key in JSON, `.env`, or Git.
   Production must not set `AUTH_TEST_CODE`; fixed codes are only for local
   `AUTH_DELIVERY_MODE=dev` tests.
5. Set `APP_ORIGIN` and the Vite Turnstile site key to the final HTTPS origin.

## Deploy

```powershell
npx wrangler whoami
npx wrangler d1 migrations apply <private-d1-binding> --remote --config <private-production-config>
npm run build
npx wrangler deploy --config <private-production-config>
```

Do not deploy production with `apps/worker/wrangler.jsonc`: that file is the
local development configuration and intentionally contains a fixed test code.
Keep the private production config outside the tracked repository, or under
the ignored `tmp/` directory, and run the deployment preflight before each
release. The public template contains placeholders only.

Run the complete browser and security suite against the deployed origin before
calling the deployment production-ready. Keep the R2 bucket private and verify
that direct bucket URLs are not reachable. This repository intentionally does
not claim that a remote D1, R2, domain, or Worker has already been created.
