# Upstream: basic-memory

Friction and limitations discovered while building vp-knowledge on top of Basic Memory.

## Open items

### `operation="append"` with `section=` appends to end of file, not end of section

**Discovered:** 2026-03-13 (v0.1.0–v0.2.0 era)
**Impact:** High — affected knowledge-maintainer, session-reflector, and tool-intel. All
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
structural wiki-link prefixes. This forces exact text match and eliminates
false positives.
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
