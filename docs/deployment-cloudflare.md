# Cloudflare deployment and `tpqrcode.shop`

Cloudflare deployment is separate from the local test gate. The public
repository contains only placeholder configuration; real D1/R2 IDs, OAuth
credentials, Resend keys, and private deployment files stay outside Git or in
the ignored `tmp/` directory.

## Delegate the domain to Cloudflare

1. In Cloudflare, choose **Websites → Add a domain**, enter `tpqrcode.shop`,
   and choose the Free plan.
2. Copy the two Nameservers Cloudflare displays.
3. In the West Digital domain console, replace the current Nameservers with
   the Cloudflare pair. Disable DNSSEC at the registrar first if it is active.
4. Preserve any required MX, TXT, SPF, and DKIM records before changing the
   delegation.
5. Wait for the zone to become **Active**, then verify with:

   ```powershell
   Resolve-DnsName tpqrcode.shop -Type NS
   ```

The domain remains registered at West Digital; only DNS authority moves to
Cloudflare. Propagation can take time and is controlled by the registrar and
DNS caches.

## Attach the Worker custom domain

Open **Workers & Pages → tp-qr → Settings → Domains & Routes → Add Custom
Domain**, then enter `tpqrcode.shop`. Cloudflare provisions the certificate
and DNS mapping. Do not create a root CNAME manually before adding the custom
domain.

The private production configuration must contain:

```jsonc
{
  "routes": [{ "pattern": "tpqrcode.shop", "custom_domain": true }],
  "vars": {
    "ENVIRONMENT": "production",
    "APP_ORIGIN": "https://tpqrcode.shop",
    "AUTH_OAUTH_CALLBACK_ORIGIN": "https://tpqrcode.shop",
    "AUTH_DELIVERY_MODE": "resend"
  }
}
```

Copy the public template to an ignored file and replace all placeholders:

```powershell
Copy-Item infra/cloudflare/wrangler.production.example.jsonc tmp/wrangler.production.jsonc
npx wrangler whoami
npm run tpqr -- deploy --environment production --config tmp/wrangler.production.jsonc --confirm-production
```

Because Wrangler resolves paths relative to the config file, adjust the
copied private file's paths to `../apps/worker/src/index.ts`, `../dist`, and
`../infra/cloudflare/migrations` when it lives under `tmp/`. Alternatively,
keep a private copy under `infra/cloudflare/` with the template's original
relative paths, but never commit that copy.

Set production secrets through Wrangler, never in JSON or Git:

```powershell
npx wrangler secret put RESEND_API_KEY --config tmp/wrangler.production.jsonc
npx wrangler secret put AUTH_GOOGLE_CLIENT_SECRET --config tmp/wrangler.production.jsonc
npx wrangler secret put AUTH_GITHUB_CLIENT_SECRET --config tmp/wrangler.production.jsonc
```

`RESEND_FROM_EMAIL` must be a verified Resend sender. Production must not set `AUTH_TEST_CODE` or use `AUTH_DELIVERY_MODE=dev`.

The production mail adapter is explicitly selected with:

```text
AUTH_DELIVERY_MODE=resend
```

## Google and GitHub callbacks

Configure these exact callback URLs in the provider consoles:

```text
https://tpqrcode.shop/api/auth/google/callback
https://tpqrcode.shop/api/auth/github/callback
```

For local development, use a separate provider application with:

```text
http://127.0.0.1:8787/api/auth/google/callback
http://127.0.0.1:8787/api/auth/github/callback
```

Google requires `openid email profile` and a verified email. GitHub should use
a GitHub App user authorization flow with only basic profile and email access;
never request repository write permissions for login.

## Smoke test and rollback

```powershell
Invoke-WebRequest https://tpqrcode.shop/api/health
npm run tpqr -- domain inspect tpqrcode.shop
```

Check the homepage, `/api/health`, an existing `/s/<slug>` page, email login,
Google login, GitHub login, and a real media download. Keep the
`workers.dev` URL available as a rollback path. If the custom domain fails,
remove the custom-domain route or redeploy the previous Worker version; do
not delete D1/R2 data while investigating.

## Mainland China note

Cloudflare Free/global routing may be reachable from mainland China but does
not provide a stability guarantee. Cloudflare China Network is a separate
commercial product with eligibility, ICP, and review requirements. A domestic
CDN/hosting route and ICP should be planned separately if stable mainland
availability becomes a hard requirement.
