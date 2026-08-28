// scan-shard.mjs — read one shard of Basic Memory notes through the `bm tool`
// CLI (MCP-through-CLI, never the filesystem) and emit, per note, BOTH the
// documented version and a set of structural-compliance signals.
//
// One read serves both dimensions: a `bm tool read-note` costs ~3s wall
// (measured 2026-08-05 against basic-memory 0.22.1; a MISSING note costs ~4.5s
// because of the search fallback). The cost is fixed per invocation rather than
// proportional to note size — a 10 KB and a 22 KB note cost the same — so it is
// per-process application initialisation, not interpreter startup (`python -c
// pass` is 0.02s and the CLI floor is ~0.8s). Serially that is ~30 minutes for a
// 580-note cohort, which is why reads are pooled and why the note is read once
// rather than twice.
//
// Version extraction delegates to the repo's fixture-tested extractor rather
// than reimplementing the six-pattern priority order. A fork of that logic is
// how a note whose only `[version]` line is narrative prose gets silently
// misread — the extractor deliberately requires a clean leading token, so such
// a note is out of contract rather than mis-parsed.
//
// EVERY structural signal below runs on FENCE-STRIPPED content. A note's
// `## Common Usage` section routinely quotes note skeletons and manifests, and
// an un-stripped scan counts a `## Security` heading inside a fenced example as
// a real section — making a non-compliant note look compliant.
//
// Usage: node scan-shard.mjs <shard.txt> <out.ndjson> [concurrency]

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'

// Statically imported and not overridable by argument — see the same note in
// rank.mjs. The orchestrator derives the drivers path and the lib path from one
// `repoRoot`; a relative import enforces that rather than asserting it, and
// gives real types back (a dynamic import of a computed specifier yields `any`).
import { extractBmVersion } from '../../../lib/bm-version-extract.mjs'
import { detectFourthWallViolations } from '../../../lib/fourth-wall-rules.mjs'
import { writeNdjson } from '../../../lib/ndjson.mjs'
import { normalizeNpmName } from '../../../lib/npm-triage.mjs'
import { errorMessage, pool } from '../../../lib/pool.mjs'
import { extractPicoschemaRelationVerbs } from '../../../lib/schema-vocab.mjs'

const execFileAsync = promisify(execFile)

const [shardPath, outPath, concurrencyRaw] = process.argv.slice(2)
if (!shardPath || !outPath) {
  throw new Error('Usage: node scan-shard.mjs <shard.txt> <out.ndjson> [concurrency]')
}
const CONCURRENCY = Math.max(1, Number.parseInt(concurrencyRaw ?? '2', 10) || 2)
// A hung `bm` permanently consumes one of very few pool slots and turns a long
// run into a hang, which is worse than a failure: a hang gets killed, and a
// killed run leaves partial artefacts behind.
const READ_TIMEOUT_MS = 120_000

const ids = readFileSync(shardPath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean)

/**
 * The relation verbs `schemas/npm_package.md` actually declares — read from the
 * schema rather than hardcoded, so the two cannot drift.
 *
 * Deliberately NOT `buildCanonicalRelationVerbs`, which returns the union across
 * all 23 schemas: a verb legitimate on a `person` note is not thereby legitimate
 * on an npm one, and the union would report a clean vocabulary for a note using
 * entirely the wrong schema's verbs.
 */
const DECLARED_RELATION_VERBS = new Set(
  extractPicoschemaRelationVerbs(readFileSync(new URL('../../../schemas/npm_package.md', import.meta.url), 'utf8'))
)

/** Required `## ` sections for an npm_package note, per schemas/npm_package.md. */
const REQUIRED_SECTIONS = ['Key APIs', 'Observations', 'Release Highlights', 'Security', 'Relations']
// Compiled once: rebuilding five RegExps per note is ~2,900 needless compiles
// over a full cohort.
const SECTION_PATTERNS = REQUIRED_SECTIONS.map(s => (
  /** @type {const} */ ([s, new RegExp(`^##\\s+${s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm')])
))

// Observation categories whose value legitimately carries a version for THIS
// package. Scoping the "is a version recoverable by eye?" question to these
// lines is what gives it discriminating power: an earlier build tested the raw
// note body for any `\d+.\d+.\d+` and was true for 24 of 24 sampled notes,
// because devDependency ranges, `SemVer 2.0.0`, engine constraints and fenced
// examples all match. That collapsed the distinction between "needs a one-line
// slot edit" and "nobody ever recorded a version", and handed the wrong
// remediation to every row.
const VERSION_BEARING_CATEGORY = /^-\s*\[(version|version-history|releases?|release-history)\]\s/

/**
 * Fenced code, removed before any structural signal is measured.
 *
 * @param {string} s
 * @returns {string}
 */
function stripFences (s) {
  return s.replaceAll(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '')
}

/**
 * Classify the title form. A pre-0.22.0 colon title is invisible to any sweep
 * that filters on an `npm-` title prefix, so it is a compliance defect in its
 * own right, not a cosmetic one.
 *
 * @param {string} title
 * @returns {'hyphen'|'colon'|'no-prefix'}
 */
function titleForm (title) {
  if (title.startsWith('npm-')) return 'hyphen'
  if (title.startsWith('npm:')) return 'colon'
  return 'no-prefix'
}

/**
 * Recover the npm package name, in descending order of authority. `packages[0]`
 * is the documented source; the npm URL in the note body is the fallback that
 * survives a null/rich-object `packages` field. Inverting the title is NOT a
 * fallback — `npm-@a-b-c` maps ambiguously back to a scoped name.
 *
 * The recovered name is NORMALIZED here, at the single point every consumer
 * reads it from: `registry-shard.mjs` queries `npmName` and `rank.mjs` builds
 * its `/intel npm:<name>` fix string from the same field, so normalizing in
 * either one alone would leave the other emitting `/intel npm:npm:solid-js`.
 * `rawName` is kept so a note whose OWN frontmatter carries the malformation
 * can be reported rather than silently repaired every sweep.
 *
 * @param {Record<string, unknown> | undefined} frontmatter
 * @param {string} content
 * @returns {{ name: string, rawName: string, source: string, packagesShape: string, extraPackages: string[] }}
 */
function recoverName (frontmatter, content) {
  const pkgs = frontmatter?.['packages']
  /** @type {unknown[] | undefined} */
  const arr = Array.isArray(pkgs) ? pkgs : undefined
  /** @type {unknown} */
  const first = arr?.[0]

  let packagesShape = 'missing'
  if (arr) {
    if (typeof first === 'string') packagesShape = arr.length > 1 ? 'string-array-multi' : 'string-array'
    else if (first && typeof first === 'object') packagesShape = 'object-array'
    else packagesShape = 'empty-array'
  } else if (pkgs != null) {
    packagesShape = 'not-an-array'
  }

  // Recorded so the report can state the coverage loss: only packages[0] is
  // ever resolved upstream, so a multi-package note's remaining packages are
  // silently unchecked rather than merely untidy.
  const extraPackages = (arr ?? []).slice(1).map(p => (typeof p === 'string' ? p : String(/** @type {Record<string, unknown>} */ (p)?.['name'] ?? ''))).filter(Boolean)

  /**
   * @param {string} raw
   * @param {string} source
   * @returns {{ name: string, rawName: string, source: string, packagesShape: string, extraPackages: string[] }}
   */
  const found = (raw, source) => ({ name: normalizeNpmName(raw), rawName: raw, source, packagesShape, extraPackages })

  if (typeof first === 'string' && first) return found(first, 'packages[0]')
  if (first && typeof first === 'object') {
    const n = /** @type {Record<string, unknown>} */ (first)['name']
    if (typeof n === 'string' && n) return found(n, 'packages[0].name')
  }
  const m = content.match(/npmjs\.com\/package\/(@[\w.-]+\/[\w.-]+|[\w.-]+)/)
  if (m) return found(m[1] ?? '', 'body-npm-url')
  return { name: '', rawName: '', source: 'none', packagesShape, extraPackages }
}

/**
 * Look for a version recorded somewhere the six-pattern extractor deliberately
 * does not read — most often `packages[0].version_latest` on a note using the
 * pre-schema rich-object `packages[]` shape.
 *
 * This is NOT a seventh extraction pattern, and it must never be folded into
 * the extractor: the distinction it enables is the point. A note with no
 * version anywhere genuinely needs research; a note whose version is merely in
 * the wrong slot needs a one-line edit. Collapsing the two sends a whole class
 * of already-current notes to the top of a "most in need of research" list.
 *
 * @param {Record<string, unknown> | undefined} frontmatter
 * @returns {{ version: string | null, source: string | null }}
 */
function nonCanonicalVersion (frontmatter) {
  if (!frontmatter) return { version: null, source: null }
  const pkgs = frontmatter['packages']
  const first = Array.isArray(pkgs) ? pkgs[0] : undefined
  if (first && typeof first === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (first)
    for (const key of ['version_latest', 'version']) {
      const v = obj[key]
      if (typeof v === 'string' && /^v?\d/.test(v)) return { version: v, source: `packages[0].${key}` }
    }
  }
  for (const key of ['version_latest', 'version']) {
    const v = frontmatter[key]
    if (typeof v === 'string' && /^v?\d/.test(v)) return { version: v, source: `frontmatter.${key}` }
  }
  return { version: null, source: null }
}

/**
 * @param {string} id
 * @returns {Promise<import('../../../lib/npm-triage.mjs').ScanRow>}
 */
async function scanOne (id) {
  /** @type {{ frontmatter?: Record<string, unknown>, content?: string, title?: string }} */
  let note
  try {
    const { stdout } = await execFileAsync('bm', ['tool', 'read-note', '--include-frontmatter', id], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: READ_TIMEOUT_MS,
    })
    note = JSON.parse(stdout)
  } catch (err) {
    return { id, status: 'read-failed', error: String(err && /** @type {Error} */ (err).message).slice(0, 200) }
  }

  // A note that does not exist is NOT an error here: `bm tool read-note` exits 0
  // and returns an all-null envelope. Left unchecked that becomes a row with no
  // version and five missing sections — a phantom "maximally non-compliant note"
  // rather than an absent one.
  if (note.title == null && note.content == null) {
    return { id, status: 'not-found' }
  }

  const content = typeof note.content === 'string' ? note.content : ''
  const returnedTitle = typeof note.title === 'string' ? note.title : ''

  // Identity guard: Basic Memory can answer a read with a *search fallback*,
  // returning a different note than the one asked for. Unchecked, that silently
  // attributes one note's version to another.
  if (returnedTitle && returnedTitle !== id) {
    return { id, status: 'read-mismatch', returnedTitle }
  }

  // The extractor runs a full remark parse to strip fences, so it CAN throw.
  // Unguarded, one malformed note rejects the pool and discards every row the
  // shard had already completed — the same reason the fourth-wall detector
  // below is wrapped.
  let version = null
  let pattern = null
  let isRange = false
  let extractError = null
  try {
    const r = extractBmVersion(content, id)
    version = r.version ?? null
    pattern = r.pattern ?? null
    isRange = !!r.isRange
  } catch (err) {
    extractError = String(err && /** @type {Error} */ (err).message).slice(0, 200)
  }

  const { extraPackages, name, packagesShape, rawName, source: nameSource } = recoverName(note.frontmatter, content)
  const { source: altVersionSource, version: altVersion } = nonCanonicalVersion(note.frontmatter)

  const stripped = stripFences(content)

  const missingSections = SECTION_PATTERNS.filter(([, re]) => !re.test(stripped)).map(([name_]) => name_)

  // Split-then-test rather than one `\s*(.*)$` capture: the greedy form is what
  // the repo's own regexp lint flags as super-linear backtracking, and
  // lib/bm-version-extract.mjs deliberately avoids the same shape.
  const observationLines = stripped.split('\n').filter(l => l.startsWith('- ['))
  const hasVersionObs = observationLines.some(l => l.startsWith('- [version]'))

  const versionBearingLines = observationLines.filter(l => VERSION_BEARING_CATEGORY.test(l))
  const versionBearingCategory = versionBearingLines.length
    ? (VERSION_BEARING_CATEGORY.exec(versionBearingLines[0] ?? '')?.[1] ?? null)
    : null
  // "Could a human read a version off this note?" — scoped to version-bearing
  // observations, so it means what it says.
  const versionRecoverableFromObservation = versionBearingLines.some(l => /\d+\.\d+/.test(l))

  // Bound the section by splitting on headings rather than with a lookahead
  // terminator: an unbounded split scans to end-of-file and counts
  // relation-shaped lines from later sections, while the obvious
  // `(?=^##\s|\s*$)` terminator matches at the end of the very first line and
  // yields an always-empty block (every note reads as having zero relations).
  const relationsBlock = stripped.split(/^##\s+/m).find(s => /^Relations\b/.test(s)) ?? ''
  // Kept as the TOTAL, deliberately. A non-zero count is what keeps a note out
  // of the `no relations` gap, and re-defining it to mean "relations using a
  // DECLARED verb" would move notes across the current→modernize boundary — a
  // scoring change wearing a counting fix's clothes. The vocabulary finding
  // below is report-only for exactly that reason, the same discipline the
  // fourth-wall flags already follow.
  const relationVerbs = [...relationsBlock.matchAll(/^-\s*([a-z_]+)\s+\[\[/gm)].map(m => m[1] ?? '')
  const relationCount = relationVerbs.length
  const relationVerbsUnknown = [...new Set(relationVerbs.filter(v => v && !DECLARED_RELATION_VERBS.has(v)))]

  // Reuses the repo's own fourth-wall rule registry rather than a local copy, so
  // this cannot drift from the checklist the note-quality skill enforces.
  // Report-only, and NOT part of the compliance gap set — its false-positive
  // rate over a full npm cohort has not been measured, so it must not move a
  // note between action classes.
  /** @type {string[]} */
  let fourthWall = []
  let fourthWallError = null
  try {
    fourthWall = detectFourthWallViolations(stripped).map(h => h.id)
  } catch (err) {
    // Recorded, not swallowed: a systematically throwing detector would
    // otherwise render as "no fourth-wall problems anywhere in the cohort".
    fourthWallError = String(err && /** @type {Error} */ (err).message).slice(0, 120)
  }

  return {
    id,
    status: extractError ? 'extract-failed' : 'ok',
    extractError,
    version,
    pattern,
    isRange,
    altVersion,
    altVersionSource,
    npmName: name,
    // Non-empty only when the note's own recorded name needed repair before it
    // could be queried — an `npm:` prefix or an `@version` suffix. rank.mjs
    // turns that into a reported gap rather than a silent fix.
    npmNameRaw: rawName === name ? '' : rawName,
    nameSource,
    packagesShape,
    extraPackages,
    titleForm: titleForm(id),
    missingSections,
    hasVersionObs,
    versionRecoverableFromObservation,
    versionBearingCategory,
    relationCount,
    relationVerbsUnknown,
    fourthWall,
    fourthWallError,
  }
}

const rows = await pool(ids, CONCURRENCY, scanOne, (item, err) => ({ id: item, status: 'read-failed', error: errorMessage(err, 200) }))
writeNdjson(outPath, rows)

/** @type {Record<string, number>} */
const counts = {}
for (const r of rows) {
  const k = String(r.status)
  counts[k] = (counts[k] ?? 0) + 1
}
process.stdout.write(JSON.stringify({ shard: shardPath, requested: ids.length, written: rows.length, counts }) + '\n')
