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
- `mode` — `quick` | `standard` | `heavy`. `quick` skips Verify + Critic and
  returns a hedged single-pass note; `standard`/`heavy` run the verification
  topology over the persisted set (see `verification-topology.md`).
- `existingTitle` — the exact title of an existing note to enrich, or null.
- `today` — an ISO date string (the Workflow runtime lacks `Date.now()`).

The Workflow runs in the background and **returns** `{ proposedNote, stats }` on
completion. It never writes to Basic Memory — the skill applies the write in the
foreground after the pre-write gate. The verdict invariants (a disputed claim is
never written as fact, a refuted claim is dropped, a hedged claim carries its
hedge text) are enforced in the `rollup`/`finalize` code below, so the per-agent
schemas can stay simple and robust.

```js
export const meta = {
  name: 'deep-intel-research',
  description: 'Multi-angle research → verified, graph-aware Basic Memory note proposal',
  phases: [
    { title: 'Scope', detail: 'type-targeted research angles' },
    { title: 'Search', detail: 'parallel web search per angle' },
    { title: 'Fetch', detail: 'dedup + fetch + extract falsifiable claims' },
    { title: 'Draft', detail: 'graph read + draft synthesis + stake assignment' },
    { title: 'Verify', detail: 'adversarial/non-adversarial topology over the persisted set' },
    { title: 'Critic', detail: 'completeness check (one capped wave)' },
    { title: 'Finalize', detail: 'apply verdicts → typed proposed-note structure' },
  ],
}

const cfg = JSON.parse(args || '{}')
const { subject, type, today } = cfg
const mode = cfg.mode || 'standard'
if (!subject || !type) return { error: 'deep-intel-research: subject and type are required in args.' }

const MAX_FETCH = 15
const HIGH_TYPES = ['date', 'number', 'version', 'attribution', 'license', 'security', 'capability']
const normUrl = (u) => (u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')

const SCOPE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['angles'],
  properties: { angles: { type: 'array', minItems: 3, maxItems: 7, items: {
    type: 'object', additionalProperties: false, required: ['label', 'query'],
    properties: { label: { type: 'string' }, query: { type: 'string' } } } } },
}
const SEARCH_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['results'],
  properties: { results: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['url', 'title', 'relevance'],
    properties: { url: { type: 'string' }, title: { type: 'string' },
      relevance: { type: 'string', enum: ['high', 'medium', 'low'] } } } } },
}
const EXTRACT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['sourceQuality', 'claims'],
  properties: {
    sourceQuality: { type: 'string', enum: ['primary', 'secondary', 'blog', 'forum', 'unreliable'] },
    claims: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['claim', 'quote'],
      properties: { claim: { type: 'string' }, quote: { type: 'string' } } } } },
}
const DRAFT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'overview', 'observations', 'relations', 'sources'],
  properties: {
    title: { type: 'string' }, overview: { type: 'string' },
    observations: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['id', 'category', 'text', 'claim_type', 'sources'],
      properties: {
        id: { type: 'string' }, category: { type: 'string' }, text: { type: 'string' },
        claim_type: { type: 'string', enum: [...HIGH_TYPES, 'architecture', 'adoption', 'mechanism', 'compat', 'soft', 'other'] },
        sources: { type: 'array', items: { type: 'string' } } } } },
    relations: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['verb', 'target', 'existsInGraph'],
      properties: { verb: { type: 'string' }, target: { type: 'string' }, existsInGraph: { type: 'boolean' } } } },
    sources: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['title', 'url'],
      properties: { title: { type: 'string' }, url: { type: 'string' } } } },
  },
}
const ADV_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['outcome'],
  properties: { outcome: { type: 'string', enum: ['CONTRADICTED', 'CORROBORATED', 'NO_EVIDENCE_FOUND'] },
    source: { type: ['string', 'null'] }, quote: { type: ['string', 'null'] } },
}
const CONFIRM_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['result'],
  properties: { result: { type: 'string', enum: ['confirms', 'partial', 'cannot-confirm'] },
    evidence: { type: ['string', 'null'] } },
}
const JUDGE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['winner'],
  properties: { winner: { type: 'string', enum: ['adversarial', 'nonadversarial', 'unresolved'] }, rationale: { type: ['string', 'null'] } },
}
const MACRO_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['framing', 'missing'],
  properties: { framing: { type: 'string', enum: ['coheres', 'overclaims', 'missing-load-bearing'] },
    missing: { type: 'array', items: { type: 'string' } } },
}

const stakeOf = (o) => HIGH_TYPES.includes(o.claim_type) ? 'high' : (o.claim_type === 'soft' ? 'low' : 'medium')

// Build a discriminated-union-respecting verdict from a pair (+ optional judge).
// Invariants enforced HERE so agent schemas stay simple:
//   refuted -> drop; disputed -> write-hedged (never write-as-is); incomplete -> write-hedged.
function rollup(obs, adv, non, judge) {
  if (!adv || !non) return { id: obs.id, verdict: 'incomplete', disposition: 'write-hedged', hedged_text: `${obs.text} (unverified — verification incomplete)` }
  const advNeg = adv.outcome === 'CONTRADICTED' && !!adv.source // unfalsifiable (sourceless) refutation does not drop a claim
  const advOk = adv.outcome === 'CORROBORATED' || adv.outcome === 'NO_EVIDENCE_FOUND'
  const nonOk = non.result === 'confirms'
  const nonNo = non.result === 'cannot-confirm'
  if (advOk && nonOk) return { id: obs.id, verdict: 'confirmed', disposition: 'write-as-is', hedged_text: null }
  if (advNeg && (nonNo || non.result === 'partial')) return { id: obs.id, verdict: 'refuted', disposition: 'drop', hedged_text: null }
  // disagreement
  if (judge) {
    if (judge.winner === 'nonadversarial') return { id: obs.id, verdict: 'confirmed', disposition: 'write-as-is', hedged_text: null }
    if (judge.winner === 'adversarial') return { id: obs.id, verdict: 'refuted', disposition: 'drop', hedged_text: null }
  }
  const both = adv.source ? ` Sources disagree (contradicting: ${adv.source}).` : ''
  return { id: obs.id, verdict: 'disputed', disposition: 'write-hedged', hedged_text: `${obs.text} — DISPUTED, unresolved.${both}` }
}

// Phase Scope
phase('Scope')
const scope = await agent(
  `Decompose research on "${subject}" (a ${type}) into 3-7 complementary angles derived from what a Basic Memory "${type}" note needs. Each angle: a short label + a web-search query. Structured output only.`,
  { label: 'scope', schema: SCOPE_SCHEMA })
if (!scope || !scope.angles?.length) return { error: 'deep-intel-research: scope agent returned no angles.' }
log(`${scope.angles.length} angles`)

// Phase Search -> Fetch (streaming, no barrier)
phase('Search')
const seen = new Set()
const extracted = await pipeline(
  scope.angles,
  (angle) => agent(
    `Use ToolSearch to load mcp__tavily__tavily_search. Search the web for: ${angle.query} (angle: ${angle.label}, subject: ${subject}). Up to 5 results ranked by relevance to the ORIGINAL subject, skip spam. Structured output only.`,
    { label: `search:${angle.label}`, phase: 'Search', schema: SEARCH_SCHEMA }),
  (search) => {
    const novel = (search?.results || []).filter((r) => {
      const k = normUrl(r.url)
      if (!k || seen.has(k) || seen.size >= MAX_FETCH) return false
      seen.add(k); return true
    })
    return parallel(novel.map((src) => () => agent(
      `Use ToolSearch to load mcp__tavily__tavily_extract (and mcp__deepwiki__ask_question for a GitHub repo). Fetch ${src.url} and extract 2-5 FALSIFIABLE claims about "${subject}" for a ${type} note — concrete, checkable, each with a verbatim quote. Rate source quality. Structured output only.`,
      { label: `fetch:${normUrl(src.url).slice(0, 32)}`, phase: 'Fetch', schema: EXTRACT_SCHEMA }
    ).then((ex) => ex && { url: src.url, title: src.title, ...ex })))
  })
const sources = extracted.flat().filter(Boolean)
const allClaims = sources.flatMap((s) => (s.claims || []).map((c) => ({ ...c, url: s.url, quality: s.sourceQuality })))
log(`${sources.length} sources, ${allClaims.length} claims`)
if (!allClaims.length) return { proposedNote: null, stats: { angles: scope.angles.length, sources: 0, claims: 0 }, note: 'no claims extracted' }

// Phase Draft — graph read + draft note with per-observation claim_type + sources
phase('Draft')
const graph = await agent(
  `Use ToolSearch to load mcp__basic-memory__search_notes and mcp__basic-memory__read_note. For "${subject}" (type ${type}): (1) summarize what any existing note already asserts; (2) list candidate cross-link hub titles VERBATIM; (3) flag existing observations that CONTRADICT the researched claims. Concise text, read-only.`,
  { label: 'graph-read', phase: 'Draft' })
const draft = await agent(
  `Draft a Basic Memory "${type}" note for "${subject}". Today is ${today}. Use ONLY observation categories + relation verbs valid for the ${type} schema; include a [source] observation. Each observation needs: id (e.g. "obs-1"), category, text, claim_type (one of date/number/version/attribution/license/security/capability/architecture/adoption/mechanism/compat/soft/other), and the sources (URLs) it rests on. No URLs in observation text, no wiki-links in observations. Relations: existsInGraph=true ONLY for an exact-title hub from the briefing.\n\nCLAIMS:\n${JSON.stringify(allClaims, null, 2)}\n\nGRAPH BRIEFING:\n${graph || '(none)'}`,
  { label: 'draft', phase: 'Draft', schema: DRAFT_SCHEMA })
if (!draft) return { error: 'deep-intel-research: draft synthesis returned nothing.' }

// Phase Verify — topology over the persisted set (skipped in --quick)
phase('Verify')
let verdicts = {}
let macro = null
if (mode !== 'quick') {
  const factual = draft.observations.filter((o) => o.category !== 'source')
  const high = factual.filter((o) => stakeOf(o) === 'high')
  const mid = factual.filter((o) => stakeOf(o) === 'medium')
  const low = factual.filter((o) => stakeOf(o) === 'low')

  // HIGH: pair + judge per claim (sources WITHHELD from the adversarial agent)
  const verifyHigh = async (obs) => {
    const [adv, non] = await parallel([
      () => agent(`Use ToolSearch to load mcp__tavily__tavily_search. Find a CREDIBLE source that CONTRADICTS this claim about ${subject}: "${obs.text}". Its own sources are withheld — search independently for disconfirming evidence. Return CONTRADICTED (with source+quote), CORROBORATED, or NO_EVIDENCE_FOUND. Structured output only.`, { label: `adv:${obs.id}`, phase: 'Verify', schema: ADV_SCHEMA }),
      () => agent(`Use ToolSearch to load mcp__tavily__tavily_search. Independently confirm this claim about ${subject}: "${obs.text}". Return confirms / partial / cannot-confirm with evidence. Structured output only.`, { label: `confirm:${obs.id}`, phase: 'Verify', schema: CONFIRM_SCHEMA }),
    ])
    let judge = null
    const disagree = adv && non && ((adv.outcome === 'CONTRADICTED') !== (non.result === 'cannot-confirm' || non.result === 'partial'))
    if (disagree) {
      judge = await agent(`Two agents disagree on this claim about ${subject}: "${obs.text}". Adversarial said ${adv.outcome} (${adv.source || 'no source'}); confirmer said ${non.result}. Read both sides and decide: adversarial / nonadversarial / unresolved. Structured output only.`, { label: `judge:${obs.id}`, phase: 'Verify', schema: JUDGE_SCHEMA })
    }
    return rollup(obs, adv, non, judge)
  }
  // Batch HIGH claims into waves under the launch ceiling (≤3 agents per claim);
  // a null wave result coerces to an explicit incomplete verdict — never a silent settle.
  const CEIL = cfg.concurrency_ceiling || 6
  const perWave = Math.max(1, Math.floor(CEIL / 3))
  for (let i = 0; i < high.length; i += perWave) {
    const slice = high.slice(i, i + perWave)
    const wave = await parallel(slice.map((obs) => () => verifyHigh(obs)))
    slice.forEach((obs, j) => { verdicts[obs.id] = wave[j] || rollup(obs, null, null, null) })
  }

  // MEDIUM + LOW: one batched pair each (no judge; disagreement -> hedged)
  for (const batch of [mid, low]) {
    if (!batch.length) continue
    const list = batch.map((o) => `${o.id}: ${o.text}`).join('\n')
    const [advB, nonB] = await parallel([
      () => agent(`Use ToolSearch to load mcp__tavily__tavily_search. For each claim about ${subject}, hunt a contradicting source. Return per-claim {id, outcome: CONTRADICTED|CORROBORATED|NO_EVIDENCE_FOUND}.\n${list}\nStructured output only.`, { label: 'adv-batch', phase: 'Verify', schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'outcome'], properties: { id: { type: 'string' }, outcome: { type: 'string', enum: ['CONTRADICTED', 'CORROBORATED', 'NO_EVIDENCE_FOUND'] } } } } } } }),
      () => agent(`Use ToolSearch to load mcp__tavily__tavily_search. For each claim about ${subject}, independently confirm. Return per-claim {id, result: confirms|partial|cannot-confirm}.\n${list}\nStructured output only.`, { label: 'confirm-batch', phase: 'Verify', schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'result'], properties: { id: { type: 'string' }, result: { type: 'string', enum: ['confirms', 'partial', 'cannot-confirm'] } } } } } } }),
    ])
    const advMap = Object.fromEntries((advB?.items || []).map((x) => [x.id, x]))
    const nonMap = Object.fromEntries((nonB?.items || []).map((x) => [x.id, x]))
    batch.forEach((obs) => {
      const a = advMap[obs.id] ? { outcome: advMap[obs.id].outcome, source: null } : null
      const n = nonMap[obs.id] ? { result: nonMap[obs.id].result } : null
      verdicts[obs.id] = rollup(obs, a, n, null)
    })
  }

  // MACRO: one pair over the whole draft
  macro = await agent(
    `Review this draft ${type} note about ${subject} as a whole. Is the framing accurate, does it cohere, and what load-bearing fact is MISSING? Return framing (coheres|overclaims|missing-load-bearing) + a list of missing facts.\n\n${draft.overview}\n${draft.observations.map((o) => `- [${o.category}] ${o.text}`).join('\n')}\nStructured output only.`,
    { label: 'macro', phase: 'Verify', schema: MACRO_SCHEMA })
}

// Phase Critic — one capped completeness wave on the top gap
phase('Critic')
let gapNote = null
if (mode === 'heavy' && macro?.framing === 'missing-load-bearing' && macro.missing?.length) {
  gapNote = macro.missing[0]
  log(`completeness gap: ${gapNote}`)
  // A single targeted search is recorded as an open question rather than auto-asserted in v1.
}

// Phase Finalize — apply verdicts -> proposed note
phase('Finalize')
const finalObs = []
const dropped = []
const disputed = []
for (const o of draft.observations) {
  const v = verdicts[o.id]
  if (o.category === 'source') { finalObs.push({ category: o.category, text: o.text }); continue }
  if (!v) { finalObs.push({ category: o.category, text: mode === 'quick' ? o.text : `${o.text} (unverified)` }); continue }
  if (v.disposition === 'drop') { dropped.push(o.text); continue }
  if (v.disposition === 'write-hedged') { finalObs.push({ category: o.category, text: v.hedged_text }); if (v.verdict === 'disputed') disputed.push(o.text); continue }
  finalObs.push({ category: o.category, text: o.text })
}
const proposedNote = {
  title: draft.title, overview: draft.overview,
  observations: finalObs,
  relations: draft.relations,
  sources: draft.sources,
  disputed, dropped,
  openQuestions: gapNote ? [`Possibly missing: ${gapNote}`] : [],
  verification: mode === 'quick' ? 'quick-unverified' : 'multi-source cross-checked',
}

return {
  proposedNote,
  stats: {
    angles: scope.angles.length, sources: sources.length, claims: allClaims.length,
    observations: finalObs.length, dropped: dropped.length, disputed: disputed.length,
    verified: Object.keys(verdicts).length, mode,
  },
}
```
