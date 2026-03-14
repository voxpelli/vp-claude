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
