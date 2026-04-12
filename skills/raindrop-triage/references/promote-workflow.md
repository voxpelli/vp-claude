# Promotion Workflow (`--promote`)

Classifies AI-triaged bookmarks into AI-sorted, AI-gems, AI-archive, or
AI-attention. Invoked via `/raindrop-triage --promote`.

## Step 0: Parse source override

Accept optional `--source <collection>` to override the default AI-triaged
source. This solves the bootstrap problem where bookmarks were pre-triaged
before the skill existed. If `--source unsorted` is passed, use collection
ID `-1` (Raindrop's unsorted). Otherwise discover the named collection via
`find_collections`.

## Step 0.5: Create progress checklist

Create a TodoWrite checklist:

- `[ ] Discover collections`
- `[ ] Fetch source bookmarks`
- `[ ] Classify batches (updated with count once known)`
- `[ ] Append attention notes`
- `[ ] Move to targets`
- `[ ] Count verification`
- `[ ] Report`

Mark each item complete as the corresponding step finishes.

## Step 1: Discover AI-managed collections

```
mcp__raindrop__find_collections(search="AI-")
```

Verify source collection exists and has bookmarks. Create AI-sorted, AI-gems,
AI-archive, and AI-attention lazily if they do not exist:

```
mcp__raindrop__create_collections(collections=[
  {title: "AI-sorted"},
  {title: "AI-gems"},
  {title: "AI-archive"},
  {title: "AI-attention"}
])
```

## Step 2: Fetch source bookmarks

```
mcp__raindrop__find_bookmarks(collection_ids=[<source-id>], limit=200)
```

If 0 results, report "No bookmarks in <source> to promote" and exit.

## Step 3: Present classification batches

Group bookmarks into batches of 8-15. For each batch, propose a
classification based on:

- **AI-sorted** — useful, organized bookmarks worth keeping (the default
  destination for most bookmarks — work references, tools, articles, docs)
- **AI-gems** — golden stuff — seminal papers, canonical references,
  foundational texts, high-reuse gems that define a field or practice
- **AI-archive** — ephemeral content (shopping, expired promos, one-off
  lookups), duplicate topics already well-covered, low-reuse probability
- **AI-attention** — needs human decision (adopt a tool? migrate?),
  contradicts existing knowledge, promising research lead, topic has no
  BM coverage

Present to the user and wait for approval:

````markdown
## Promotion Batch 1/4

| # | Title | Tags | Proposed | Reason |
|---|-------|------|----------|--------|
| 1 | Fastify Reply Docs | `fastify`, `docs` | sorted | Useful work reference |
| 2 | Old Shopping Page | `shopping` | archive | Ephemeral, no reuse |
| 3 | Worse Is Better - Richard Gabriel | `manifesto` | gems | Foundational essay, defines a field |
| 4 | New Vector DB Tool | `vectordb`, `genai` | attention | [research-lead] Promising, needs eval |

Approve all, or adjust (e.g. "2: sorted instead")?
````

### Classification examples

- **gems**: Primary specs (RFC, W3C), foundational essays, tools used daily,
  canonical documentation that defines a field
- **sorted**: Work references, useful articles, docs for tech in your stack,
  bookmarks you'd want to find again
- **archive**: Shopping pages, version announcements, niche tools not in use,
  expired campaigns, one-off lookups
- **attention**: Tool adoption decisions, research leads, knowledge gaps,
  topics that contradict existing understanding

## Step 4: Append AI-attention notes

For bookmarks classified as AI-attention, append a structured note to the
bookmark's note field. **Never overwrite existing note content.**

The append format uses a delimiter to separate AI-generated notes from
any existing content:

```
---ai-triage---
[type] reason
tagged: YYYY-MM-DD
```

AI-attention note types:
- `[research-lead]` — promising topic worth investigating
- `[decision]` — needs human decision (adopt tool, migrate, etc.)
- `[anomaly]` — contradicts knowledge or reveals gap
- `[gap-signal]` — topic has no BM coverage (from burst cross-ref)
- `[action-needed]` — explicit follow-up language in title

To append, use the `note` field returned in Step 2's `find_bookmarks` response
(cache it per bookmark ID when fetching), then update:

```
mcp__raindrop__update_bookmarks(updates=[{
  bookmark_ids: [<id>],
  update: { note: "<existing-note>\n\n---ai-triage---\n[research-lead] Promising vector DB — evaluate for project X\ntagged: 2026-04-12" }
}])
```

If the note field would exceed 10,000 characters after appending, skip the
append and warn the user.

## Step 5: Move to target collections

For each classification group, move bookmarks to the target collection.
Use separate `update_bookmarks` calls per collection:

```
mcp__raindrop__update_bookmarks(updates=[{
  bookmark_ids: [<sorted-ids>],
  update: { collection_id: <ai-sorted-id> }
}])
```

## Step 5.5: Count verification

After all batches: verify `processed + skipped = source total`. If mismatch,
present the missing bookmarks and ask how to handle them. This prevents
silent bookmark loss during batch processing.

## Step 6: Report

````markdown
## Promotion Summary

- **Processed:** 131 bookmarks from AI-triaged
- **AI-sorted:** 72 (useful, organized bookmarks)
- **AI-gems:** 15 (golden reference material)
- **AI-archive:** 30 (low-reuse, ephemeral content)
- **AI-attention:** 14 (needs human decision or further research)

AI-attention items have structured notes — review them in Raindrop
or search for `---ai-triage---` in bookmark notes.
````
