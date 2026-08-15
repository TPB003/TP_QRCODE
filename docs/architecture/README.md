# Architecture

TP QR is a small monorepo with a browser application and a Cloudflare Worker.
The browser owns presentation and QR rendering; the Worker owns authentication,
authorization, public content, uploads, versioning, and analytics.

```text
apps/web -> packages/ui, packages/domain, packages/content, packages/qr
apps/worker -> packages/domain, packages/content
apps/worker -> D1 (metadata/events) + private R2 (media)
public scanner -> Worker public API -> immutable published version -> content frame
```

## Active content model

The product has seven active-code payloads: `image`, `video`, `audio`, `file`,
`url`, `contact`, and `text`. A code stores a stable ten-character slug and a
draft revision. Publishing creates an immutable version. Public pages only
resolve the current published version, so a later edit cannot change a scan in
the middle of a request.

`packages/domain` is the source of truth for API response envelopes, IDs,
revisions, slugs, and errors. `packages/content` validates each payload and
normalizes vCards and safe URLs. `packages/qr` provides one renderer used by
preview, download, batch export, and decoding.

## Data and trust boundaries

- D1 stores users, codes, versions, resource metadata, and aggregate events.
- R2 is private. The client never receives a bucket URL or object key.
- Worker routes check session ownership for dashboard operations.
- Public routes expose only published, active content and stream resources
  through authorization and rate-limit checks.
- Uploaded bytes are checked for declared MIME, file signature, size, and
  per-code count before they are associated with a draft.

Legacy project/form data is kept behind a compatibility adapter while the new
code editor is rolled out. Legacy inspection payloads are not emitted by the
new public content response.
