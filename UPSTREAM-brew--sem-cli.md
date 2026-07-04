## Feature Requests

_No entries yet._

## Bugs

- **`sem_impact` mode=dependents misses a real cross-file caller** (2026-07-04) \[degraded\] — `sem_impact(file_path="lib/bm-version-extract.mjs", entity_name="extractBmVersion", mode="dependents")` returns "no dependents" in 64ms, and still returns "no dependents" in 246ms after re-running with `no_default_excludes=true`. But `scripts/check-bm-version-extract.mjs` genuinely `import`s and calls `extractBmVersion` at 5+ call sites (verified directly via `grep -n extractBmVersion scripts/check-bm-version-extract.mjs`). The false negative is silent and confident — nothing in the response distinguishes it from a true "nothing calls this," which is the dangerous failure mode for a cross-file impact tool.
  Severity: degraded · Ownership: upstream · Workaround: partial — cross-check any load-bearing `sem_impact` "no dependents"/"no callers" result with a plain grep before trusting it as an absence-of-callers signal; do not treat a confident negative as verified.

## Upstream Opportunities

_No entries yet._
