# deep-intel research Workflow

Launch this script via the **Workflow** tool from Step 3 of the skill, passing
the subject context as a JSON string:

```text
Workflow({ script: <the script below>, args: JSON.stringify({
  subject, type, mode, existingTitle, today
}) })
```

- `subject` — the thing to research.
- `type` — one of service/concept/standard/milestone/project/engineering.
- `mode` — `quick` | `standard` | `heavy` (Sprint 1 ignores tiering; it runs one
  research+synthesis pass and returns a proposed note for the foreground gate).
- `existingTitle` — the exact title of an existing note to enrich, or null.
- `today` — an ISO date string (the Workflow runtime lacks `Date.now()`).

The Workflow runs in the background and **returns** `{ proposedNote, stats }` on
completion. It never writes to Basic Memory — the skill applies the write in the
foreground after the pre-write gate.

> Sprint 1 scope: research + graph-aware synthesis only. The verification
> topology (Phase Verify) and the completeness critic (Phase Critic) are added
> in `references/verification-topology.md` in a later sprint; until then every
> proposed observation is marked single-pass and the note is written hedged.

```js
export const meta = {
  name: 'deep-intel-research',
  description: 'Multi-angle research → graph-aware Basic Memory note proposal',
  phases: [
    { title: 'Scope', detail: 'type-targeted research angles' },
    { title: 'Search', detail: 'parallel web search per angle' },
    { title: 'Fetch', detail: 'dedup + fetch + extract falsifiable claims' },
    { title: 'Draft', detail: 'graph read + draft synthesis + select observations' },
    { title: 'Synthesize', detail: 'emit a typed proposed-note structure' },
  ],
}

const cfg = JSON.parse(args || '{}')
const { subject, type, today } = cfg
if (!subject || !type) return { error: 'deep-intel-research: subject and type are required in args.' }

const MAX_FETCH = 15

const SCOPE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['angles'],
  properties: {
    angles: {
      type: 'array', minItems: 3, maxItems: 7,
      items: {
        type: 'object', additionalProperties: false,
        required: ['label', 'query'],
        properties: { label: { type: 'string' }, query: { type: 'string' } },
      },
    },
  },
}

const SEARCH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['url', 'title', 'relevance'],
        properties: {
          url: { type: 'string' }, title: { type: 'string' },
          relevance: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const EXTRACT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['sourceQuality', 'claims'],
  properties: {
    sourceQuality: { type: 'string', enum: ['primary', 'secondary', 'blog', 'forum', 'unreliable'] },
    claims: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim', 'quote'],
        properties: { claim: { type: 'string' }, quote: { type: 'string' } },
      },
    },
  },
}

const NOTE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'overview', 'observations', 'relations', 'sources'],
  properties: {
    title: { type: 'string' },
    overview: { type: 'string' },
    observations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['category', 'text'],
        properties: { category: { type: 'string' }, text: { type: 'string' } },
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['verb', 'target', 'existsInGraph'],
        properties: {
          verb: { type: 'string' }, target: { type: 'string' },
          existsInGraph: { type: 'boolean' },
        },
      },
    },
    sources: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'url'],
        properties: { title: { type: 'string' }, url: { type: 'string' } },
      },
    },
  },
}

const normUrl = (u) => (u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')

// Phase Scope — angles targeted at the type's schema fields
phase('Scope')
const scope = await agent(
  `Decompose research on "${subject}" (a ${type}) into 3-7 complementary angles. ` +
  `Derive angles from what a Basic Memory "${type}" note needs (e.g. service: status/architecture/adoption/funding/security/lineage; standard: design/lineage/security/adoption/weaknesses). ` +
  `Each angle: a short label + a web-search query. Structured output only.`,
  { label: 'scope', schema: SCOPE_SCHEMA }
)
if (!scope || !scope.angles?.length) return { error: 'deep-intel-research: scope agent returned no angles.' }
log(`${scope.angles.length} angles`)

// Phase Search → Fetch — stream search results into fetch+extract (no barrier)
phase('Search')
const seen = new Set()
const extracted = await pipeline(
  scope.angles,
  (angle) => agent(
    `Use ToolSearch to load mcp__tavily__tavily_search. Search the web for: ${angle.query} ` +
    `(angle: ${angle.label}, subject: ${subject}). Return up to 5 results ranked by relevance to the ORIGINAL subject, skipping spam. Structured output only.`,
    { label: `search:${angle.label}`, phase: 'Search', schema: SEARCH_SCHEMA }
  ),
  (search) => {
    const novel = (search?.results || []).filter((r) => {
      const k = normUrl(r.url)
      if (!k || seen.has(k) || seen.size >= MAX_FETCH) return false
      seen.add(k); return true
    })
    return parallel(novel.map((src) => () => agent(
      `Use ToolSearch to load mcp__tavily__tavily_extract (and mcp__deepwiki__ask_question if the source is a GitHub repo). ` +
      `Fetch ${src.url} and extract 2-5 FALSIFIABLE claims about "${subject}" relevant to a ${type} note — concrete, checkable statements, each with a verbatim quote. Rate the source quality. Structured output only.`,
      { label: `fetch:${normUrl(src.url).slice(0, 32)}`, phase: 'Fetch', schema: EXTRACT_SCHEMA }
    ).then((ex) => ex && { url: src.url, title: src.title, ...ex })))
  }
)
const sources = extracted.flat().filter(Boolean)
const allClaims = sources.flatMap((s) => (s.claims || []).map((c) => ({ ...c, url: s.url, quality: s.sourceQuality })))
log(`${sources.length} sources, ${allClaims.length} claims`)
if (!allClaims.length) return { proposedNote: null, stats: { angles: scope.angles.length, sources: 0, claims: 0 }, note: 'no claims extracted' }

// Phase Draft — graph read (dedup/gap/contradiction) + draft synthesis
phase('Draft')
const graph = await agent(
  `Use ToolSearch to load mcp__basic-memory__search_notes and mcp__basic-memory__read_note. ` +
  `For subject "${subject}" (type ${type}): (1) find an existing note (typed + text search) and summarize what it already asserts; ` +
  `(2) list candidate cross-link hub notes by their EXACT titles verbatim from search results; ` +
  `(3) flag any existing observation that CONTRADICTS the researched claims. Return a concise text briefing. Read-only.`,
  { label: 'graph-read', phase: 'Draft' }
)

// Phase Synthesize — emit a typed proposed-note structure
phase('Synthesize')
const proposedNote = await agent(
  `Synthesize a Basic Memory "${type}" note for "${subject}" from the researched claims. ` +
  `Today is ${today}. Use ONLY observation categories and relation verbs valid for the ${type} schema. ` +
  `Each observation = {category, text}; include a [source] observation. Relations = {verb, target, existsInGraph}: ` +
  `set existsInGraph=true ONLY for an exact-title hub from the graph briefing, else false (forward-reference). ` +
  `Put no URLs in observation text and no wiki-links in observations. Merge duplicate claims. ` +
  `Mark this as single-pass / not yet cross-checked.\n\n` +
  `CLAIMS:\n${JSON.stringify(allClaims, null, 2)}\n\nGRAPH BRIEFING:\n${graph || '(none)'}`,
  { label: 'synthesize', phase: 'Synthesize', schema: NOTE_SCHEMA }
)
if (!proposedNote) return { error: 'deep-intel-research: synthesis returned no note.' }

return {
  proposedNote,
  sources: sources.map((s) => ({ url: s.url, title: s.title, quality: s.sourceQuality })),
  stats: {
    angles: scope.angles.length,
    sources: sources.length,
    claims: allClaims.length,
    observations: proposedNote.observations.length,
    relations: proposedNote.relations.length,
  },
}
```
