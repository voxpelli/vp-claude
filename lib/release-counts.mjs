// Release-count contract — asserts the component counts stated across release
// surfaces match what is actually on disk. Mirrors lib/staleness-contract.mjs:
// pure parsing + compare, fixture-tested by scripts/check-release-counts.mjs, so
// a component addition/removal cannot silently drift a stated count.
//
// Gated surfaces (as of the SWARM-34 srnm.1 extension):
//  - CLAUDE.md "### Skills (N)" / "### Agents (N)" / "### Hooks (N)" headings
//    (parseStatedCounts/compareCounts — the original, heading-anchored family).
//  - CLAUDE.md's `<!-- schema-count: N -->` HTML-comment anchor next to the
//    Schemas section prose (parseSchemaCountComment) — a pre-existing anchor
//    placed there specifically to keep "It contains twenty-three files" honest
//    without matching every other "N files" mention in the document.
//  - README.md's "<N> hooks run automatically in the background" sentence
//    (parseReadmeHooksCount) — the one place in README.md that states a
//    literal, verifiable component count outside a fenced example. Skills and
//    Agents have no equivalent countable sentence in README.md today (verified
//    by grep — the file describes each skill/agent individually rather than
//    stating a total), so only Hooks is gated there.
//
// Explicitly NOT gated: plugin.json's and marketplace.json's `description`
// fields (verified by grep — neither states a raw skill/agent/hook/schema
// count, only descriptive ecosystem/category prose) — inventing a count to
// check would be the thing this contract exists to prevent. If either file
// later gains a literal count, extend this module the same way; until then
// those two surfaces stay in sync via the release checklist. MEMORY.md is a
// user-global file outside this repository and out of scope for a repo-local
// check entirely.
//
// Pattern: "assert, don't generate" — keeps the markdown literal rather than
// introducing a build step.

import { collectHeadings, collectScannableText } from './mdast.mjs'

/**
 * Component labels that carry a countable "### <Label> (N)" heading in CLAUDE.md.
 * The single source of truth: ComponentLabel is derived from it (below) and the
 * parse pattern is built from it, so neither can drift from this array.
 *
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
 *
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
 *
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

/**
 * Spelled-out number lookup (one–twenty) for README's prose-sentence count
 * style ("Five hooks run automatically…", not a digit or a heading).
 *
 * @type {Record<string, number>}
 */
const WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
}

/**
 * Parse README.md's stated hooks count from its distinctive sentence anchor
 * ("<N> hooks run automatically in the background") rather than a generic
 * "N hooks" prose mention, which would risk matching an unrelated sentence
 * elsewhere in the document. README.md has no "### Hooks (N)" heading the way
 * CLAUDE.md does, so this is the most literal anchor available. Uses
 * collectScannableText so the same phrase appearing inside a fenced code
 * example (there is none today, but the plugin structure tree is a fence a
 * future edit could extend) cannot false-match.
 *
 * @param {string} content - README.md markdown content
 * @returns {number|undefined} stated hooks count, or undefined if the anchor sentence isn't present
 */
export function parseReadmeHooksCount (content) {
  const text = collectScannableText(content).join(' ')
  const m = /\b(\w+)\s+hooks\s+run automatically in the background\b/i.exec(text)
  if (!m) return
  const captured = m[1]
  if (captured === undefined) return
  const word = captured.toLowerCase()
  if (/^\d+$/.test(word)) return Number(word)
  return WORD_NUMBERS[word]
}

/**
 * Parse CLAUDE.md's `<!-- schema-count: N -->` anchor comment, placed next to
 * the Schemas section's "It contains twenty-three files" prose specifically so
 * that prose can be kept honest without regex-matching every "N files"
 * sentence in the document. An HTML comment is an mdast `html` node (not
 * `text`/`inlineCode`), so collectScannableText does not surface it — this
 * intentionally matches against the raw content instead, same as the
 * fenced-anchor exception documented in lib/mdast.mjs's header (the anchor
 * here isn't inside a fence, but it isn't AST-scannable prose either).
 *
 * @param {string} content - CLAUDE.md markdown content
 * @returns {number|undefined} stated schema count, or undefined if the anchor comment isn't present
 */
export function parseSchemaCountComment (content) {
  // Trailing prose after the digits (e.g. "— keep in sync with `ls schemas/*.md
  // | wc -l`") is expected and intentionally not required to match — only the
  // leading "schema-count: N" is the contract.
  const m = /<!--\s*schema-count:\s*(\d+)/.exec(content)
  return m ? Number(m[1]) : undefined
}

/**
 * Compare one stated single-value count (e.g. README's hooks sentence, or
 * CLAUDE.md's schema-count comment) against disk. Generalizes compareCounts
 * for surfaces that don't have a matching heading-anchored `parseStatedCounts`
 * family — one stated value, one actual value, one surface name for the error.
 *
 * @param {string} surface - human-readable surface name for the error message (e.g. "README.md")
 * @param {string} label - human-readable component label (e.g. "Hooks", "Schemas")
 * @param {number|undefined} stated - parsed value, or undefined if the anchor wasn't found
 * @param {number} actual - computed from disk
 * @returns {string[]} zero or one error strings
 */
export function compareSingleCount (surface, label, stated, actual) {
  if (stated === undefined) {
    return [`${surface} is missing its stated ${label} count anchor`]
  }
  if (stated !== actual) {
    return [`${surface} states ${label} (${stated}) but disk has ${actual} — update ${surface} and the other release surfaces.`]
  }
  return []
}
