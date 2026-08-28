# Link-integrity sweep — 2026-08-28

Decision record for a graph-wide dangling-link repair pass over the basic-memory
vault (2,174 notes), run through `md-wiki-vec`'s `graph_lint` / `suggest_links` /
`get_context` and applied via `mcp__basic-memory__edit_note`.

Recorded here because `docs/design/` is where this repo keeps findings that outlive
a sprint (precedent: `intel-corrections-2026-07-28.md`). The working notes were in a
session scratchpad, which does not survive the session.

## Outcome

| Metric | Before | After | Δ |
|---|---|---|---|
| `graph_lint` `unresolved_total` | 1090 | 1032 | **−58 dead edges** |
| `graph_lint` `missing_total` (distinct dead targets) | 845 | 823 | **−22** |
| New relations authored | — | 21 | all resolved first try |

## The verification invariant (the reusable part)

**A correct new link leaves `unresolved_total` unchanged; a mistyped title becomes a
new dangling edge and RAISES it.** So the single number checks every title in a batch
at once, with no per-link inspection. A repair batch predicts its own delta:

    expected = unresolved_before − (edges repaired) + (mistyped new links)

Four batches were applied and every one matched its prediction exactly (−20, −1, −15,
−22). Any mismatch localises immediately to the batch that broke it.

**Precondition:** the index must be current. `mdwv watch` was running, so
`freshness` returned `in_sync: true` between every batch. Without the daemon, this
invariant silently measures a stale index.

## Defect taxonomy

Dangling links were not one problem. Four distinct causes, in descending fixability:

1. **Permalink-fragment as target** — `[[engineering/agents/parallel-agent-orchestration-lessons]]`.
   Real permalinks carry a `main/` project prefix, so the bare form never matches.
   Fix: replace with the note's title.
2. **Title drift** — a remembered or paraphrased title
   (`Bridgy Fed - Cross-Protocol Bridge` vs the real `…Cross-Protocol Social Network Bridge`).
3. **Punctuation drift** — a hyphen written where the title carries an em dash, or a
   colon where it carries a hyphen (the colon→hyphen migration artifact).
4. **A bare URL target — dead by construction.** The line is written without brackets
   (`- cites https://llmstxt.org/`), and a relation whose target is a raw URL can never
   resolve; no note can carry a URL as its title, permalink or file path.
   These are NOT repairable and NOT missing-subject — they want rewriting as markdown
   links. Filed upstream against md-wiki-vec (`graph_lint` does not distinguish them).

## Two rules that prevent corrupting the graph

Both are pre-existing findings from `Obsidian Interoperability - Wiki-Link Resolution
Divergence`, re-confirmed under load here:

- **Refuse a prefix repair when more than one vault title prefix-matches.** `npm-eslint`
  prefix-matches 19 titles. `Flattr` matched three. Enumerate the candidate list first.
- **Use the separator, never string length.** A candidate continuing the target's token
  with no space (`npm-is` → `npm-is-plain-obj`) is a DIFFERENT entity, wrong every time.
  One resuming with ` - `, ` — ` or `: ` is the same subject.

## Triage result — the full backlog

~98 distinct dangling targets classified by three agents over disjoint slices
(count ≥3 / count 2 A–M / count 2 N–Z):

| Bucket | Count | Status |
|---|---|---|
| REPAIRABLE | 18 | **15 applied**, 2 held (see below), 1 reclassified as a bare-URL target |
| MISSING-SUBJECT | 56 | not acted on — creating notes is a separate scope decision |
| DEMOTE | 24 | not acted on — needs prose rewriting, not link repair |

**The REPAIRABLE bucket is effectively closed.** Applied: `gugu91` →
`Will Porcellini …` (6 edges), `Matrix Specification` → `Matrix Protocol` (4),
`ods-flat-xml-format` → `ODS Flat XML Format` (3), `Tolerance Trap` →
`The Tolerance Trap - How Liberal Acceptance …` (2), both Neostandard targets,
`npm-webpage-webmentions`, `@tmustier/pi-ralph-wiggum`, `Design-to-Code Loop`,
`Domain-as-Identity`, `Flattr — The Full Story`, `bilateral-synergy-tracking-…`,
`mafintosh` → `Mathias Buus …`, `engineering/rust/error-handling` → `error-handling`,
`engineering/ui/slint-patterns` → `slint-patterns`.

**DEMOTE is a deliberate modelling choice, not a backlog.** The graph declines to model
companies and most individuals — there is no Microsoft, Google, Apple or Facebook note
despite hundreds of mentions, and `Automattic`, `Socket Inc`, `OpenAI`, `Cloudflare`
are all dangling by the same convention. Two agents reached this independently.

## Held deliberately — then closed

**Colon-title stragglers — retitle, do NOT repair the links.** `npm:remark-wiki-link`
(3 dead edges) and `npm:remark-gfm` (2) still carried pre-0.22.0 colon titles. The
links pointing at them were written in the CORRECT post-migration hyphen form; the
NOTE TITLE was the defect. Repairing the links would have fixed the wrong end and
broken them again when the migration completed. **Done in the follow-up pass below.**

## Implicit-link findings (`suggest_links`)

Method notes that changed the answers, worth keeping:

1. **Cosine is symmetric; rank is not.** `cos(A,B) == cos(B,A)`, so a score alone adds
   nothing. MUTUAL top-N membership is the precision filter.
2. **Scores are not comparable across roots of different degree.** `suggest_links`
   excludes already-linked notes, so a 0.66 survivor for a 25-edge hub is far stronger
   evidence than 0.66 from an orphan.
3. **Same-folder proximity is weak evidence; cross-folder is strong.** Five
   `indieweb/history` notes scoring 0.78–0.81 against each other is folder density.
4. **Meta-notes are systematic false positives.** `Knowledge Graph Axioms` scored high
   against five independent roots because it is *about* the graph's recurring themes.
   Linking a subject note to it is the fourth-wall anti-pattern.

**Cosine proposed the right neighbourhood but the wrong members, three times.** Each
was caught only by reading the notes:

- `Robustness Principle` looked like a disconnected hub; it has 25 edges and zero
  dangling. The real finding was narrower: of TWO ossification notes, the cluster was
  attached to `Protocol Ossification Prevention` and not to the base
  `Protocol Ossification` note. Fixed with 3 edges.
- `Permissionless Extension` looked like an unattached keystone; it has 14 relations
  and already reaches sub-cluster B.
- The `voxpelli Doctrine`'s best target was `Graceful Obsolescence — Code Designed to
  Be Replaced by the Platform` (both name `pony-cause` as the purest case), which
  cosine never surfaced; its top cosine suggestion was weak on content and dropped.

## Package-note dependency accuracy

Tested the hypothesis that concrete package notes are better-linked because dependency
structure gives them edges "for free". **Partly wrong.** Registry-checkability makes
wrongness *detectable*; it does not make linking automatic. Defects found and fixed,
each re-verified at primary source (npm registry / crates.io API):

- `npm-@platformatic-mcp` `depends_on [[npm-fastify]]` → `composes_with`; fastify is
  **devDependencies only** at v2.4.0, absent from `dependencies` and `peerDependencies`.
- `npm-@platformatic-mcp` `depends_on [[npm-@sinclair-typebox]]` → `integrates_with`;
  peerDependency only.
- `crate-rmcp` had **zero** `depends_on` despite `tokio` and `tokio-util` at
  `optional=false` in BOTH the documented v1.6.0 and current v3.1.4. Added both.
- `crate-wasmcp` `builds_on [[crate-rmcp]]` → `relates_to`; rmcp is not a Cargo
  dependency of wasmcp at all.

Incidental: `crate-rmcp` documents v1.6.0, crates.io max_stable is **3.1.4** — a
two-major-version drift, a `--stale` cohort candidate.

## Tooling state observed

- **Socket MCP was unavailable throughout** — every `mcp__socket-mcp__*` call returned
  `No valid session. Send initialize first.` Direct npm/crates.io API calls were used
  instead, and are the more authoritative source for dependency facts anyway.
- **`mdwv watch` performed correctly** across ~60 relation edits; every `graph_lint`
  reading reflected the prior batch exactly.

## Open, not acted on

- 56 MISSING-SUBJECT targets. Highest-demand: `feedback_test_first_refactoring` (6),
  `Web Standards Movement` (4), `npm-chokidar` (4), `pattern:esm-only-nodejs` (4).
- 24 DEMOTE targets needing prose rewriting.
- Bare-URL-target class (`- cites https://…`) — the 7 local instances are rewritten
  (below); the class was never sized graph-wide.
- **`web_standard` and `practice` have no schema note**, so `schema_validate` cannot
  run against either — it returns "No Schema Found" rather than a pass. Both types
  carry real notes. `schema_infer` would seed them; not done here.
- Whether the two ossification notes, or `Absorption Response Taxonomy` /
  `Platform Gap Survival Theory`, should merge. Both were investigated and both
  resolved to LINK, not merge — but only for those two pairs.

---

## Follow-up pass — later the same day

`unresolved_total` **1032 → 1019** (−13), `missing_total` 823 → 814 (−9). Three
things closed, each measured against its own prediction and matching exactly.

### Colon-title stragglers — retitled, and the migration is now provably complete

**`edit_note` `find_replace` does reach frontmatter**, so a retitle is a one-line
edit of the `title:` field. That was the unestablished mechanism; `move_note` and
`write_note` were never needed. Basic Memory renames the file to match the new title
and keeps the permalink stable, so nothing addressed by permalink breaks.

Four notes retitled: `npm:remark-gfm` (2 dead edges healed), `npm:remark-wiki-link`
(3), `npm:@flowershow/remark-wiki-link` (1), `npm:webmention-testpinger` (0 —
migration consistency only; nothing pointed at it). The scoped one takes the house
`npm-@scope-name` form, confirmed against the existing `npm-@fastify-*` family.

**Enumerate every title instead of sweeping prefix by prefix.** Nine prefixes were
listed as unchecked. `bm tool search-notes` with `--permalink '*'` pages the whole
graph, so one walk answers the question for every prefix at once:

    p=1; while :; do
      r=$(bm tool search-notes --project main --permalink '*' \
            --entity-type entity --page $p --page-size 1000)
      echo "$r" | jq -r '.results[].title'
      [ "$(echo "$r" | jq -r .has_more)" = true ] || break
      p=$((p+1))
    done | grep -E '^(npm|crate|go|composer|pypi|gem|brew|cask|action|docker|vscode|gh|plugin|skill):'

**Drive the loop off `has_more`, never a literal page count.** The first version of
this ran `for p in 1 2 3` — complete against 2,174 notes, and silently truncating
the moment the graph passes 3,000, at which point it reports a clean migration
because it stopped looking. That is this repo's recurring *check that cannot fail*,
reproduced in a snippet written to be re-run. `lib/bm-search.mjs` validates
`has_more` and `total` for exactly this reason.

Zero hits across all 2,174 notes. The colon→hyphen migration is complete **for the
fourteen ecosystem prefixes** — a claim per-prefix searching can only ever support for
the prefixes actually searched. See the correction below: it is *not* complete for
every prefix-shaped title. This
is CLI access to Basic Memory, not filesystem access to its files, so it stays
inside the MCP-only rule (the repo's own `lib/bm-search.mjs` uses the same call).

### Bare-URL relation targets — rewritten as citations

The seven `- cites https://…` lines across the two notes became one `[source]`
observation each, in the house style. Six distinct targets, all preserved.

**Gotcha, hit and fixed:** inserting a line by `find_replace`-ing against a
following `\n\n## Relations` anchor CONSUMES those newlines, gluing the new line
onto the previous observation (`…tax above.- [source] …`). It then parses as one
observation under the wrong category and the citation silently disappears. Put the
newline back in the replacement text, and verify the inserted observation parses
standalone — `edit_note` reports success either way, so only a re-read catches it.

### One permalink missing its project prefix

`vscode-eamodio.gitlens` carried `permalink: vscode/vscode-eamodio.gitlens` — the
only note of 2,174 without the `main/` project segment. Found by the same
enumeration walk (`grep -v '^main/'`), fixed with `edit_note` on the frontmatter,
and confirmed **edge-neutral**: `unresolved_total` did not move, because everything
pointing at that note resolves by title, not by permalink.

---

## Phase 2 — three missing package notes via `/intel`

`unresolved_total` **1019 → 1009**, `missing_total` 814 → 811. Created
`npm-chokidar` (4 inbound edges healed), `npm-ioredis` (3) and `npm-@fastify-jwt`
(3). The three notes authored 18 wiki-link relations between them and the count
fell by exactly 10 — so every one of those 18 titles resolved first try, checked by
the same single number rather than by inspecting 18 links.

**The most load-bearing find:** `@fastify/jwt` **CVE-2026-18500 / GHSA-j4cx-787j-xjqg**
(High, 2026-08-14) is an authorization bypass where the global secret overrode the
per-request key — and it is patched in **exactly 10.2.2**, the version documented.
So the note's `[version]` doubles as a security floor: 10.0.0–10.2.1 are all
affected. Behind it, `CVE-2026-44351` (Critical) was a `fast-jwt` bug reached
*through* this plugin, where an async key resolver returning `''` — the idiomatic
`keys[decoded.header.kid] || ''` JWKS fallback — became a zero-length HMAC key that
validated attacker-forged tokens. A clean advisory list for the wrapper is not a
clean dependency.

### Tooling behaviour worth not rediscovering

- **`write_note` has no `entity_type` parameter** in the installed Basic Memory
  0.23.2 — it errors as an unexpected keyword. Notes land as `type: note` with no
  `url` or `packages`, all three of which `/intel`'s note template specifies. The
  fix is a follow-up `edit_note` `find_replace` on the frontmatter (which does reach
  it). Worth reconciling in `references/note-write-mechanics.md`, since a note
  written per the template without that second step silently misses the
  `npm_package` schema.
- **`/intel`'s batch hook mis-routes a from-scratch multi-package call.** Multiple
  names are read as an *upgrade haul* — a refresh of already-documented notes
  against a version delta — but here none of the three existed. The single-identifier
  path had to be run three times by hand. The detection could gate on the Step-1
  existence check rather than on operand count alone.
- **DeepWiki lags the current major on both actively developed packages.** It knew
  nothing of chokidar v5 (ESM-only, 2025-11) or ioredis v6 (RESP3 by default,
  2026-07), and said so explicitly rather than guessing. The skill's own
  indexing-lag caveat is real and load-bearing: the v5/v6 content came from GitHub
  release notes, not DeepWiki.
- **Context7's `resolve_library_id` requires BOTH `libraryName` and `query`**, and
  each error names only the *other* missing field — so passing one at a time reads
  as a contradiction rather than as "supply both".
- **Socket MCP failed again** (`No valid session. Send initialize first.`), the
  fourth confirmation this session. Recorded as attempted-and-failed in all three
  notes rather than omitted, so no note implies a depscore was judged and passed.
- Readwise returned nothing relevant for any of the three; Raindrop had nothing for
  chokidar, five incidental ioredis mentions, and one direct `fast-jwt` bookmark.

---

## Phase 3.2 — the company test, applied once

**The test, recorded so it is not re-argued:** a company earns a note when **two or
more of its products or people already have notes AND the company is what connects
them**. Otherwise it stays prose. This graph deliberately does not model most
companies — there is no Microsoft, Google or Apple note despite hundreds of mentions.

`Automattic` passes (WordPress and Akismet both have notes, and nothing else links
them) and was created: 1009 → **1006**, missing 811 → 810, its four outgoing links
all resolving. `Facebook`, `Cloudflare`, `OpenAI`, `Dropbox`, `Okta` and `Socket Inc`
fail the test and stay dangling by convention — that is a modelling choice, not a
backlog item.

One thing the note deliberately does **not** claim: the Automattic / WordPress
Foundation / wordpress.org structure and the 2024–25 governance dispute are the most
consequential facts about the company and were not researched. The note says so in a
`[caveat]` rather than implying the omission is absence of interest.

## Phase 3.1 — the three internal slugs, investigated

Read before deciding, per the standing rule that a note invented to satisfy a link
may be inventing a subject. All three turned out to be ordinary `## Relations`
entries; the differences are in whether a subject exists at all.

| Slug | Edges | Verbs | Does the subject exist? |
|---|---|---|---|
| `feedback_test_first_refactoring` | 6 | all `relates_to`, all from the fast-check family | **No** — no graph note, and no `feedback_*` memory file of that name either |
| `pattern:esm-only-nodejs` | 4 | 3 × `implements`, 1 × `relates_to` | **Yes**, but no note covers it; the existing ESM notes are migration and gotcha notes, not the convention itself |
| `vp-beads-sibling-sync-skill` | 3 | 2 × `implemented_by`, 1 × `bug_in` | **Yes** — `skills/sibling-sync` ships in vp-beads 0.18.0, verified on disk |

**Method note: relation targets are slugified in the relation index.** A first pass
grepped for the literal `feedback_test_first_refactoring` and found zero rows, which
read as "these are inline body links, not relations" — wrong. The index stores
`feedback-test-first-refactoring`, exactly as `pattern:esm-only-nodejs` is stored as
`pattern-esm-only-nodejs`. Grep the slugified form, or a real relation looks absent.

**The verification invariant does not cover this phase.** Removing a link drops
`unresolved_total` by exactly as much as repairing one, so the count cannot
distinguish a heal from a deletion. Reading the source is the only check here.

---

## Phase 3.1 — the three slugs, resolved

`unresolved_total` **1006 → 993**, `missing_total` 810 → 807. Each sub-step matched
its prediction (−6, −4, −3).

- **`feedback_test_first_refactoring` (6)** → all six relinked to
  `Characterization Testing`, which already carries "commit characterization tests
  separately before the refactoring commit". No note was invented for a subject that
  existed nowhere.
- **`pattern:esm-only-nodejs` (4)** → new `pattern` note
  **`ESM-Only Publishing for Node.js Packages`**, four sources repointed. Anchored on
  something verified from primary source the same day: chokidar 5.0.0's release notes
  set `engines.node` to `>= 20.19` *because* that is the first line where CJS can
  `require()` ESM — the constraint whose removal is what makes the pattern viable.
- **`vp-beads-sibling-sync-skill` (3)** → new `claude_plugin` note
  **`plugin-voxpelli-claude-beads-vp-beads`**, three sources repointed. The graph has
  no addressable form for a single skill inside a plugin, so the note is the plugin
  with `sibling-sync` documented in depth. The `bug_in` edge loses a little precision
  as a result; the alternative was a title outside every naming convention.

Incidental: this repo's `CLAUDE.md` describes vp-beads as "sprint workflow
(retrospective, upstream-tracker)". It ships **eight** skills at 0.18.0 — also
`backlog-groomer`, `harden-memories`, `sibling-sync`, `swarm-wave`, `synergy-tracker`
and `vendor-sync` — plus a `sprint-review` agent.

## Correction: the colon migration is NOT complete outside the ecosystem prefixes

A full title enumeration found **17 surviving prefix-shaped colon titles** that the
ecosystem-prefix grep was never going to see, because it only tested the fourteen
`npm|crate|go|…` prefixes:

- **`person:` × 13** — Adam Wiggins, Christopher Alexander, Cory Doctorow, Dave
  Thomas, Doug McIlroy, Fred Brooks, Jon Postel, Jonas Bonér, Martin Fowler, Melvin
  Conway, Nadia Eghbal, Richard Gabriel, Richard Stallman
- **`reference:` × 4** — node-app-template, node-cli-template, node-module-template,
  web-component-starter

The `person:` case is worse than an inconsistency, because it runs **both ways**:
thirteen notes still carry the prefix in their title, while `person:Brian Kardell`
and `person:Eric Meyer` sit in the dangling bucket as links written in that form
pointing at notes that have since moved to descriptive titles. So the convention is
half-migrated in both directions at once. Not acted on — thirteen notes is a
convention decision, not a repair.

## The enumeration check that reported clean by reading nothing

Re-running the title walk to check for non-ecosystem colon prefixes, `jq` failed with
`Invalid string: control characters ... must be escaped` on a note added during the
session. The loop wrote an empty file, and the grep over it printed `NONE` — a clean
bill of health from a check that had read **zero of 2,202 rows**.

This is the repo's recurring *check that cannot fail*, arrived at from a new
direction: not a derived comparison and not a missing input, but a **parse failure on
one row silently emptying the whole result set**. The tell was a stderr line that did
not stop the pipeline. The fix has two parts, and the second is the load-bearing one:
parse with `json.loads(..., strict=False)` so a raw control character does not abort,
and **assert the row count against a literal floor** before believing the answer:

    assert len(titles) > 2000, f"REFUSING to report: only {len(titles)} titles read"

Same rule as the `has_more` fix earlier in this document: compare a measured count to
a value the failure cannot touch.

## Concurrent writers break the delta invariant

Mid-session, `freshness` listed a changed file this session never touched — another
agent or session writes to the same vault. Two consequences worth carrying:

1. A predicted delta can be wrong through no fault of the edit, so a mismatch is not
   automatically your bug. Check `freshness` for unfamiliar filenames before
   investigating your own change.
2. `freshness` must read `in_sync: true` **immediately before** `graph_lint`, not
   merely at some earlier point. One reading during this phase came back −3 against a
   predicted −4 purely because the index was mid-debounce; the same measurement after
   sync was exactly −4. The precondition was already written down here and skipping
   it still cost a false alarm.
