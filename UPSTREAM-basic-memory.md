# Upstream: basic-memory

Friction, limitations, and capability discoveries found while building vp-knowledge on top of Basic Memory.

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
"find isolated nodes" capability.

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
**Status:** Open — workaround in place, but the blast radius of edit_note validation
is surprising. Expected: errors from the edited note only.

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

### `bm project info` exposes `most_connected_entities` and `total_unresolved_relations`

**Discovered:** 2026-03-30 (DeepWiki research for concept gap detection)
**Impact:** Medium — `bm project info main --json` returns:
- `statistics.total_unresolved_relations` — count of dead wiki-links (quick gate)
- `statistics.most_connected_entities` — top 10 entities by outgoing relation
  count, with `title`, `permalink`, `relation_count`. Free hub-node detection
  without graph traversal.
**Workaround:** Not friction — this is a capability discovery. No workaround needed.
**Status:** Documented — stable CLI output. Used by knowledge-gaps Steps 10 and 14a.
