# QA and UX acceptance plan

This checklist is the user-facing release gate for TP QR. It is intentionally
separate from implementation details: a control is accepted only when a user
can find it, activate it, see feedback, and complete the next step without
guessing.

## Test matrix

| Area | Desktop 1440x900 | Mobile 390x844 / 375x812 | Acceptance signal |
| --- | --- | --- | --- |
| Session | email OTP, refresh, home account, logout | drawer account, logout, protected route redirect | account state is consistent on every page |
| Editor | content, QR preview, style controls, publish proof visible without page scroll | preview first, collapsible content/style, fixed actions | every rendered button has a real action and readable feedback |
| Versions | draft `revision` and published `V<number>` are distinct | same labels remain visible after rotation | publishing increments the published version and survives reload |
| Public content | image, video, audio, file, URL, contact, text | type-specific single-column renderer | only the published payload is shown; no backend chrome |
| Decoder | camera/image/text/vCard/URL handling | camera permission and stream cleanup | unsafe schemes are blocked and TP QR opens the public slug |
| Navigation | active route and heading agree | menu opens, closes, and exposes account actions | no dead links or links that silently return to the home screen |

## Severity

- **P0**: authentication bypass, published content leak, data loss, or a
  release button that cannot publish.
- **P1**: a supported content type cannot complete its lifecycle, a download
  is not a real file, or a mobile action is unreachable.
- **P2**: confusing copy, visual overflow, stale status, or missing feedback.
- **P3**: cosmetic polish that does not block the workflow.

Any P0/P1 failure blocks the PR. P2 failures block release when they affect
discoverability or readability; P3 issues are recorded for a follow-up.

## Automated coverage

The local commands are the source of truth:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run build
npx playwright test tests/browser/qr-editor-layout.spec.ts tests/browser/home-account-visibility.spec.ts --project=chromium --project=mobile
npm run check:opensource
```

The `PR UX QA` GitHub Actions workflow runs this matrix for every pull
request. The regular `CI` workflow remains the full repository gate. Browser
tests start the Worker and Vite independently so a Windows process wrapper
cannot hide a real product failure.

## Manual black-box pass

1. Sign in with email OTP, refresh, return to `/`, and confirm the account is
   shown instead of a login link.
2. Create one text code and one media code. Save, preview, publish, reload,
   and confirm draft `revision` and published `V<number>` are different
   concepts and show current values.
3. Change the style, publish again, and scan the unchanged slug. Confirm the
   public page contains only the selected content type.
4. Repeat at both mobile viewports. Open the menu, use the account card, and
   log out. Confirm protected routes redirect to login.
5. Record browser console errors, 4xx/5xx responses, horizontal overflow, and
   any control that has no visible result. File each issue with viewport,
   route, reproduction steps, expected result, actual result, and severity.
