/**
 * Fixture self-test for `lib/npm-downloads.mjs`. Wired into `npm run check` as
 * `check:npm-downloads`.
 *
 * The case that earns this file is the ONE-NAME chunk. api.npmjs.org answers a
 * single-name request with a different SHAPE — unwrapped rather than a keyed map
 * — and the driver read it as a keyed map, so a package npm had answered for
 * with a real number was filed "npm never answered". It is reachable whenever
 * `plain.length % 128 === 1`, which is one cohort size away at all times.
 *
 * A live run could only reach it by accident, and the driver is a
 * top-level-await script, so before the extraction there was nowhere to put this
 * test at all. That is what the extraction bought.
 *
 * BOUNDARY NOTE: this file pins the seven forms the interpreters EMIT, including
 * the unbounded `downloads-unavailable:<reason>` suffix carrying the attempt
 * count. It deliberately does NOT assert that the emitted set is bounded — the
 * suffix is the point of that format. Collapsing the seven forms into six
 * buckets is `stateBucket()`'s job in `rank.mjs`, asserted on that side.
 */

import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  BATCH_SIZE, chunkNames, interpretBulk, interpretSingle, isUnwrappedResponse,
} from '../lib/npm-downloads.mjs'

const { checkEqual: check, done } = createCheckHarness()

// --- chunk boundaries, where the one-name remainder comes from ---
/**
 * The chunk sizes a cohort of `n` names splits into, as a comparable string.
 *
 * @param {number} n
 * @returns {string}
 */
const sizes = (n) => chunkNames(Array.from({ length: n }, (_, i) => `p${i}`), BATCH_SIZE).map(c => c.length).join(',')
check('a batch-sized list is one full chunk', sizes(128), '128')
check('one short is still one chunk', sizes(127), '127')
check('ONE over leaves a one-name remainder — the bug trigger', sizes(129), '128,1')
check('two batches exactly', sizes(256), '128,128')
check('two batches plus the same remainder', sizes(257), '128,128,1')
check('an empty list is no chunks at all', chunkNames([], BATCH_SIZE).length, 0)

let threw = false
try { chunkNames(['a'], 0) } catch { threw = true }
check('a zero chunk size throws rather than looping forever', threw, true)

// --- the two response SHAPES, told apart ---
check('the unwrapped shape is recognised',
  isUnwrappedResponse({ downloads: 5, start: 'x', end: 'y', 'package': 'foo' }), true)
check('a keyed map is not', isUnwrappedResponse({ foo: { downloads: 5 } }), false)
check('null is not', isUnwrappedResponse(null), false)
check('a keyed map for a package NAMED `package` is not mistaken for unwrapped',
  isUnwrappedResponse({ 'package': { downloads: 5 } }), false)
check('...nor one for a package named `downloads`',
  isUnwrappedResponse({ downloads: { downloads: 5 } }), false)
// Both halves, each with its own witness — a single fixture can only prove that
// SOME condition is present, never which. The plant sweep found this: deleting
// the `package` half left the file green, because every case that reached it was
// already rejected by the `downloads` half.
check('...and the pair is required, not either half',
  isUnwrappedResponse({ 'package': 'foo' }), false)
check('...in the other direction too — a numeric `downloads` alone is not enough',
  isUnwrappedResponse({ downloads: 5 }), false)

// --- the bug this file exists for ---
const one = interpretBulk(['solo'], { downloads: 4242, start: 'a', end: 'b', 'package': 'solo' })
check('a one-name chunk reads the unwrapped count', one.get('solo')?.weeklyDownloads, 4242)
check('...and is `ok`, NOT `downloads-not-returned`', one.get('solo')?.downloadsState, 'ok')

// --- the keyed path: every state it can emit ---
const bulk = interpretBulk(['a', 'b', 'c', 'd', 'f'], {
  a: { downloads: 100 },
  b: null,
  c: { start: 'x' },
  // 'd' absent entirely
  e: { downloads: 9 }, // never requested
  f: { downloads: '100' }, // a STRING where a count belongs
})
check('a counted package is ok', bulk.get('a')?.downloadsState, 'ok')
check('...with its count', bulk.get('a')?.weeklyDownloads, 100)
check('an explicit null is `none-reported` — npm ANSWERED, with nothing',
  bulk.get('b')?.downloadsState, 'downloads-none-reported')
check('...and never a zero count, which would read as unpopular',
  bulk.get('b')?.weeklyDownloads, null)
check('an entry with no `downloads` field is `missing`',
  bulk.get('c')?.downloadsState, 'downloads-missing')
check('an absent key is `not-returned` — a different finding from null',
  bulk.get('d')?.downloadsState, 'downloads-not-returned')
// The bulk path needs its OWN non-numeric case: the `{ start: 'x' }` row above
// has no count at all, so a `!= null` coercion bug passes it either way. Found
// by the plant sweep, which deleted the `typeof` guard and stayed green.
check('a string where a count belongs is `missing`, not coerced',
  bulk.get('f')?.downloadsState, 'downloads-missing')
check('...and reports no count rather than a parsed one',
  bulk.get('f')?.weeklyDownloads, null)
check('a key nobody asked for does not enter the results', bulk.has('e'), false)
check('...and the result is keyed by request, so its size matches', bulk.size, 5)

// A multi-name request answering in the unwrapped shape is a contract change,
// not a case to guess at: attributing one number to many names would be the
// same false-popularity this whole step exists to remove.
const weird = interpretBulk(['a', 'b'], { downloads: 7, 'package': 'a' })
check('an unwrapped shape for a MULTI-name request is not spread across names',
  weird.get('a')?.downloadsState, 'downloads-not-returned')
check('...for every requested name', weird.get('b')?.downloadsState, 'downloads-not-returned')

// --- the scoped path, which always gets the unwrapped shape ---
check('a scoped response reads its count', interpretSingle({ downloads: 12 }).weeklyDownloads, 12)
check('...and is ok', interpretSingle({ downloads: 12 }).downloadsState, 'ok')
check('a scoped response with no count is `missing`',
  interpretSingle({ start: 'x' }).downloadsState, 'downloads-missing')
check('...and so is a null body', interpretSingle(null).downloadsState, 'downloads-missing')
check('a non-numeric count is `missing`, not coerced',
  interpretSingle({ downloads: '12' }).downloadsState, 'downloads-missing')

done(25)
