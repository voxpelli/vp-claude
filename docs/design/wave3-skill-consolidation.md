# Wave 3 skill consolidation 16 → 14 — Design record (0.33.0, breaking)

**Date:** 2026-07-15 · **Status:** APPROVED, in implementation · **Architecture:**
shared-core-two-families (`/intel`) + mode-routed merge (`/nudge`)

Provenance: produced by a 10-agent ultracode workflow (`wf_fc214e12-2d9`) — 5 Sonnet recon →
3 Opus design approaches → Opus synthesis → Opus adversarial critique. The full agent result
corpus lives in the session journal at
`…/subagents/workflows/wf_fc214e12-2d9/journal.jsonl` (re-extract the design with
`jq -r 'select(.result.recommendedApproach).result.finalDesign'`, the critique with
`jq -c 'select(.result.verdict).result'`). This document is the durable in-repo copy of both,
so the design survives independently of the session journal. The living execution plan is
`~/.claude/plans/quirky-squishing-kitten.md`.

## Why this merge is worth the risk

`package-intel` and `tool-intel` already share `upgrade-haul.md`, `forge-fallback.md`, and a
(drifted) `gh-api-fallback.md`, plus ~255 lines of duplicated Basic-Memory mechanics that have to
be kept "in lockstep" by hand. Drift has already happened — the tool copy of `gh-api-fallback.md`
silently dropped a RETRO-19 citation. The merge deletes that duplication. It also collapses the 4
cross-skill `${CLAUDE_PLUGIN_ROOT}` references that `check:portability` tracks into same-skill
references, clearing standalone-skills.sh portability debt (the deferred D5 intent from 0.32.7).

## Decisions (user sign-off, 2026-07-15)

1. **Hard rename, NO alias** — `/package-intel`, `/tool-intel`, `/nudge-sync`, `/nudge-adoption`
   all disappear (Claude Code has no skill-alias mechanism; a wrapper defeats 16→14).
2. **One 0.33.0, `/intel` first** then `/nudge` (the critique preferred nudge-first as a lower-risk
   warm-up; proceeding intel-first per the user).
3. **Retire `docs/design/tool-intel-next-gen.md`** with a recorded revival trigger (its whole
   premise is the two skills staying separate).
4. **`/nudge` = `disable-model-invocation: true`** (explicit `/nudge` / `/nudge check` only).

---

# Final design (verbatim from the workflow synthesis)

The section below is the synthesized design as produced by the workflow, preserved faithfully.

## Grounding facts (verified on disk 2026-07-15)

package-intel 644 / tool-intel 789 / nudge-sync 107 / nudge-adoption 465 body lines; descriptions
692 / 931 / 535 / 811 chars; the two `gh-api-fallback.md` files are genuinely divergent (5921 vs
7481 bytes); nudge-adoption has NO `references/` dir (only
`nudge-sync/references/tip-cache-contract.md` exists).

## Part A — `/intel` (shared-core, two families)

### A.1 Dispatch model

One `/intel` skill. Step 0 parses the leading `<prefix>:` token and routes on a provably disjoint
14-row union table (npm/crate/go/composer/pypi/gem vs brew/cask/action/docker/vscode/gh/plugin/skill
— verified no prefix appears in both, so the union has zero collisions). The prefix ALONE selects a
`FAMILY` value (`package` | `tool`), set ONCE and read at each divergent point; never re-derived.

- No prefix / bare name → default `package` family + package-intel's existing project-context
  inference (package.json/Cargo.toml/go.mod/composer.json/pyproject.toml/Gemfile). A bare *tool* name
  is disambiguated INSIDE the tool batch adapter's formula-vs-cask auto-routing — not hoisted to Step 0.
- Unknown prefix → error, print the 14-row table.

The body is a shared 7-step skeleton. It branches exactly once, at Step 3 (enrichment):
`FAMILY=package → load+follow references/enrichment-package.md; FAMILY=tool →
references/enrichment-tool.md`. Steps 0/1/2/4/5/6/7 are family-agnostic, parameterized only by the
routing row (BM directory, note-type, ecosystem-ref, note-template-ref, source-count). Each family's
distinct source roster stays intact in its own file — never flattened into a generic loop. This is
the primary anti-capability-loss guard.

Per-token batch routing: a single `/intel` call may MIX families (`npm:fastify brew:ripgrep cask:warp`)
and route each token by its own prefix — a capability GAIN over today's forced two-Skill-call split.

### A.2 SKILL.md body skeleton (target ≤420; lands ~284)

Frontmatter is NOT counted toward the 500-line body budget.

- **Frontmatter** (0 body lines) — `name: intel`; `argument-hint: "<prefix>:<name>"`; rewritten
  `description` ≤1024 chars (naive concat 692+931=1623 is 59% over — REWRITE, do not concat: one
  lifecycle spine + a trimmed union of highest-value per-family trigger phrases + the 14-prefix
  enumeration; drop the duplicated "post-write cross-linking" tail both repeat). `allowed-tools` =
  UNION of both (adds Context7 + Socket depscore + Homebrew MCP `info` to the shared
  Bash/Read/6×BM/DeepWiki/2×Tavily/2×Raindrop/2×Readwise set).
- **1. Intro + one-workflow framing** (~14) — "one research lifecycle (detect → check → resolve →
  enrich → synthesize → write → cross-link), routed per-ecosystem via the table below; the two
  families share every step except enrichment." The unifying axis is the shared BM-note lifecycle,
  NOT sourcing mechanics.
- **2. Arguments** (~36; realistically 40–50) — union 14-row table (columns: prefix | family | BM dir
  | note-type | ecosystem-<x>.md | note-template-<x>.md), per-prefix identifier normalization
  (action strips @version, docker strips :tag, vscode dot-separated, gh/plugin/skill strip github URL
  and validate owner/repo with optional #name; package prefixes pass through), and backward-compat
  (no-prefix=npm, scoped-npm=npm).
- **3. Step 0: Detect ecosystem & family** (~30) — prefix parse → FAMILY partition → routing-row
  lookup; no-prefix project-context inference; colon/slash→hyphen title convention with 2 worked
  examples (one-line pointer to CLAUDE.md Prefix Convention); third-party-tap slash-counting reduced
  to a one-line pointer into ecosystem-brew.md.
- **4. Batch mode: upgrade haul** (~24) — detect multi-operand paste → route each operand by prefix →
  load shared `references/upgrade-haul.md` (relocated); tool family → pointer to
  `references/upgrade-haul-adapter-tool.md`; package family Axis-B target = `## Release Highlights`
  (inline one-liner). Keep the DIRECT 1-level link to upgrade-haul.md.
- **5. Step 1: Check for existing note** (~24) — `list_directory` existence glob + compact
  freshness-tier matrix (full / 60-180d / <60d source-skip), source-count as a per-family value
  (package 7, tool 6); pointer to `references/note-lookup-and-freshness.md`.
- **6. Step 2: Resolve repository / forge detection** (~20) — load the routing row's ecosystem-<x>.md
  directly; forge host-parse table + DIRECT pointer to `references/forge-fallback.md`;
  popularity/downloads pre-fetch.
- **7. Step 3: Family enrichment — THE SINGLE BRANCH** (~36) — "package → load+follow
  enrichment-package.md; tool → enrichment-tool.md." PLUS an inline shared note listing the 5 sources
  common to both (DeepWiki, Tavily, Raindrop, Readwise, changelog) AND an explicit design invariant:
  per-ecosystem skip/run conditionals (DeepWiki skip for brew/cask; man-page brew/cask only; Open VSX
  vscode only; Context7 package-only; Socket npm/pypi/cargo/gem-only) are OWNED as explicit
  per-ecosystem gates inside each family file — NEVER collapsed into a generic loop.
- **8. Step 4: Synthesize into note** (~34) — 14-row note-template table lookup + observation
  conventions (`[version]` mandatory, `[popularity]` omit for pypi/go, `[security]`) + header-pipe
  format + no-wiki-links-in-observations rule; DIRECT pointer to `references/verify-before-capture.md`.
- **9. Step 5: Write or update the note** (~24) — 5-row note-state summary (new / relocated-stub /
  existing) + DIRECT pointer to `references/note-write-mechanics.md`.
- **10. Step 6: Confirm and summarize** (~12) — bullet list (family/note location, key findings,
  security/analytics concerns, cross-links); the one family-conditional bullet inline.
- **11. Step 7: Cross-link existing notes** (~18) — short spine (search_notes → per-result Relations
  check → add relates_to) + DIRECT pointer to `references/cross-link-existing-notes.md`.
- **12. References index / See also** (~12) — enumerate all referenced files so every one is
  1-level-deep reachable from the body (Anthropic one-level-deep rule).

Sum: 14+36+30+24+24+20+36+34+24+12+18+12 = **284 lines**.

### A.3 Extraction plan into `skills/intel/references/`

New shared/family files (all moves are VERBATIM copy-paste, never paraphrase; source line-ranges are
from the recon — verify against disk before cutting):

1. `enrichment-package.md` (NEW ~150, from pkg Step 3 L213-361) — full 7-source package pipeline:
   DeepWiki (+hallucination/indexing caveats), Context7 (npm-bias, resolve-library-id), Tavily
   (per-ecosystem advisory table), Raindrop, changelog (delegates to shared gh-api-fallback +
   forge-fallback), Readwise, Socket depscore (crate→cargo token remap, npm/pypi/cargo/gem-only). Skip/run
   kept as explicit per-ecosystem gates. Add a ToC + "read IN FULL" header.
2. `enrichment-tool.md` (NEW ~166, from tool Step 3 L377-543 incl. the ~65-line man-page block) — full
   6-source tool pipeline: DeepWiki (action/docker + conditional gh), Tavily (per-prefix query table),
   Raindrop, changelog (+release-list-staleness sub-block), Readwise, local man-page (session
   toolchain guard, `man -P cat | col -bx | head -300`, empty=skip), Homebrew MCP install-analytics,
   Open VSX trust-signal pointer. Skip/run as explicit gates. Add ToC + "read IN FULL" header.
3. `note-lookup-and-freshness.md` (NEW shared, ~60, DEDUP pkg Step 1 L154-186 + tool Step 1 L298-357)
   — existence glob, read_note freshness check, append-don't-overwrite, audit-context stale-handling
   branch. Parameterized by source-count. Diff the two current copies before collapsing.
4. `verify-before-capture.md` (NEW shared, ~40, DEDUP pkg L413-454 + tool L599-640). Diff first;
   people-intel L224 carries a "shaped variant" comment to repoint.
5. `note-write-mechanics.md` (NEW shared, ~135, DEDUP pkg Step 5 L455-554 + tool Step 5 L641-737) —
   relocated-stub recovery, note-state update table, two edit_note find_replace templates,
   never-append-with-section=Observations rule, 40KB fallback, schema_validate trust rule. Single
   largest dedup (~90 lines from EACH body).
6. `cross-link-existing-notes.md` (NEW shared, ~82, DEDUP pkg Step 7 L564-645 + tool Step 7 L747-790)
   — search_notes discovery, per-result Relations check, add-relates_to template, build_context
   bidirectional-Related caution, bare-name-stub reconciliation. Zero ecosystem content.
7. `upgrade-haul-adapter-tool.md` (NEW ~150, from tool L88-240, PURE extract, no dedup) — bare-name
   formula-vs-cask auto-routing, cask not-in-api re-dispatch, @-suffix dual-key fetch, Axis-B
   inline-observation target + linked-timeline check. Package adapter is a one-line inline
   `## Release Highlights` note (no file needed).

Relocations (content-preserving unless noted):

8. RELOCATE `forge-fallback.md` and `upgrade-haul.md` from package-intel/references/ →
   intel/references/. Delete each file's now-obsolete "why the full `${CLAUDE_PLUGIN_ROOT}` path"
   header paragraph; switch all loads to bare `references/<file>.md`. `upgrade-haul.md` ALSO needs
   prose reconciliation (its "Per-skill adapter contract" / named "package-intel"/"tool-intel"
   cross-refs → "each family's adapter mode" in one skill). `forge-fallback.md` needs only a light
   "either skill" → "the skill" find-replace.
9. RELOCATE all 14 `ecosystem-<x>.md` + 13 `note-template-<x>.md` (plugin/skill share one). Add a ToC
   to `ecosystem-brew.md` (largest, ~342 lines). Fold the third-party-tap slash-counting dispatch
   fully INTO ecosystem-brew.md. **These are NOT inert — see the corrective pass below.**
10. RECONCILE the two gh-api-fallback.md files into ONE (see A.4).

### A.4 gh-api-fallback.md reconciliation (RECONCILE, not concatenate)

package copy (111 lines / 5921 B) and tool copy (141 lines / 7481 B) are genuinely different content
under one name — a real clobber-on-copy collision. Produce ONE `intel/references/gh-api-fallback.md`:

- UNION the four ecosystem-specific "When to reach for this" triggers (package-only Context7-miss
  heuristics + tool-only DeepWiki "Repository not found" cases). Dropping either pair is real
  capability loss.
- KEEP BOTH unique sections: package-only "Cross-Contributor Discovery" (the tool copy silently
  dropped it) AND tool-only "Per-Prefix Notes" (action.yml canonical source, gh: runtime_shape,
  docker: source-repo discovery).
- KEEP the higher-fidelity Verification Rule wording — package's, which carries the RETRO-19
  golangci-lint#608 citation the tool copy dropped.
- EXTEND the scope/applicability ladder (currently only in tool's copy) to all 14 prefixes: full for
  action/gh/docker + all six package ecosystems; conditional for brew; skip for cask/vscode. This is
  authored judgment absent from both source files — needs a written, human-reviewed acceptance table
  (no check can gate it). Single hardest reconciliation item.
- DE-DUP the ~60% byte-identical core (8-row Endpoints table, raw-file-content paragraph, Cross-Link
  section) — kept once. Preserve the tool copy's "Contents" ToC.

## Part B — `/nudge` (mode-routed merge)

`skills/nudge-sync/` (107) + `skills/nudge-adoption/` (465) → `skills/nudge/`. Mode-routed, mirroring
the in-repo `knowledge-gaps` flag-routing precedent:

- bare `/nudge` (or no arg) = **Mode A (sync)** — read `main/reference/claude-code-noteworthy-features`,
  filter adopted, regenerate `~/.claude/references/claude-code-nudge-tips.txt`.
- `/nudge check` = **Mode B (adoption-check)** — scan transcripts for real feature-use evidence,
  preview status transitions, write frontmatter after approval, then regenerate the same cache.

`argument-hint: "[check]"`, `disable-model-invocation: true` (decision #4 — two modes in one
≤1024-char description is a real auto-misroute risk; both nudge skills are already explicit-slash
tools; the knowledge-garden/knowledge-maintain precedent applies).

Tool-list UNION: `{Grep, Read, Write, mcp__basic-memory__read_note, mcp__basic-memory__edit_note}`.
Description: measured 535+811=1346 naive, 322 over the cap → REWRITE (drop the verbatim-duplicated
"Intentionally Claude-Code-specific" framing both repeat; keep DISTINCT sync-vs-check vocab).

Body & extraction (raw 107+465=572 > 500 cap, extraction mandatory):

- Mode A (sync) stays inline (~55).
- Mode B (adoption) preview/approve flow stays inline (~140), with two extractions into a NEW
  `skills/nudge/references/` dir (nudge-adoption has none today):
  - `references/evidence-detection.md` (~220, from nudge-adoption L169-385, VERBATIM). Pure
    copy-paste, no paraphrase: this prose is dogfood-hardened with real counts and documents specific
    fixed false-positives (bare-word "advisor"/"advisories"; Glob-mtime-cap bug) — a lossy reword
    reintroduces exactly those bugs.
  - `references/adoption-limitations.md` (~55, from the "Accepted limitations" subsection L84-147).
  - RELOCATE `references/tip-cache-contract.md` from nudge-sync/references/ as-is; simplify its
    now-obsolete cross-skill-path header caveat to a single-skill "shared by both modes" note.
- Landing: ~572 − 20 − 220 − 55 = **~277 lines** (a floor, not an expectation).

---

# Adversarial critique (verbatim) + the corrective pass

The synthesis was reviewed by an Opus adversarial critic. Verdict: **architecturally sound but NOT
yet implementation-ready — needs one focused corrective pass, not a full redesign.** The design
contains a concrete, ship-silently-broken defect class that its own migration/validation story does
NOT catch. The corrective pass below is folded into the execution plan.

## Mandatory fixes (fold into implementation)

1. **Silent-broken relative cross-load paths (highest severity, grep-confirmed).**
   `skills/tool-intel/references/ecosystem-brew.md:326` and `ecosystem-vscode.md:110` both contain the
   relative code-span path `../../package-intel/references/forge-fallback.md`. After the merge,
   `forge-fallback.md` moves into `intel/references/` alongside these files, so the correct link is a
   bare `forge-fallback.md`. "Relocate VERBATIM" leaves the old path pointing at a DELETED directory,
   and NOTHING in `npm run check` catches it (`check-plugin-load-paths.mjs` validates only bare
   `${CLAUDE_PLUGIN_ROOT}/...` paths; remark ignores code-span paths). Fix: convert to the portable
   form during the merge.
2. **"Verbatim" ≠ inert — run the doc-grep first (the grep is the authority, not the plan's file
   list).** Before relocating any reference file, run
   `grep -rn -E 'package-intel|tool-intel|\.\./' skills/{package,tool}-intel/references/` and fix
   every hit. ~10 files carry old-name strings: ecosystem-crates.md (L9 + L24), ecosystem-npm.md (L9),
   ecosystem-brew.md (L270), ecosystem-cask.md (L10), ecosystem-plugin.md (L3), ecosystem-skill.md
   (L3), ecosystem-vscode.md (L10), note-template-action.md (L98), note-template-docker.md (L87),
   note-template-plugin.md (L3).
3. **`ecosystem-crates.md:24` curl User-Agent `package-intel/vp-knowledge`** — a LIVE operational HTTP
   header emitted to crates.io, not prose. A deliberate keep-or-rebrand decision, not a find-replace.
4. **Close the checker blind spot + reconcile with the D5 portability verdict.** Same-skill refs
   should be bare relative (`references/x.md`) — the form verified portable across Claude Code +
   skills.sh in 0.32.7's D5 check. But bare relative is invisible to `check-plugin-load-paths.mjs`.
   Resolution: use bare relative refs AND add a new relative-`../`/`references/`-path on-disk
   resolution check so the portable form is machine-covered. This is the one genuinely-new check Wave
   3 adds. (The critique alternatively suggested converting all cross-load refs to the
   `${CLAUDE_PLUGIN_ROOT}` form that the existing check already covers; we take the bare-relative +
   new-check route because it also discharges the D5 standalone-skills.sh portability goal.)
5. **Diff every "mirrored"/"byte-identical" block before collapsing** — the HTML comments are
   self-declared and the gh-api-fallback drift proves they lie. Budget for Step-4's
   record-contradictions/confidence-scaling sub-blocks needing reconciliation, not a clean pick.
6. **gh-api-fallback per-prefix ladder needs a written, human-reviewed acceptance table** — ~half the
   14-prefix cells are newly-authored assertions absent from both source files. No check can gate this.
7. **Author enrichment-package.md / enrichment-tool.md as explicit per-prefix `### <prefix>`
   subsections, NOT a shared "run these N sources" list** — structural separation resists a future
   flatten.
8. **Confirmed non-misses** (the design is right to omit them): `fetch-brew-upstream.sh` has no
   old-name reference; `hooks/tip-fragment.sh` reads only the cache file, never a skill name.

## Non-blocking calibration notes (from `unrealisticClaims`)

- The ≤420/~284-line target is arithmetically correct; the 500-line ERROR cap gives ~216 lines of
  headroom, so even 350–400 passes. Defensible.
- The 36-line Arguments budget is optimistic (tool prefixes need per-identifier normalization the
  package prefixes don't) — realistically 40–50 lines. Non-blocking given the headroom.
- The nudge ~277 landing is a floor, not an expectation.

---

# Per-commit greenness (coordination constraint)

The old-skill DELETE and its path-coupled consumers MUST land in the SAME commit, or `npm run check`
goes red mid-migration: `check-plugin-load-paths.mjs:109` reads `skills/package-intel/SKILL.md` and
ENOENT-crashes once it's gone (repoint it to `skills/intel/SKILL.md` in that commit), and
`test/mcp-mapping.test.js` hard-fails until `VP_KNOWLEDGE_SKILL_NAMES` is 4→2. Sequence the delete +
fixture-repoint + Set-edit + test-update as one atomic commit. (`check:release-counts`,
`check:pi-load`, `check:cohort-lockstep` live-derive from disk and need no code change — they just
expect the 14-count once CLAUDE.md/README say 14.)

# Scope / revival

If this merge is ever reverted, or the two intel families are ever split back into separate skills,
`tool-intel-next-gen.md` (retired 2026-07-15) becomes relevant again — its whole premise is the two
skills staying separate. Its architecture-neutral grafts (haul-contract lib, observation-line lint,
ground-truth anchoring) can be revived independently under the merged `/intel` without reverting the
merge.
