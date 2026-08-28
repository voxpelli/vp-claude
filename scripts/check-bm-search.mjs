// Fixture self-test for lib/bm-search.mjs — the shared enumeration core behind
// scripts/list-notes.mjs and scripts/list-unresolved-links.mjs.
//
// The envelope tests are the ones that matter. The bug this module was written
// to kill is a response shape that no longer matches expectations being coerced
// into a valid EMPTY page, whose scanned-vs-total check then passes `0 === 0`
// and reports a perfectly clean graph. So every "must throw" case below is a
// case that previously returned a clean-looking zero.
//
// The paging loop runs against an injected fake fetcher — no `bm`, no network,
// no live graph — which is the whole reason the loop lives in lib/ instead of
// inside the scripts.

import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  assessCompleteness,
  buildSearchArgs,
  createDuplicateFilter,
  enumeratePages,
  parseSearchEnvelope,
  toNoteRow,
  toRelationRow,
} from '../lib/bm-search.mjs'

const { check, done, record } = createCheckHarness()

/**
 * Assert that `fn` throws, and that its message mentions `needle`.
 *
 * The message check is not decoration: these errors are the only thing standing
 * between a changed bm response shape and a silently empty audit, so a throw
 * that fails to name the offending field is only half a fix.
 *
 * @param {string} name Test name.
 * @param {() => unknown} fn Thunk expected to throw.
 * @param {string} needle Substring the message must contain.
 * @returns {void}
 */
function checkThrows (name, fn, needle) {
  let message = ''
  try {
    fn()
  } catch (err) {
    message = err instanceof Error ? err.message : String(err)
  }
  const ok = message.includes(needle)
  record(ok)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` (message was: ${message || '<did not throw>'})`}`)
}

console.log('\nbuildSearchArgs — scoping')

const args = buildSearchArgs({ project: 'main', entityType: 'relation', page: 2, pageSize: 500 })
check('passes --project rather than a project-scoped permalink glob',
  args.includes('--project') && args[args.indexOf('--project') + 1] === 'main')
check("keeps --permalink '*' (search-notes needs a filter to run at all)",
  args[args.indexOf('--permalink') + 1] === '*')
check('never emits the under-scoping `main/*` glob that hid 11 relations',
  !args.includes('main/*'))
check('page and page-size are stringified for argv',
  args[args.indexOf('--page') + 1] === '2' && args[args.indexOf('--page-size') + 1] === '500')

console.log('\nparseSearchEnvelope — every field required')

const good = parseSearchEnvelope(JSON.stringify({ results: [{ a: 1 }], has_more: true, total: 42 }))
check('valid envelope parses', good.results.length === 1 && good.hasMore === true && good.total === 42)
check('has_more false survives as false',
  parseSearchEnvelope('{"results":[],"has_more":false,"total":0}').hasMore === false)

checkThrows('non-JSON output throws rather than reading as an empty page',
  () => parseSearchEnvelope('Error: something went wrong'), 'not JSON')
checkThrows('a bare array envelope throws',
  () => parseSearchEnvelope('[]'), 'object envelope')
checkThrows("absent 'results' throws and names the field",
  () => parseSearchEnvelope('{"has_more":false,"total":0}'), "'results'")
checkThrows("'results' as an object throws",
  () => parseSearchEnvelope('{"results":{},"has_more":false,"total":0}'), "'results'")
checkThrows("absent 'has_more' throws and names the field",
  () => parseSearchEnvelope('{"results":[],"total":0}'), "'has_more'")
checkThrows("absent 'total' throws and names the field",
  () => parseSearchEnvelope('{"results":[],"has_more":false}'), "'total'")
checkThrows("a non-finite 'total' throws",
  () => parseSearchEnvelope('{"results":[],"has_more":false,"total":"12"}'), "'total'")

console.log('\ntoNoteRow')

check('shapes a well-formed entity row',
  JSON.stringify(toNoteRow({ title: 'T', permalink: 'main/a/b', entity_id: 7, extra: 'ignored' })) ===
  JSON.stringify({ title: 'T', permalink: 'main/a/b', entityId: 7 }))
check('rejects a row with no title', toNoteRow({ permalink: 'main/a/b', entity_id: 7 }) === null)
check('rejects an empty title', toNoteRow({ title: '', permalink: 'main/a/b', entity_id: 7 }) === null)
check('rejects a row with no permalink', toNoteRow({ title: 'T', entity_id: 7 }) === null)
// entity_id is a JSON number on live rows; a string would split the dedup key
// space in half without any visible failure.
check('rejects a string entity_id', toNoteRow({ title: 'T', permalink: 'main/a/b', entity_id: '7' }) === null)
check('rejects a non-object row', toNoteRow('nope') === null && toNoteRow(null) === null)

console.log('\ntoRelationRow')

const resolvedRow = toRelationRow({
  from_entity: 'main/npm/npm-passport',
  relation_type: 'used_with',
  relation_id: 78176,
  to_entity: 'main/npm/npm-express-session',
  permalink: 'main/npm/npm-passport/used-with/main/npm/npm-express-session',
})
check('shapes a resolved relation row', resolvedRow?.toEntity === 'main/npm/npm-express-session')

const danglingRow = toRelationRow({
  from_entity: 'main/npm/npm-foo',
  relation_type: 'relates_to',
  relation_id: 79731,
  permalink: 'main/npm/npm-foo/relates-to/pelle-wessman',
})
check('an ABSENT to_entity normalises to null', danglingRow?.toEntity === null)
// bm omits the key today, but were it ever to emit an explicit null, an
// `undefined` test would read every dangling edge as resolved — the audit would
// report zero unresolved links and the completeness check would still pass.
check('an EXPLICIT null to_entity also normalises to null',
  toRelationRow({
    from_entity: 'main/a', relation_type: 'relates_to', relation_id: 1, to_entity: null, permalink: 'main/a/relates-to/x',
  })?.toEntity === null)
check('an empty-string to_entity normalises to null',
  toRelationRow({
    from_entity: 'main/a', relation_type: 'relates_to', relation_id: 1, to_entity: '', permalink: 'main/a/relates-to/x',
  })?.toEntity === null)
check('rejects a row with no relation_id (the only field separating two edges to one target)',
  toRelationRow({ from_entity: 'main/a', relation_type: 'relates_to', permalink: 'main/a/relates-to/x' }) === null)
check('rejects a row with no permalink',
  toRelationRow({ from_entity: 'main/a', relation_type: 'relates_to', relation_id: 1 }) === null)

console.log('\nenumeratePages')

/**
 * Build a fake page fetcher over a fixed list of pages.
 *
 * @param {unknown[][]} pages Rows per page.
 * @param {number} [total] Server-reported total.
 * @returns {(page: number) => Promise<{results: unknown[], hasMore: boolean, total: number}>} Fetcher.
 */
function fakeFetcher (pages, total = pages.flat().length) {
  return async (page) => ({
    results: pages[page - 1] ?? [],
    hasMore: page < pages.length,
    total,
  })
}

/** @type {unknown[]} */
const seen = []
const walk = await enumeratePages({
  fetchPage: fakeFetcher([['a', 'b'], ['c'], ['d', 'e']]),
  onRow: (row) => { seen.push(row) },
})
check('walks every page and stops when has_more clears',
  walk.scanned === 5 && walk.pages === 3 && walk.truncated === false)
check('rows arrive in server order', seen.join('') === 'abcde')
check('total is taken from the first page', walk.total === 5)

const truncated = await enumeratePages({
  fetchPage: fakeFetcher([['a'], ['b'], ['c'], ['d']]),
  onRow: () => {},
  maxPages: 2,
})
check('hitting the page backstop reports truncated', truncated.truncated === true && truncated.scanned === 2)

console.log('\ncreateDuplicateFilter')

/** @type {{id: number}[]} */
const rows = [{ id: 1 }, { id: 2 }, { id: 1 }, { id: 3 }, { id: 2 }, { id: 1 }]
const filter = createDuplicateFilter(/** @type {(r: {id: number}) => number} */ (r) => r.id)
const kept = rows.filter((r) => !filter.isDuplicate(r))
check('keeps the first occurrence of each key', kept.map((r) => r.id).join(',') === '1,2,3')
// The count is the whole reason this is a filter object and not a bare Set: a
// silent dedupe is the same defect in a new coat.
check('reports how many were dropped', filter.dropped() === 3)
check('a duplicate-free run drops nothing', (() => {
  const f = createDuplicateFilter(/** @type {(r: {id: number}) => number} */ (r) => r.id)
  for (const r of [{ id: 1 }, { id: 2 }]) f.isDuplicate(r)
  return f.dropped() === 0
})())

console.log('\nassessCompleteness')

const clean = assessCompleteness({ scanned: 100, total: 100, pages: 1, truncated: false, unparseable: 0 })
check('a clean run is complete with no problems', clean.complete === true && clean.problems.length === 0)
check('a clean run over a non-empty graph is not empty', clean.empty === false)

const short = assessCompleteness({ scanned: 90, total: 100, pages: 1, truncated: false, unparseable: 0 })
check('scanned < total is incomplete', short.complete === false)
check('the mismatch problem names both counts',
  short.problems.some((p) => p.includes('90') && p.includes('100')))

check('truncation is incomplete',
  assessCompleteness({ scanned: 10, total: 100, pages: 2, truncated: true, unparseable: 0 }).complete === false)
check('dropped unparseable rows make the run incomplete',
  assessCompleteness({ scanned: 100, total: 100, pages: 1, truncated: false, unparseable: 3 }).complete === false)

// An empty project is a COMPLETE run over zero rows. Conflating "no rows" with
// "no problems" is how an empty graph gets reported as a clean one.
const emptyRun = assessCompleteness({ scanned: 0, total: 0, pages: 1, truncated: false, unparseable: 0 })
check('an empty project is complete AND flagged empty', emptyRun.complete === true && emptyRun.empty === true)

done()
