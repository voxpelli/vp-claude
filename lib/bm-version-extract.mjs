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
 * Patterns are tried in priority order, first hit wins — EXCEPT for
 * `npm_package` notes (detected via a `type: npm_package` frontmatter field,
 * the same signal every real `/package-intel` npm note carries), where
 * Pattern 3 is tried before Pattern 1. This is the fix for bead
 * `vp-claude-9q7e`: the `[version]` observation was designed as a
 * misparse-shield for version-string package names (`yaml`, `semver`) and
 * version-named tools, but under uniform first-hit-wins the header pipe
 * (Pattern 1, which the npm template also emits) always outranked it, so the
 * shield never actually fired. The override is npm-scoped only — every other
 * note type keeps the original 1→2→3→4→5→6 order unchanged, including the
 * other five package cohorts (crate/go/composer/pypi/gem) which also emit a
 * `[version]` observation since bead `vp-claude-f3zx` but have not had their
 * own read-ordering revisited (see bead `vp-claude-xux8`).
 *   1. Inline header pipe        — `<Label>: … | v1.39.0 | <license>`, where
 *      `<Label>` is one of the real header labels this repo's own note
 *      templates use (verified via `grep` over
 *      `skills/*\/references/note-template-*.md`): `Homepage:` (brew, cask),
 *      `Homepage / repo:` (plugin, skill), `GitHub:` (npm, crate, go,
 *      composer, pypi, gem), `Publisher:` (vscode), `Runs:` (action),
 *      `Source:` (gh). `docker`'s template has no version-pipe header at all
 *      (`Official: … | Pulls: … | Last updated: …`), so it is intentionally
 *      absent from this list.
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
 * `>=2.5.0 || 5.0.0 - 7.2.3` yields `2.5.0` as an INFORMATIONAL value only
 * (never the raw range text, and never picked up as prose — Pattern 6 only
 * matches the two literal shapes above, not arbitrary version-looking numbers
 * in body text). The returned `isRange` flag is what actually distinguishes
 * this case: a `[version-range]` observation sets `isRange: true`, signaling
 * that the note's dependency is itself unpinned and must be EXCLUDED from
 * staleness bucketing (a real pinned version and the resolved-but-unpinned
 * value of a range are otherwise textually indistinguishable once the
 * operator is stripped — `isRange` is the only reliable signal a caller has).
 * Only a bare `[version]` observation yields `isRange: false`; every other
 * pattern (1, 2, 4, 5, 6) always yields `isRange: false` too, since none of
 * them can currently capture a range value.
 *
 * Before any pattern runs, fenced code blocks (any backtick/tilde depth) are
 * excised from the note content — a real note's `## Common Usage` (or
 * similar) section routinely contains fenced examples that can coincidentally
 * contain version-looking text, and none of the 6 patterns are otherwise
 * fence-aware. This reuses the AST-based fence-detection approach `lib/mdast.mjs`
 * already established for the same problem class (see `lib/plugin-load-paths.mjs`
 * for the sibling use) — but, unlike `collectScannableText`, it returns the
 * SOURCE TEXT with fenced ranges cut out rather than a flattened array of text
 * fragments. A flattened array is unusable here: several patterns are
 * line-anchored regexes over raw structure that `collectScannableText` does
 * not preserve — list-item markers, link/emphasis delimiters, and pipe-table
 * cells are structural mdast nodes, not `text`/`inlineCode` values, so they'd
 * be silently dropped (breaking Pattern 1's `Label: … | v… |` line, Pattern 2's
 * `| Version | … |` row, and Pattern 6's `- **Version**: …` bullet marker).
 * Frontmatter (the `yaml` node) is deliberately NOT excised — Pattern 4 needs
 * it intact.
 */

/**
 * @typedef {1 | 2 | 3 | 4 | 5 | 6} VersionPattern
 */

import remarkFrontmatter from 'remark-frontmatter'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

// Built once at module scope (unified processors are stateless parse
// pipelines) — mirrors lib/mdast.mjs's own processor construction.
const mdProcessor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml'])

/**
 * Excise fenced/indented code blocks (mdast `code` nodes) from markdown
 * source, leaving everything else — including frontmatter — byte-identical.
 * Returns the input unchanged when no code block is present, so the common
 * case (a note with no fenced examples) pays no reconstruction cost.
 *
 * @param {string} content
 * @returns {string}
 */
function stripFencedCode (content) {
  const tree = mdProcessor.parse(content)
  /** @type {[number, number][]} */
  const ranges = []
  /** @param {import('mdast').Nodes} node */
  function walk (node) {
    if (node.type === 'code') {
      if (node.position) ranges.push([node.position.start.offset, node.position.end.offset])
      return
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child)
    }
  }
  walk(tree)
  if (ranges.length === 0) return content

  ranges.sort((a, b) => a[0] - b[0])
  let result = ''
  let cursor = 0
  for (const [start, end] of ranges) {
    result += content.slice(cursor, start)
    cursor = end
  }
  result += content.slice(cursor)
  return result
}

/**
 * Documentation-only catalog of the 6 patterns, in priority order. Not
 * consumed by `extractBmVersion` itself — exported so prose (skill/agent docs)
 * can render the table from a single source instead of hand-copying it.
 *
 * @type {ReadonlyArray<{ id: VersionPattern, name: string, example: string }>}
 */
export const PATTERN_SIGNATURES = [
  { id: 1, name: 'Inline header pipe', example: 'Homepage:/GitHub:/Publisher:/Runs:/Source: … | v1.39.0 | <license>' },
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
 * @typedef {{ value: string, isRange: boolean }} ExtractedToken
 */

/**
 * Pattern 1 — inline header pipe: `<Label>: … | v1.39.0 | <license>`. The
 * label alternation below is the exact, closed set of header-line labels
 * this repo's own note templates use — NOT a generic "any label" match,
 * which would raise false-positive risk against unrelated `Label: … | … |`
 * prose elsewhere in a note. See the module doc comment for the per-label
 * ecosystem mapping and the docker exception.
 *
 * @param {string} content
 * @returns {ExtractedToken | null}
 */
function patternInlineHeaderPipe (content) {
  const m = /^(?:Homepage(?: \/ repo)?|GitHub|Publisher|Runs|Source):[^|\n]*\|\s*v?(\d[\w.+-]*)\s*\|/m.exec(content)
  return m ? { value: m[1], isRange: false } : null
}

/**
 * Pattern 2 — `| Version | <value> |` table row. The label cell must equal
 * "version" (trimmed, case-insensitive) exactly — `| Spec Version | 1.1 |`
 * and `| Legacy Version | 0.9.0 |` do NOT match, so a note's real version
 * anchor (a later pattern) is not shadowed by a same-shaped but
 * differently-scoped table row.
 *
 * @param {string} content
 * @returns {ExtractedToken | null}
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
    if (valueMatch) return { value: valueMatch[1], isRange: false }
  }
  return null
}

/**
 * Pattern 3 — `[version]` / `[version-range]` observation. A range takes the
 * first concrete token after stripping a leading range operator, and is
 * flagged `isRange: true` — the note's dependency is itself unpinned, so a
 * caller doing staleness comparison must exclude it from bucketing rather
 * than diff the resolved token as if it were a real pinned version (see the
 * module doc comment). A bare `[version]` observation is unaffected and
 * always yields `isRange: false`.
 *
 * @param {string} content
 * @returns {ExtractedToken | null}
 */
function patternObservation (content) {
  const m = /^-\s*\[(version|version-range)\](.+)$/m.exec(content)
  if (!m) return null
  const isRange = m[1] === 'version-range'
  const raw = m[2].trim()
  const source = isRange ? stripLeadingRangeOperator(raw) : raw
  const tokenMatch = /^v?(\d[\w.+-]*)/.exec(source)
  return tokenMatch ? { value: tokenMatch[1], isRange } : null
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
 * @returns {ExtractedToken | null}
 */
function patternFrontmatterVersion (content) {
  const block = extractFrontmatterBlock(content)
  if (!block) return null
  const m = /^version:\s*['"]?v?(\d[\w.+-]*)['"]?\s*$/m.exec(block)
  return m ? { value: m[1], isRange: false } : null
}

/**
 * Pattern 5 — `## Release Highlights` / `## Version History` newest entry.
 * These blocks are grouped by change-type (breaking/feature/fix), not
 * version order, so the highest semver referenced is taken, never the first
 * bullet.
 *
 * @param {string} content
 * @returns {ExtractedToken | null}
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
  return { value: best, isRange: false }
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
 * @returns {ExtractedToken | null}
 */
function patternProseFallback (content) {
  const bulletMatch = /^\s*-\s*\*\*Version\*\*:\s*v?(\d[\w.+-]*)/m.exec(content)
  if (bulletMatch) return { value: bulletMatch[1], isRange: false }
  const currentMatch = /^\s*Current:\s*v?(\d[\w.+-]*)/m.exec(content)
  return currentMatch ? { value: currentMatch[1], isRange: false } : null
}

/** @type {ReadonlyArray<{ id: VersionPattern, extract: (content: string) => ExtractedToken | null }>} */
const EXTRACTORS = [
  { id: 1, extract: patternInlineHeaderPipe },
  { id: 2, extract: patternTableRow },
  { id: 3, extract: patternObservation },
  { id: 4, extract: patternFrontmatterVersion },
  { id: 5, extract: patternReleaseHighlights },
  { id: 6, extract: patternProseFallback },
]

/**
 * Default try-order: 1 → 2 → 3 → 4 → 5 → 6, unchanged for every note type
 * except `npm_package` (see {@link NPM_PATTERN_ORDER}).
 */
const DEFAULT_PATTERN_ORDER = /** @type {ReadonlyArray<VersionPattern>} */ ([1, 2, 3, 4, 5, 6])

/**
 * npm-scoped override: Pattern 3 (the `[version]` observation) tried before
 * Pattern 1 (the header pipe) — see the module doc comment and bead
 * `vp-claude-9q7e`. Patterns 2/4/5/6 keep their original relative order.
 */
const NPM_PATTERN_ORDER = /** @type {ReadonlyArray<VersionPattern>} */ ([3, 1, 2, 4, 5, 6])

/**
 * Detect an `npm_package` note via its `type:` frontmatter field — the same
 * signal every real `/package-intel`-written npm note carries
 * (`note-template-npm.md` seeds `type: npm_package`).
 *
 * @param {string} content
 * @returns {boolean}
 */
function isNpmPackageNote (content) {
  const block = extractFrontmatterBlock(content)
  return /^type:\s*npm_package\s*$/m.test(block)
}

/**
 * Extract the documented version from a Basic Memory note, trying all 6
 * patterns in priority order (first hit wins) — npm_package notes use an
 * npm-scoped override order, see {@link NPM_PATTERN_ORDER}. A `null` version
 * means no pattern matched — a genuine corpus-quality finding, not a parser
 * miss.
 *
 * @param {string} noteContent - the note body (and, if present, its leading
 *   YAML frontmatter block) as returned by `read_note`
 * @param {string} [noteTitle] - the note's title; not used by the current
 *   pattern set, accepted for signature parity with callers that key
 *   diagnostics off the title (e.g. reporting an `<unparseable>` note)
 * @returns {{ version: string | null, pattern: VersionPattern | null, isRange: boolean }}
 *   `isRange` is `true` only when the match came from a `[version-range]`
 *   observation (Pattern 3) — the note's dependency is itself unpinned, and
 *   callers doing staleness comparison MUST exclude it from bucketing rather
 *   than diff `version` as if it were a concrete pin (see the module doc
 *   comment). `isRange` is always `false` for every other pattern and for a
 *   `null` version.
 */
// eslint-disable-next-line no-unused-vars -- noteTitle kept for signature parity, see JSDoc above
export function extractBmVersion (noteContent, noteTitle) {
  const scannable = stripFencedCode(noteContent)
  const order = isNpmPackageNote(scannable) ? NPM_PATTERN_ORDER : DEFAULT_PATTERN_ORDER
  for (const id of order) {
    const entry = EXTRACTORS.find((e) => e.id === id)
    const token = entry?.extract(scannable)
    if (token) {
      return { version: stripLeadingV(token.value), pattern: id, isRange: token.isRange }
    }
  }
  return { version: null, pattern: null, isRange: false }
}
