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

/** @typedef {'Skills' | 'Agents' | 'Hooks'} ComponentLabel */

/**
 * Component labels that carry a countable "### <Label> (N)" heading in CLAUDE.md.
 * @type {ComponentLabel[]}
 */
export const COUNTED_COMPONENTS = ['Skills', 'Agents', 'Hooks']

/**
 * Parse component-count headings (markdown levels 2–4, e.g. "### Skills (N)").
 * Anchored to heading lines so a prose mention of "14 skills" cannot match. The
 * label alternation is built from COUNTED_COMPONENTS so the list and the regex
 * cannot drift apart.
 * @param {string} content - markdown content (e.g. CLAUDE.md)
 * @returns {Partial<Record<ComponentLabel, number>>} label → stated count (only labels found)
 */
export function parseStatedCounts (content) {
  /** @type {Partial<Record<ComponentLabel, number>>} */
  const stated = {}
  // Function-local (do NOT hoist): the `g` flag carries `lastIndex` across calls,
  // so a module-scope regex would start mid-string on the second call.
  const re = new RegExp(`^#{2,4}\\s+(${COUNTED_COMPONENTS.join('|')})\\s+\\((\\d+)\\)`, 'gm')
  let m
  while ((m = re.exec(content)) !== null) {
    stated[/** @type {ComponentLabel} */ (m[1])] = Number(m[2])
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
