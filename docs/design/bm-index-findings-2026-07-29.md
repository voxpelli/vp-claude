# Basic Memory search-index findings, and why the link pipeline pivoted

Recorded 2026-07-29. Local record only — nothing here has been reported
upstream, and doing so needs explicit approval for that exact action.

Basic Memory is AGPL-3.0; this repo is MIT. Its source was **read and cited**
to establish behaviour, never copied. Every file path below is a citation.

## Summary

The link-integrity pipeline was being built on `bm tool search-notes
--entity-type relation`. That source is a **projection** of the real `relation`
table, and the projection is lossy in four directions at once. The pipeline now
reads the markdown files instead, via `md-wiki-vec`, and keeps the index only as
a cross-check.

## What is actually wrong (measured, then confirmed against the database)

`~/.basic-memory/memory.db` holds the ground truth:

```sql
CREATE TABLE "relation" ( id INTEGER NOT NULL, from_id, to_id, to_name, relation_type, …
  PRIMARY KEY (id),
  CONSTRAINT uix_relation_from_id_to_name UNIQUE (from_id, to_name, relation_type), … )
```

| Measure | Value |
|---|---|
| Relations in the `relation` table | **13,131** |
| Rows returned by `search-notes --entity-type relation` | **15,545** |
| Distinct `(from, verb, permalink, to)` in those rows | **13,131** — matches the table exactly |
| Index ids with no matching row in `relation` | **68** |
| Relations present in the table but ABSENT from the index | **28** (3 of them dangling) |
| Index ids bound to more than one permalink | **15** |
| Permalinks carrying more than one index id | **55** |

The arithmetic closes exactly: 13,171 distinct index ids, minus 68 stale, gives
13,103 live; plus the 28 unindexed relations, gives 13,131.

### Correction to an earlier claim in this repo

An earlier commit message on this branch says *"`relation_id` is neither unique
nor stable"*. **That is false about the data.** `relation.id` is a primary key —
13,131 rows, 13,131 ids, no duplicates. The accurate statement is:

> `relation_id` **as returned by `search-notes`** is unreliable.

The distinction is load-bearing. It changes the fix (reindex, not a schema
change) and the blast radius (everything that reads through `search-notes`, not
just this pipeline).

### Mechanism, from source

- `SearchIndexRow` (`src/basic_memory/repository/search_index_row.py`) copies
  `relation.id` into the index; the SQLite `search_index` is an **FTS5 virtual
  table**, which enforces no unique constraint.
- `src/basic_memory/alembic/versions/n7i8j9k0l1m2_cleanup_sqlite_search_orphans.py`
  documents orphaned FTS rows surviving deletion, and ids being reissued — its
  own words: *"auto-increment handed the id to a brand-new project and the FTS
  rows from the deleted predecessor masquerade as the new tenant's data."* It
  sweeps orphans by `project_id` and `entity_id`. There is **no sweep keyed on a
  relation that no longer exists.**
- Relations churn constantly: an entity's outgoing relations are
  deleted-and-reinserted on every file change
  (`RelationRepository.replace_accepted_outgoing_relations`), so ids move.

### REFUTED: pagination instability

Every relation row scores `0`, and the SQLite FTS path orders by score with no
id tiebreaker — which suggested `limit`/`offset` paging might silently SKIP
rows while `scanned === total` still passed. **This did not survive testing.**

Seven enumerations across two independent investigations, at page sizes 1000,
700, 5000 and one unpaginated pull of all 15,545 rows, returned byte-identical
sets: same 13,131 distinct contents, same 15 colliding ids, no collision near a
page boundary. The duplicates are in storage, not in the paging.

Recorded because it was asserted forcefully before it was tested.

### `to_name` exists but is not exposed

The `relation` table and `SearchIndexRow` both carry `to_name` — the **literal
link text, set even when unresolved**. `SearchResult`
(`src/basic_memory/schemas/search.py`) does not expose it, in 0.22.1 or on
current main, so no consumer of **`search-notes`** can recover what the author
actually wrote.

**Correction (verified 2026-07-29, after this document first claimed
otherwise):** an earlier version of this section said the literal text was
unrecoverable from the API at any price. That is wrong. `build_context` DOES
return it — `context_service.py` populates `to_name` into `RelationSummary`,
and a live call returns `{"to_entity": null, "to_name": "Temporal.io"}` for a
dangling relation. Two constraints keep it from being a whole-graph audit
source, and both were found by calling it rather than reading it: `timeframe`
defaults to **7 days** (the first call returned zero relations for a note whose
links were older) and is **capped at 1 year**, and it is per-note rather than
per-graph.

So the honest statement is narrower than the original: `search-notes` cannot
recover the link text, `build_context` can for a known note within a bounded
window, and neither yields the SECTION the link was written in. Section
provenance — not link text — is what actually required reading the markdown.

## The pivot

`@voxpelli/md-wiki-vec` (MIT, sibling repo, clean-room, basic-memory-compatible)
already implements the read-and-classify half, and better:

- parses markdown with a **remark/mdast AST**, not regexes (a hand-rolled
  equivalent here drew 10 ReDoS lint errors before it was deleted);
- scopes relations to an anchored `## Relations` heading
  (`src/chunker.js`, `/^relations?$/i`), so prose-extracted `[[links]]` —
  upstream bug `vp-claude-dpz6` — **never enter the graph at all**;
- resolves with more tiers than Basic Memory's strict path
  (`permalink`, `permalink_norm`, `title`, `file_path`, `alias`, `normalized`),
  so its dangling set is a safe subset of the true one;
- classifies into `missing_target` / `phantom_edge` / `title_mismatch` /
  `schema_template_noise`, and reports the **raw link text**.

`phantom_edge` returning 0 is the expected result, not an empty finding: it is a
self-check that mdwv's own title resolution holds. This repo's earlier
`exact-title` strategy appeared to win 27 times only because it matched in
**slug space**, where `[[NPM Fastify]]` and the title `npm-fastify` collapse to
the same string. Matching on slugs was always a workaround for not having the
literal text.

**Access:** `mdwv-mcp` exposes `graph_lint` as one of nine read-only MCP tools,
so it can be mounted as an MCP server rather than shelled out — typed schema, no
CLI-JSON parsing. `mdwv graph-lint --format json` remains the fallback.

## Constraints the repair pass must honour

1. **Repairs go through `edit_note`, never a direct file write.** Basic Memory
   binds a relation when the SOURCE note is parsed; editing markdown behind its
   back leaves the index stale and the edge still dangling.
2. **Replace every occurrence, not the first.** 7 dangling groups are ONE
   relation row but MULTIPLE text occurrences under the same verb — the UNIQUE
   constraint collapses them, so no key recovers the count. Example:
   `main/projects/flode-github-webhook-gateway-and-ci-cd-cost-control` carries
   `- built_with [[npm-@fastify-sse]]` on both line 34 and line 37.
3. **Reindex before enumerating.** Of 1,317 groups reported dangling through the
   index, **72 (5.5%) have no live dangling relation behind them** — 13 phantom,
   61 whose database row is actually resolved. A reindex buys more accuracy than
   any amount of key selection.
4. **The 28 unindexed relations are unreachable through the index** at any page
   size or key choice. Only the files (or the database) see them.

## `title_mismatch` is a candidate list, not a repair list

Measured 2026-07-29 against a freshly reindexed vault (1,928 notes in sync,
manifest `c4e34284`): `graph_lint` reports **1,205 unresolved, 827 distinct
missing targets, 225 hygiene findings**, of which **185 are `title_mismatch`**
across 113 distinct targets.

Those 185 are NOT 185 repairs. Splitting on what the candidate title adds after
the written target:

| Class | Count | Verdict |
|---|---|---|
| **descriptive-suffix** — candidate continues with ` - `, ` — `, `: ` or ` (` | **123 (66%)** | correct in every sample |
| **word-continuation** — continues with a space, no separator | 48 (26%) | genuinely mixed, needs review |
| **token-continuation** — no space at all | **14 (8%)** | wrong in every sample |

This works because the graph titles notes `<Name> - <Description>`, so a
short-form link is safe to repair exactly when the candidate extends it at a
descriptive separator. `WordPress` → `WordPress - Open Source CMS Powering 43%
of the Web` is right; `Pelle Wessman` → `Pelle Wessman - IndieWeb Builder and
Open Source Maintainer` is right.

The token-continuations are wrong and dangerous *because they look plausible*:
`npm-lightningcss` → `npm-lightningcss-cli`, `npm-babel` →
`npm-babel-plugin-htm`, `npm-resolve` → `npm-resolve-email`, `brew-sdl2` →
`brew-sdl2-compat`, `brew` → `brew-aarch64-unknown-linux-gnu`. Every one names a
DIFFERENT package. Applying them would rewire the graph to the wrong notes and
leave no trace that anything went wrong.

Note also that length is NOT the discriminator, though it looks like one:
`WordPress` is 18% of its correct candidate while `brew-sdl2` is 56% of its
wrong one. A ratio threshold gets both backwards.

**Consequence for the repair pass:** apply `descriptive-suffix` only; route
`word-continuation` to human review; REJECT `token-continuation` outright and
report it, rather than dropping it silently. `graph_lint` returns the
lexicographically-first qualifying candidate, so a target with several plausible
extensions is a coin flip — 42 of the 113 distinct targets are referenced from
more than one source and must resolve to one answer.

## The repair run, and what the fix log says

120 repairs applied 2026-07-29 — 106 accepted by the separator rule, 14 by
adversarial-reviewed judgement — out of 185 raw candidates. The 65 not applied
were excluded by findings, not by omission: 10 phantoms (already repaired on
disk), 7 ambiguous targets where more than one vault title prefix-matches, 14
token-continuations naming a different entity, 1 refuted judgement (`TLS 1.3`,
a narrowing), and 33 that no judge ever ruled on.

Verified against the files, not against tool responses: **120 applied, 0 not
applied, 0 partial**, including all three multi-occurrence repairs at both
occurrences. Index reconciled afterwards: unresolved edges **1,317 → 1,197**,
exactly the 120. `bm orphans` reports 0 of the 78 edited notes as relation-less.

### The whole point of the log

**120 of 120 are `short-form-title`.** Not one `em-dash-vs-hyphen`, not one
`colon-vs-hyphen`, not one `case`, not one `permalink-slug-pasted`. The entire
repairable population is a single authoring habit: writing `[[Name]]` when the
note is titled `Name - Description`.

That is an unusually clean answer to the question the log exists to ask, and it
routes to one place. `/intel`'s `references/cross-link-existing-notes.md`
already claims to reconcile bare-name stubs; on this evidence it is emitting
them instead. The other four failure modes are, on this corpus, theoretical.

| Cut | Result |
|---|---|
| Separator the title resumes with | 89 hyphen, 16 em-dash, 15 other |
| Source directories | `engineering/patterns` 29, `indieweb` 18, `engineering/history` 13 |
| Most under-linked targets | Conservative Change Philosophy ×6, Modern CSS Platform Features ×5, Pelle Wessman ×4, h-entry ×4 |

The target ranking is the more actionable half: a note referenced by six
different sources under a short name is not six authoring slips, it is one note
whose full title nobody remembers. That is a naming problem, not a linking
problem, and no repair pass fixes it.

## What survives from the index-based work

The enumerator (`scripts/list-unresolved-links.mjs`, `scripts/list-notes.mjs`,
`lib/bm-search.mjs`) is now the **second opinion** in a cross-check: md-wiki-vec
is authoritative, and the diff against the index is what surfaces the phantom
rows, the misbound ids and the 28 missing relations. That diff is the evidence
behind this document.
