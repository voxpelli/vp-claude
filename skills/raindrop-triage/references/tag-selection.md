# Tag Selection Strategy

These rules apply to both the first pass (Step 8a) and the Tag Selection
Guidelines used throughout. Both passes follow the same logic.

## Tag Proposal Pipeline

For each bookmark, propose tags using this strategy in order:

**A — Copy-from-similar** (primary signal): Search for bookmarks similar to
the candidate's topic:

```
mcp__raindrop__find_bookmarks(search="<topic keywords from title>", limit=5)
```

Extract tags from the top 3-5 results. Count tag frequency across results.

**B — Topic-match boost**: If a tag name appears as a word in the bookmark's
title or topic keywords, boost it regardless of frequency.

**C — Filter blocklist**: Remove any tag listed in the vocabulary file's
`blocklist` frontmatter field. Support exact matches (case-insensitive) and
prefix wildcards (entries ending in `*` match any tag with that prefix, e.g.,
`for:*` matches `for:jane`). If the vocabulary file exists but `blocklist`
is absent, skip filtering. If the vocabulary file is missing entirely, apply
a minimal fallback: numeric-only tags (`1`-`9`) and `imported`.

**D — Vocabulary fallback**: If fewer than 3 similar bookmarks found in
Step A, match topics against the vocabulary file's table characterizations.

**E — Selection rules**:
- Pick 2-4 tags per bookmark (aim for 3)
- Each tag must add DISTINCT information — if A implies B, drop B
- Prefer the MOST SPECIFIC tag: `nodejs` not `javascript`
- Two tags from the same cluster is a smell — prefer cross-cluster
- For research burst members: always include `research-burst`
- For each `context_tags` entry in the vocabulary file's frontmatter where
  `match: domain`, check if the bookmark URL hostname matches the `pattern`
  glob. If it matches, inject the specified `tag`.

**F — User conventions**: Apply any substitution rules from the vocabulary
file's `conventions` frontmatter. For each entry, if the `replace` tag is
being proposed, drop it and add all `with` tags instead. If no vocabulary
file is loaded or `conventions` is absent, skip.

## Tag Axes

Tags serve three orthogonal purposes:

1. **WHAT** (topic): `mcp`, `css`, `fastify`, `react` — what the content is about
2. **HOW** (content type): `article`, `code`, `tools`, `standards` — what kind
   of content it is
3. **WHY** (context): `research-burst`, context tags from vocabulary — why it was bookmarked

Aim for at least one WHAT tag per bookmark. HOW and WHY tags are situational.

## Vocabulary-first Principle

Always check the tag vocabulary file (`~/.claude/references/raindrop-tags.md`)
before proposing a tag. Use existing tags over inventing new ones. The
vocabulary file contains curated tags with counts and characterizations.

## Copy-from-similar Pattern

The primary tag signal comes from existing bookmarks on similar topics. Search
for similar bookmarks, extract their tags, and weight by frequency. This
ensures consistency with the user's established tagging patterns.

## Blocklist

Apply the vocabulary file's `blocklist` frontmatter field (same logic as
Filter C above). If no vocabulary file is loaded, apply the minimal fallback:
numeric-only tags (`1`-`9`) and `imported`.

## User Conventions

Apply `context_tags` and `conventions` from the vocabulary file's frontmatter
(same logic as Rules E and F above). Use `research-burst` for bookmarks in
detected temporal clusters.
