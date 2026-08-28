// Shared enumeration core for the two `bm tool search-notes` walkers:
// `scripts/list-notes.mjs` (entities) and `scripts/list-unresolved-links.mjs`
// (relations). They differ only in `--entity-type` and in how they shape a row,
// so argv construction, envelope validation, the paging loop and the
// completeness verdict live here once and are fixture-tested once.
//
// The envelope validation is the load-bearing part. The first version of the
// relation walker read its response like this:
//
//     rows: parsed.results ?? [],
//     hasMore: parsed.has_more === true,
//     total: typeof parsed.total === 'number' ? parsed.total : 0
//
// Each of those three coercions turns an UNRECOGNISED response into a
// syntactically valid EMPTY page — and the completeness check that follows then
// compares `0 === 0` and passes. A bm upgrade that renamed a field would have
// been reported as a perfectly clean graph. Every field is therefore required
// and type-checked here, and a mismatch throws with the field named.
//
// I/O is INJECTED rather than imported (see `createPageFetcher`) so this module
// stays free of side effects and the self-test can drive the entire paging loop
// against a fake bm, with no live graph and no network.

/**
 * Rows per page. bm accepts large page sizes and the whole graph is ~15.5k
 * relations, so 1000 keeps a full walk to ~16 calls.
 */
export const DEFAULT_PAGE_SIZE = 1000

/** Backstop against an unbounded loop if `has_more` ever fails to clear. */
export const MAX_PAGES = 200

/** A full page of relation rows runs to a few MB; give the pipe real headroom. */
const MAX_BUFFER = 64 * 1024 * 1024

/**
 * @typedef SearchEnvelope
 * @property {unknown[]} results Rows for this page.
 * @property {boolean} hasMore Whether a further page exists.
 * @property {number} total Server-reported row count for the whole query.
 */

/**
 * @typedef EnumerationStats
 * @property {number} scanned Rows received across every page.
 * @property {number} total Server-reported total, taken from the first page.
 * @property {number} pages Pages actually fetched.
 * @property {boolean} truncated Whether the page backstop stopped the walk early.
 */

/**
 * @typedef CompletenessVerdict
 * @property {boolean} complete True only when the run saw the whole population.
 * @property {boolean} empty True when the server reported zero rows.
 * @property {string[]} problems Human-readable reasons the run is incomplete.
 */

/**
 * Describe a value for an error message without dumping it wholesale.
 *
 * @param {unknown} value Value to describe.
 * @returns {string} Short type-and-shape description.
 */
function describe (value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `an array of ${value.length}`
  return typeof value
}

/**
 * Build the argv array for one `search-notes` page.
 *
 * `--project <name>` rather than a `--permalink '<name>/*'` glob, for two
 * reasons that happen to share one fix. The glob UNDER-SCOPES: measured
 * 2026-07-29, it returns 15,534 of 15,545 relations, so 11 relations (2 of them
 * unresolved) were invisible to every run. And an unknown project name under
 * the glob matches nothing and exits 0 — indistinguishable from a clean graph —
 * whereas `--project` exits 1. The `--permalink '*'` filter stays because
 * `search-notes` needs either a query or a metadata filter to run at all.
 *
 * @param {object} options Query parameters.
 * @param {string} options.project Basic Memory project name.
 * @param {string} options.entityType `entity` or `relation`.
 * @param {number} options.page 1-based page number.
 * @param {number} options.pageSize Rows per page.
 * @returns {string[]} argv for the `bm` binary.
 */
export function buildSearchArgs ({ entityType, page, pageSize, project }) {
  return [
    'tool', 'search-notes',
    '--project', project,
    '--permalink', '*',
    '--entity-type', entityType,
    '--page', String(page),
    '--page-size', String(pageSize),
  ]
}

/**
 * Parse and validate one `search-notes` JSON response.
 *
 * Every field is required. Returning a defaulted envelope for an unrecognised
 * response is the specific failure this function exists to prevent — see the
 * module header.
 *
 * @param {string} stdout Raw stdout from `bm tool search-notes`.
 * @returns {SearchEnvelope} Validated envelope.
 * @throws {TypeError} When the response is not JSON, or a field is absent or mistyped.
 */
export function parseSearchEnvelope (stdout) {
  /** @type {unknown} */
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch (cause) {
    throw new TypeError(
      'bm search-notes returned output that is not JSON, so the page cannot be read. ' +
      `Parser said: ${String(cause)}. First 200 bytes: ${JSON.stringify(stdout.slice(0, 200))}`,
      { cause }
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(
      `bm search-notes: expected a JSON object envelope, got ${describe(parsed)}. ` +
      'Refusing to treat this as an empty page, because an empty page would be reported as a clean graph.'
    )
  }

  const { has_more: hasMore, results, total } = /** @type {Record<string, unknown>} */ (parsed)

  if (!Array.isArray(results)) {
    throw new TypeError(
      `bm search-notes: 'results' must be an array, got ${describe(results)}. ` +
      'The response shape has changed; every count downstream would be zero and would look clean.'
    )
  }
  if (typeof hasMore !== 'boolean') {
    throw new TypeError(
      `bm search-notes: 'has_more' must be a boolean, got ${describe(hasMore)}. ` +
      'Without it the walk cannot tell a last page from a dropped one, and would stop early silently.'
    )
  }
  if (typeof total !== 'number' || !Number.isFinite(total)) {
    throw new TypeError(
      `bm search-notes: 'total' must be a finite number, got ${describe(total)}. ` +
      'It is the only cross-check that pagination did not drop rows, so a missing total disarms the completeness check.'
    )
  }

  return { results, hasMore, total }
}

/**
 * Build a page fetcher bound to one project and entity type.
 *
 * `execFileAsync` is injected so this module performs no I/O of its own and the
 * self-test can exercise the whole loop against a fake. Always an argv ARRAY,
 * never a template-literal shell string — `'*'` would glob in a shell.
 *
 * @param {(file: string, args: string[], options: {maxBuffer: number}) => Promise<{stdout: string}>} execFileAsync Promisified `execFile`.
 * @param {object} options Query parameters.
 * @param {string} options.project Basic Memory project name.
 * @param {string} options.entityType `entity` or `relation`.
 * @param {number} [options.pageSize] Rows per page.
 * @returns {(page: number) => Promise<SearchEnvelope>} Fetcher for one page.
 */
export function createPageFetcher (execFileAsync, { entityType, pageSize = DEFAULT_PAGE_SIZE, project }) {
  return async (page) => {
    const args = buildSearchArgs({ project, entityType, page, pageSize })
    /** @type {{stdout: string}} */
    let result
    try {
      result = await execFileAsync('bm', args, { maxBuffer: MAX_BUFFER })
    } catch (cause) {
      // bm reports an unknown project as "Cloud routing requested but no
      // credentials found", which sends you off chasing an auth problem you do
      // not have. Verified 2026-07-29 against `--project notaproject`.
      throw new Error(
        `bm tool search-notes failed for project "${project}" (page ${page}). ` +
        'If the message below blames cloud credentials, the likely cause is simply an unknown ' +
        'project name — check `bm project list`. ' +
        `Underlying error: ${String(cause)}`,
        { cause }
      )
    }
    return parseSearchEnvelope(result.stdout)
  }
}

/**
 * Walk every page, handing each row to `onRow`.
 *
 * @param {object} options Walk parameters.
 * @param {(page: number) => Promise<SearchEnvelope>} options.fetchPage Page fetcher.
 * @param {(row: unknown) => void} options.onRow Called once per row, in server order.
 * @param {number} [options.maxPages] Page backstop.
 * @returns {Promise<EnumerationStats>} Run statistics.
 */
export async function enumeratePages ({ fetchPage, maxPages = MAX_PAGES, onRow }) {
  let scanned = 0
  let total = 0
  let pages = 0

  for (let page = 1; page <= maxPages; page++) {
    const envelope = await fetchPage(page)
    if (page === 1) total = envelope.total
    pages = page
    scanned += envelope.results.length
    for (const row of envelope.results) onRow(row)
    if (!envelope.hasMore) return { scanned, total, pages, truncated: false }
  }

  return { scanned, total, pages, truncated: true }
}

/**
 * Shape one `--entity-type entity` row into the note record downstream wants.
 *
 * Returns null rather than a partially-filled record when a field is absent or
 * mistyped: a note with no title cannot be matched against and a note with no
 * permalink cannot be keyed, so half a row is not a usable row. The caller
 * counts the nulls and reports them — a dropped row that is never mentioned is
 * the silent-failure mode this whole pipeline is built against.
 *
 * `entity_id` is a JSON NUMBER (verified 2026-07-29 against live rows, in both
 * entity and relation results). It is carried through as the dedup key, because
 * the search index returns the same note more than once — 2,304 rows for 1,926
 * distinct notes, a known upstream sync defect.
 *
 * @param {unknown} row One raw result row.
 * @returns {{title: string, permalink: string, entityId: number} | null} Note record, or null when unusable.
 */
export function toNoteRow (row) {
  if (typeof row !== 'object' || row === null) return null
  const { entity_id: entityId, permalink, title } = /** @type {Record<string, unknown>} */ (row)
  if (typeof title !== 'string' || title === '') return null
  if (typeof permalink !== 'string' || permalink === '') return null
  if (typeof entityId !== 'number') return null
  return { title, permalink, entityId }
}

/**
 * Shape one `--entity-type relation` row into the edge record downstream wants.
 *
 * `toEntity` is normalised to `null` when the relation is unresolved. bm OMITS
 * the key entirely today (verified over 4,000+ rows), but the caller must test
 * `=== null` rather than `=== undefined`: were bm ever to start emitting an
 * explicit `null`, an `undefined` test would read every dangling edge as
 * resolved, the audit would report zero unresolved links, and the
 * scanned-vs-total completeness check would still pass. That is a wrong answer
 * with every alarm silent.
 *
 * @param {unknown} row One raw result row.
 * @returns {{fromEntity: string, relationType: string, permalink: string, relationId: number, toEntity: string | null} | null} Edge record, or null when unusable.
 */
export function toRelationRow (row) {
  if (typeof row !== 'object' || row === null) return null
  const {
    from_entity: fromEntity,
    permalink,
    relation_id: relationId,
    relation_type: relationType,
    to_entity: toEntity,
  } = /** @type {Record<string, unknown>} */ (row)
  if (typeof fromEntity !== 'string' || fromEntity === '') return null
  if (typeof relationType !== 'string' || relationType === '') return null
  if (typeof permalink !== 'string' || permalink === '') return null
  if (typeof relationId !== 'number') return null
  return {
    fromEntity,
    relationType,
    permalink,
    relationId,
    toEntity: typeof toEntity === 'string' && toEntity !== '' ? toEntity : null,
  }
}

/**
 * Track which rows have already been seen, so a caller can drop duplicates AND
 * say how many it dropped.
 *
 * The search index returns the same row more than once — 2,304 entity rows for
 * 1,927 distinct notes, 1,481 relation rows for 1,319 distinct edges (measured
 * 2026-07-29). This corroborates a live upstream sync defect the graph already
 * documents, and which `bm status` and `bm doctor` both pass over.
 *
 * The duplicates are not harmless noise. Left in, a note that appears three
 * times matches itself three times and gets classified AMBIGUOUS — the audit
 * reports "a human must disambiguate this" about a single unambiguous note.
 *
 * The dropped COUNT is the reason this is a filter object rather than a bare
 * `Set`: a silent dedupe is the same defect in a new coat, and the count is the
 * only signal that the upstream defect is still present at all.
 *
 * @template T
 * @param {(item: T) => string | number} keyOf Identity of a row.
 * @returns {{isDuplicate: (item: T) => boolean, dropped: () => number}} Filter.
 */
export function createDuplicateFilter (keyOf) {
  /** @type {Set<string | number>} */
  const seen = new Set()
  let dropped = 0
  return {
    isDuplicate (item) {
      const key = keyOf(item)
      if (seen.has(key)) {
        dropped++
        return true
      }
      seen.add(key)
      return false
    },
    dropped: () => dropped,
  }
}

/**
 * Decide whether an enumeration run saw the whole population.
 *
 * Kept separate from the walk because the verdict drives the process exit code,
 * and a partial run that exits 0 is precisely the plausible-looking success this
 * pipeline exists to eliminate. The documented consumer is an agent invoking the
 * script through Bash, where stdout and stderr interleave and the exit code is
 * the only machine-checkable signal it has.
 *
 * `empty` is orthogonal to `complete`: a genuinely empty project is a COMPLETE
 * run over zero rows. Reporting it is still worth doing, because "no rows" and
 * "no problems" read identically in a summary line and mean very different things.
 *
 * @param {EnumerationStats & {unparseable: number}} stats Run statistics plus dropped-row count.
 * @returns {CompletenessVerdict} Verdict and the reasons behind it.
 */
export function assessCompleteness (stats) {
  /** @type {string[]} */
  const problems = []

  if (stats.truncated) {
    problems.push(
      `stopped at the ${stats.pages}-page backstop with more pages still pending — output is PARTIAL`
    )
  }
  if (stats.scanned !== stats.total) {
    problems.push(
      `scanned ${stats.scanned} rows but the server reported ${stats.total} — ` +
      'pagination dropped rows, so every count derived from this run is an undercount'
    )
  }
  if (stats.unparseable > 0) {
    problems.push(
      `${stats.unparseable} rows could not be parsed and were dropped — ` +
      'they are absent from the output rather than reported as failures'
    )
  }

  return { complete: problems.length === 0, empty: stats.total === 0, problems }
}
