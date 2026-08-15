# Contributing

1. Create a feature branch from the current default branch.
2. Keep changes scoped to one behavior and add deterministic tests.
3. Do not commit local environment files, private QR payloads, generated media,
   or Cloudflare identifiers.
4. Run `npm run check:all`, `npm run check:opensource`, and `git diff --check`.
5. Open a pull request describing the behavior, tests, screenshots (if visual),
   and known limitations.

For security issues, follow `SECURITY.md` instead of opening a public issue.
