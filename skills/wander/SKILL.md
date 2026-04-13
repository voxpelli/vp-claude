---
name: wander
description: "This skill should be used when the user asks to 'wander', 'surprise me',
  'show me something unexpected', 'time machine', 'forgotten bookmarks', 'what am I
  obsessing about', 'explore my knowledge', 'serendipity', 'random walk', 'cross-system
  collision', 'obsession detector', 'show me old bookmarks', 'connect random things',
  'knowledge exploration'. Presents serendipitous collisions from the user's knowledge
  graph, bookmarks, and highlights -- purposeless exploration with no scoring or ranking."
user-invocable: true
argument-hint: "[mode: walk|time-machine|collision|forgotten|obsession]"
allowed-tools:
  - mcp__basic-memory__search_notes
  - mcp__basic-memory__read_note
  - mcp__basic-memory__build_context
  - mcp__basic-memory__recent_activity
  - mcp__raindrop__find_bookmarks
  - mcp__readwise__readwise_search_highlights
  - mcp__readwise__reader_search_documents
  - Read
  - TodoWrite
---

# Wander

Purposeless exploration of the knowledge landscape. Five modes surface
serendipitous connections, forgotten saves, and emerging obsessions from
across Basic Memory, Raindrop, and Readwise.

**Critical constraint**: NEVER score, rank, or recommend. Present material
and shut up. The user makes meaning; the skill makes collisions.

## Arguments

| Form | Example |
|------|---------|
| No argument (random mode) | `/wander` |
| Named mode | `/wander time-machine` |
| Mode alias | `/wander forgotten` |
| Mode alias | `/wander obsession` |

When invoked without an argument, pick a random mode (weighted toward
modes with the richest data available).

## Mode Aliases

| Mode | Aliases |
|------|---------|
| Random Walk | `walk`, `random`, `graph` |
| Time Machine | `time-machine`, `time`, `temporal` |
| Cross-System Collision | `collision`, `cross`, `cross-system` |
| Forgotten Shelf | `forgotten`, `shelf`, `old` |
| Obsession Detector | `obsession`, `obsess`, `recent` |

## Edge Cases

- **BM unavailable** — skip modes that need it (Random Walk). Fall back to
  Raindrop/Readwise-only modes (Time Machine, Forgotten Shelf).
- **Raindrop unavailable** — skip modes that need it (Time Machine, Forgotten
  Shelf, Obsession Detector). Fall back to BM-only modes (Random Walk).
- **Readwise unavailable** — skip Cross-System Collision. Note degraded mode.
- **All systems unavailable** — report "No knowledge systems reachable — cannot
  wander" and exit.
- **Empty results from a mode** — try the next mode in rotation rather than
  showing nothing. If all modes return empty, report "Your knowledge landscape
  is quiet today."
- **Mode argument not recognized** — list available modes and exit.

## Workflow

### Step 0: Parse mode

Check for a mode argument. If absent, pick randomly. Validate against the
alias table above.

### Step 1: Execute the selected mode

Jump to the corresponding mode section below.

### Step 2: Present results

Format the output for the selected mode. End with a one-line footer:

```
---
`/wander` • [mode-name] • "Here are two things from your own history. Make of them what you will."
```

No analysis. No suggestions. No "you might want to explore this further."
The footer is the same every time — a reminder that this is exploration,
not productivity.

---

## Mode 1: Random Walk

Start at a random note in Basic Memory and follow relations for 3-5 hops.

### Steps

1. Fetch recent activity to find an active starting pool:

```
mcp__basic-memory__recent_activity(timeframe="30d")
```

2. Pick a random note from the results. If fewer than 5 results, broaden to
   `90d`. Read the note:

```
mcp__basic-memory__read_note(identifier="<note-title>")
```

3. Extract outgoing relations from `## Relations`. Pick one at random and
   follow it:

```
mcp__basic-memory__read_note(identifier="<related-note>")
```

4. Repeat for 3-5 hops total, recording each step.

5. Present the journey:

````markdown
## Random Walk: 4 hops

**Start** → npm-fastify
  ↓ `relates_to`
**Hop 1** → Node.js Ecosystem Hub
  ↓ `relates_to`
**Hop 2** → Nordic Technology Design Ethos
  ↓ `relates_to`
**Hop 3** → Spotify
  ↓ `relates_to`
**Hop 4** → Algorithmic Discovery and Recommendation

> From a web framework to cultural design philosophy to algorithmic
> discovery. A path purpose could not produce.
````

The closing quote is a single-sentence observation of the thematic arc —
not a recommendation, just a description of the journey.

---

## Mode 2: Time Machine

Pair a random old bookmark (10+ years) with a recent bookmark on a similar
topic.

### Steps

1. Fetch old bookmarks (before 2016):

```
mcp__raindrop__find_bookmarks(search="*", sort="-created", limit=50)
```

Filter results to those created before 2016-01-01. If the API does not
support date filtering directly, fetch a broad set and filter client-side.

If no old bookmarks found, try broadening to before 2020.

2. Pick one at random. Extract topic keywords from its title and tags.

3. Search for a recent bookmark (last 2 years) on a similar theme:

```
mcp__raindrop__find_bookmarks(search="<topic keywords>", sort="-created", limit=10)
```

Filter to bookmarks created after 2024-01-01. Pick the most thematically
related (by title keyword overlap), not the "best" — no scoring.

4. Present the pair:

````markdown
## Time Machine: 18 years apart

### Then (2007-03-14)
**Social Network Portability** — microformats.org/wiki/social-network-portability
Tags: `microformats`, `hcard`, `xfn`
> Portable social identity via structured markup and friend-of-a-friend links.

### Now (2026-02-08)
**Standard.site — Shared Lexicons for Long-form Publishing** — standard.site
Tags: `atproto`, `lexicon`, `publishing`
> Portable content identity via shared schemas on a decentralized protocol.

*19 years. Same question, different protocols.*
````

The closing line states the connection plainly. No judgment about which
approach is better.

---

## Mode 3: Cross-System Collision

Find a Readwise highlight and a Raindrop bookmark from different domains
that unexpectedly relate.

### Steps

1. Pick a random topic from recent BM activity:

```
mcp__basic-memory__recent_activity(timeframe="30d")
```

Extract a topic keyword from a random note title.

2. Search Readwise for highlights on that topic:

```
mcp__readwise__readwise_search_highlights(vector_search_term="<topic>")
```

3. Pick a random highlight. Extract a secondary keyword from it (something
   NOT in the original topic).

4. Search Raindrop for bookmarks matching the secondary keyword:

```
mcp__raindrop__find_bookmarks(search="<secondary keyword>", limit=10)
```

5. Pick a bookmark from a different domain/cluster than the original topic.

6. Present the collision:

````markdown
## Cross-System Collision

### Highlight (Readwise)
From: *Elastic* by Leonard Mlodinow
> "Procrastination can help... by putting off conscious attempts to solve
> problems, we provide ourselves more time for unconscious consideration."

### Bookmark (Raindrop)
**Pinterest's Redesign: Built for Exploration** — medium.com/...
Tags: `design`, `ux`, `exploration`
> "Just like a children's toy, you want to try it out just to see what
> will happen."

*One is cognitive science about the value of not-working. The other is
design philosophy about play as interface principle.*
````

---

## Mode 4: Forgotten Shelf

Surface random old, untagged bookmarks — things saved for a reason now
forgotten.

### Steps

1. Fetch old bookmarks with minimal tags:

```
mcp__raindrop__find_bookmarks(search="*", sort="created", limit=50)
```

Sort ascending by creation date to get the oldest. Filter to bookmarks
with 0-1 tags.

2. Pick 5 at random from the filtered set.

3. Present them:

````markdown
## Forgotten Shelf: 5 bookmarks from another era

| # | Title | URL | Saved | Tags |
|---|-------|-----|-------|------|
| 1 | Wikipedia's New Love Button | en.wikipedia.org/... | 2011-04-22 | — |
| 2 | The new era of PHP frameworks | ... | 2011-06-15 | `php` |
| 3 | The Good, the Bad, and the Ugly of REST APIs | ... | 2011-09-03 | — |
| 4 | CSS Zen Garden | csszengarden.com | 2005-12-01 | — |
| 5 | 24 ways: Front-end Style Guides | 24ways.org/... | 2006-12-12 | — |

*Saved for a reason you have since forgotten. The reason itself might be
the interesting thing.*
````

---

## Mode 5: Obsession Detector

Find the most-saved topic in the last 30 days that has zero Basic Memory
notes.

### Steps

1. Fetch recent bookmarks:

```
mcp__raindrop__find_bookmarks(search="*", sort="-created", limit=100)
```

Filter to last 30 days.

2. Extract tags from all results. Count tag frequency. Rank by frequency.

3. For the top 5 most frequent tags, check BM coverage:

```
mcp__basic-memory__search_notes(query="<tag-topic>", page_size=3)
```

4. Find tags with high Raindrop frequency but zero or near-zero BM results.
   These are forming obsessions below the capture threshold.

5. Present findings:

````markdown
## Obsession Detector: forming below the surface

| Topic | Bookmarks (30d) | BM Notes | Status |
|-------|-----------------|----------|--------|
| fhir | 7 | 0 | Uncaptured obsession |
| font-rendering | 8 | 0 | Uncaptured obsession |
| atproto | 12 | 4 | Well-captured |
| mcp | 9 | 3 | Well-captured |

**Forming interests with no knowledge capture:**
- `fhir` — 7 bookmarks, zero notes. Healthcare interoperability is
  pulling your attention.
- `font-rendering` — 8 bookmarks, zero notes. Typography rendering
  is a quiet fascination.

*These obsessions will dissipate if not noticed.*
````

The closing line is observational, not prescriptive. No "you should create
a note about this."

---

## Guidelines

- **No scoring** — never assign numeric scores, relevance percentages, or
  rankings to any output. Every item is presented equally.
- **No recommendations** — never say "you should read this", "consider
  exploring", or "this might be useful for your current work."
- **Describe, don't prescribe** — closing lines observe what IS (thematic
  arcs, time gaps, attention patterns), never what SHOULD BE.
- **Random is okay** — if a mode produces an uninteresting result, that is
  fine. Not every wander yields treasure. The value is in the practice of
  looking, not in what you find.
- **Graceful degradation** — if a system is unavailable, try another mode
  rather than failing. Always wander somewhere.
