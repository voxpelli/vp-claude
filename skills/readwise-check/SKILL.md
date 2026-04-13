---
name: readwise-check
description: "This skill should be used when the user asks 'how much have I read about
  [topic]', 'readwise check [topic]', 'reading coverage for [topic]', 'do I have
  highlights on [topic]', 'what have I saved about [topic] in Readwise', 'reading
  depth on [topic]', 'pre-research check', 'readwise lookup'. Quick pre-research
  lookup that reports highlight count, document count, and reading depth for a topic
  across Readwise highlights and Reader documents."
user-invocable: true
argument-hint: "<topic>"
allowed-tools:
  - mcp__readwise__readwise_search_highlights
  - mcp__readwise__reader_search_documents
---

# Readwise Check

Quick pre-research lookup for a topic across Readwise. Reports how many
highlights, how many documents, and how deeply the topic has been read.
Helps decide whether to dive deeper with `/package-intel`, `/knowledge-ask`,
or just start reading.

## Arguments

The user provides a topic after the skill invocation:

| Form | Example |
|------|---------|
| Package name | `/readwise-check fastify` |
| Topic | `/readwise-check knowledge management` |
| Concept | `/readwise-check IndieWeb` |

## Edge Cases

- **No argument** — report "Usage: `/readwise-check <topic>`" and exit.
- **Readwise unavailable** — report "Readwise unavailable — cannot check
  reading coverage" and exit.
- **Zero results** — report "No Readwise coverage for `<topic>`." and exit
  cleanly. Suggest `/package-intel` if the topic looks like a package name.
- **Very broad topic** — results may be noisy. Report counts as-is; the
  user can narrow with a more specific query.

## Workflow

### Step 1: Search highlights

```
mcp__readwise__readwise_search_highlights(vector_search_term="<topic>")
```

Count the returned highlights (N). Note which source books/articles they
come from.

### Step 2: Search Reader documents

```
mcp__readwise__reader_search_documents(vector_search_term="<topic>")
```

Count unique documents (M). For each document, check if `reading_progress`
is available in the response. Count documents where the user has meaningfully
engaged (opened or partially read) as deeply read (K).

If `reading_progress` is not in the response, use `first_opened_at` as a
proxy — documents that have been opened at least once count as engaged.

### Step 3: Present summary

````markdown
## Readwise: `<topic>`

**N highlights** across **M documents**. **K deeply read.**

### Top sources
- *Book or Article Title* — X highlights
- *Another Source* — Y highlights
- *Third Source* — Z highlights

### Reader documents
- **Title** — location: inbox/later/archive, progress: 45%
- **Title** — location: shortlist, progress: 100%
````

Keep the output compact. No analysis or recommendations — just the facts.
If the user wants to act on this, they know their own workflow.

## Guidelines

- **Report, don't recommend** — present counts and sources. Do not suggest
  what the user should read next or which highlights are most important.
- **Fast** — this is a pre-research check, not a deep dive. Two API calls
  maximum.
- **Compact output** — the value is in the summary line. The detail tables
  are supplementary.
