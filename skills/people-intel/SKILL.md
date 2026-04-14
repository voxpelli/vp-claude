---
name: people-intel
description: "This skill should be used when the user asks to 'research person', 'person intel', 'people intel', 'who is [person]', 'who created [project]', 'who maintains [package]', 'add person to knowledge graph', 'enrich person note', 'update person note', 'document [person]', 'create person note for [name]'. Researches a person using five-source enrichment (Basic Memory, Raindrop, Readwise, Tavily, DeepWiki) and creates/updates a structured Basic Memory person note with post-write cross-linking."
user-invocable: true
argument-hint: "<Full Name>"
allowed-tools:
  - Read
  - mcp__basic-memory__search_notes
  - mcp__basic-memory__read_note
  - mcp__basic-memory__write_note
  - mcp__basic-memory__edit_note
  - mcp__basic-memory__build_context
  - mcp__deepwiki__ask_question
  - mcp__tavily__tavily_search
  - mcp__tavily__tavily_extract
  - mcp__raindrop__find_bookmarks
  - mcp__raindrop__fetch_bookmark_content
  - mcp__readwise__readwise_search_highlights
  - mcp__readwise__reader_search_documents
---

# People Intelligence

Research a person and synthesize a structured Basic Memory person note using
five enrichment sources, then cross-link existing notes.

## Arguments

One argument: the person's full name. No prefix required — person names are
unique identifiers in this graph.

| Form | Example |
|------|---------|
| `<Full Name>` | `Linus Torvalds` |
| `<Full Name>` | `Tim Berners-Lee` |
| `<Full Name>` | `Aaron Gustafson` |

If the argument contains ` - ` (the title separator), split into `name` and
`descriptor`. Otherwise treat the full argument as `name` and derive the
descriptor from research.

### Step 0: Normalize input

Strip leading/trailing whitespace. If the argument looks like a BM note title
(contains ` - `), split into name and descriptor. Otherwise treat the whole
argument as the person's name.

### Step 1: Check for existing note

<!-- This pattern is mirrored in package-intel and tool-intel — update all when changing -->

Search by name across person notes:
```
search_notes(query="<name>", note_types=["person"], page_size=5)
```

Also do a broad text search in case the note uses a different title format:
```
search_notes(query="<name>", search_type="text", page_size=10)
```

If a matching person note is found, read it:
```
read_note(identifier="<title>", include_frontmatter=true, output_format="json")
```

**Freshness check:** Scope research based on note age (check `updated_at`):

| Note age | Sources to run | Sources to skip |
|----------|---------------|-----------------|
| Missing or >180 days | All 5 (full pipeline) | None |
| 60–180 days | All except Raindrop | Raindrop |
| <60 days | Tavily bio + DeepWiki only | Raindrop, Readwise |

Note any previous `[gotcha]` or `[controversy]` observations — these guide
what to look for in new research.

Append new observations rather than overwriting.

### Step 2: Five-source enrichment (run in parallel)

**Multi-query strategy:** For Tavily, ask 2 targeted questions (bio/role and
contributions/influence) rather than one broad query.

Launch these research queries simultaneously:

**a) Basic Memory context — deep graph traversal:**

People are key connectors in the knowledge graph — a single person may be
referenced across engineering, indieweb, security, and accessibility clusters.
The BM step is therefore deeper than in package-intel or tool-intel.

If a note exists, build context with depth 2 to discover second-hop connections:
```
build_context(url="<note-title>", depth=2, max_related=15)
```

Then search broadly for mentions across all note types:
```
search_notes(query="<name>", search_type="text", page_size=20)
```

If no note exists, run the text search first, then build context from the
highest-scoring related note to explore its neighborhood:
```
search_notes(query="<name>", search_type="text", page_size=20)
build_context(url="<highest-scoring-related-note>", depth=1, max_related=10)
```

**Relation mining:** For each note that mentions the person, note:
- What role the person plays in that note (creator, advocate, author, inventor)
- Whether the mention is substantive or passing
- Which relation verb from the person schema best describes the connection

This produces a richer set of relations than just `relates_to` — use `created`,
`founded`, `maintains`, `works_with`, `enables` where they apply.

**Cross-cluster discovery:** People often bridge unrelated graph clusters.
After the initial search, check if results span multiple directories
(e.g., results appearing in 3+ distinct directories). If so, the person is a
cross-cluster connector — document this in a `[connection]` observation.

**b) Raindrop — bookmarked articles by or about the person:**
```
find_bookmarks(search="<name>")
```

If fewer than 3 results, search again with a known alias, project name, or
domain (e.g., `find_bookmarks(search="adactio")` for Jeremy Keith):
```
find_bookmarks(search="<alias-or-project>")
```

If bookmarks are found, fetch content from the top 2-3 most relevant results:
```
fetch_bookmark_content(bookmark_id=<id>)
```

These are articles the user deliberately saved — high relevance signal.

**c) Readwise — highlights from their writing:**
```
readwise_search_highlights(vector_search_term="<name> <primary-domain>")
reader_search_documents(query="<name>")
```

Highlights contain expert-selected passages from the user's reading (books,
articles, documentation). These have high signal-to-noise ratio and may surface
insights not found in any other source. Reader documents may contain in-depth
articles by or about the person.

If both return empty, note "source c: no Readwise content found" and proceed.

**d) Tavily — biographical and professional data:**

Two targeted queries:
```
tavily_search(query="<name> bio role current work projects contributions", max_results=5)
tavily_search(query="<name> <primary-domain> influence controversy", max_results=5)
```

If the person has a personal site (identifiable from Raindrop or Readwise
results), extract the about page:
```
tavily_extract(urls=["<personal-site-url>/about"], query="role bio current projects")
```

This is the primary source for the `role` and `impact` fields.

**e) DeepWiki — GitHub repository analysis (conditional):**

Only run if Tavily or Raindrop surfaces a GitHub username or the person is
primarily known as a developer/maintainer of open source projects.

```
ask_question(repo="<github-username>/<primary-repo>", question="What are this project's goals, design philosophy, and key patterns?")
```

The goal is understanding the person's approach through their work, not
documenting the package API (that's what `/package-intel` does).

If no GitHub presence is evident, skip and note "source e: no GitHub
presence found".

### Step 3: Synthesize into note

Read the note template:
`${CLAUDE_PLUGIN_ROOT}/skills/people-intel/references/note-template-person.md`

Read the source guide for query refinement tips:
`${CLAUDE_PLUGIN_ROOT}/skills/people-intel/references/source-guide.md`

**Fourth-wall guardrail:** Before writing, verify every sentence passes the
export test — "would someone unfamiliar with Basic Memory understand this
paragraph?" Delete any sentence that:
- Claims the person "has no presence in Raindrop/BM"
- Explains where the note fits in the knowledge graph
- References the research process rather than the person
- Describes the note's coverage status rather than the person's work

This prevents the fourth-wall anti-pattern (self-referential content in
subject-domain notes). See the `vp-note-quality` skill checklist for the
full ruleset.

**Title convention:** `<Full Name> - <Brief Descriptor>`. The descriptor
should be a concise phrase (3-8 words) capturing the person's primary
contribution or role. Examples:
- `Linus Torvalds - Linux Creator`
- `Tim Berners-Lee - World Wide Web Inventor`
- `Aaron Gustafson - Web Standards and Accessibility Advocate`

**Directory:** Default to `people/`. If the person clearly belongs to a
domain cluster with an existing directory convention, use that directory.
When uncertain, use `people/`.

**No wiki-links in observations.** Never use `[[Target]]` syntax in observation
lines. BM's parser treats any `[[` as a relation boundary — the text before it
becomes the `relation_type` field (max 200 chars), causing validation failures.
Put all wiki-links in `## Relations` only.

### Step 4: Write or update the note

<!-- This pattern is mirrored in package-intel and tool-intel — update all when changing -->

**New person:** Use `write_note` with the full template. Set
`note_type="person"`.

**Existing person:** Use `edit_note` with `find_replace` to insert new
observations after the last existing `- [category]` line in `## Observations`.
Do NOT use `operation="append"` with `section="Observations"` — it appends to
the end of the file, not the end of the section.

### Step 5: Confirm and summarize

Report to the user:
- Note location (directory/title)
- Key findings from each source (1 line each)
- Any controversies or sensitivities surfaced
- Cross-links to be added in Step 6

### Step 6: Cross-link existing notes

After writing the note, search for existing notes that reference this person
in their body text or observations but lack a wiki-link back to them:

```
search_notes(query="<name>", search_type="text", page_size=15)
```

The page size is larger than in package-intel because person names appear in
prose more often than package names. Filter carefully — only add links where
the mention is substantive (attributing a quote, citing their work, listing
them as a creator). Do not link notes that mention the name only in passing.

For each qualifying result (excluding the note just written):
1. Read its `## Relations` section
2. If the person is mentioned in body/observations but not linked in Relations,
   add a link via `edit_note` with `find_replace`:

```
edit_note(
  identifier="<existing-note-title>",
  operation="find_replace",
  find_text="- <last_relation_type> [[<Last Existing Relation>]]",
  content="- <last_relation_type> [[<Last Existing Relation>]]\n- relates_to [[<person-title>]]"
)
```

Cross-linking is bidirectional: also check the new person note's
`## Relations` section. If source a) surfaced related project, standard, or
concept notes that should link back, add `created [[Project]]`,
`maintains [[Project]]`, or `relates_to [[Standard]]` relations using the
person schema's relation vocabulary.

For adding outbound relations to the new person note itself:

```
edit_note(
  identifier="<person-title>",
  operation="find_replace",
  find_text="- <last_relation_type> [[<Last Existing Relation>]]",
  content="- <last_relation_type> [[<Last Existing Relation>]]\n- created [[<Project-Title>]]"
)
```

Only add links where the relationship is genuine. Skip this step for updates to
existing notes where cross-links likely already exist.
