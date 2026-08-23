# Security model

This document describes the baseline expected before a production deployment.

- Authentication uses short-lived verification codes and an HttpOnly session
  cookie. Codes expire, are single-use, and staging/production (plus the
  explicit test environment) rate limit both normalized email (5/hour) and
  Cloudflare source IP (20/hour). The local development adapter keeps the
  fixed test code and intentionally skips these production throttles so the
  browser suite can run repeatedly without shared-state coupling.
- Dashboard routes authorize the session owner on every code, version, asset,
  submission, and analytics query.
- Public routes expose only active published versions and use a stable slug;
  deleted, paused, unpublished, or unknown slugs return a safe not-found error.
- URLs accept only safe `http` and `https` schemes. `javascript:`, `data:`,
  `file:`, and other executable schemes are rejected or shown as inert text.
- Uploads enforce file size, MIME, magic-byte, count, and ownership checks.
  R2 buckets stay private and object keys are never accepted from the client.
- Public reads, downloads, external-link clicks, and event writes are
  rate-limited. Event identifiers are idempotent to prevent double counting.
- Published snapshots are immutable. A revision mismatch returns
  `REVISION_CONFLICT` instead of overwriting another editor's draft.
- GitHub OAuth uses a one-time state, exact callback origin, and PKCE
  (`S256`). Provider access tokens are used only for the callback exchange and
  are never persisted.

Before publishing, run `npm run test:security` and
`npm run check:opensource`. Report vulnerabilities privately as described in
`SECURITY.md` at the repository root.
