# Cross-link Existing Notes

Shared by both `/intel` families. Loaded from Step 7 (cross-link).

After writing the note, search for existing notes that reference this note's
subject in their body text or observations but lack a wiki-link back to it:

```
search_notes(query="<name>", search_type="text", page_size=10)
```

For each result (excluding the note just written):
1. Read its `## Relations` section
2. If the subject is mentioned in body/observations but not linked in Relations,
   add a link via `edit_note` with `find_replace`:

```
edit_note(
  identifier="<existing-note-title>",
  operation="find_replace",
  find_text="- <last_relation_type> [[<Last Existing Relation>]]",
  content="- <last_relation_type> [[<Last Existing Relation>]]\n- relates_to [[<prefix>-<name>]]"
)
```

Only add links where the relationship is genuine — don't link notes that
mention the same word in an unrelated context. Skip this step for updates to
existing notes where cross-links likely already exist.

**Verify the specific edge resolved — not via `build_context`.** After adding
a link, confirm that specific previously-dangling relation now resolves by
querying the relation index directly, not by re-running `build_context`:

```
search_notes(query="<existing-note-title-or-target-name>", entity_types=["relation"], page_size=10)
```

Find the specific relation row for the edge you just added or fixed and
confirm it shows a populated `to_entity`/target rather than a dangling
target. **Caution:** `build_context`'s bidirectional "Related" list traverses
only *resolved* edges and can surface a *reciprocal* relation — e.g. the
`relates_to` link the target note already carries back to the note you just
edited — which reads as success even when the specific egress edge you just
wrote is still unresolved (`to_id NULL`). Seeing the target appear in
`build_context`'s Related list does not confirm that edge; only the relation
index does.

**Reconcile bare-name stubs.** Existing notes elsewhere in the graph may
reference this subject via a bare `[[<name>]]` wiki-link — no
ecosystem/tool prefix — written before the prefix convention (v0.22.0+) or before
this note existed. Basic Memory resolves wiki-links by exact title match, so
`[[<name>]]` does NOT resolve to `[[<prefix>-<name>]]` — the
link silently stays broken. Reconcile it explicitly. Search relations, not
text — FTS5 strips brackets, so a `search_type="text"` query containing
`[[`/`]]` degrades to an unscoped match on the bare word; `entity_types:
["relation"]` with the bare name and no `search_type` (default hybrid)
instead searches the relation's indexed text — for a resolved relation the
title carries both endpoints, while for a dangling bare-name link the
target survives in the relation's permalink slug, which the default
hybrid/semantic search surfaces — an explicit `search_type="text"` would
not, since text search is scoped to `title`/`content_stems` only and never
matches on `permalink`:

```
search_notes(query="<name>", entity_types=["relation"], page_size=10)
```

For each result (excluding the note just written) that contains a bare
`[[<name>]]` link aimed at this subject — not an unrelated note that
happens to share the bare name — rewrite it to the full title:

```
edit_note(
  identifier="<existing-note-title>",
  operation="find_replace",
  find_text="[[<name>]]",
  content="[[<prefix>-<name>]]"
)
```

As with the cross-link step above, verify each match actually names this
subject before rewriting — a generic bare name (e.g. a common English word)
can produce false positives.
