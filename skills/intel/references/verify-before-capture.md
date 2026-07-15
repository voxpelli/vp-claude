# Verify Before Capture

Shared by both `/intel` families. Loaded from Step 4 (synthesize).

**Verify before capture (mandatory self-check — not CI-enforced).** This step is
required for the conditions below — not enforced by CI, but the same class of
obligation as the LLM-judgment fourth-wall rules. Unlike the Step 1 freshness
table (enforced by *which sources actually run*), no mechanical gate checks it;
treat that as a reason to self-enforce, not permission to skip. For any note
Step 1 did not put on the fast path — missing,
60+ days old, or a security-sensitive or thin-evidence subject — confirm
load-bearing claims (version, maintainer/owner, license, security posture, and
any "does X" capability claim) against the sources already fetched in this run
before writing. Do NOT make new source calls — Step 1's
freshness tiers deliberately pruned sources; verify against what was fetched. A
wrong note compounds via citation and cross-project reciprocation, so a persisted
claim carries a higher bar than a passing remark. If a claim cannot be confirmed
from this run's sources, weaken it to a capability statement ("designed for X"
rather than "does X") and date-qualify uncertain facts (e.g. "as of the 2026-05
release") — never fabricate; if a fact is unknown, say so or omit it. Routine
refreshes (note under 60 days) skip this step.

**Record contradictions, do not resolve them silently.** When two sources
disagree on a load-bearing fact (version, maintainer, license, behavior), record
both values with their provenance as a `[gotcha]` observation — prefer the more
recent or authoritative source and name which — rather than silently picking
one.

**Confidence scales with source count.** A load-bearing claim backed by only
one source in this run carries lower confidence than the same claim
independently confirmed by 2+ sources. Apply the hedging rule above (capability
phrasing, date-qualified) to single-source claims even when nothing in this
run's sources contradicts them — the absence of a second source is not
confirmation, and a persisted note should not read as more certain than its
evidence supports.

**Genuinely unresolved contradictions.** The "prefer the more recent or
authoritative source and name which" guidance above assumes one source can be
judged more trustworthy. When neither can be — both current, both plausible,
no canonical/official source among them — do not force a pick. Record the
contradiction as still-open in the same `[gotcha]` observation, e.g.
`- [gotcha] Contested: registry says v5.8.5 (fetched 2026-07-03), README badge
says v5.9.0 (undated) — unresolved, neither source clearly more authoritative`.
This flags the fact for a future refresh instead of quietly asserting a
resolution the evidence doesn't support.
