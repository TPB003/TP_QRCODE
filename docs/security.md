# Security model

This document describes the baseline expected before a production deployment.

- Authentication uses short-lived verification codes and an HttpOnly session
  cookie. Codes expire, are single-use, and are rate limited.
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

Before publishing, run `npm run test:security` and
`npm run check:opensource`. Report vulnerabilities privately as described in
`SECURITY.md` at the repository root.
