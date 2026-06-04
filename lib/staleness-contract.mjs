// Staleness drift-bucket contract — the single source of truth for the
// cross-file string contract between the EMIT side (knowledge-gardener +
// staleness-detection.md `#### <bucket>` headings under `### Version Drift —
// <eco>` sections) and the CONSUME side (knowledge-maintainer Section 3b
// routing bullets). Extracted from validate-plugin.mjs as pure functions so it
// can be unit-tested (scripts/check-staleness-contract.mjs) without triggering
// the validator's top-level run — the check-hooks.mjs precedent: a guard that
// silently stops guarding is worse than no guard.
//
// Implementation notes (do not "simplify" away):
//  - LINE-REGEX over raw text, NOT a markdown AST. The emit headings live
//    *inside* ```markdown / 4-backtick fenced example blocks, so an AST parser
//    sees zero headings and would pass vacuously.
//  - The emit files contain `####` headings OUTSIDE the drift section (e.g.
//    the gardener's `#### Source-URL provenance nudge`), so we scope to the
//    drift section: from a `Version Drift —` heading until the next heading of
//    level <= 3, collecting only the `####` headings between.
//  - The consume side pins to the routing-bullet shape `- **`<bucket>`** … →`
//    so bare code-spans like `` `Drifted` `` in prose don't false-positive.

export const CANONICAL_STALENESS_BUCKETS = /** @type {const} */ ([
  'Drifted >30d',
  'Drifted <30d',
  'Drifted, age unknown',
  'Not in registry',
  'Unparseable',
  'Archive candidates',
  'API unavailable',
])

/** @typedef {typeof CANONICAL_STALENESS_BUCKETS[number]} StalenessBucket */

const STALENESS_HEADING_ALLOWLIST = new Set(['Summary'])

/**
 * Narrowing guard: is a parsed string an exact canonical bucket? Narrows to
 * StalenessBucket on the consume side where buckets are compared by equality.
 *
 * @param {string} value
 * @returns {value is StalenessBucket}
 */
function isStalenessBucket (value) {
  return /** @type {readonly string[]} */ (CANONICAL_STALENESS_BUCKETS).includes(value)
}

/**
 * Emit side: every `#### <bucket>` heading inside a `Version Drift —` section
 * must prefix-match a canonical bucket (or be allow-listed). Pure — returns the
 * count of canonical bucket headings matched plus any contract-violation
 * messages (the caller attributes them to a file).
 *
 * @param {string} content
 * @returns {{ bucketCount: number, errors: string[] }}
 */
export function checkStalenessEmit (content) {
  /** @type {string[]} */
  const errors = []
  const lines = content.split('\n')
  let inDrift = false
  let sectionCount = 0
  let bucketCount = 0
  for (const line of lines) {
    if (/^#{2,3} Version Drift /.test(line)) {
      inDrift = true
      sectionCount++
      continue
    }
    if (!inDrift) continue
    // A heading of level 1–3 ends the drift section (e.g. `### Graph Statistics`,
    // `### S7`). `#### …` (level 4) does NOT match `^#{1,3} ` and stays in-scope.
    if (/^#{1,3} \S/.test(line)) {
      inDrift = false
      continue
    }
    const headingMatch = line.match(/^#### (.+)$/)
    if (!headingMatch || headingMatch[1] === undefined) continue
    const text = headingMatch[1].trim()
    if (CANONICAL_STALENESS_BUCKETS.some((b) => text.startsWith(b))) {
      bucketCount++
    } else if (!STALENESS_HEADING_ALLOWLIST.has(text)) {
      errors.push(`Staleness drift section has a non-canonical "#### ${text}" heading — must prefix-match one of: ${CANONICAL_STALENESS_BUCKETS.join(', ')} (or be allow-listed: ${[...STALENESS_HEADING_ALLOWLIST].join(', ')})`)
    }
  }
  if (sectionCount === 0) {
    errors.push('Expected a "## / ### Version Drift —" section heading (staleness contract) but found none — was the section renamed or removed?')
  }
  return { bucketCount, errors }
}

/**
 * Consume side: every bucket named in a Section-3b routing bullet
 * (`- **`<bucket>`** … →`) must be canonical. Pinned to the routing-bullet
 * shape so prose code-spans don't match. Pure.
 *
 * @param {string} content
 * @returns {{ bulletBuckets: number, errors: string[] }}
 */
export function checkStalenessConsume (content) {
  /** @type {string[]} */
  const errors = []
  const lines = content.split('\n')
  let bulletBuckets = 0
  for (const line of lines) {
    // Routing bullet: a list item that carries the `→` action arrow and names
    // its bucket(s) as `**`<bucket>`**`. A single bullet may name two buckets
    // (e.g. `Drifted <30d` or `Drifted, age unknown`).
    if (!/^-\s+\*\*`/.test(line) || !line.includes('→')) continue
    for (const m of line.matchAll(/\*\*`([^`]+)`\*\*/g)) {
      if (m[1] === undefined) continue
      const bucket = m[1].trim()
      bulletBuckets++
      if (!isStalenessBucket(bucket)) {
        errors.push(`Section 3b routing bullet names non-canonical bucket "${bucket}" — must be one of: ${CANONICAL_STALENESS_BUCKETS.join(', ')}`)
      }
    }
  }
  if (bulletBuckets === 0) {
    errors.push('Expected at least one Section 3b drift routing bullet (`- **`<bucket>`** … →`) but found none — was the section renamed or removed?')
  }
  if (!content.includes('Version Drift —')) {
    errors.push('Expected a reference to the "Version Drift —" section (staleness contract) but found none')
  }
  return { bulletBuckets, errors }
}
