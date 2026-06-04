# deep-intel research Workflow

Launch this script via the **Workflow** tool from Step 3 of the skill, passing
the subject context as a **structured** `args` object (a Workflow receives `args`
as structured data — pass the object, not a JSON string; the script also tolerates
a JSON string defensively):

```text
Workflow({ script: <the script below>, args: {
  subject, type, mode, existingTitle, today
} })
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

let cfg
try { cfg = typeof args === 'string' ? JSON.parse(args || '{}') : (args || {}) } catch (e) { return { error: `deep-intel-research: args must be a JSON object or a JSON string (got ${typeof args})` } }
const { subject, type, today } = cfg
const mode = cfg.mode || 'standard'
if (!subject || !type) return { error: 'deep-intel-research: subject and type are required in args.' }

const MAX_FETCH = 15
const MAX_DIVERGENT_SEARCH = 4 // free spirits ideate uncapped; only this many divergent angles are actually SEARCHED (launch-budget guard — keeps --heavy under the ~10-launch admission-throttle ceiling)
const HIGH_TYPES = ['date', 'number', 'version', 'attribution', 'license', 'security', 'capability']
const normUrl = (u) => (u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')

// Model tiering (researched against the captured bundled deep-research script + BM 'Claude Code
// Plugin Mechanics'): deep-research sets NO per-agent model — it inherits the session default, so its
// economy is session-dependent (an Opus session runs every agent on Opus). deep-intel routes
// EXPLICITLY so it stays economical regardless of session model. Haiku = high-volume mechanical
// (search / fetch / curated / batched yes-no verify); Sonnet = judgment (scope / graph-read /
// per-claim adversarial+confirm+judge / macro / extend); Opus = creative + synthesis judgment —
// the divergent "free spirits" ideation (the genius must tame the nuts) and `draft` synthesis
// (`draft` omits `model` so it inherits the session's strongest; the principle is mechanical=cheap,
// judgment-or-creativity=top-tier, NOT sourcing=cheap).

const SCOPE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['angles'],
  properties: { angles: { type: 'array', minItems: 3, maxItems: 8, items: {
    type: 'object', additionalProperties: false, required: ['label', 'query', 'stance'],
    properties: { label: { type: 'string' }, query: { type: 'string' },
      stance: { type: 'string', enum: ['corroborating', 'adversarial', 'divergent'] } } } } },
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

const EXTEND_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['spokes', 'neighborObservations', 'neighborRelations'],
  properties: {
    spokes: { type: 'array', maxItems: 3, items: {
      type: 'object', additionalProperties: false, required: ['title', 'type', 'reason', 'observations'],
      properties: {
        title: { type: 'string' }, reason: { type: 'string' },
        type: { type: 'string', enum: ['service', 'concept', 'standard', 'milestone', 'project', 'engineering'] },
        observations: { type: 'array', minItems: 1, maxItems: 6, items: {
          type: 'object', additionalProperties: false, required: ['category', 'text'],
          properties: { category: { type: 'string' }, text: { type: 'string' } } } } } } },
    // Two TYPED arrays (was a weak `kind`-discriminated `neighborEdits` with all-nullable category/text/verb):
    // an observation cannot ship without category+text, a relation cannot ship without a verb — a null
    // payload appended to an EARNED note is now structurally unrepresentable (C1). The neighbor-side category/
    // verb LEGALITY for the target's own schema is enforced at the foreground write step (the schema can't
    // know the neighbor's type) — see SKILL.md Step 5.
    neighborObservations: { type: 'array', maxItems: 5, items: {
      type: 'object', additionalProperties: false, required: ['targetTitle', 'category', 'text'],
      properties: { targetTitle: { type: 'string' }, category: { type: 'string' }, text: { type: 'string' } } } },
    neighborRelations: { type: 'array', maxItems: 5, items: {
      type: 'object', additionalProperties: false, required: ['targetTitle', 'verb'],
      properties: { targetTitle: { type: 'string' }, verb: { type: 'string' } } } },
  },
}

const stakeOf = (o) => HIGH_TYPES.includes(o.claim_type) ? 'high' : (o.claim_type === 'soft' ? 'low' : 'medium')

// Build a discriminated-union-respecting verdict from a pair (+ optional judge).
// Invariants enforced HERE so agent schemas stay simple:
//   refuted -> drop; disputed -> write-hedged (never write-as-is); incomplete -> write-hedged.
function rollup(obs, adv, non, judge) {
  if (!adv || !non) return { id: obs.id, verdict: 'incomplete', disposition: 'write-hedged', hedged_text: `${obs.text} (unverified — verification incomplete)` }
  const advNeg = adv.outcome === 'CONTRADICTED' && !!adv.source // unfalsifiable (sourceless) refutation does not drop a claim
  const advCorrob = adv.outcome === 'CORROBORATED'
  const advNoEv = adv.outcome === 'NO_EVIDENCE_FOUND'
  const nonOk = non.result === 'confirms'
  const nonNo = non.result === 'cannot-confirm'
  // Both sides positively corroborate -> firm, cross-checkable
  if (advCorrob && nonOk) return { id: obs.id, verdict: 'confirmed', disposition: 'write-as-is', hedged_text: null }
  // Adversary found NO contradiction (weak evidence) and only the confirmer found support
  // -> single-source confirm, capped at hedged; NEVER cross-checkable (NO_EVIDENCE_FOUND != CORROBORATED)
  if (advNoEv && nonOk) return { id: obs.id, verdict: 'confirmed', disposition: 'write-hedged', hedged_text: `${obs.text} (single-source; an adversarial search found no independent corroboration)` }
  if (advNeg && (nonNo || non.result === 'partial')) return { id: obs.id, verdict: 'refuted', disposition: 'drop', hedged_text: null }
  // disagreement
  if (judge) {
    if (judge.winner === 'nonadversarial') return { id: obs.id, verdict: 'confirmed', disposition: 'write-as-is', hedged_text: null }
    if (judge.winner === 'adversarial') return { id: obs.id, verdict: 'refuted', disposition: 'drop', hedged_text: null }
  }
  const both = adv.source ? ` Sources disagree (contradicting: ${adv.source}).` : ''
  return { id: obs.id, verdict: 'disputed', disposition: 'write-hedged', hedged_text: `${obs.text} — DISPUTED, unresolved.${both}` }
}

// Phase Scope — corroborating + adversarial angles (and, in --heavy, a divergent pair)
phase('Scope')
const scope = await agent(
  `Decompose research on "${subject}" (a ${type}) into 4-8 angles derived from what a Basic Memory "${type}" note needs. Each angle: a short label, a web-search query, and a stance:\n- "corroborating" — establish what the subject is and how it works.\n- "adversarial" — REQUIRED: include AT LEAST 2. Actively hunt the counter-case — criticism, limitations, failure modes, disputes, contradicting evidence, vendor-claim scrutiny, "${subject} vs alternatives". This surfaces contrarian material at gather-time, not only at verification.\nStructured output only.`,
  { label: 'scope', model: 'sonnet', schema: SCOPE_SCHEMA })
if (!scope || !scope.angles?.length) return { error: 'deep-intel-research: scope agent returned no angles.' }

// Occasional divergent ("free spirits") ideation — bounded, --heavy only. It emits ANGLES, not
// claims, so an off-topic leap simply finds no corroborating source and drops in the verify gauntlet;
// a nuts-and-genius connection that IS real surfaces sources the structured angles would never reach.
let divergentAngles = []
if (mode === 'heavy') {
  // A PAIR of SINGLE free spirits (two independent perspectives beat one agent role-playing two —
  // one persona per agent stays coherent; the pair diverges). Each on Opus: lateral ideation needs
  // the "genius" to make the "nuts" cohere — creative reasoning, not a mechanical stage.
  const fsPair = await parallel([1, 2].map((n) => () => agent(
    `You are a single free spirit brainstorming about "${subject}" (a ${type}) like you are nuts and genius at once. You are free spirit #${n} of a pair: chase YOUR OWN visions, don't hedge toward the obvious or converge on your twin, and DON'T hold back — emit as many wild SEARCH ANGLES (label + query, stance "divergent") as your imagination demands, using everything to chase the connections a careful researcher would never dare. Stay tethered to the subject — an off-topic angle simply finds nothing and drops in verification, so dream freely. Structured output only.`,
    { label: `free-spirit:${n}`, model: 'opus', schema: SCOPE_SCHEMA })))
  const divergentEmitted = fsPair.filter(Boolean).flatMap((fs) => fs.angles || []).map((a) => ({ ...a, stance: 'divergent' }))
  // Free spirits ideate UNCAPPED, but only the first MAX_DIVERGENT_SEARCH are actually SEARCHED —
  // decouples imagination from the launch budget (uncapped angles would burst the search-agent launches
  // past the ~10-launch admission-throttle ceiling). Full emission count is logged.
  divergentAngles = divergentEmitted.slice(0, MAX_DIVERGENT_SEARCH)
  if (divergentEmitted.length > divergentAngles.length) log(`free spirits emitted ${divergentEmitted.length} divergent angles; searching ${divergentAngles.length} (MAX_DIVERGENT_SEARCH)`)
}
const angles = [...scope.angles, ...divergentAngles]
log(`${angles.length} angles (${angles.filter((a) => a.stance === 'adversarial').length} adversarial, ${divergentAngles.length} divergent)`)

// Phase Search -> Fetch (streaming, no barrier)
phase('Search')
const seen = new Set()
let searchNulls = 0
const extracted = await pipeline(
  angles,
  async (angle) => {
    const s = await agent(
      `Use ToolSearch to load mcp__tavily__tavily_search. Search the web for: ${angle.query} (angle: ${angle.label}, stance: ${angle.stance}, subject: ${subject}). Up to 5 results ranked by relevance to the ORIGINAL subject${angle.stance === 'adversarial' ? ', prioritizing critical/contrarian/dissenting sources' : ''}, skip spam. Structured output only.`,
      { label: `search:${angle.label}`, phase: 'Search', model: 'haiku', schema: SEARCH_SCHEMA })
    if (!s) searchNulls++
    return s
  },
  (search) => {
    const novel = (search?.results || []).filter((r) => {
      const k = normUrl(r.url)
      if (!k || seen.has(k) || seen.size >= MAX_FETCH) return false
      seen.add(k); return true
    })
    return parallel(novel.map((src) => () => agent(
      `Use ToolSearch to load mcp__tavily__tavily_extract (and mcp__deepwiki__ask_question for a GitHub repo). Fetch ${src.url} and extract 2-5 FALSIFIABLE claims about "${subject}" for a ${type} note — concrete, checkable, each with a verbatim quote. Rate source quality. Structured output only.`,
      { label: `fetch:${normUrl(src.url).slice(0, 32)}`, phase: 'Fetch', model: 'haiku', schema: EXTRACT_SCHEMA }
    ).then((ex) => ex && { url: src.url, title: src.title, ...ex })))
  })
// Multi-source gather (additive): the user's curated reading (always) + domain-specific sources
// (conditional). Same claim shape, merged into the same pool, so adversarial verification covers them too.
const aiml = /\b(ai|ml|llm|agent|model|neural|embedding|transformer|inference|prompt|rag|memory|dataset)\b/i.test(`${subject} ${type}`)
const domainish = ['service', 'standard', 'project'].includes(type)
const curatedThunks = [
  () => agent(`Use ToolSearch to load mcp__raindrop__find_bookmarks and mcp__raindrop__fetch_bookmark_content. Find the user's bookmarks about "${subject}", fetch the 2-3 most relevant, and extract 2-5 FALSIFIABLE claims for a ${type} note (each with a verbatim quote). These are the user's own curated reading — high signal. Rate source quality. Structured output only.`,
    { label: 'curated:raindrop', phase: 'Search', model: 'haiku', schema: EXTRACT_SCHEMA }).then((ex) => ex && { url: 'raindrop:curated', title: 'Raindrop — curated reading', ...ex }),
  () => agent(`Use ToolSearch to load mcp__readwise__readwise_search_highlights and mcp__readwise__reader_search_documents. Find highlights/documents about "${subject}" and extract 2-5 FALSIFIABLE claims for a ${type} note (each with a verbatim quote). Rate source quality. Structured output only.`,
    { label: 'curated:readwise', phase: 'Search', model: 'haiku', schema: EXTRACT_SCHEMA }).then((ex) => ex && { url: 'readwise:highlights', title: 'Readwise — highlights', ...ex }),
]
if (aiml) curatedThunks.push(() => agent(`Use ToolSearch to load mcp__claude_ai_Hugging_Face__paper_search and mcp__claude_ai_Hugging_Face__hub_repo_search. Find papers/models/datasets about "${subject}" and extract 2-5 FALSIFIABLE, citable claims (titles, arXiv ids, authors, dates, benchmark numbers) for a ${type} note, each with a verbatim quote. Rate source quality. Structured output only.`,
  { label: 'curated:huggingface', phase: 'Search', model: 'haiku', schema: EXTRACT_SCHEMA }).then((ex) => ex && { url: 'huggingface:papers', title: 'HuggingFace — papers/models', ...ex }))
if (domainish) curatedThunks.push(() => agent(`Use ToolSearch to load mcp__plugin_context7_context7__resolve-library-id and mcp__plugin_context7_context7__query-docs. If "${subject}" maps to a library/framework/API, fetch authoritative docs and extract 2-5 FALSIFIABLE claims for a ${type} note, each with a verbatim quote; if it does not map, return empty claims. Rate source quality. Structured output only.`,
  { label: 'curated:context7', phase: 'Search', model: 'haiku', schema: EXTRACT_SCHEMA }).then((ex) => ex && { url: 'context7:docs', title: 'Context7 — library docs', ...ex }))
const curatedSources = (await parallel(curatedThunks)).filter(Boolean)

const sources = [...extracted.flat(), ...curatedSources].filter(Boolean)
const allClaims = sources.flatMap((s) => (s.claims || []).map((c) => ({ ...c, url: s.url, quality: s.sourceQuality })))
log(`${sources.length} sources (${curatedSources.length} curated/domain), ${allClaims.length} claims`)
if (!allClaims.length) {
  // Distinguish a throttle cascade (most search agents returned null) from a genuine no-evidence subject.
  // Denominator is the STRUCTURED angle count, not the divergent-padded total — the free-spirit overlay
  // must not dilute (mask) a real structured-search throttle.
  const throttleSuspected = searchNulls >= Math.ceil(scope.angles.length / 2)
  return {
    proposedNote: null, throttleSuspected,
    stats: { angles: angles.length, sources: sources.length, claims: 0, searchNulls },
    note: throttleSuspected
      ? 'throttle-suspected: most search agents returned no result — retry or lower concurrency'
      : 'no claims extracted (research found nothing for this subject)',
  }
}

// Phase Draft — graph read + draft note with per-observation claim_type + sources
phase('Draft')
const graph = await agent(
  `Use ToolSearch to load mcp__basic-memory__search_notes and mcp__basic-memory__read_note. For "${subject}" (type ${type}): (1) summarize what any existing note already asserts; (2) list candidate cross-link hub titles VERBATIM; (3) flag existing observations that CONTRADICT the researched claims. Concise text, read-only.`,
  { label: 'graph-read', phase: 'Draft', model: 'sonnet' })
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
      () => agent(`Use ToolSearch to load mcp__tavily__tavily_search. Find a CREDIBLE source that CONTRADICTS this claim about ${subject}: "${obs.text}". Its own sources are withheld — search independently for disconfirming evidence. Return CONTRADICTED (with source+quote), CORROBORATED, or NO_EVIDENCE_FOUND. Structured output only.`, { label: `adv:${obs.id}`, phase: 'Verify', model: 'sonnet', schema: ADV_SCHEMA }),
      () => agent(`Use ToolSearch to load mcp__tavily__tavily_search. Independently confirm this claim about ${subject}: "${obs.text}". Return confirms / partial / cannot-confirm with evidence. Structured output only.`, { label: `confirm:${obs.id}`, phase: 'Verify', model: 'sonnet', schema: CONFIRM_SCHEMA }),
    ])
    let judge = null
    // Fire the judge only on genuine conflict, not on two-sided uncertainty (NO_EVIDENCE_FOUND cases are handled by rollup).
    const disagree = !!adv && !!non && (
      (adv.outcome === 'CORROBORATED' && (non.result === 'cannot-confirm' || non.result === 'partial')) ||
      (adv.outcome === 'CONTRADICTED' && !!adv.source && non.result === 'confirms')
    )
    if (disagree) {
      judge = await agent(`Two agents disagree on this claim about ${subject}: "${obs.text}". Adversarial said ${adv.outcome} (${adv.source || 'no source'}); confirmer said ${non.result}. Read both sides and decide: adversarial / nonadversarial / unresolved. Structured output only.`, { label: `judge:${obs.id}`, phase: 'Verify', model: 'opus', schema: JUDGE_SCHEMA })
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
      () => agent(`Use ToolSearch to load mcp__tavily__tavily_search. For each claim about ${subject}, hunt a contradicting source. Return per-claim {id, outcome: CONTRADICTED|CORROBORATED|NO_EVIDENCE_FOUND}.\n${list}\nStructured output only.`, { label: 'adv-batch', phase: 'Verify', model: 'haiku', schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'outcome'], properties: { id: { type: 'string' }, outcome: { type: 'string', enum: ['CONTRADICTED', 'CORROBORATED', 'NO_EVIDENCE_FOUND'] } } } } } } }),
      () => agent(`Use ToolSearch to load mcp__tavily__tavily_search. For each claim about ${subject}, independently confirm. Return per-claim {id, result: confirms|partial|cannot-confirm}.\n${list}\nStructured output only.`, { label: 'confirm-batch', phase: 'Verify', model: 'haiku', schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'result'], properties: { id: { type: 'string' }, result: { type: 'string', enum: ['confirms', 'partial', 'cannot-confirm'] } } } } } } }),
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
    { label: 'macro', phase: 'Verify', model: 'sonnet', schema: MACRO_SCHEMA })
}

// Phase Critic — one capped completeness wave on the top gap
phase('Critic')
let gapNote = null
if (mode !== 'quick' && macro?.framing === 'missing-load-bearing' && macro.missing?.length) {
  gapNote = macro.missing[0]
  log(`completeness gap: ${gapNote}`)
  // standard/heavy: record the gap as an open question (surfaced at the pre-write gate).
  // A heavy-only second search wave on the gap is a deferred follow-up (bead B2).
}

// Phase Finalize — apply verdicts -> proposed note
phase('Finalize')
const finalObs = []
const dropped = []
const disputed = []
let strong = 0, hedged = 0, unverified = 0
for (const o of draft.observations) {
  const v = verdicts[o.id]
  if (o.category === 'source') { finalObs.push({ category: o.category, text: o.text }); continue }
  if (!v) { finalObs.push({ category: o.category, text: mode === 'quick' ? o.text : `${o.text} (unverified)` }); if (mode !== 'quick') unverified++; continue }
  if (v.disposition === 'drop') { dropped.push(o.text); continue }
  if (v.disposition === 'write-hedged') {
    finalObs.push({ category: o.category, text: v.hedged_text })
    if (v.verdict === 'disputed') disputed.push(o.text)
    if (v.verdict === 'incomplete') unverified++; else hedged++
    continue
  }
  finalObs.push({ category: o.category, text: o.text }); strong++ // write-as-is
}
// Weakest-wins label: never claim "cross-checked" over an unverified or hedged claim.
const verification = mode === 'quick' ? 'quick-unverified'
  : unverified > 0 ? 'partial-unverified'
  : hedged > 0 ? 'partial-cross-checked'
  : strong > 0 ? 'multi-source cross-checked'
  : 'unverified'
const proposedNote = {
  title: draft.title, overview: draft.overview,
  observations: finalObs,
  relations: draft.relations,
  sources: draft.sources,
  disputed, dropped,
  openQuestions: gapNote ? [`Possibly missing: ${gapNote}`] : [],
  verification,
}

// Phase Extend — propose a BOUNDED graph-extension set (spokes + neighbor enrichments).
// The Workflow still never writes; the foreground gates and applies each item per the pre-write gate.
phase('Extend')
let extensions = { spokes: [], neighborObservations: [], neighborRelations: [] }
if (mode !== 'quick') {
  const ext = await agent(
    `A verified ${type} note about "${subject}" has been drafted. From its observations and the graph briefing, propose a BOUNDED, non-duplicate set of graph extensions (return empty arrays if none is genuinely warranted):\n(1) SPOKES (<=3): distinct entities/concepts the research surfaced that warrant their OWN note — title, type (service|concept|standard|milestone|project|engineering), a one-line reason it is separable, and 2-6 observations drawn from the claims. A spoke must NOT be a near-duplicate of "${subject}" or of an existing note.\n(2) NEIGHBOR ENRICHMENTS for EXISTING notes named VERBATIM in the briefing's hub list (append-only): neighborObservations[] (<=5), each {targetTitle, category, text} — an observation that belongs on that neighbor; and neighborRelations[] (<=5), each {targetTitle, verb} — a relation FROM the neighbor TO the new "${draft.title}" note. Only where the insight genuinely belongs there, and use ONLY categories/verbs valid for the neighbor's own type.\nStructured output only.\n\nNOTE OBSERVATIONS:\n${finalObs.map((o) => `- [${o.category}] ${o.text}`).join('\n')}\nGRAPH BRIEFING:\n${graph || '(none)'}`,
    { label: 'extend', phase: 'Extend', model: 'sonnet', schema: EXTEND_SCHEMA })
  if (ext) extensions = { spokes: (ext.spokes || []).slice(0, 3), neighborObservations: (ext.neighborObservations || []).slice(0, 5), neighborRelations: (ext.neighborRelations || []).slice(0, 5) }
}

return {
  proposedNote, extensions,
  stats: {
    angles: angles.length, sources: sources.length, claims: allClaims.length,
    observations: finalObs.length, dropped: dropped.length, disputed: disputed.length,
    verified: Object.keys(verdicts).length,
    spokes: extensions.spokes.length, neighborObservations: extensions.neighborObservations.length, neighborRelations: extensions.neighborRelations.length, mode,
  },
}
```
