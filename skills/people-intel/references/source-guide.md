# People-Intel Source Guide

Source-specific research guidance for the five-source enrichment pipeline.

## Contents

- [Source a: Basic Memory context](#source-a-basic-memory-context)
- [Source b: Raindrop bookmarks](#source-b-raindrop-bookmarks)
- [Source c: Readwise highlights](#source-c-readwise-highlights)
- [Framing extracted observations around the subject](#framing-extracted-observations-around-the-subject)
- [Source d: Tavily web search](#source-d-tavily-web-search)
- [Source e: DeepWiki (conditional)](#source-e-deepwiki-conditional)

## Source a: Basic Memory context

Always run. Never skip.

**Strategy:** Build context from the person's existing note (if any) to find
connected notes and avoid duplicating observations. If no note exists, search
by name to find notes that mention the person.

**Gotcha:** Person names may appear in many notes as passing mentions. Only
track references where the person is substantively discussed (attributed a
quote, cited as a creator, listed in a timeline).

## Source b: Raindrop bookmarks

**Primary search:** `find_bookmarks(search="<full name>")`

**Fallback searches** (run if primary returns <3 results):
- Personal site domain: `find_bookmarks(search="<personal-domain>")` (e.g., their blog domain)
- Project name: `find_bookmarks(search="<well-known-project>")` (e.g., a book or framework they created)
- Known alias or handle: `find_bookmarks(search="<handle>")` (e.g., their Twitter/Mastodon handle)

**Fetch priority:** Rank bookmarks by relevance:
1. Articles *by* the person (highest signal — their own voice)
2. Profile/interview articles *about* the person
3. Articles that cite the person as a key reference

Fetch content for the top 2-3. Extract:
- Professional roles and affiliations
- Key ideas, methodologies, or positions
- Projects mentioned or created
- Star rating or tags that indicate the user's assessment

## Source c: Readwise highlights

**Two-tool strategy:**
1. `readwise_search_highlights(vector_search_term="<name> <primary domain>")`
   — finds highlighted passages from books and articles
2. `reader_search_documents(query="<name>")`
   — finds saved Reader documents by or about the person

**Highlight signal:** When the user highlighted a specific passage from
someone's writing, that passage represents a deliberately selected insight.
These should become `[readwise]` observations citing the source document.

**Handling no results:** Common for less-prominent figures or those who write
primarily in non-English languages. Note "source c: no Readwise content found"
and proceed. Do not treat absence of highlights as absence of importance.

## Framing extracted observations around the subject

When writing `[raindrop]` or `[readwise]` observations from extracted content,
frame them around the **subject's reach or influence**, not the user's
bookmarking or reading pattern. The subject is the note's center; the user's
corpus is evidence of reach, not the subject of the sentence.

| Bad (fourth-wall) | Good (subject-focused) |
|-------------------|------------------------|
| `[raindrop] User bookmarked five posts from X's blog (2009-2010)` | `[reach] X's blog circulated through <network> 2009-2010 (5 posts saved as evidence)` |
| `[raindrop] First contact with X's work in the user's library was via Y` | `[reach] Y was X's first-noticed surface in the user's library (date) — landed before <other-work> in third-party awareness` |
| `[readwise] One Readwise highlight from X's landing page — no long-form articles in the user's Reader yet` | `[insight] "<direct quote from highlight>" — from the X landing page; X's long-form essays followed the marketing surface, indicating staged disclosure` |

The user's corpus is acceptable as **parenthetical evidence** ("...5 posts
saved as evidence", "...as documented in <book title>"), never as the
primary observation framing.

If the highlight or bookmark is genuinely a network-reach signal rather than
a content signal, prefer `[reach]` or `[influence]` over `[raindrop]` /
`[readwise]` — the latter categories should carry actual extracted content
(a quote, a position, a claim), not just "user saved this".

## Source d: Tavily web search

**Two targeted queries** (never one broad query):

1. Bio/role query:
   ```
   tavily_search(query="<name> bio role current position affiliation projects", max_results=5)
   ```

2. Influence/controversy query:
   ```
   tavily_search(query="<name> <primary-domain> contributions influence criticism controversy", max_results=5)
   ```

The second query intentionally includes "controversy" and "criticism" to
counter the hagiography bias in search results. If nothing surfaces,
the person likely has no notable controversies — do not invent one.

**Personal site extraction:** If sources b or c reveal a personal site URL:
```
tavily_extract(urls=["<personal-site>/about"], query="role bio projects affiliations")
```

Personal about pages are the most authoritative source for current roles and
self-described focus areas.

**Handling pseudonymous figures:** Search by both the pseudonym and the real
name (if known and public). Use the name the person publicly identifies with
as the note title.

**Handling non-Latin names:** Search with common transliterations. The note
title should use the most widely recognized English form of the name.

## Source e: DeepWiki (conditional)

**Only run when** the person is primarily known as a developer or maintainer
of open source projects, AND you have identified their GitHub username.

**Goal:** Understand the person's technical philosophy and approach through
their code, NOT to document the package API (that's `/package-intel`'s job).

```
ask_question(
  repo="<username>/<primary-repo>",
  question="What are this project's goals, design philosophy, and key architectural patterns?"
)
```

**Select the right repo:** Choose the repository that best represents the
person's technical identity:
- For prolific developers: their most-starred or most-contributed-to repo
- For framework authors: the framework itself
- For authors/speakers: skip DeepWiki entirely (no meaningful repo to analyze)

**Handling organizations:** If the person's key work is in an org repo
(e.g., `nicholasblaskey/my-project` vs `google/some-framework`), prefer the
personal repo unless the org repo is their defining contribution.

**When to skip:** Skip for persons who are primarily writers, designers,
speakers, policy advocates, or researchers. DeepWiki adds noise for people
whose contribution is primarily through writing and speaking. Note
"source e: skipped (non-developer profile)" in the summary.
