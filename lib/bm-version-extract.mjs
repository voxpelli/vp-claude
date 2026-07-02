/**
 * Single-source S2 version extractor for Basic Memory notes.
 *
 * The 6-pattern, priority-ordered version-extraction logic used by
 * `/knowledge-gaps --stale` (`skills/knowledge-gaps/references/staleness-detection.md`
 * S2) and the `knowledge-gardener` agent (Step 5b-ii) was, until this module,
 * duplicated as PROSE-ONLY mirrors kept in sync by a manual lockstep comment —
 * no machine contract coupled them. This module is the real matching logic,
 * fixture-tested via `scripts/check-bm-version-extract.mjs` (wired as
 * `check:bm-version-extract`), following the drift-guard family template of
 * `lib/staleness-contract.mjs` + `check:contract` and `lib/version-distance.mjs`
 * + `check:distance`.
 *
 * Patterns are tried in priority order, first hit wins:
 *   1. Inline header pipe        — `Homepage: … | v1.39.0 | <license>`
 *   2. `| Version | <value> |` table row (label cell must equal "version",
 *      trimmed/case-insensitive — `| Spec Version | 1.1 |` does NOT match)
 *   3. `[version]` / `[version-range]` observation
 *   4. Frontmatter `version:` field
 *   5. `## Release Highlights` / `## Version History` newest entry (highest
 *      semver referenced in the section, NOT the first bullet — these blocks
 *      are grouped by change-type, not version order)
 *   6. Registry/prose fallback — `- **Version**: 0.11.13 (…)` or
 *      `Current: v3.2.4 (…)`
 *
 * A leading `v` is stripped from the final extracted value. `[version-range]`
 * takes the first concrete version token after stripping a leading range
 * operator (`^`, `~`, `>=`, `>`, `<=`, `<`, `=`) — a range-example string like
 * `>=2.5.0 || 5.0.0 - 7.2.3` yields `2.5.0`, never the raw range text, and is
 * never picked up as prose (Pattern 6 only matches the two literal shapes
 * above, not arbitrary version-looking numbers in body text).
 */

/**
 * @typedef {1 | 2 | 3 | 4 | 5 | 6} VersionPattern
 */

/**
 * Documentation-only catalog of the 6 patterns, in priority order. Not
 * consumed by `extractBmVersion` itself — exported so prose (skill/agent docs)
 * can render the table from a single source instead of hand-copying it.
 *
 * @type {ReadonlyArray<{ id: VersionPattern, name: string, example: string }>}
 */
export const PATTERN_SIGNATURES = [
  { id: 1, name: 'Inline header pipe', example: 'Homepage: … | v1.39.0 | <license>' },
  { id: 2, name: '`| Version | <value> |` table row', example: '| Version | 0.26.1 |' },
  { id: 3, name: '`[version]` / `[version-range]` observation', example: '- [version] 5.8.5' },
  { id: 4, name: 'Frontmatter `version:` field', example: 'version: 12.4.0' },
  { id: 5, name: '`## Release Highlights` / `## Version History` newest entry', example: '## Release Highlights\n- **v5.8.5** (2026-05-…) — …' },
  { id: 6, name: 'Registry/prose fallback', example: '- **Version**: 0.11.13 (…) / Current: v3.2.4 (…)' },
]

/**
 * Strip a leading `v` immediately followed by a digit (`v1.39.0` → `1.39.0`).
 * A no-op for already-bare tokens.
 *
 * @param {string} v
 * @returns {string}
 */
function stripLeadingV (v) {
  return /^v(?=\d)/.test(v) ? v.slice(1) : v
}

/**
 * Extract the note's YAML frontmatter block (the text between the first pair
 * of `---` fences), or an empty string if the note has no frontmatter.
 *
 * @param {string} content
 * @returns {string}
 */
function extractFrontmatterBlock (content) {
  const m = /^---\n([\s\S]*?)\n---/.exec(content)
  return m ? m[1] : ''
}

/**
 * Parse the leading `MAJOR.MINOR[.PATCH]` of a version string for comparison.
 *
 * @param {string} v
 * @returns {[number, number, number] | null}
 */
function parseForCompare (v) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(v)
  if (!m) return null
  return [Number.parseInt(m[1], 10), Number.parseInt(m[2], 10), Number.parseInt(m[3] ?? '0', 10)]
}

/**
 * Compare two version strings by their leading `MAJOR.MINOR.PATCH`. Returns a
 * positive number when `a` is newer, negative when `b` is newer, 0 when equal
 * or not comparable.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersions (a, b) {
  const pa = parseForCompare(a)
  const pb = parseForCompare(b)
  if (!pa || !pb) return 0
  if (pa[0] !== pb[0]) return pa[0] - pb[0]
  if (pa[1] !== pb[1]) return pa[1] - pb[1]
  return pa[2] - pb[2]
}

/**
 * Pattern 1 — inline header pipe: `Homepage: … | v1.39.0 | <license>`.
 *
 * @param {string} content
 * @returns {string | null}
 */
function patternInlineHeaderPipe (content) {
  const m = /^Homepage:[^|\n]*\|\s*v?(\d[\w.+-]*)\s*\|/m.exec(content)
  return m ? m[1] : null
}

/**
 * Pattern 2 — `| Version | <value> |` table row. The label cell must equal
 * "version" (trimmed, case-insensitive) exactly — `| Spec Version | 1.1 |`
 * and `| Legacy Version | 0.9.0 |` do NOT match, so a note's real version
 * anchor (a later pattern) is not shadowed by a same-shaped but
 * differently-scoped table row.
 *
 * @param {string} content
 * @returns {string | null}
 */
function patternTableRow (content) {
  for (const line of content.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    // Manual cell split (not a regex) — a pipe-bounded regex capture here
    // would need adjacent `\s*`/`[^|]+?` quantifiers that ReDoS-lint flags as
    // super-linear on pathological input.
    let cells = line.split('|').map((c) => c.trim())
    if (cells[0] === '') cells = cells.slice(1)
    if (cells.at(-1) === '') cells = cells.slice(0, -1)
    if (cells.length < 2) continue
    if (cells[0].toLowerCase() !== 'version') continue
    const valueMatch = /v?(\d[\w.+-]*)/.exec(cells[1])
    if (valueMatch) return valueMatch[1]
  }
  return null
}

/**
 * Pattern 3 — `[version]` / `[version-range]` observation. A range takes the
 * first concrete token after stripping a leading range operator.
 *
 * @param {string} content
 * @returns {string | null}
 */
function patternObservation (content) {
  const m = /^-\s*\[(version|version-range)\](.+)$/m.exec(content)
  if (!m) return null
  const raw = m[2].trim()
  const source = m[1] === 'version-range' ? stripLeadingRangeOperator(raw) : raw
  const tokenMatch = /^v?(\d[\w.+-]*)/.exec(source)
  return tokenMatch ? tokenMatch[1] : null
}

/**
 * Strip one leading semver range operator (`^`, `~`, `>=`, `<=`, `>`, `<`,
 * `=`) from a `[version-range]` observation value, so the first concrete
 * version token can be read off the front — a plain loop over a fixed
 * operator list, not a regex alternation (avoids ReDoS-lint on an alternation
 * of single- and multi-character operators).
 *
 * @param {string} raw
 * @returns {string}
 */
function stripLeadingRangeOperator (raw) {
  const trimmed = raw.trimStart()
  for (const op of ['>=', '<=', '^', '~', '>', '<', '=']) {
    if (trimmed.startsWith(op)) return trimmed.slice(op.length).trimStart()
  }
  return trimmed
}

/**
 * Pattern 4 — frontmatter `version:` field.
 *
 * @param {string} content
 * @returns {string | null}
 */
function patternFrontmatterVersion (content) {
  const block = extractFrontmatterBlock(content)
  if (!block) return null
  const m = /^version:\s*['"]?v?(\d[\w.+-]*)['"]?\s*$/m.exec(block)
  return m ? m[1] : null
}

/**
 * Pattern 5 — `## Release Highlights` / `## Version History` newest entry.
 * These blocks are grouped by change-type (breaking/feature/fix), not
 * version order, so the highest semver referenced is taken, never the first
 * bullet.
 *
 * @param {string} content
 * @returns {string | null}
 */
function patternReleaseHighlights (content) {
  const sectionMatch = /^##\s+(?:Release Highlights|Version History)\s*$/m.exec(content)
  if (!sectionMatch) return null
  const rest = content.slice(sectionMatch.index + sectionMatch[0].length)
  const endMatch = /^##\s+\S/m.exec(rest)
  const block = endMatch ? rest.slice(0, endMatch.index) : rest

  /** @type {string[]} */
  const tokens = []
  for (const m of block.matchAll(/\*\*v?(\d+\.\d+\.\d[\w.-]*)\*\*/g)) tokens.push(m[1])
  for (const m of block.matchAll(/\[v?(\d+\.\d+\.\d[\w.-]*)\]/g)) tokens.push(m[1])
  if (tokens.length === 0) return null

  let best = tokens[0]
  for (const token of tokens) {
    if (compareVersions(token, best) > 0) best = token
  }
  return best
}

/**
 * Pattern 6 — registry/prose fallback: `- **Version**: 0.11.13 (…)` or
 * `Current: v3.2.4 (…)`. Deliberately narrow shapes only, anchored to the
 * start of a line (`^`, `/m`) — arbitrary version-looking numbers elsewhere
 * in prose (e.g. a semver-range example like `>=2.5.0 || 5.0.0 - 7.2.3`, or
 * either shape appearing mid-sentence rather than as its own line) must NOT
 * be grabbed here.
 *
 * @param {string} content
 * @returns {string | null}
 */
function patternProseFallback (content) {
  const bulletMatch = /^\s*-\s*\*\*Version\*\*:\s*v?(\d[\w.+-]*)/m.exec(content)
  if (bulletMatch) return bulletMatch[1]
  const currentMatch = /^\s*Current:\s*v?(\d[\w.+-]*)/m.exec(content)
  return currentMatch ? currentMatch[1] : null
}

/** @type {ReadonlyArray<(content: string) => string | null>} */
const EXTRACTORS = [
  patternInlineHeaderPipe,
  patternTableRow,
  patternObservation,
  patternFrontmatterVersion,
  patternReleaseHighlights,
  patternProseFallback,
]

/**
 * Extract the documented version from a Basic Memory note, trying all 6
 * patterns in priority order (first hit wins). A `null` version means no
 * pattern matched — a genuine corpus-quality finding, not a parser miss.
 *
 * @param {string} noteContent - the note body (and, if present, its leading
 *   YAML frontmatter block) as returned by `read_note`
 * @param {string} [noteTitle] - the note's title; not used by the current
 *   pattern set, accepted for signature parity with callers that key
 *   diagnostics off the title (e.g. reporting an `<unparseable>` note)
 * @returns {{ version: string | null, pattern: VersionPattern | null }}
 */
// eslint-disable-next-line no-unused-vars -- noteTitle kept for signature parity, see JSDoc above
export function extractBmVersion (noteContent, noteTitle) {
  for (const [i, extractor] of EXTRACTORS.entries()) {
    const raw = extractor(noteContent)
    if (raw) {
      return { version: stripLeadingV(raw), pattern: /** @type {VersionPattern} */ (i + 1) }
    }
  }
  return { version: null, pattern: null }
}
