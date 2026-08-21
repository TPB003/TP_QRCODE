# Contributing

1. Create a feature branch from the current default branch.
2. Keep changes scoped to one behavior and add deterministic tests.
3. Do not commit local environment files, private QR payloads, generated media,
   or Cloudflare identifiers.
4. Review and update the README for every user-visible behavior, route,
   command, environment variable, authentication, deployment, or visual change.
   Refresh `assets/open/homepage.png` when the homepage or navigation changes.
5. If a change is internal-only, state in the pull request that the README was
   checked and no update was needed.
6. Run `npm run check:all`, `npm run check:opensource`, and `git diff --check`.
7. Open a pull request describing the behavior, tests, screenshots (if visual),
   and known limitations.

## Automatic merge policy

The `main` branch accepts changes only through a pull request with the `CI / verify`
check passing. Trusted pull requests authored by `TPB003` or Dependabot and coming
from this repository are queued for squash auto-merge after CI succeeds. Add the
`no-auto-merge` label when a passing pull request needs manual review. Pull requests
from forks and draft pull requests are never auto-merged.

For security issues, follow `SECURITY.md` instead of opening a public issue.
