# UPSTREAM — ghatemplates

Requests and friction for `voxpelli/ghatemplates` — the shared reusable GitHub
Actions workflows this repo's CI consumes (`test.yml`, `ci.yml`, ...).

## Feature Requests

- **Replace the org-only GitHub-native coverage upload with an opt-in Codecov backend** (2026-07-17) —
  `test.yml`'s "Upload coverage report" step uses `actions/upload-code-coverage@v1`
  (GitHub Code Quality's native coverage upload), which is available **only for
  organization-owned repos on GitHub Team / Enterprise Cloud plans**. It returns
  a structural HTTP 404 on every personal-account repo — which is the entire
  ghatemplates consumer base (~60 `voxpelli/*` personal repos), so the upload can
  never succeed for any of them. Requested change: swap the native upload for a
  Codecov step (works for personal + public OSS repos, free for open source),
  kept behind the existing `coverage-file` input so it stays opt-in and a no-op
  for repos that don't set it, and made non-fatal (a `coverage-fail-on-error` /
  `continue-on-error` guard) so a transient Codecov outage never blocks an
  otherwise-green build. Note the KG precedent (`action-codecov-codecov-action`):
  Codecov's own `fail_ci_if_error: false` default silently greens CI on upload
  failure — so prefer a fail-loud default and let repos opt into leniency.
  Origin: the native-coverage step was added 2026-07-11 in PR #39 by
  copilot-swe-agent\[bot]; no consumer had wired `coverage-file` before vp-claude,
  so it surfaced on first adoption. Reference: `actions/upload-code-coverage#16`
  (identical 404 on another personal repo, open/unresolved); GitHub Code Quality
  GA 2026-07-20 stays org-gated.
  Ownership: us · Workaround: full — vp-claude drops the `coverage-*` inputs so
  the step is skipped; the other ~60 consumers are unaffected until they set
  `coverage-file`.

## Bugs

_No entries yet._

## Upstream Opportunities

_No entries yet._
