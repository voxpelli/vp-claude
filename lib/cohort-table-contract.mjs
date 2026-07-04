// Cross-file lockstep contract for the `--stale` cohort configuration tables
// in skills/knowledge-gaps/references/staleness-detection.md and
// agents/knowledge-gardener.md Step 5b — both hand-maintain the same cohort
// set, with NO comment or contract tying them together until now (a
// DIFFERENT, adjacent lockstep risk in the same two files — the S2
// version-extraction PATTERN PROSE — does carry a "no machine contract
// couples them" comment at knowledge-gardener.md; this module does not cover
// that one). Extracted as pure functions per the staleness-contract.mjs
// precedent.
//
// LINE-REGEX over raw text, NOT a markdown AST. Written before `remark-gfm`
// was added to this repo's devDependencies (2026-07-04, same session) — at
// the time, this repo's only markdown-parsing dependency (remark-parse, via
// lib/mdast.mjs) did not produce `table` nodes at all without it. `remark-gfm`
// is now installed (for `check:md`'s own table-structure linting), but this
// module deliberately stays line-regex rather than migrating to an AST walk:
// the logic here is already correct and tested, and teaching lib/mdast.mjs a
// table-cell extractor for this one narrow need would be churn with no
// functional benefit over the working implementation.
//
// Anchor: the table HEADER ROW itself, not a preceding heading or sentence
// (which can be reworded independently of the table). Both files' header
// rows share "Prefix", "Fetch script", and "Deprecation?" as stable column
// labels even though the tables otherwise differ (column order, an extra
// "Tap dim?" column in the gardener's table, backtick-wrapped vs bare tokens
// in the first cell).

/**
 * Extract the cohort token set from a cohort configuration table, identified
 * by its header row.
 *
 * @param {string} content
 * @returns {{ tokens: string[], errors: string[] }}
 */
export function extractCohortTokens (content) {
  const lines = content.split('\n')
  const headerIndex = lines.findIndex((line) => /^\|.*Prefix.*Fetch script.*Deprecation\?/.test(line))
  if (headerIndex === -1) {
    return {
      tokens: [],
      errors: ['Expected a cohort configuration table (header row containing "Prefix", "Fetch script", "Deprecation?") but found none — was the table renamed or restructured?'],
    }
  }
  const separator = lines[headerIndex + 1]
  if (separator === undefined || !/^\|[-\s|]+\|$/.test(separator)) {
    return {
      tokens: [],
      errors: ['Cohort table header row found but not followed by a `|---|---|` separator row — malformed table?'],
    }
  }
  /** @type {string[]} */
  const tokens = []
  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined || !line.startsWith('|')) break
    const firstCell = line.split('|')[1]?.trim()
    if (!firstCell) continue
    tokens.push(firstCell.replaceAll('`', ''))
  }
  return { tokens, errors: [] }
}

/**
 * Compare the cohort token sets from staleness-detection.md and
 * knowledge-gardener.md Step 5b — they must be IDENTICAL (order-independent).
 * Pure — the caller supplies both files' already-read content.
 *
 * @param {string} stalenessDetectionContent
 * @param {string} knowledgeGardenerContent
 * @returns {{ errors: string[] }}
 */
export function checkCohortLockstep (stalenessDetectionContent, knowledgeGardenerContent) {
  const a = extractCohortTokens(stalenessDetectionContent)
  const b = extractCohortTokens(knowledgeGardenerContent)
  const errors = [...a.errors, ...b.errors]
  if (errors.length > 0) return { errors }

  const setA = new Set(a.tokens)
  const setB = new Set(b.tokens)
  const onlyInA = a.tokens.filter((t) => !setB.has(t))
  const onlyInB = b.tokens.filter((t) => !setA.has(t))
  if (onlyInA.length > 0) {
    errors.push(`Cohort(s) in staleness-detection.md but missing from knowledge-gardener.md Step 5b: ${onlyInA.join(', ')}`)
  }
  if (onlyInB.length > 0) {
    errors.push(`Cohort(s) in knowledge-gardener.md Step 5b but missing from staleness-detection.md: ${onlyInB.join(', ')}`)
  }
  return { errors }
}
