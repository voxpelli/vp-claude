# Concept-Level Gap Detection — Reference

Use this reference during Steps 14–15 of the knowledge-gaps workflow to
detect concept-level hub gaps and reading-signal gaps.

### 14. Detect concept-level gaps

Concept hubs are topics referenced across multiple package/tool notes that
deserve their own dedicated note (type: `engineering`, `standard`, or
`concept`). These are structural gaps invisible to package/tool-level auditing.

**14a. Mine the relation graph for implicit hub gaps:**

Use the `most_connected_entities` from `bm project info main --json`
(top 10 entities by outgoing relation count) as seed entities. If the CLI
is unavailable, fall back to Tier 1 documented packages from Step 3.

For the top 5 seeds, query the relation index to find ALL their relations
(both incoming and outgoing — relation titles index both directions):

```
search_notes(query="<seed-title>", entity_types=["relation"], output_format="json", page_size=50)
```

From all results across the 5 queries, identify unresolved relations by
checking whether `to_entity` is present in each result:

- **`to_entity` present** — resolved (skip)
- **`to_entity` absent** — unresolved (dead link — the target has no note)

Among the unresolved targets:

- **Prefixed targets** (`npm:*`, `brew:*`, etc.) are already covered by
  Step 10's dead wiki-link detection — skip these.
- **Non-prefixed targets** are concept/engineering/standard candidates.
  Extract the target name from the relation `title` (format:
  `"source → target"`).

Count non-prefixed unresolved targets by frequency. A target appearing in
3+ distinct source notes is a **hub gap candidate**.

**Optional context enrichment:** For top hub gap candidates, use
`build_context` on the source notes that reference them (depth=1) to
understand why the concept is referenced — this helps classify priority
in Step 14c. Note: `build_context` cannot discover dead links directly
(returns empty for non-existent notes), so use it for context only, not
discovery.

**14b. Mine Readwise for concept signals:**

Derive queries from the project context known from Steps 0–13 — do not
use generic phrases. Use the actual ecosystem names, top Tier 1 package
names, and hub gap candidates from 14a.

For each hub gap candidate from 14a (up to 5):

```
readwise_search_highlights(vector_search_term="<candidate-topic>")
```

Also query for the project's primary framework/domain (from Steps 0-1):

```
reader_search_documents(query="<primary-framework> patterns architecture")
```

Limit to 3-5 queries total. A topic with 3+ Readwise highlights/documents
AND no BM note is a **reading-signal gap**. Discard off-domain results
(e.g., a Node.js project returning Zig allocator highlights).

If Readwise tools are unavailable (MCP server not configured), skip this
step and report only graph-based hub gaps.

**14c. Classify concept gaps:**

- **Hub gap** (referenced by 3+ notes, no dedicated note): structural gap
- **Reading-signal gap** (3+ Readwise highlights on a topic, no BM note): interest gap
- **Combined** (both graph references and reading signal): highest priority

### 15. Add concept gaps to report

Append after the Domain Standard Coverage section:

````markdown
## Concept Coverage

### Hub Gaps (referenced by 3+ notes, no dedicated note)
| Concept | Referenced by | Priority |
|---------|--------------|----------|
| <target> | <N> notes | hub |

### Reading-Signal Gaps (3+ Readwise highlights, no BM note)
| Concept | Highlights | Priority |
|---------|-----------|----------|
| <topic> | <N> | interest |

### Concept Summary
- Hub gaps: N
- Reading-signal gaps: M
- Combined (highest priority): P
````

For top concept gaps, suggest creating concept notes manually or via the
session-reflector agent, since concept notes require more editorial judgment
than package/tool notes.

Add concept gap counts to the Overall Summary:

```
- Concept hub gaps: N
- Reading-signal gaps: M
```
