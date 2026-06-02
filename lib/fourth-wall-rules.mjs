// Fourth-wall anti-pattern rule registry — the canonical source of truth for the
// rules the `vp-note-quality` skill documents. Mirrors lib/staleness-contract.mjs:
// a pure registry + pure functions, fixture-tested by scripts/check-fourthwall.mjs.
//
// What is actually CI-enforced (by scripts/check-fourthwall.mjs):
//   1. every deterministic `detect` pattern fires on a planted violation;
//   2. the vp-note-quality SKILL.md documents every rule id (checklistMissingRuleIds);
//   3. the SKILL.md Rule-Registry table's deterministic/judgment column matches
//      each rule's `deterministic` flag (checkDetectionColumnParity).
// What is NOT mechanically coupled: the knowledge-gardener Step 10 / knowledge-
// maintainer Step 2e `search_notes` scans ALIGN with these rules by convention —
// they are markdown agents that cannot import this module, so their phrase queries
// are kept in sync by review, not by a contract check (an attempt to assert agent
// query coverage was rejected as brittle: regex alternations are not 1:1 with FTS
// search phrases).
//
// `deterministic: true` rules carry a `detect` RegExp — a HIGH-PRECISION /
// LOW-RECALL first pass: it catches the obvious literal forms only. Recall for the
// broader rule (paraphrases the regex can't match) is owned by the LLM-judgment
// `deterministic: false` rules (subject/export/lede tests). So "passes
// check-fourthwall" means the patterns are correct, NOT that a note is fourth-wall
// clean. Each deterministic pattern is deliberately narrow to avoid false positives
// on legitimate subject prose; see the per-rule notes.

/**
 * A rule whose violation is mechanically detectable by a regex.
 * @typedef {object} DeterministicRule
 * @property {string} id - stable `fw-*` identifier
 * @property {true} deterministic
 * @property {RegExp} detect - high-precision/low-recall violation pattern
 * @property {string} name - short human label
 * @property {string} summary - one-line description of what the rule forbids
 */

/**
 * A rule that requires LLM judgment (no mechanical pattern).
 * @typedef {object} JudgmentRule
 * @property {string} id - stable `fw-*` identifier
 * @property {false} deterministic
 * @property {string} name - short human label
 * @property {string} summary - one-line description of what the rule forbids
 */

/**
 * The discriminated union makes "detect present IFF deterministic" expressible:
 * `deterministic: true` ⇒ `detect` required; `deterministic: false` ⇒ no `detect`.
 * JSDoc is documentation-only here (no tsc/check:types is wired), so the invariant
 * is also asserted at runtime by the self-test.
 * @typedef {DeterministicRule | JudgmentRule} FourthWallRule
 */

/** @type {FourthWallRule[]} */
export const CANONICAL_FOURTH_WALL_RULES = [
  { id: 'fw-subject-test', name: 'Subject test', deterministic: false, summary: 'Every sentence must be about the declared subject, not the graph/session/sources.' },
  // "zero presence in" alone is legitimate subject prose ("zero presence in IE9"),
  // so that arm is anchored to a knowledge-source noun; the other arms are already specific.
  { id: 'fw-inventory-claim', name: 'No inventory claims', deterministic: true, detect: /(zero presence in (?:raindrop|readwise|basic memory|the knowledge graph)|absent from the knowledge graph|not yet in basic memory|no presence in raindrop|no raindrop bookmarks exist)/i, summary: 'Never assert coverage state (e.g. "zero presence in Raindrop").' },
  // Narrow by design: "most significant gap" can appear in legitimate subject prose
  // (history, topology); accepted as a rare false positive (gardener reports only,
  // with surrounding context for dismissal). Recall owned by the judgment rules.
  { id: 'fw-significance-ranking', name: 'No significance rankings', deterministic: true, detect: /(most significant gap|most important connection)/i, summary: 'No editorial "most significant/important" rankings about the session.' },
  { id: 'fw-graph-fitting', name: 'Firewall graph-fitting analysis', deterministic: false, summary: 'Discard any topic-fits-the-graph assessment before writing.' },
  { id: 'fw-gap-is-subject', name: '[gap] means subject gap', deterministic: false, summary: 'A [gap] observation records something unknown about the subject, never coverage absence.' },
  { id: 'fw-provenance-cite', name: '[raindrop]/[readwise] must cite artifacts', deterministic: false, summary: 'Only use [raindrop]/[readwise] with a concrete artifact; prefer [quote]/[source].' },
  // "Graph Coverage" gets a same-line negative lookahead `(?![ \t]+\w)`: a bare
  // "## Graph Coverage" heading (followed by a newline → body) fires, while
  // "## Graph Coverage Algorithms" AND "## Graph Coverage  Metrics" (double space)
  // AND "## Graph Coverage\tMetrics" (tab) — any run of spaces/tabs then a word on
  // the SAME line — do not. `[ \t]` excludes `\n`, so the lookahead never crosses
  // into the body paragraph (a plain `\s` lookahead would, wrongly suppressing
  // every real heading); a single-space `(?! \w)` would false-fire on tab- or
  // double-space-separated legitimate subject headings.
  { id: 'fw-self-ref-section', name: 'No self-referential sections', deterministic: true, detect: /^#{1,6}\s.*(Connection to the Knowledge Graph|Graph Coverage(?![ \t]+\w)|Significance to the Graph|Why This Note Exists)/im, summary: 'No "Connection to the Knowledge Graph" / "Graph Coverage" headings.' },
  { id: 'fw-export-test', name: 'Export test', deterministic: false, summary: 'The overview must make sense to a reader who never heard of Basic Memory.' },
  { id: 'fw-lede-subject-first', name: 'Lede is subject-first', deterministic: false, summary: 'The first sentence states what the subject is, not what the graph lacks.' },
  { id: 'fw-session-obs', name: 'Session observations go in session notes', deterministic: false, summary: 'Insights about the enrichment session belong in a session note, not the subject note.' },
  { id: 'fw-session-boundary', name: 'No session-boundary references', deterministic: true, detect: /(prior to this (?:session|note))/i, summary: 'Never reference the note-creation session boundary ("prior to this session/note").' },
  // `\b` so "fills_gap_in_detail" (a longer token) does not partial-match; `/i` for
  // consistency with the other deterministic rules (humans may capitalise prose).
  { id: 'fw-relation-type', name: 'Relation types describe subject relationships', deterministic: true, detect: /(fills_gap_in|adds_coverage_for|documents_gap_in)\b/i, summary: 'No graph-topology relation types like fills_gap_in.' },
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
    // Safety net: the discriminated-union typedef guarantees `detect` on
    // deterministic rules, but JSDoc is not CI-enforced — keep the guard (the
    // self-test proves the invariant holds across the registry).
    if (!rule.deterministic || !rule.detect) continue
    const m = text.match(rule.detect)
    if (m) hits.push({ id: rule.id, name: rule.name, match: m[0] })
  }
  return hits
}

/**
 * Contract: the `vp-note-quality` checklist must document every canonical rule id.
 * Pure — the caller supplies the SKILL.md content.
 * @param {string} checklistContent - raw text of skills/vp-note-quality/SKILL.md
 * @returns {{ missing: string[] }} ids absent from the checklist
 */
export function checklistMissingRuleIds (checklistContent) {
  const missing = CANONICAL_FOURTH_WALL_RULES
    .map((r) => r.id)
    .filter((id) => !checklistContent.includes(id))
  return { missing }
}

/**
 * Contract: the Rule-Registry table's "Detection" column (deterministic|judgment)
 * must match each rule's `deterministic` flag. Catches the drift axis where the
 * table's prose label diverges from the registry boolean. Pure.
 * @param {string} checklistContent - raw text of skills/vp-note-quality/SKILL.md
 * @returns {{ mismatches: { id: string, expected: string, found: string }[] }}
 */
export function checkDetectionColumnParity (checklistContent) {
  const byId = new Map(CANONICAL_FOURTH_WALL_RULES.map((r) => [r.id, r.deterministic]))
  /** @type {{ id: string, expected: string, found: string }[]} */
  const mismatches = []
  const seen = new Set()
  // Table rows look like: `| 2. No inventory claims | `fw-inventory-claim` | deterministic |`
  const rowRe = /^\|[^|]*\|\s*`(fw-[a-z0-9-]+)`\s*\|\s*(deterministic|judgment)\s*\|/gm
  let m
  while ((m = rowRe.exec(checklistContent)) !== null) {
    const [, id, found] = m
    seen.add(id)
    if (!byId.has(id)) {
      mismatches.push({ id, expected: '(id not in registry)', found })
      continue
    }
    const expected = byId.get(id) ? 'deterministic' : 'judgment'
    if (found !== expected) mismatches.push({ id, expected, found })
  }
  for (const r of CANONICAL_FOURTH_WALL_RULES) {
    if (!seen.has(r.id)) {
      mismatches.push({ id: r.id, expected: r.deterministic ? 'deterministic' : 'judgment', found: '(no table row)' })
    }
  }
  return { mismatches }
}
