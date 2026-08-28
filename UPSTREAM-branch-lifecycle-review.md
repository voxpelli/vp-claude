# UPSTREAM — branch-lifecycle-review

Friction observed while running the `branch-lifecycle-review` skill/workflow
against this repo (first run: 2026-07-17, `voxpelli/wave3-skill-consolidation`,
size `s`). Overall the run was high-value — it correctly picked `origin/main`
as the base (full 41-commit stack), found two real major defects the CI gate
suite structurally cannot catch (README analytics regression; Pi advisory tool
names), verified its own novelty bets against primary sources (pi-coding-agent
0.80.7 runtime, DeepWiki, skills.sh CLI), kept honest three-state discipline,
and correctly skipped a duplicate Basic Memory capture. The items below are
the rough edges worth fixing.

## Feature Requests

_No entries yet._

> **Trend review — 2026-08-28 (Sprint 47).** Both feature requests resolved:
> `size` cost is now documented with two data points, and the `today`
> requirement is stated in `whenToUse` and hard-fails without it.

## Bugs

- **Verified findings never leave the `unverified` result array** (2026-07-17)
  \[degraded\] — The structured result reported `confirmed: []`,
  `inconclusive: []`, and all 8 raw findings in `unverified`, while `counts`
  reclassified them as "6 confirmed (2 major, 3 minor, 1 nit) · 1 inconclusive ·
  1 unverified", the SWOT prose marked the six "verified against disk this run",
  and the HTML dashboard rendered them correctly under "Confirmed findings"
  (C1–C6). So the verify/SWOT pass reclassifies findings in the counts, prose,
  and dashboard but never promotes them out of the `unverified` bucket in the
  returned object. A consumer reading `result.confirmed` programmatically gets
  nothing while every human-facing surface says six were confirmed. Expected: a
  finding the verify pass confirms appears in `result.confirmed`.
  Severity: degraded · Ownership: upstream · Workaround: partial — read the
  SWOT/counts/dashboard, not the raw `confirmed`/`unverified` arrays, for the
  true confirmed set.

## Upstream Opportunities

_No entries yet._
