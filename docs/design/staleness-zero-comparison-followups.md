# `--stale` zero-comparison false-clean — deferred siblings

Surfaced by the 6-reviewer cross-pollination gauntlet on 0.33.4 (commit for the
range-pin fix folded into the `--sample` preflight commit). The **range-pin**
channel of the zero-comparison false-clean was fixed in that commit (S5 now keys
"all current" on notes-*compared*, not S1 survivors). Two sibling gaps of an
adjacent-but-distinct shape were **deliberately deferred** — they exit the
workflow at different points and do not share the range-pin fix's single-edit
shape. Recorded here because `bd` is write-locked (v1.1.0 migration bug), so a
bead can't be filed yet; convert to beads when `bd` writes are restored.

## 1. All-`@types/*` cohort misreports existence (MEDIUM)

**Symptom:** an npm cohort where *every* note is `@types/*` collapses to an empty
filtered list at S1 (the `@types/*` filter is unconditional and runs *before* the
survivor count), so it hits the S1 empty-cohort skip — "No `<prefix>` notes
documented … nothing to check" (single-eco) or a silent skip (bare `--stale`).
That misreports `M ≥ 1` documented notes as `M = 0` ("nothing documented").

**Why it's NOT the range-pin bug:** it exits at S1's empty-list branch, never
reaching S5's "all current" — so it is a *milder existence-misreport*, not a
false clean-of-drift. Distinct exit point, distinct symptom.

**Fix shape:** a small S1 edit distinguishing "filtered list empty because all
survivors were `@types/*`-excluded" (render "0 of M checked — all M excluded as
`@types/*`, which track their target by design") from "empty because nothing is
documented" (`M = 0`). One location, no new mechanism.

## 2. `recent_activity` / `list_directory` error-vs-empty conflation (MEDIUM)

**Symptom:** the `--since` mechanism paginates `recent_activity` "until a page
returns fewer items than `page_size` **or an empty result**" — with no handling
for a mid-pagination *error*. A failed page that surfaces as empty/short
terminates pagination early → a partial active-titles set → over-inclusion in the
survivor set (fail-*safe* for the false-clean axis, but silently produces
false-*positive* drift and corrupts the S8 "N checked out of M" accounting).
Symmetrically, a transient `list_directory` failure returning empty is
indistinguishable from "genuinely no notes" and routes a whole cohort into the
S1 silent skip — 122 brew notes could vanish from an otherwise-clean report with
zero trace.

**Why it's a separate class:** this is *error-vs-empty* (a tool/API failure
masquerading as legitimate emptiness), not "notes existed but none compared." It
needs error-detection at the tool-call sites (`recent_activity`, `list_directory`),
a different mechanism from the comparison-count guard.

**Fix shape:** distinguish a tool-call failure from a legitimate empty result at
each call site, and surface "enumeration failed — cohort not checked" rather than
folding it into the empty/all-current paths. Larger review surface than item 1.

## Provenance

Cross-pollinated review of the 0.33.4 `--sample` preflight commit: silent-failure
reviewer (root traces + subsumption analysis), logic reviewer (S1/S5 line trace),
adversarial reviewer (confirmed the bug *class* is not fully closed by the
range-pin fix). All three agreed these two are legitimately follow-up, not
fold-in: different exit points, no shared smallest-edit, and (for item 2) a new
error-detection mechanism beyond the reviewed commit's scope.
