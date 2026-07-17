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

- **Bound or document `size` cost on large diffs** (2026-07-17) — A `size: "s"`
  run over a 41-commit / 132-file branch spawned 21 agents, ~2M subagent tokens,
  ~25 min. "Small" did not bound total spend the way the label implies — `size`
  appears to scale review depth per cluster, not the agent/token ceiling, so a
  large diff at `s` is still a heavy run. Either cap total agents/tokens by
  size, or document that `size` controls depth (not total cost) so a caller can
  gauge spend before launching a big-diff review.
  Ownership: upstream · Workaround: partial — narrow the base range to shrink
  the diff.

- **Document that `today` must be supplied by the orchestrator** (2026-07-17) —
  `today` is a required arg, but workflow scripts cannot call `Date` (blocked in
  the sandbox), so the orchestrator must inject it. The skill's own invoke hint
  shows `args: "s"` (size only), which omits `today` and would fail the
  required-arg contract if pasted literally. Document the requirement, or resolve
  `today` at the orchestrator boundary automatically.
  Ownership: upstream · Workaround: full — pass `{today: "YYYY-MM-DD", size:
  "s"}` explicitly.

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
