# Synergy: md-wiki-vec

Cross-project patterns, divergences, and capability gaps between **vp-knowledge**
(this project) and **md-wiki-vec** — a clean-room, git-committable hybrid
search index for the same Basic Memory / Obsidian markdown vault. Relationship:
`shared-tooling`. md-wiki-vec consumes BM's markdown conventions as a documented
data format, so the load-bearing question is whether it reproduces BM's parser/sync
bugs; as of 2026-07-15 it **structurally avoids all six** verified this session.

**License contrast — matters more than usual.** Basic Memory is
**AGPL-3.0-or-later** (strong copyleft; confirmed from its dist-info this session).
md-wiki-vec's license is **NOT yet finalized (as of 2026-07-15)** — the repo
currently declares MIT (`package.json` `license`, `LICENSE`) but could become MIT,
BSL (Business Source License), or another model. The two coexist today ONLY because
md-wiki-vec is a **clean-room** implementation: it copies no BM source and consumes
BM's markdown conventions solely as a documented data format (facts/format are not
copyrightable; BM's AGPL binds only BM's own code), so it is not bound by BM's
copyleft and stays free to pick its own license. That boundary is load-bearing:
(1) it must stay intact — pulling AGPL BM source into md-wiki-vec (or vice-versa)
would collapse the independence and force AGPL across; (2) the Extraction Candidate
below is gated by BOTH licenses — an AGPL-derived shared package is a very different
thing from an MIT/BSL one. Re-verify before acting.

## Shared Patterns

- **Both consume BM's markdown note conventions as the data contract** (2026-07-15) — frontmatter + `## Observations`/`## Relations` + `[category]` observations + `[[wiki-link]]` relations + picoschema `schema/<type>.md`. md-wiki-vec is a clean-room reimplementation of BM's picoschema validation (`mdwv validate`); vp-knowledge ships the schema source-of-truth (`schemas/`). Drift risk: a BM/vp-knowledge convention or schema change must be tracked by md-wiki-vec's parser, or the two indexes diverge on the same corpus.
  Status: aligned · Last verified: 2026-07-15
- **Atomic write-to-temp + rename for sidecar/index files** (2026-07-15) — both use the write-`.tmp`-then-`rename()` atomic-replace pattern (md-wiki-vec `sidecar.js`/`manifest.js`; BM `file_utils.write_file_atomic`). Note the shared caveat: this pattern bumps the OS inode `ctime` on every write — harmless for md-wiki-vec (it never reads `ctime`; see Divergences) but the root of BM's `created_at`-reset bug.
  Status: aligned · Last verified: 2026-07-15

## Divergences

- **Parsing model: structured MDAST + section-scoping vs BM's flatten-then-regex** (2026-07-15) — md-wiki-vec reads `[category]`/`#tag`/`(context)` grammar only from *plain* inline segments under the matching heading, structurally avoiding four BM parser bugs verified this session: silent drop of link-bearing observations (BM's over-matching `is_observation` regex), unscoped `[[wiki-link]]` extraction from prose/code, prose-leaking-into-`relation_type`, and fenced-code over-extraction. Documented as intentional in the parser's own header comment.
  Convergence path: accept-difference · Ownership: shared
- **Timestamps from git history, not filesystem `ctime`** (2026-07-15) — md-wiki-vec derives all temporal/authorship semantics from git commit history (`git-index.js` `revListForPath`), never from `os.stat` ctime/mtime, avoiding BM's `created_at`-resets-to-edit-time bug. It performs the same atomic temp+rename writes as BM but never reads `ctime`, so the shared mechanism is inert here — structurally immune, not lucky.
  Convergence path: accept-difference (git is the correct authority for a committable index) · Ownership: shared
- **Wiki-link resolution honors `aliases:` + descriptive titles** (2026-07-15) — `[[bare name]]` resolves against a note's `aliases:` frontmatter and exact `title` (measured: 7636/7639 edges resolved via the title tier on the real vault), closing BM's LinkResolver ~9%-of-edges gap (the same gap tracked in `UPSTREAM-basic-memory.md`). Colon-in-title (`npm:fastify`) also resolves via the title tier verbatim, sidestepping BM's filename-safety problem entirely.
  Convergence path: accept-difference · Ownership: shared
- **Reverse divergence — nested subheadings under `## Relations`/`## Observations` are missed** (2026-07-15) — because the fix is strict per-heading section-scoping, a `### subheading` nested inside a Relations/Observations block exits the section and its content is reclassified as ordinary body prose (those relations/observations drop from the graph), whereas BM's unscoped parser still captures them. On a vault using nested relation/observation subheadings the two indexes **disagree**. Watch item: avoid nested subheadings under `## Relations`/`## Observations` in authored notes, or md-wiki-vec should extend scoping to descend into subheadings. (Minor sibling divergences also exist: ambiguous-title tiebreak, malformed-relation-line skipping, duplicate-chunk-id collapse.)
  Convergence path: propose-shared · Ownership: shared
- **Licensing & clean-room independence — AGPL vs undecided-permissive** (2026-07-15) — Basic Memory is **AGPL-3.0-or-later** (strong copyleft); md-wiki-vec's license is undecided (currently MIT, possibly BSL or another model — see the license note in the header). md-wiki-vec is a deliberate clean-room reimplementation: no BM source is copied, and it consumes BM's markdown conventions only as an uncopyrightable documented data format, so it is not bound by BM's AGPL and stays free to choose its own license. The clean data-format boundary is load-bearing — pulling AGPL BM source across it would collapse md-wiki-vec's independence and force AGPL onto it. Aligns with the lock-in-resistance tenet: separate licenses held apart by a conventions-only boundary is what preserves independent evolution.
  Convergence path: accept-difference (intentional license/governance divergence; keep the clean-room boundary intact) · Ownership: shared

## Extraction Candidates

- **Picoschema definitions as a shared versioned contract** (2026-07-15) — vp-knowledge's `schemas/<type>.md` are the source-of-truth that md-wiki-vec independently reimplements validation against (`src/schema.js`, `src/schema-usage.js`). The schema set is a candidate for a shared, versioned package both consume rather than duplicating the validation logic. Lower priority — the data contract is already shared via the notes themselves; only the validator logic is duplicated. **Blocked-on:** md-wiki-vec's undecided license (see header) — MIT would permit a permissively-licensed shared package; a BSL or other outcome would constrain what can be shared and how.
  Readiness: proof-of-concept · Effort: significant · Ownership: shared

## They Have / We Don't

- **Deterministic graph-lint / unresolved-edge classification** (2026-07-15) — `mdwv graph-lint` (`src/graph-lint.js`) buckets every unresolved edge into `phantom_edge` / `title_mismatch` / `schema_template_noise` / `missing_target` by precedence rule. vp-knowledge's knowledge-gardener reimplements exactly this classification ad-hoc (SQL + heuristics over the BM index) — it has the underlying need and could adopt md-wiki-vec's deterministic classifier instead of re-deriving the discriminator each audit.
  Priority: adopt-soon · Effort: moderate
- **Committable index as a bulk-metadata-projection source** (2026-07-15) — md-wiki-vec materializes per-note metadata in a git-committable index; vp-knowledge's `/knowledge-gaps --stale` currently does O(N) `read_note` round-trips per cohort — the exact "No bulk metadata extraction" feature request already logged in `UPSTREAM-basic-memory.md`. Querying md-wiki-vec's index (or its manifest) could replace the per-note fan-out.
  Priority: adopt-soon · Effort: moderate
