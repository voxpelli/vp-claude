// Release-count contract — asserts the component counts stated in CLAUDE.md's
// Components index ("### Skills (N)" / "### Agents (N)" / "### Hooks (N)") match
// what is actually on disk. Mirrors lib/staleness-contract.mjs: pure parsing +
// compare, fixture-tested by scripts/check-release-counts.mjs, so a component
// addition/removal (a new skill, a merged skill, a new hook) cannot silently
// drift the canonical Components index. This is the "assert, don't generate"
// pattern (cf. impeccable's build.js generateCounts) — it keeps the markdown
// literal rather than introducing a build step.
//
// Scope note: CLAUDE.md is the only repo surface with mechanically-unambiguous
// "(N)" count headings. README.md / marketplace.json state counts in prose
// (no footgun-free anchor — the use/mention hazard), and MEMORY.md lives outside
// the repo, so they are out of scope here — update those via the release
// checklist. Anchoring on a recurring prose count would re-introduce exactly the
// use/mention footgun the scripts-and-validation rule warns against.

/** Component labels that carry a countable "### <Label> (N)" heading in CLAUDE.md. */
export const COUNTED_COMPONENTS = ['Skills', 'Agents', 'Hooks']

/**
 * Parse "### <Label> (N)" component-count headings (levels 2–4) from a doc.
 * Anchored to heading lines so a prose mention of "14 skills" cannot match.
 * @param {string} content - markdown content (e.g. CLAUDE.md)
 * @returns {Record<string, number>} label → stated count (only labels found)
 */
export function parseStatedCounts (content) {
  /** @type {Record<string, number>} */
  const stated = {}
  const re = /^#{2,4}\s+(Skills|Agents|Hooks)\s+\((\d+)\)/gm
  let m
  while ((m = re.exec(content)) !== null) {
    stated[m[1]] = Number(m[2])
  }
  return stated
}

/**
 * Compare stated counts against actual on-disk counts.
 * @param {Record<string, number>} stated - from parseStatedCounts
 * @param {Record<string, number>} actual - computed from disk by the caller
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
