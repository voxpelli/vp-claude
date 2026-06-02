// Release-count contract — asserts the component counts stated in CLAUDE.md's
// Components index ("### Skills (N)" / "### Agents (N)" / "### Hooks (N)") match
// what is actually on disk. Mirrors lib/staleness-contract.mjs: pure parsing +
// compare, fixture-tested by scripts/check-release-counts.mjs, so a component
// addition/removal cannot silently drift the canonical Components index.
//
// Design decision: CLAUDE.md is the only counted surface here. README.md,
// marketplace.json, and MEMORY.md carry prose-embedded counts that have no
// footgun-free, heading-level anchor separating use from mention — anchoring on a
// recurring prose count would re-introduce the use/mention footgun the
// scripts-and-validation rule warns against. Those surfaces are kept in sync via
// the release checklist instead. This is a scope decision, not a claim about the
// current shape of those files — if they later gain mechanically-countable
// headings, revisit.
//
// Pattern: "assert, don't generate" — keeps the markdown literal rather than
// introducing a build step.

import { collectHeadings } from './mdast.mjs'

/**
 * Component labels that carry a countable "### <Label> (N)" heading in CLAUDE.md.
 * The single source of truth: ComponentLabel is derived from it (below) and the
 * parse pattern is built from it, so neither can drift from this array.
 * @type {readonly ['Skills', 'Agents', 'Hooks']}
 */
export const COUNTED_COMPONENTS = /** @type {const} */ (['Skills', 'Agents', 'Hooks'])

/** @typedef {(typeof COUNTED_COMPONENTS)[number]} ComponentLabel */

/**
 * Parse component-count headings (markdown levels 2–4, e.g. "### Skills (N)").
 * Headings come from the mdast AST (collectHeadings), so a prose mention of
 * "14 skills" cannot match AND a "### Skills (99)" inside a fenced code block —
 * CLAUDE.md is fence-heavy — is correctly ignored rather than false-matched. The
 * label alternation is built from COUNTED_COMPONENTS so the list and the pattern
 * cannot drift apart.
 * @param {string} content - markdown content (e.g. CLAUDE.md)
 * @returns {Partial<Record<ComponentLabel, number>>} label → stated count (only labels found)
 */
export function parseStatedCounts (content) {
  /** @type {Partial<Record<ComponentLabel, number>>} */
  const stated = {}
  const re = new RegExp(`^(${COUNTED_COMPONENTS.join('|')})\\s+\\((\\d+)\\)`)
  for (const { depth, text } of collectHeadings(content)) {
    if (depth < 2 || depth > 4) continue
    const m = re.exec(text)
    if (m) stated[/** @type {ComponentLabel} */ (m[1])] = Number(m[2])
  }
  return stated
}

/**
 * Compare stated counts against actual on-disk counts.
 * @param {Partial<Record<ComponentLabel, number>>} stated - from parseStatedCounts
 * @param {Record<ComponentLabel, number>} actual - computed from disk; must include every COUNTED_COMPONENTS label
 * @returns {string[]} one error per mismatch or missing count heading
 */
export function compareCounts (stated, actual) {
  /** @type {string[]} */
  const errors = []
  for (const label of COUNTED_COMPONENTS) {
    if (!(label in stated)) {
      errors.push(`CLAUDE.md is missing a "### ${label} (N)" count heading`)
      continue
    }
    if (stated[label] !== actual[label]) {
      errors.push(`CLAUDE.md states ${label} (${stated[label]}) but disk has ${actual[label]} — update the Components index and the other release surfaces (README, MEMORY.md, marketplace.json).`)
    }
  }
  return errors
}
