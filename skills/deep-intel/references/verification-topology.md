# Verification topology

The verification layer runs **only on the claims that will be persisted** — the
draft note's `## Observations`, not the full research firehose. A persisted claim
carries a higher bar than a passing remark, so the rigor goes where it lands. The
runnable implementation is the Verify/Critic/Finalize phases in
`research-workflow.md`; this file is the **contract** — the stakes model, the
typed verdict shape, and the portable INPUT/OUTPUT so the same block can later
become a shared `--verify` flag on package/people/tool-intel.

## Stakes assignment (claim-type-first, total)

Every candidate observation gets a stake tier. `claim_type` is **required** —
default an unclassifiable claim to `other` → MEDIUM (never silently LOW/skip):

- **HIGH** — a date, number, version, named attribution, license, security
  posture, or a load-bearing "does-X" capability other notes will cite.
- **MEDIUM** — architecture, adoption, mechanism, compatibility, or `other`.
- **LOW** — soft characterization / framing colour.

Modifiers (compose as floor + saturating bump, order-independent):

- The research engine's confidence `< 0.7` → bump up one tier (saturating:
  `min(HIGH, tier + 1)` — there is nothing above HIGH).
- A claim that collides with a contradiction the graph read flagged → set to HIGH
  (a floor) and mark `internal_conflict`.

## Per-tier choreography (waves of ≤ ceiling)

- **HIGH** — one pair per claim: an **adversarial** agent told to find a
  *contradicting* source **with the claim's own sources withheld** (forces
  falsification, not confirmation), and a **non-adversarial** agent that
  independently confirms. Agree → settled; disagree → a 3rd **judge** reads both
  sides' cited sources and decides; still unresolved → **DISPUTED**.
- **MEDIUM** — a batched adversarial + non-adversarial pair over the whole medium
  set (not one pair per claim).
- **LOW** — a single pair over the whole low set.
- **MACRO** — a dedicated pair over the *draft note as a whole*: is the framing
  accurate, does it cohere, what load-bearing fact is missing?

Launch each tier as its own wave and keep concurrent launches under the ceiling
(passed in as `concurrency_ceiling`; batch HIGH claims if they exceed it). A wave
where more than a small fraction of agents return null is **throttle-suspected** —
surface it as incomplete, never let it silently settle claims.

## The adversarial outcome is three-state (never a boolean)

An adversarial agent returns one of `CONTRADICTED | CORROBORATED |
NO_EVIDENCE_FOUND`. `NO_EVIDENCE_FOUND` (failure to find a contradiction with
sources withheld) is **not** confirmation — it is weak evidence. It may settle a
claim only when the non-adversarial agent independently `CORROBORATED` it.
Collapsing "no evidence" into "confirmed" is the exact false-confidence failure
this topology exists to prevent.

## Verdict OUTPUT contract — a discriminated union (illegal states unrepresentable)

Each verdict discriminates on `verdict`; encode in JSON Schema with
`oneOf` + `const` + `if/then` so a subagent literally cannot emit an illegal
combination:

- `verdict: "confirmed"` → `disposition ∈ {write-as-is, write-hedged}`.
- `verdict: "refuted"` → `disposition` is `const "drop"` (a refuted claim is
  never written — the strongest safety property here).
- `verdict: "disputed"` → `disposition ∈ {write-hedged, drop}` (**never**
  `write-as-is` — a claim that could not be settled is never asserted as fact).
- `disposition: "write-hedged"` → `hedged_text` is required, non-empty.
- `disposition ∈ {write-as-is, drop}` → `hedged_text` is null.
- A `resolution` tag (`unanimous | judge-resolved | judge-failed`) gates `judge`
  presence: `judge` is present **iff** the pair disagreed (`judge-resolved` or
  `judge-failed`); `disputed` ⇒ `judge-failed`.
- A null/absent agent return → `verdict: "incomplete"` (never a silent settle).
- An adversarial `CONTRADICTED` must carry its `source` + `quote` (an
  unfalsifiable refutation is rejected).

## Disposition → write

- `write-as-is` → a firm `[category]` observation, eligible for the
  "multi-source cross-checked" label.
- `write-hedged` → the `hedged_text` (a softened statement, or a `[gotcha]` /
  `[controversy]`-on-person observation recording both values + provenances for a
  DISPUTED claim). DISPUTED items are surfaced in the pre-write gate, never
  silently resolved.
- `drop` → not written; listed in the report so the user sees what was refuted.

## Completeness critic (one capped wave)

After verification, a critic agent reads the verified draft + the type's schema
fields and asks "what load-bearing fact is missing for a `<type>` note?" A real
gap triggers **at most one** targeted second research wave (narrow
search/fetch/verify on the gap), then re-synthesis. Cap at one iteration so the
worst-case cost stays bounded and knowable at the pre-spend gate.

## Portable block (for a future shared `--verify` flag)

The block is defined by its boundary so it lifts cleanly into the other intel
skills (which re-implement it inline; the contract is shared, not the code):

- **INPUT** `{ claims: [{ id, text, sources, claim_type, engine_confidence,
  internal_conflict }], macro: { note_draft } | null, concurrency_ceiling }`
  (no `stakes_hint` — stakes are derived, not an input; a single source of truth).
- **OUTPUT** `{ verdicts: [{ id, verdict, stakes_used, adversarial,
  nonadversarial, judge | null, resolution, disposition, hedged_text | null }],
  macro_verdict, stats }`.

## Labeling

Per-observation provenance, not a blanket banner: only a claim settled via a
non-null, CORROBORATED pair earns "multi-source cross-checked". LOW / `--quick` /
`incomplete` / `NO_EVIDENCE_FOUND`-only claims are visibly hedged and excluded.
Never "fact-checked" — that asserts a correctness guarantee no automated layer
can back until a calibration fixture measures its false-confirm rate.
