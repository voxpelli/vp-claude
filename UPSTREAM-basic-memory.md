# Upstream: basic-memory

Friction, limitations, and capability discoveries found while building vp-knowledge on top of Basic Memory.

## Latest upstream activity (snapshot 2026-05-04)

**Latest release:** [v0.20.3](https://github.com/basicmachines-co/basic-memory/releases/tag/v0.20.3) (2026-03-27)
**Latest `main` commit:** [a661e92](https://github.com/basicmachines-co/basic-memory/commit/a661e92) (2026-05-04) — `feat(mcp): create projects by workspace slug` (#789)
**Activity:** 44 commits in last 4 weeks (accelerating from 38 prior 4 weeks); 30+ commits on `main` since v0.20.3; 62 open issues. Workspace-aware MCP routing dominates the post-v0.20.3 sprint — v0.20.4 / v0.21 cut likely imminent.

### Merged PRs that touch entries below (unreleased — pending v0.20.4/v0.21)

| PR | Date | Effect on local entries |
|---|---|---|
| [#770](https://github.com/basicmachines-co/basic-memory/pull/770) | 2026-04-29 | Regression guard for long `relation_type` values (#721). **Partial fix** for the `edit_note re-parse triggers validation errors from unrelated notes` entry — hardens against future regressions, but the cross-note error attribution problem remains |
| [#769](https://github.com/basicmachines-co/basic-memory/pull/769) | 2026-04-29 | `fix(core): skip Obsidian callouts in observation parser` — Obsidian callout syntax (`> [!note]`) no longer pollutes observation parsing |
| [#768](https://github.com/basicmachines-co/basic-memory/pull/768) | 2026-04-29 | `fix(mcp): remove no-op pagination params from read_note and view_note` — silent no-op `page`/`page_size` removed |
| [#776](https://github.com/basicmachines-co/basic-memory/pull/776) | 2026-04-29 | `feat(cli): refuse db reset while basic-memory mcp processes run` — operational safety, not friction |
| [#774](https://github.com/basicmachines-co/basic-memory/pull/774) | 2026-04-29 | `fix(core): degrade gracefully when sqlite-vec cannot load on init` — Windows `vec0` load failures no longer crash startup |
| [#764](https://github.com/basicmachines-co/basic-memory/pull/764) | 2026-04-24 | Entity deletion no longer leaves orphaned rows in `search_vector_chunks` and `search_vector_embeddings` |
| [#765](https://github.com/basicmachines-co/basic-memory/issues/765) | 2026-04-25 | Stale FTS index entries after `reset --reindex` and `reindex --search` (closed) |

### Open / in-progress upstream

| Issue/PR | Effect on local entries |
|---|---|
| [#762](https://github.com/basicmachines-co/basic-memory/issues/762) (open feature) | "Show which entities do not have relations" — filed by maintainer; would **obsolete the two-pass orphan-detection workaround** in `build_context` entry below |
| [#763](https://github.com/basicmachines-co/basic-memory/issues/763) (open bug) | `write_note` / `edit_note` return before semantic indexing completes — see new entry below |
| [#786](https://github.com/basicmachines-co/basic-memory/issues/786) (open enhancement) | MCP settings tool for active project/workspace context |
| [#760](https://github.com/basicmachines-co/basic-memory/issues/760) (open) | Harden subprocess usage in `sync_service.py` and expand `SECURITY.md` |
| Workspace-aware MCP routing sprint | PRs #777, #783, #788, #789, #790 — post-v0.20.3 multi-workspace support; introduces `external_id` project resolution and workspace-qualified memory URLs |

### Should still be filed (no upstream activity yet)

These local entries have no upstream issue/PR despite being clear friction. Candidates for filing:

- `operation="append"` with `section=` appends to end of file — high-value bug filing
- `search_notes(note_types=[X])` matches directory paths instead of just frontmatter type — clear bug
- `edit_note(find_replace)` on schema frontmatter creates duplicate frontmatter — high-value bug filing
- `list_directory` has no `bm tool` CLI wrapper — feature request
- Observation search does not filter by parent note type — feature request
- FTS tokenizer doesn't match bare `[[` — feature request (low-medium pri)
- `search_type="text"` required for `[[prefix:` queries — feature request (low pri)
- `character-handling.md` omits colon documentation — **docs-only PR, easy contribution**
- LinkResolver should resolve wiki-links against aliases/metadata — design proposal
- Phased Obsidian colon-compatibility — Upstream Opportunity, **Merge readiness: needs-redesign**, no PR submitted

## Open items

### `operation="append"` with `section=` appends to end of file, not end of section

**Discovered:** 2026-03-13 (v0.1.0–v0.2.0 era)
**Impact:** High — affected knowledge-maintainer, session-reflect, and tool-intel. All
components initially used `operation="append", section="Observations"` expecting it to
append at the end of the `## Observations` section. Instead it appends to end of file,
corrupting note structure.
**Workaround:** Use `operation="find_replace"` targeting the last known line of the
section. Documented as a gotcha throughout the plugin.
**Status:** Open — workaround in place, but the API behavior is surprising and undocumented.

---

### `build_context` cannot detect zero-link (isolated) notes

**Discovered:** 2026-03-09 (v0.3.0)
**Impact:** Medium — orphan detection in knowledge-gardener was silently missing
fully-isolated notes because `build_context` only traverses edges. Zero-link notes
are invisible to it.
**Workaround:** Two-pass approach: `read_note(output_format="json")` inspects the
structured `relations` field to find zero-outbound candidates, then `build_context`
on each candidate confirms zero-incoming. True orphans (zero in + zero out) are
reliably detected this way.
**Status:** Open — two-pass workaround documented; upstream API has no direct
"find isolated nodes" capability. [upstream: [#762](https://github.com/basicmachines-co/basic-memory/issues/762) — open feature request filed by maintainer would obsolete this workaround]

---

### `search_type="text"` required for structural `[[prefix:` syntax queries

**Discovered:** 2026-03-13 (v0.9.0, knowledge-gaps Step 10)
**Impact:** Low-medium — using the default hybrid/vector search for `[[npm:` style
queries adds noise. The `[[` prefix is structural syntax, not semantic content, so
vector similarity is the wrong retrieval method.
**Workaround:** Explicitly pass `search_type="text"` for any query containing
structural wiki-link prefixes. This forces FTS5 full-text search instead of
vector/semantic. Works for `[[prefix:` queries because the prefix token is
distinctive, but does NOT do literal substring matching — FTS5 still tokenizes
on punctuation (colons, slashes, brackets are token boundaries).
**Status:** Open — workaround trivial, but the default hybrid behavior is surprising
when querying for non-semantic strings.

---

### `edit_note` re-parse triggers validation errors from unrelated notes

**Discovered:** 2026-03-29 (v0.16.0 era)
**Impact:** High — editing `npm:@voxpelli/eslint-config` via `edit_note(find_replace)`
failed with a `relation_type` MaxLen(200) error originating from `Config Loading
Patterns in Node.js` — a completely different note. That note had >200 chars of text
before a `[[wiki-link]]` in prose. `edit_note` does raw string replacement then
re-parses the ENTIRE note, calling `update_entity_relations` which surfaces validation
errors from related entities — not the edited note's own content.
**Workaround:** Fix the offending note first (shorten text before `[[` to under 200
chars), then retry the edit. The validation error identifies the problematic
`relation_type` text in its `input_value` field, which can be grepped across BM files
to find the source note.
**Status:** Partial fix in unreleased `main` — [PR #770](https://github.com/basicmachines-co/basic-memory/pull/770) (merged 2026-04-29) added a regression guard for long `relation_type` values via test coverage of [#721](https://github.com/basicmachines-co/basic-memory/issues/721). Hardens against future regressions on the underlying parsing rule but does NOT solve the **cross-note error attribution** problem — validation errors from unrelated notes still surface during a single-note edit. Expected fix shipping in next release after v0.20.3.

---

### FTS tokenizer doesn't match bare `[[` in observation search

**Discovered:** 2026-03-29 (v0.16.0 era)
**Impact:** Medium — `search_notes(query="[[", entity_types=["observation"])` returns 0
results, but `search_notes(query="[[npm:", entity_types=["observation"])` returns 3+
results. The FTS tokenizer strips or mishandles bare `[[` and needs prefix context to
match.
**Workaround:** Search per-prefix (`[[npm:`, `[[brew:`, `[[action:`, etc.) — requires
~10 calls instead of 1. Functional but verbose.
**Status:** Open — workaround functional.

---

### `list_directory` has no `bm tool` CLI wrapper

**Discovered:** 2026-03-29 (v0.16.0 era)
**Impact:** Medium — all MCP tools except `list_directory` have `bm tool` CLI wrappers
(e.g. `bm tool search-notes`, `bm tool read-note`). The missing wrapper blocks shell
script automation that needs directory enumeration.
**Workaround:** Use `bm tool search-notes --entity-type entity` with `--type` filters,
though this has different semantics and pagination behavior.
**Status:** Open — feature request.

---

### Observation search does not filter by parent note type

**Discovered:** 2026-03-29 (v0.16.0 era)
**Impact:** Medium — `search_notes(entity_types=["observation"], note_types=["brew_formula"])`
returns empty results. The `note_types` filter does not propagate to observations; it
only applies to entity-level results. To audit observations for a specific note type,
you must enumerate entities first, then search observations within each.
**Workaround:** Two-pass approach: enumerate entities of the target type, then search
observations per-entity or search all observations and filter by `entity_id` in the
result set.
**Status:** Open — feature request.

---

### `entity_types=["relation"]` enables direct relation-index search

**Discovered:** 2026-03-30 (v0.18.1, knowledge-gaps Step 10 rewrite)
**Impact:** High — the relation index stores parsed wiki-link relations with
`from_entity` and `to_entity` fields. When `to_entity` is absent/None, the
relation is unresolved (dead wiki-link). This is the correct primitive for
dead-link detection — far more reliable than FTS5 text search for `[[prefix:`
syntax.
**Workaround:** Not friction — this is a capability discovery. Key details:
- Relation titles are indexed as `"source → target"` — both names searchable
- `to_entity` absent = unresolved (DB `to_id` is NULL)
- Searches find both incoming and outgoing relations for an entity name
- Default `entity_types` is `["entity"]` — must explicitly set `["relation"]`
**Status:** Documented — stable API. Used by knowledge-gaps Steps 10 and 14a.

---

### Use `note_types=["<type>"]` instead of FTS5 for type filtering

**Discovered:** 2026-03-30 (standard-detection.md bug)
**Impact:** High — `search_notes(query="type: standard", search_type="text")`
does NOT find notes by frontmatter type. FTS5 tokenizes the colon, matching
any note containing both words "type" and "standard" in any context.
**Workaround:** Use `search_notes(note_types=["standard"])` — the dedicated
metadata filter checks the frontmatter `type` field directly. The parameter
existed all along, was just not used.
**Status:** Documented — not a bug, but the FTS5 approach silently returns wrong results.

---

### Colon-prefixed titles break Obsidian wiki-link resolution

**Discovered:** 2026-04-05
**Impact:** High — BM docs claim "Every \[\[wiki link\]\] your AI creates is a clickable
backlink in Obsidian" but `[[npm:fastify]]` is unresolvable because Obsidian forbids
colons in filenames on all platforms and resolves by filename first. BM stores
`npm:fastify` as `npm-fastify.md` but wiki-links use the title form. Affects ~38% of
notes in graphs using colon-prefixed naming conventions (~280+ notes, ~600+ cross-references).
Severity: degraded · Ownership: upstream · Workaround: partial — can add `aliases`
frontmatter for Obsidian discoverability, but Obsidian rewrites links to
`[[npm-fastify|npm:fastify]]` which then degrades BM's own strict title-based resolution.

---

### `character-handling.md` omits colon documentation

**Discovered:** 2026-04-05
**Impact:** Minor — BM's `docs/character-handling.md` covers hyphens, case, Unicode,
and slashes but never mentions colons — the most impactful special character for
Obsidian interoperability. `sanitize_for_filename()` replaces colons with hyphens
silently via `re.sub(r'[<>:"|?*]', replacement, text)`.
Severity: minor · Ownership: upstream · Workaround: full — behavior is predictable
once discovered.

---

### LinkResolver should resolve wiki-links against aliases/metadata

**Discovered:** 2026-04-05
**Impact:** High — BM's `_resolve_in_project` cascade is: external_id → permalink →
exact title match → file_path → fuzzy. Adding an alias-based step (querying
`entity_metadata` for alias matches) between title and file_path would enable
Obsidian-compatible wiki-links like `[[npm-fastify]]` to resolve when the title is
`npm:fastify`. The `entity_metadata` JSON column and open `EntityFrontmatter` model
already support storing custom fields like `aliases`.
Ownership: upstream · Workaround: none — no way to resolve by alias currently.

---

### Phased Obsidian colon-compatibility fix (Upstream Opportunity)

**Discovered:** 2026-04-05
**Impact:** High — a 3-phase approach that benefits all BM users with non-filename-safe
titles: (1) add `aliases` frontmatter to prefixed notes for Obsidian discoverability,
(2) upstream PR adding alias-based resolution to LinkResolver, (3) gradual wiki-link
migration from `[[npm:fastify]]` to `[[npm-fastify]]`. Phase 2 is the key upstream
contribution — it closes the gap between BM's title-based and Obsidian's filename-based
resolution models.
Source: vp-claude research session 2026-04-05 · Merge readiness: needs-redesign ·
Ownership: shared · Workaround: partial — aliases provide Obsidian discoverability
but don't fix existing body wiki-links.

---

### `edit_note(find_replace)` on schema frontmatter creates duplicate frontmatter

**Discovered:** 2026-04-06
**Impact:** High — using `edit_note` with `find_replace` to modify a schema note's
YAML frontmatter caused BM to prepend a `permalink`-only frontmatter block, pushing
the real schema (with `entity`, `version`, `schema:` block) into the body as content.
`schema_validate` then reports "No schema found" because it reads the first (empty)
frontmatter only.
**Workaround:** Use `write_note` with `overwrite=True` to replace the entire schema
note cleanly. This avoids the re-parse that generates the duplicate frontmatter.
**Status:** Open — workaround reliable but requires rewriting the full note.

---

### `search_notes(note_types=[X])` matches directory paths, not just frontmatter type

**Discovered:** 2026-04-06
**Impact:** Medium — `search_notes(note_types=["engineering"])` returns notes whose
file path contains "engineering" (e.g. `engineering/history/Agile Manifesto.md` with
`type: milestone`), not just notes with `type: engineering` in frontmatter. This
inflates type counts by ~20% for types sharing names with directories.
**Workaround:** Verify counts via `read_note(include_frontmatter=true)` on individual
results when precision matters. Never rely on `search_notes` counts alone for type
audits.
**Status:** Open — behavior is undocumented.

---

### `bm project info` exposes `most_connected_entities` and `total_unresolved_relations`

**Discovered:** 2026-03-30 (DeepWiki research for concept gap detection)
**Impact:** Medium — `bm project info main --json` returns:
- `statistics.total_unresolved_relations` — count of dead wiki-links (quick gate)
- `statistics.most_connected_entities` — top 10 entities by outgoing relation
  count, with `title`, `permalink`, `relation_count`. Free hub-node detection
  without graph traversal.
**Workaround:** Not friction — this is a capability discovery. No workaround needed.
**Status:** Documented — stable CLI output. Used by knowledge-gaps Steps 10 and 14a.

---

### `write_note` / `edit_note` return before semantic indexing completes

**Discovered:** 2026-05-04 (from upstream activity review of post-v0.20.3 sprint)
**Impact:** Medium — write tools return as soon as the FTS index is updated synchronously, but vector embedding indexing runs asynchronously. A note written via `write_note` may not be hybrid-search-hittable for a few seconds even though `read_note` works immediately. Affects workflows that write a note then immediately search for it (cross-link sweeps, schema validation chains).
Severity: degraded · Ownership: upstream · Workaround: full — separate the write and the semantic-search query in time, or use FTS-only search via `search_type="text"` for the immediate post-write read. Most vp-knowledge skills that already do this (post-write cross-linking happens via `search_notes` with text queries) are unaffected.
**Status:** Open upstream — [#763](https://github.com/basicmachines-co/basic-memory/issues/763) filed 2026-04-24 by `groksrc`. Already on the maintainer's radar; not yet fixed in `main`.
