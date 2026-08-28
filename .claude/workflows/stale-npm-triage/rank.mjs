// rank.mjs — join the four mechanical passes, assign each cohort member exactly
// one action class, order within class, and render the tables.
//
// Nothing here is a judgement call made by an agent. An agent asked to
// holistically order ~580 rows produces an ordering that is neither stable
// across runs nor reviewable afterwards; a declared lexicographic key is both,
// and every input to it is emitted as its own column so a reader can check any
// row's position by eye.
//
// ── Why a key and not a score ───────────────────────────────────────────────
// This used to be a weighted sum. Two failure modes killed it, and neither was
// fixable by re-tuning weights. Compensation: with ~30 points available below
// the drift term, a `patch` bump on an old, popular, untidy note reached the
// same total as a confirmed `semver-major` — a breaking change is not something
// tidiness should be able to buy back. Imputation: an unmeasured input scored 0,
// so 462 lookups lost to HTTP 429 were arithmetically identical to 462 packages
// nobody uses. `lib/npm-triage.mjs`'s `compareRows` has neither property: a
// level cannot be crossed from below, and "not measured" is a branch, not a 0.
//
// ── The class boundary that matters ─────────────────────────────────────────
// "We measured drift and it is bad" and "we could not measure drift" are
// different epistemic states, not different severities, so they get different
// tables. An earlier build ranked them together and the result was actively
// misleading: notes that were in fact CURRENT topped the list — purely because
// no machine-readable version slot existed to compare — while a confirmed
// breaking change on a widely-used package sat far below them. `intel`
// therefore means CONFIRMED drift only.
//
// ── The gate ────────────────────────────────────────────────────────────────
// This gate has been rewritten twice for the same reason. The first version
// compared `rows.length` against `cohort.length` where `rows` was built by
// iterating `cohort` — a tautology that passed over literally any input,
// including empty scan and registry files. The second split it into named
// sub-checks and claimed in this comment that each could fail; three of them
// still could not, and two constructed disasters (every note read failing, a
// total registry outage) both reported a clean run and "0 confirmed drift
// candidates".
//
// The rule the current set obeys, enforced by fixture in
// scripts/check-npm-triage.mjs: **a live check compares a measured count
// against a literal constant, or against a value from a source the failure
// itself cannot touch.** Here those are the literal 0 (`resolvedSomeNote`) and
// `enumerate.json` (`cohortWithinEnumeration`), which is written before any
// note is read. `registryCoversNamed` satisfies neither and its comment in
// lib/npm-triage.mjs says so out loud rather than implying otherwise.
//
// Exit codes are distinct on purpose: 1 = a gate invariant failed (a real
// finding), 2 = the inputs could not be read (nothing was computed). Collapsing
// them makes "we found a hole" indistinguishable from "we crashed".
//
// Usage: node rank.mjs <outDir> <today-ISO> [censusTsv]
//   censusTsv: `<noteTitle>\t<YYYY-MM-DD>` census of the ecosystem directory.
//   Supplies note-age AND lets the completeness audit reconcile the type-based
//   cohort against directory membership.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { readNdjson, writeNdjson } from '../../../lib/ndjson.mjs'
import { extractPicoschemaRelationVerbs } from '../../../lib/schema-vocab.mjs'

// Statically imported, and deliberately not overridable by argument. The
// orchestrator derives both the drivers path and the lib path from ONE
// `repoRoot`, because a lib from a different checkout would silently score the
// report with a different version extractor than the repo it claims to
// describe. A relative import ENFORCES that invariant instead of asserting it,
// resolves identically under any `repoRoot`, and restores real types across
// every symbol below — a dynamic `import()` of a computed specifier gives back
// `any`. It also retires the `new URL().pathname` fallback, which mangles a
// checkout path containing spaces into `%20`.
import {
  buildGate, classifyRow, compareRows, DRIFT_ORDER, isResolvedAction, RENDERED_ACTIONS,
} from '../../../lib/npm-triage.mjs'

// Guarded, not just destructured. Every one of these files previously read
// `process.argv` positionally with no check, so invoking a driver with a
// missing argument reached `readFileSync(undefined)` and failed with a message
// about `undefined` rather than about the argument nobody passed.
/** Reported beside the drift list so "0 unknown verbs" is not read as "no vocabulary was checked". */
const DECLARED_RELATION_VERB_COUNT = extractPicoschemaRelationVerbs(
  readFileSync(new URL('../../../schemas/npm_package.md', import.meta.url), 'utf8')
).length

const [outDir, todayRaw, censusPath] = process.argv.slice(2)
if (!outDir || !todayRaw) {
  throw new Error('Usage: node rank.mjs <outDir> <today-ISO> [censusTsv]')
}
const TODAY = new Date(`${todayRaw}T00:00:00Z`)
if (Number.isNaN(TODAY.getTime())) throw new Error(`rank.mjs: invalid today date: ${todayRaw}`)

// The ordering key and the action-class chain live in lib/npm-triage.mjs —
// file I/O here, resolution in lib/, per .claude/rules/scripts-and-validation.md.
// That is what lets scripts/check-npm-triage.mjs pin the decision logic to
// fixtures instead of a 21-minute live run.

/** Fatal input error — distinct exit code from a gate failure. */
let malformedLines = 0

/**
 * `readNdjson` reports malformed lines rather than throwing or dropping them;
 * this accumulates them across the three inputs so the gate can fail on a
 * truncated shard write. Silently skipping would shrink coverage while every
 * count still looked self-consistent.
 *
 * @param {string} p
 * @returns {Map<string, Record<string, unknown>>}
 */
function loadNdjson (p) {
  const { malformed, map } = readNdjson(p)
  malformedLines += malformed
  return map
}

const cohortPath = `${outDir}/cohort.txt`
const scanPath = `${outDir}/scan.ndjson`
const registryPath = `${outDir}/registry.ndjson`

const cohort = existsSync(cohortPath)
  ? readFileSync(cohortPath, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : []
const scan = loadNdjson(scanPath)
const registry = loadNdjson(registryPath)
const schema = loadNdjson(`${outDir}/schema.ndjson`)
const downloads = loadNdjson(`${outDir}/downloads.ndjson`)

/** Carried forward so the denominator can be reconciled against what BM reported. */
let enumerateSummary = null
if (existsSync(`${outDir}/enumerate.json`)) {
  try {
    enumerateSummary = JSON.parse(readFileSync(`${outDir}/enumerate.json`, 'utf8'))
  } catch { malformedLines++ }
}

/**
 * ISO-8601 calendar dates, and nothing else.
 *
 * `new Date()` accepts `05/08/2026` and reads it as May 8 — so a census
 * regenerated in `DD/MM/YYYY` yields plausible-but-WRONG note ages for days
 * 1-12 and nulls for 13-31, while `censusRows` and `cohortMatchedInCensus` both
 * stay green. Note age is level 4 of the intel key and the sole tie-break above
 * `id`, so a silently wrong date silently reorders the deliverable. Rejecting at
 * parse time keeps a malformed value out of the classifier entirely; the count
 * of rejects is what `censusUsable` then fails on.
 *
 * A well-formed but impossible date (`2026-13-45`) still passes here and yields
 * a null age downstream — a visible gap, not a wrong number, so it is left to
 * the existing `noteAgeDays == null` reporting rather than guarded twice.
 */
const CENSUS_DATE = /^\d{4}-\d{2}-\d{2}$/

/** @type {Map<string, string>} */
const census = new Map()
/**
 * Whether a census was SUPPLIED — deliberately not `census.size > 0`.
 *
 * A wholesale format break rejects every row, so a parsed-row count of 0 is
 * exactly what a broken census looks like — gating the check on it would make
 * `censusUsable` unfailable in the one case it exists for. This is the file's
 * own existence, which no parse failure can touch.
 */
const censusFile = censusPath && existsSync(censusPath) ? censusPath : null
const censusSupplied = censusFile !== null
let censusRowsRejected = 0
if (censusFile) {
  for (const line of readFileSync(censusFile, 'utf8').split('\n')) {
    const [id, date] = line.split('\t')
    // A blank or single-column line is skipped, not rejected: trailing newlines
    // are normal and must not count against the format.
    if (!id?.trim() || !date?.trim()) continue
    const d = date.trim()
    if (CENSUS_DATE.test(d)) census.set(id.trim(), d)
    else censusRowsRejected++
  }
}
// One action class per cohort member, assigned by lib/npm-triage.mjs. The
// driver supplies the three NDJSON row maps and the census date; every decision
// about what they mean is made in the library, under fixture test.
const rows = cohort.map(id => classifyRow({
  id,
  scanRow: scan.get(id),
  registryRow: registry.get(id),
  downloadsRow: downloads.get(id),
  schemaRow: schema.get(id),
  censusDate: census.get(id) ?? null,
  today: TODAY,
}))

// ── Gate ────────────────────────────────────────────────────────────────────
/** @type {Record<string, number>} */
const actionCounts = {}
for (const r of rows) actionCounts[r.action] = (actionCounts[r.action] ?? 0) + 1
const classified = Object.values(actionCounts).reduce((a, b) => a + b, 0)

const namedRows = [...scan.values()].filter(r => r.status === 'ok' && r.npmName)
const resolvedRows = rows.filter(r => isResolvedAction(r.action)).length
const okScanRows = namedRows.length
const scanReconciled = enumerateSummary
  ? (enumerateSummary.uniqueIdentifiers ?? 0) + (enumerateSummary.duplicateIdentifiers?.length ?? 0) === (enumerateSummary.reportedTotalEntities ?? -1)
  : null
// The gate's one failure-independent denominator. Written by the enumerate step
// before any note is read or any registry queried, so no downstream disaster can
// shrink it into agreement with a broken cohort.
const expectedTotal = typeof enumerateSummary?.uniqueIdentifiers === 'number'
  ? enumerateSummary.uniqueIdentifiers
  : null
// Replaces a content hash of the cohort, which had no consumer and could not do
// the job its comment claimed: a hash detects a DIFFERENT cohort, never an
// OLDER one, and reading last week's artefacts is the failure that actually
// happened. The run date is argv-supplied at both ends, so this stays free of
// `new Date()`.
const artefactsFromThisRun = enumerateSummary?.runDate === todayRaw

// Denominator from the REGISTRY step, numerator from the DOWNLOADS step: a
// downloads outage cannot shrink the denominator into agreement with itself.
const downloadsEligible = [...registry.values()]
  .filter(r => r.upstreamState === 'ok' || r.upstreamState === 'deprecated').length
const downloadsOk = [...downloads.values()].filter(r => r.downloadsState === 'ok').length

/**
 * Cohort members carrying a well-formed census date. Computed once: it is both
 * a reported number and `censusUsable`'s numerator, and the two must never be
 * able to disagree about what "matched" means.
 */
const censusMatched = cohort.filter(id => census.has(id)).length

const gate = buildGate({
  cohort,
  rows,
  scan,
  registry,
  scanFilePresent: existsSync(scanPath),
  registryFilePresent: existsSync(registryPath),
  malformedLines,
  scanReconciled,
  expectedTotal,
  downloadsEligible,
  downloadsOk,
  artefactsFromThisRun,
  censusSupplied,
  censusMatched,
})
const gateOk = Object.values(gate).every(Boolean)

rows.sort(compareRows)
writeNdjson(`${outDir}/ranked.ndjson`, rows)

/**
 * Intel rows whose drift class the ordering map does not know. They sort LAST
 * within `intel` rather than first, so the failure is quiet in the table — which
 * is exactly why it has to be loud in the summary. Expected to be empty; a
 * non-empty list means `classifyVersionDistance` grew a class that
 * `DRIFT_ORDER` was not told about.
 */
const unknownDriftClasses = rows
  .filter(r => r.action === 'intel' && !(r.distance in DRIFT_ORDER))
  .map(r => ({ id: r.id, distance: r.distance }))

/** @type {Record<string, number>} */
const scanStatuses = {}
for (const r of scan.values()) {
  const k = String(r.status)
  scanStatuses[k] = (scanStatuses[k] ?? 0) + 1
}

// Which NON-CANONICAL frontmatter slot a version came from, when it did.
// Report-only, and it exists to settle a deferred question with data rather
// than a guess: `nonCanonicalVersion` reads `version` and `version_latest` at
// two levels, and a proposal to extend it to `current_version`/`latest_version`
// has no evidence behind it — a search found no note using either. If those keys
// are genuinely absent across the full cohort this histogram says so, and the
// extension is YAGNI; if they are not, it names the notes to look at. Cheap
// because the field was already written into every scan row.
/** @type {Record<string, number>} */
const altVersionSources = {}
for (const r of scan.values()) {
  const k = r.altVersionSource == null ? 'none' : String(r.altVersionSource)
  altVersionSources[k] = (altVersionSources[k] ?? 0) + 1
}

/**
 * The bucket a state string belongs to: everything before the first `:`.
 *
 * Failure states carry a detail suffix (`downloads-unavailable:http-429/5`), and
 * the retry ATTEMPT is part of it — so an un-truncated key splits one failure
 * mode across as many buckets as there are attempt counts. The 2026-08-05 run
 * had 462 throttled rows; post-Phase-6 they would fragment across five or more
 * keys, and the report is instructed to read these histograms as a small bounded
 * set. Truncation is the same normalisation {@link dl} applies to the cell, and
 * they share this function so the table and the histogram cannot disagree about
 * what a state is. The full string stays in `ranked.ndjson`.
 *
 * @param {string | null | undefined} state
 * @param {string} absent bucket name for a row that carries no state at all —
 *   distinct from any state the API can report
 * @returns {string}
 */
function stateBucket (state, absent) {
  if (state == null) return absent
  return String(state).split(':')[0] ?? absent
}

// Both of these were written into every row from the start and read by nothing.
// As histograms they answer the question the old report could not: of the rows
// whose reach or release date is blank, HOW MANY are blank because the API said
// so, and how many because it never answered? A single `rowsWithMissingInputs`
// count cannot separate those, and they call for opposite responses — one is a
// finding about the packages, the other about the run.
/** @type {Record<string, number>} */
const downloadsStates = {}
/** @type {Record<string, number>} */
const dateStates = {}
for (const r of rows) {
  const dk = stateBucket(r.downloadsState, 'no-downloads-row')
  downloadsStates[dk] = (downloadsStates[dk] ?? 0) + 1
  const ak = stateBucket(r.dateState, 'no-registry-row')
  dateStates[ak] = (dateStates[ak] ?? 0) + 1
}

const cohortSet = new Set(cohort)
const summary = {
  generatedFor: todayRaw,
  cohortSize: cohort.length,
  rowsEmitted: rows.length,
  classified,
  gate,
  gateOk,
  malformedLines,
  actionCounts,
  scanStatuses,
  altVersionSources,
  namedRows: namedRows.length,
  downloadsEligible,
  downloadsOk,
  downloadsRows: downloads.size,
  registryRows: registry.size,
  reportedTotalEntities: enumerateSummary?.reportedTotalEntities ?? null,
  duplicateIdentifiers: enumerateSummary?.duplicateIdentifiers ?? [],
  censusRows: census.size,
  censusSupplied,
  // Rows whose date was not `YYYY-MM-DD` and were therefore never given to the
  // classifier. A non-zero count beside a green `censusUsable` means the census
  // is partially malformed but still above the match floor — worth reporting,
  // not worth failing on.
  censusRowsRejected,
  cohortMatchedInCensus: censusMatched,
  cohortMissingFromCensus: cohort.filter(id => !census.has(id)),
  // Directory members absent from the TYPE cohort: the mirror of the title-prefix
  // blind spot. A note filed in the ecosystem directory but not carrying this
  // schema type is swept by neither enumeration strategy.
  censusRowsNotInCohort: [...census.keys()].filter(id => !cohortSet.has(id)),
  // Substance counters, distinct from the coverage counters above: `classified`
  // says every cohort member got a row, which stays true when every row is a
  // failure. These two say the pipeline actually resolved something.
  resolvedRows,
  okScanRows,
  intelWithoutReleaseDate: rows.filter(r => r.action === 'intel' && r.releaseAgeDays == null).length,
  rowsWithMissingInputs: rows.filter(r => r.missingInputs.length > 0).length,
  downloadsStates,
  dateStates,
  unknownDriftClasses,
  slotUnreadable: rows.filter(r => r.slotUnreadable).map(r => r.id),
  fourthWallFlagged: rows.filter(r => r.qualityFlags.length).map(r => r.id),
  // Report-only vocabulary drift: relations whose verb the npm_package schema
  // does not declare. Counted, never scored — changing what `relationCount`
  // means would move the current→modernize boundary.
  relationVocabDrift: rows.filter(r => r.relationVerbsUnknown.length)
    .map(r => ({ id: r.id, verbs: r.relationVerbsUnknown })),
  declaredRelationVerbs: DECLARED_RELATION_VERB_COUNT,
  fourthWallDetectorErrors: [...scan.values()].filter(r => r.fourthWallError).length,
  multiPackageNotes: rows.filter(r => r.extraPackages.length).map(r => ({ id: r.id, unchecked: r.extraPackages })),
}
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 2) + '\n')

// ── Tables ──────────────────────────────────────────────────────────────────
// One escaping rule: escape `|`, which would otherwise split a row (and trip
// the repo's remark-lint-no-hidden-table-cell). `[` needs no escaping because
// every label that can contain one is emitted inside a code span, where it is
// literal — and escaping it there would render a visible backslash.
const cell = (/** @type {unknown} */ v) => String(v ?? '').replaceAll('|', '\\|')
const dash = (/** @type {unknown} */ v) => (v == null || v === '' ? '—' : String(v))
/**
 * A note id in a code span. Required, not decorative: a bare `npm-@jazzer.js-core`
 * is a valid GFM email autolink (`@jazzer.js` reads as user@domain) and remark
 * flags it as `no-literal-urls` — two real instances in the 2026-08-05 report,
 * the only two findings the file had. Inside a code span it is literal text, and
 * `|` needs no escaping there either.
 *
 * @param {unknown} v
 * @returns {string}
 */
const noteCell = v => `\`${String(v ?? '')}\``
/**
 * Weekly downloads, or the REASON there is no number — never a bare `—`. A
 * MEASURED zero does render as `0`: that is npm answering "nobody downloaded
 * this", a real finding, and a fixture pins it. What never appears is an
 * UNMEASURED row wearing a number.
 *
 * This column is level 3 of the intel key, so a reader checking a row's
 * position has to be able to see whether the sweep measured its reach at all.
 * A `—` here would put "nobody downloads this" and "npm rate-limited us" in the
 * same cell, which is the misreading that made the first run's ordering noise.
 * The state is bucketed by {@link stateBucket} — the retry detail
 * (`downloads-unavailable:http-429/5`) stays in `ranked.ndjson`.
 *
 * @param {number | null} n
 * @param {boolean} measured whether the downloads API actually answered
 * @param {string | null} state
 * @returns {string}
 */
function dl (n, measured, state) {
  if (!measured || n == null) return `\`${stateBucket(state, 'no-downloads-row')}\``
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return String(n)
}
/**
 * @param {number | null} d
 * @returns {string}
 */
const days = d => (d == null ? '—' : `${d}d`)

/**
 * @param {{ headers: string[], align: string[], rows: string[][], empty: string }} spec
 * @returns {string}
 */
function table (spec) {
  if (!spec.rows.length) return spec.empty
  return [
    '| ' + spec.headers.join(' | ') + ' |',
    '|' + spec.align.join('|') + '|',
    ...spec.rows.map(r => '| ' + r.join(' | ') + ' |'),
  ].join('\n')
}

const intel = rows.filter(r => r.action === 'intel')
const unmeasured = rows.filter(r => r.action === 'unmeasured')

// Every column below is a FACT, and the three that order the table are marked as
// such in the header. The columns this replaces were tier point-values — `Drift`
// 40 beside a `Distance` of `semver-major`, `Reach` 7 beside a `Weekly DL` of
// 2.1M — a lossy re-encoding of the cell next to it, present only to show the
// sum's arithmetic. With no sum they encode nothing, so the raw value stands
// alone and the table gets narrower. `Note age` is new: it was the one ordering
// input with no raw column at all, visible only through its tier score.
/**
 * Render the Documented cell with its PROVENANCE, which used to be invisible.
 *
 * The old rule marked a row only when the version came from the off-slot
 * frontmatter fallback, and left every one of the six extractor patterns
 * unmarked. That reads as "declared by the note author" and is not: pattern 3 is
 * the `- [version]` observation, the only slot the author declares, while 1/2/4/
 * 5/6 are inferences from a header pipe, a table row, frontmatter, a prose
 * release reel, or loose prose. In the 2026-08-06 report 4 of the top 12 rows —
 * `supports-color`, `uuid`, `npm`, `sinon` — had NO `[version]` observation and
 * rendered clean, and `npm-uuid`'s number came off a Release Highlights passage.
 *
 * Two markers, because they are different problems with different fixes:
 *   `†` the extractor matched, but NOT on the declared `[version]` observation
 *       → the note should gain one; the number is probably right.
 *   `⚠` no extractor pattern matched at all; the value came from an off-slot
 *       frontmatter key → the number is least trustworthy.
 *
 * @param {{ documented?: unknown, versionBasis?: unknown, versionPattern?: unknown }} r
 * @returns {string}
 */
function documentedCell (r) {
  const v = dash(r.documented)
  if (r.versionBasis !== 'extracted') return `${v} ⚠`
  return r.versionPattern === DECLARED_VERSION_PATTERN ? v : `${v} †`
}

/**
 * The `[version]` / `[version-range]` observation — pattern 3 of the six in
 * `lib/bm-version-extract.mjs`. Named rather than inlined as a bare `3`, since
 * the whole point of `documentedCell` is that "which pattern" carries meaning.
 */
const DECLARED_VERSION_PATTERN = 3

const intelTable = table({
  headers: ['#', 'Note', 'Documented', 'Upstream', 'Distance ①', 'Weekly DL ②', 'Note age ③', 'Released', 'Note gaps', 'Refresh'],
  align: ['---:', '---', '---', '---', '---', '---:', '---:', '---:', '---', '---'],
  rows: intel.map((r, i) => [
    String(i + 1),
    noteCell(r.id),
    documentedCell(r),
    dash(r.upstream),
    `\`${r.distance}\``,
    dl(r.weeklyDownloads, r.reachMeasured, r.downloadsState),
    days(r.noteAgeDays),
    days(r.releaseAgeDays),
    r.gaps.length ? cell(r.gaps.join(', ')) : '—',
    cell(r.fix),
  ]),
  empty: '*No confirmed drift among the notes that could be compared.*',
})

const unmeasuredTable = table({
  headers: ['#', 'Note', 'Why unmeasured ①', 'Note age ②', 'Upstream', 'Weekly DL', 'Note gaps', 'Fix'],
  align: ['---:', '---', '---', '---:', '---', '---:', '---', '---'],
  rows: unmeasured.map((r, i) => [
    String(i + 1),
    noteCell(r.id),
    `\`${r.reason}\``,
    days(r.noteAgeDays),
    dash(r.upstream),
    dl(r.weeklyDownloads, r.reachMeasured, r.downloadsState),
    r.gaps.length ? cell(r.gaps.join(', ')) : '—',
    cell(r.fix),
  ]),
  empty: '*None.*',
})

/**
 * @param {string} action
 * @param {string[]} headers
 * @param {(r: typeof rows[number]) => string[]} cells
 * @returns {string}
 */
function byAction (action, headers, cells) {
  const sel = rows.filter(r => r.action === action).sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return table({ headers, align: headers.map(() => '---'), rows: sel.map(r => cells(r).map(c => cell(c))), empty: '*None.*' })
}

const tables = {
  intel: intelTable,
  intelCount: intel.length,
  unmeasured: unmeasuredTable,
  unmeasuredCount: unmeasured.length,
  modernize: byAction('modernize', ['Note', 'Version', 'Gaps', 'Fix'], r => [noteCell(r.id), dash(r.documented), r.gaps.join(', '), r.fix]),
  archive: byAction('archive', ['Note', 'Package', 'Documented', 'Upstream'], r => [noteCell(r.id), noteCell(r.npmName), dash(r.documented), dash(r.upstream)]),
  investigate: byAction('investigate', ['Note', 'Package', 'Reason'], r => [noteCell(r.id), noteCell(r.npmName), `\`${r.reason}\``]),
  blocked: byAction('blocked', ['Note', 'Reason', 'Name source', 'Fix'], r => [noteCell(r.id), `\`${r.reason}\``, dash(r.nameSource), r.fix]),
  excluded: byAction('excluded', ['Note', 'Reason'], r => [noteCell(r.id), `\`${r.reason}\``]),
  ahead: byAction('ahead', ['Note', 'Documented', 'Upstream'], r => [noteCell(r.id), dash(r.documented), dash(r.upstream)]),
}
// The other half of the gate's `actionsRendered` check, and it has to live here
// because `tables` does not exist yet when the gate is built.
//
// `actionsRendered` proves every action the CLASSIFIER produced is declared in
// `RENDERED_ACTIONS`. This proves the reverse: that every declared action really
// did get a table object built for it. Without both, an action could be added to
// the literal — satisfying the gate — while the `tables` entry was forgotten, and
// the section would render as a heading with `undefined` under it.
//
// Deliberately a hard exit rather than a gate flag: a gate flag is recorded in
// `summary.json` and reported at the very end, but `tables.md` would already have
// been written by then — the malformed artefact is the thing we are preventing,
// so this has to fire BEFORE the write below. `.filter()` drops the two `*Count`
// scalars, which are numbers riding in the same object and not tables at all.
//
// Exit 2, not 1: exit 1 means "the completeness gate failed" — a statement about
// the DATA — and this is a statement about the CODE. Reusing it would make the
// one signal a caller reads ambiguous.
const builtTables = Object.keys(tables).filter(k => !k.endsWith('Count')).sort()
const declaredTables = [...RENDERED_ACTIONS].sort()
if (builtTables.join(',') !== declaredTables.join(',')) {
  process.stderr.write(
    `CONFIG ERROR: rendered-table drift — built [${builtTables.join(', ')}] ` +
    `but RENDERED_ACTIONS declares [${declaredTables.join(', ')}]\n`
  )
  process.exit(2)
}

writeFileSync(`${outDir}/tables.json`, JSON.stringify(tables, null, 2) + '\n')
writeFileSync(`${outDir}/tables.md`, [
  `## Confirmed drift — \`/intel\` candidates (${intel.length})`, '',
  'Ranked. Each of these has a documented version that a registry lookup proved is behind —',
  'with one declared exception: an `upstream-prerelease` row is one this pipeline **refuses to',
  'classify**, because npm\'s `latest` points at a prerelease and the stable line usually lives',
  'under a dist-tag not read here. Such a row needs a human to decide, and its drift may turn',
  'out to be nothing.',
  'The order is **lexicographic**, not a score: ① drift class, then ② weekly downloads,',
  'then ③ note age, then note id. Each level is decisive — a `patch` row never outranks a',
  '`semver-major` however popular or neglected it is. Both refusal classes outrank every',
  '`patch` (an unknown magnitude beats a confirmed-small one), and `distance-unknown` (two',
  'parsed versions on incomparable schemes — drift confirmed, magnitude not) outranks',
  '`upstream-prerelease` (drift not even established).',
  '',
  'In the **Documented** column, a marker describes where that version was read from —',
  'the note is only as trustworthy as its source:',
  '',
  '- *(no marker)* — the note\'s own `- [version]` observation, the slot its author declares.',
  '- `†` — extracted, but from somewhere else in the note: a header pipe, a `| Version |`',
  '  row, frontmatter, a `## Release Highlights` entry, or loose prose. Probably right;',
  '  the note should still gain a `[version]` observation.',
  '- `⚠` — no extraction pattern matched at all and the value came from an off-slot',
  '  frontmatter key. Least trustworthy.',
  'A `Weekly DL` cell showing a state rather than a number means the downloads API never',
  'answered for that package: it is ordered **after** every measured row in its drift class,',
  'never treated as zero reach.', '',
  intelTable, '',
  `## Unmeasured — drift unknown, not zero (${unmeasured.length})`, '',
  'No comparable version could be read from these notes, so they were **not** checked for drift.',
  'Only `no-version-recorded` rows need real research; the rest need a `[version]` slot,',
  'after which the next sweep can measure them. Ordered as a worklist by ① what the fix costs',
  '(cheapest first) then ② note age — not by urgency, since three of the four classes are the',
  'same one-line edit.', '',
  unmeasuredTable, '',
  '## Modernize — current version, structural gaps', '', tables.modernize, '',
  '## Archive candidates — deprecated upstream', '', tables.archive, '',
  '## Investigate — absent from the registry', '', tables.investigate, '',
  '## Blocked — could not be assessed', '', tables.blocked, '',
  '## Excluded by construction', '', tables.excluded, '',
  '## Ahead of registry (informational)', '', tables.ahead, '',
].join('\n'))

process.stdout.write(JSON.stringify(summary) + '\n')

if (malformedLines > 0 || !existsSync(cohortPath)) {
  process.stderr.write(`INPUT ERROR: ${malformedLines} malformed line(s); cohort file present: ${existsSync(cohortPath)}\n`)
  process.exit(2)
}
if (!gateOk) {
  const failed = Object.entries(gate).filter(([, v]) => !v).map(([k]) => k)
  process.stderr.write(`COMPLETENESS GATE FAILED: ${failed.join(', ')}\n`)
  process.exit(1)
}
