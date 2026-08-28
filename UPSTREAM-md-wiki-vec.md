# UPSTREAM — md-wiki-vec

Friction found while consuming `@voxpelli/md-wiki-vec` as the read+classify half
of vp-knowledge's link-integrity pipeline. Reciprocal to md-wiki-vec's own
`UPSTREAM-vp-knowledge.md`.

**Provenance convention:** every entry stamps its own measurement basis, because
the vault grows and figures go stale. Entries dated 2026-07-29 were measured
against a 1,928-note vault; entries dated 2026-08-28 against 2,174 notes with
`freshness` reporting `in_sync: true` and `mdwv watch` running. Where a figure has
not been re-derived since, the entry says so.

**Settled 2026-08-28 — `missing_target.count` counts SOURCE NOTES, not occurrences.**
This was carried here as an open question because 88 notes write the same wiki-link
twice inside one `## Relations` section, and a repair consumer replacing only the
first occurrence would leave the rest dangling. Measured: `adversarial-review-methodology`
reported `count: 2` across 2 sources while one of those sources
(`doc-reconciliation-after-a-backlog-ships…`) contained the link **three times**. So
`count` is not inflated by duplicates. The practical guard is better than expected —
`edit_note` with `expected_replacements=1` **fails loudly** on such notes (it did,
twice, finding 2 and 3), so a consumer that always passes an expected count cannot
silently half-repair. **Not established:** whether basic-memory itself emits one edge
or N per duplicate occurrence; the repair deltas are consistent with per-source but
that was never isolated.

## Feature Requests

- **`title_mismatch` carries no repair-safety signal, and the residue gets MORE
  dangerous after a cleanup pass** (2026-07-29, re-measured 2026-08-28) — the
  bucket reads as a repair list but is a candidate list. Classify each entry by
  what the candidate adds immediately after the written target and three classes
  fall out: a descriptive separator (` - `, ` — `, `: `) means the same subject and
  is safe; a plain space is mixed and needs review; a bare token continuation names
  a **different entity** and is wrong every time.

  | Class | 2026-07-29 (1,928 notes) | 2026-08-28 (2,174 notes) |
  |---|---|---|
  | Descriptive separator (safe) | 123 (66%) | **7 (13%)** |
  | Plain space (review) | 48 (26%) | **32 (59%)** |
  | Token continuation (**reject**) | 14 (8%) | **15 (28%)** |
  | Bucket total | 185 | **54** |

  **The distribution shift is the point.** The safe class collapsed while the
  graph-corrupting class held flat in absolute terms and nearly quadrupled as a
  share. Whatever drains this bucket drains the *repairable* entries first, so a
  consumer that treats "what is left after a cleanup" as lower-risk is now roughly
  four times more likely to be looking at a wrong one. The 54 figure is the complete
  bucket, not a sample (returned under `limit=100`). *Causation deliberately not
  claimed:* the 2026-07-29 baseline is a month and 246 notes old, and the 58 edges
  repaired on 2026-08-28 do not by themselves account for a 116-entry drop.

  All four originally-cited entries are **still present and unrepaired**:
  `npm-lightningcss` → `npm-lightningcss-cli`, `npm-babel` → `npm-babel-plugin-htm`,
  `npm-resolve` → `npm-resolve-email`, `brew-sdl2` → `brew-sdl2-compat`. The
  clearest example is new: `Inter` → `Interactive Rebase for Branch Splitting —
  GIT_SEQUENCE_EDITOR Workflow`, where the token merges with **no separator
  character at all** ("Inter" + "active"), from the Rasmus Andersson typeface note.

  Length is NOT a usable proxy, and this reproduces exactly across both
  measurements: `WordPress` is 18% of its *correct* candidate while `brew-sdl2` is
  56% of its *wrong* one. Exposing the separator class, or just the matched span,
  would let a consumer act without re-deriving the rule.
  Ownership: shared · Workaround: full — vp-knowledge classifies by separator downstream

- **`title_mismatch` returns only the lexicographically-first candidate**
  (2026-07-29) — `findFirstPrefixExtension` picks the lexicographically-first
  qualifying title and emits no signal that others qualified, so where several
  titles legitimately extend a short-form target the pick is arbitrary and the
  consumer cannot tell an unambiguous match from a coin flip. Returning all
  qualifying candidates, or just a `candidate_count`, would let a consumer route
  the ambiguous ones to review instead of silently applying one.
  **Re-confirmed under load 2026-08-28:** repairing `Flattr — The Full Story: …`
  required checking by hand that three vault titles prefix-match `Flattr`; the
  bucket gave one candidate and no indication a choice had been made. The repair
  was only safe because the target differed from one candidate by exactly a colon.
  *Re-measured 2026-08-28: **11 of 35** distinct targets are multi-sourced (31%),
  against 42 of 113 (37%) on 2026-07-29 — proportionally unchanged, so the
  ambiguity surface is not shrinking with the bucket.*
  Ownership: upstream · Workaround: partial — a consumer can re-scan titles itself, duplicating the match logic

- **`missing_target` mixes structurally-unresolvable URL targets with repairable
  ones** (2026-08-28) — a relation whose target is a raw URL can never resolve:
  no note can carry a URL as its title, permalink or file path. They land in
  `missing_target` indistinguishable from the title-drift entries a one-character
  fix would heal. **The target string reaching the linter carries no brackets** —
  the source line is written bare, as `- cites https://llmstxt.org/`, so an upstream
  fix that matched on `[[…]]` would miss every instance. Detection is a one-line
  predicate on the target (`^https?://`); a separate bucket, or a boolean on the
  entry, would let a consumer route these to "rewrite as a markdown link" instead
  of into the repair queue. Distinct from MISSING-SUBJECT: no note will ever be
  created that resolves them. The cost is not theoretical — a triage pass over
  this bucket classified `https://llmstxt.org/` as REPAIRABLE to
  `llms.txt - LLM-Curated Documentation Index`, which would have made that note
  cite **itself**.
  *Not sized graph-wide. Seven such relations were found by hand across two notes
  (six distinct targets, `cites` the only verb); of those, only the target cited
  by both notes surfaces in the bucket's first 100 entries — the rest carry
  `count: 1`. Entries appear ordered by count descending then lexicographically,
  so a `https://…` target sorts under `h` among ordinary titles and will not be
  found by reading the head of the bucket. Rewriting those seven locally retires
  the instances, not the class.*
  Ownership: upstream · Workaround: partial — a consumer can re-test each target for a URL scheme, duplicating classification that belongs in the linter

- **No way to retrieve every source for a `missing_target` entry** (2026-08-28) —
  entries carry `count` plus `sample_sources`, and the sample is capped at three
  regardless of `count` or of the `limit` argument. The field name is honest, but
  a repair consumer needs the complete list, because healing a dangling target
  means editing *every* source that writes it. Hit twice in one session on
  `count: 4` targets — `Bridgy Fed - Cross-Protocol Bridge` and
  `Matrix Specification` — where the fourth source had to be recovered with a
  separate `basic-memory` full-text search on the target string. That fallback
  only works when the target is distinctive prose; it degrades badly for short or
  punctuation-heavy targets, which are exactly the ones most likely to be
  repairable. `graph_lint` already holds the full list in order to compute
  `count`, so a `sources` array (or a `limit`-respecting opt-in) would close it.
  Ownership: upstream · Workaround: partial — recover the remainder via full-text search on the target string, unreliable for short targets

- **`suggest_links` does not expose the exclusion count that makes its scores
  readable** (2026-08-28) — the tool excludes notes already graph-linked to the
  root, which is correct, but it means **cosine is not comparable across roots of
  different degree**: a 0.66 survivor for a 25-edge hub is far stronger evidence of
  a real gap than 0.66 from an orphan, because 25 nearer candidates were removed
  first. A consumer ranking suggestions across many roots — the natural way to find
  structural holes — silently compares incomparable numbers. `linked` is already
  computed (`src/suggest-links.js:95`), so `excluded_linked: linked.size` alongside
  the existing `skipped_no_vectors` would cost nothing and make every score
  interpretable. Filed as an observation from first heavy use (18 roots swept
  2026-08-28, days after the tool shipped), not a defect.
  Ownership: upstream · Workaround: partial — call `get_context` per root to recover the degree, one extra round-trip per suggestion set

- **An unindexed file type resolves to `not_found`, colliding with a real miss**
  (2026-08-28) — `suggest_links` on
  `Unsafe Shared State in node:test — Quick Reference.canvas` returns
  `not_found: true`. That is literally correct (the key resolves to no *indexed*
  note) but it is indistinguishable from a typo, and the vault does contain such
  files: `bm orphans` lists `.canvas` and `.base` entries as real basic-memory
  entities with no relations, so a consumer cross-referencing that list into
  `suggest_links` gets an unexplained miss. This is the same class the
  `no_vectors` split already solved — that commit's own reasoning was that a
  resolvable-but-unusable note is "a diagnosable anomaly, not a missing key". An
  unindexed *file type* is a fourth case of exactly that kind; a distinct reason
  (`unsupported_type`), or a documented corpus boundary, would close it.
  Ownership: upstream · Workaround: full — filter the candidate list to `.md` before calling

## Bugs

- **MCP tool count is understated in two places, and the newest tool is in
  neither** (2026-08-28) \[minor\] — `src/mcp/tools.js:94` exports `TOOL_NAMES`
  with **ten** entries (search, get_by_permalink, list_tags, get_context,
  schema_report, describe_schema, graph_lint, semantic_diff, **suggest_links**,
  freshness). But `bin/mdwv-mcp.js`'s header comment says "Exposes seven
  read-only tools" and lists seven, and `README.md:176` says "Nine tools, all
  read-only". Neither document mentions `suggest_links` at all. It matters more
  than a typo because the binary header is where you look when wiring an MCP
  host, and the two documents disagree with each other as well as with the code —
  so there is no authority to fall back on short of reading `TOOL_NAMES`.
  *Supersedes the 2026-07-29 filing of this entry, which reported a two-tool
  undercount against a nine-tool surface; `suggest_links` has since widened it.*
  Severity: minor · Ownership: upstream · Workaround: full — read `src/mcp/tools.js` `TOOL_NAMES`, the only current source

- **`schema_report` proposes prose fragments as relation verbs** (2026-08-18,
  re-verified 2026-08-28 against a fresh index) \[minor\] — a line inside a note's
  `## Relations` section that is really an observation (`- [category] …`) or a
  markdown link, and that carries an inline `[[Target]]`, is emitted as a relation
  whose *verb* is the entire preceding prose, split at `[[`. Emitted verbs get no
  shape validation, so a proposal list the consumer is invited to act on can contain
  multi-sentence prose.

  **Re-verified with no stale-cache excuse remaining:** `freshness` reports
  `in_sync: true` at 2174/2174 with `check_content: true`. `schema_report` returns
  6,170 findings (`errors: 0, warnings: 6060, suggestions: 110`) over 2,151 notes,
  `exit_would_fail: false`. The `proposals` array is corpus-wide and unpaginated, so
  entity-type coverage below is complete.

  **Still reproduces, across four entity types — wider than originally filed:**

  | Entity | Proposed relation verb |
  |---|---|
  | `brew_formula` | `Docs:` · `GitHub:` · `Option reference:` · `maintained_by Astral (now part of OpenAI Codex team, 2025-11) — see` |
  | `brew_formula` | ~15 more: `Config reference:`, `Rules reference:`, `Versioning policy:`, `ffmpeg filters:`, `clickable hyperlinks work natively in`, `runtime dep of`, … |
  | `concept` | `cites DCC Curation Lifecycle Model (Higgins 2008,` · `cites Hypocognition research (Kaidi Wu,` |
  | `npm_package` | `author: Sindre Sorhus (same as` · `authored_by same maintainer as` |

  The `brew_formula` entries are confirmed as live findings, not stale proposal
  artifacts — page-1 raw findings carry `unknown relation 'Docs:' (not in schema
  'brew_formula')` and the same for `GitHub:` and `Option reference:`.

  **No longer reproduces:** the originally-quoted `engineering.add_relation`
  ~1,000-character proposal beginning `"[heuristic] Concrete termination rule for
  multi-round agent audit cycles: …"`. That entity's ~130 `add_relation` proposals
  are now all clean snake_case verbs — the source note was repaired downstream, so
  that example is spent. The defect is not: it simply moved entity types.

  **Deliberately not claimed:** whether classifying by section position rather than
  by the `- [category]` marker is intentional. Basic Memory, parsing the identical
  bytes, classifies such a line as an observation (`schema_validate` →
  `unmatched_observations`) and emits no relation at all — the two parsers disagree
  on one input, with BM the reference for the corpus mdwv indexes. Source notes for
  the new `concept` / `npm_package` instances were not located (the proposal array
  identifies the entity type, not the note).

  A length/shape filter on `add_relation` would make the bucket safe to read without
  re-deriving it downstream.
  Severity: minor · Ownership: upstream · Workaround: full — cross-check any relation finding against
  `mcp__basic-memory__schema_validate` on the live note before acting

## Upstream Opportunities

- **Separator-based repair-safety classifier** (2026-07-29) — vp-knowledge
  derives a three-way safety class for every `title_mismatch` entry by looking
  at what the candidate title adds after the written target: a descriptive
  separator (safe to apply), a plain space (needs review), or a bare token
  continuation (reject). The rule is deterministic, cheap, and explainable in a
  report, which fits md-wiki-vec's determinism posture; it would slot into
  `graph-lint.js` beside the existing bucket classification without touching the
  read-only contract.
  **Validated on a second corpus 2026-08-28.** Originally measured on 1,928 notes
  (123 correct repairs separated from 14 graph-corrupting ones, no false negatives
  in the sampled set). Re-applied on 2,174 notes across a ~98-target triage, it
  again produced no wrong repairs: 15 applied repairs all resolved, verified by
  `unresolved_total` moving by exactly the predicted amount in every batch. Two
  targets were correctly *withheld* by the multi-candidate rule that accompanies
  it. Two independent corpora is the strongest argument for upstreaming it.
  Source: docs/design/bm-index-findings-2026-07-29.md, docs/design/link-integrity-sweep-2026-08-28.md · Merge readiness: needs-redesign
  Ownership: us · Workaround: full — implemented downstream in the repair pass
