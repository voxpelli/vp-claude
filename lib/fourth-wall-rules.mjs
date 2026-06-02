// Fourth-wall anti-pattern rule registry — the single source of truth for the
// rules the `vp-note-quality` skill documents and the knowledge-gardener Step 10
// audit consumes. Mirrors lib/staleness-contract.mjs: a pure registry + pure
// functions, fixture-tested by scripts/check-fourthwall.mjs, so the checklist
// (emit) and the gardener Red-Flags scan (consume) cannot silently drift from
// the canonical rule set.
//
// `deterministic: true` rules carry a `detect` RegExp that mechanically flags a
// violation in note text (the grep-able "Red Flags"); `deterministic: false`
// rules need LLM judgment (the export/subject/firewall tests) and have no
// pattern. The self-test exercises every `detect` against a planted violation
// and a clean string, and asserts the checklist documents every rule id.

/**
 * @typedef {object} FourthWallRule
 * @property {string} id - stable `fw-*` identifier
 * @property {string} name - short human label
 * @property {boolean} deterministic - true when a grep-able `detect` exists
 * @property {RegExp} [detect] - mechanical violation pattern (deterministic rules only)
 * @property {string} summary - one-line description of what the rule forbids
 */

/** @type {FourthWallRule[]} */
export const CANONICAL_FOURTH_WALL_RULES = [
  { id: 'fw-subject-test', name: 'Subject test', deterministic: false, summary: 'Every sentence must be about the declared subject, not the graph/session/sources.' },
  { id: 'fw-inventory-claim', name: 'No inventory claims', deterministic: true, detect: /(zero presence in|absent from the knowledge graph|not yet in basic memory|no presence in raindrop|no raindrop bookmarks exist)/i, summary: 'Never assert coverage state (e.g. "zero presence in Raindrop").' },
  { id: 'fw-significance-ranking', name: 'No significance rankings', deterministic: true, detect: /(most significant gap|most important connection)/i, summary: 'No editorial "most significant/important" rankings about the session.' },
  { id: 'fw-graph-fitting', name: 'Firewall graph-fitting analysis', deterministic: false, summary: 'Discard any topic-fits-the-graph assessment before writing.' },
  { id: 'fw-gap-is-subject', name: '[gap] means subject gap', deterministic: false, summary: 'A [gap] observation records something unknown about the subject, never coverage absence.' },
  { id: 'fw-provenance-cite', name: '[raindrop]/[readwise] must cite artifacts', deterministic: false, summary: 'Only use [raindrop]/[readwise] with a concrete artifact; prefer [quote]/[source].' },
  { id: 'fw-self-ref-section', name: 'No self-referential sections', deterministic: true, detect: /^#{1,6}\s.*(Connection to the Knowledge Graph|Graph Coverage|Significance to the Graph|Why This Note Exists)/im, summary: 'No "Connection to the Knowledge Graph" / "Graph Coverage" headings.' },
  { id: 'fw-export-test', name: 'Export test', deterministic: false, summary: 'The overview must make sense to a reader who never heard of Basic Memory.' },
  { id: 'fw-lede-subject-first', name: 'Lede is subject-first', deterministic: false, summary: 'The first sentence states what the subject is, not what the graph lacks.' },
  { id: 'fw-session-obs', name: 'Session observations go in session notes', deterministic: false, summary: 'Insights about the enrichment session belong in a session note, not the subject note.' },
  { id: 'fw-relation-type', name: 'Relation types describe subject relationships', deterministic: true, detect: /(fills_gap_in|adds_coverage_for|documents_gap_in)/, summary: 'No graph-topology relation types like fills_gap_in.' },
]

/**
 * Apply every deterministic rule's `detect` pattern to note text.
 * @param {string} text - the note content to scan
 * @returns {{ id: string, name: string, match: string }[]} one entry per fired rule
 */
export function detectFourthWallViolations (text) {
  /** @type {{ id: string, name: string, match: string }[]} */
  const hits = []
  for (const rule of CANONICAL_FOURTH_WALL_RULES) {
    if (!rule.deterministic || !rule.detect) continue
    const m = text.match(rule.detect)
    if (m) hits.push({ id: rule.id, name: rule.name, match: m[0] })
  }
  return hits
}

/**
 * Contract: the `vp-note-quality` checklist must document every canonical rule
 * id. Pure — the caller supplies the SKILL.md content.
 * @param {string} checklistContent - raw text of skills/vp-note-quality/SKILL.md
 * @returns {{ missing: string[] }} ids absent from the checklist
 */
export function checklistMissingRuleIds (checklistContent) {
  const missing = CANONICAL_FOURTH_WALL_RULES
    .map((r) => r.id)
    .filter((id) => !checklistContent.includes(id))
  return { missing }
}
