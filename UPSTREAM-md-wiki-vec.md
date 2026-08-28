# UPSTREAM — md-wiki-vec

Friction found while consuming `@voxpelli/md-wiki-vec` as the read+classify half
of vp-knowledge's link-integrity pipeline. Reciprocal to md-wiki-vec's own
`UPSTREAM-vp-knowledge.md`.

**Provenance convention:** every entry stamps its own measurement basis, because
the vault grows and figures go stale. Where a figure has not been re-derived
since it was written, the entry says so.

> **Trend review — 2026-08-28 (Sprint 47).** All nine open entries resolved by
> **v0.5.0, shipped the same day**, and each was re-verified here against the
> running server rather than against the changelog: the `url_target` bucket, the
> `repair_safety`/`separator`/`candidates` fields on `title_mismatch`, the
> `sample_sources` cap raised 3→20, `excluded_linked` on `suggest_links`, and
> `unsupported_type` separating an unindexed type from a real miss. Resolved
> entries are deleted rather than archived — git history is the record. The file
> stays open because the audit immediately found the defect below recurring.

## Bugs

- **Tool descriptions document a subset of what the tools now return**
  (2026-08-28) \[degraded\] — v0.5.0 resolved the previous instance of this
  (an understated MCP tool count) and reintroduced it in the same release. The
  running server's `graph_lint` description documents four buckets and omits
  `url_target`; it does not mention `repair_safety`, `separator` or `candidates`
  at all, and `suggest_links` omits `excluded_linked` and `unsupported_type`.
  A consumer reading the tool description — which is how an LLM discovers the
  contract — cannot learn that the fields it needs exist.
  Severity: degraded · Ownership: upstream · Workaround: full — call the tool and
  read the response shape, which is what this audit had to do.

- **`schema_report` hard-fails MCP output validation at large `page_size`**
  (2026-08-28) \[blocking, narrow\] — findings can carry a `kind` of
  `relation-prose-fragment`, which ships in the code but is absent from the
  declared output enum, so the response fails validation before reaching the
  caller. Small pages happen to avoid it by not surfacing that finding type.
  Severity: blocking within its trigger · Ownership: upstream · Workaround:
  partial — page smaller, which hides the finding rather than fixing it.

## Feature Requests

_No entries yet._

## Upstream Opportunities

- **Separator-based repair-safety classifier** (2026-07-29) — **Shipped
  natively in v0.5.0**, so the goal is met and the entry is closed. Recorded
  here only for the reciprocation note: md-wiki-vec implemented its own
  classifier rather than adopting vp-knowledge's, which is the right outcome for
  a read-only tool with a determinism posture. The downstream implementation in
  `lib/link-resolution.mjs` remains as the second corpus that validated the
  approach — 1,928 notes then 2,174, no wrong repairs in either.
