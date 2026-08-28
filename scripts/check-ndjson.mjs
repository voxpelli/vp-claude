/**
 * Fixture self-test for `lib/ndjson.mjs`. Wired into `npm run check` as
 * `check:ndjson`.
 *
 * The case that matters is the truncated line. Two drivers used to disagree
 * about it — one counted it, one threw — and the disagreement was invisible
 * because exercising either took a live sweep. These fixtures pin the answer.
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createCheckHarness } from '../lib/check-harness.mjs'
import { readNdjson, writeNdjson } from '../lib/ndjson.mjs'

const { done, record } = createCheckHarness()

/**
 * @param {string} name
 * @param {unknown} actual
 * @param {unknown} expected
 */
function check (name, actual, expected) {
  const cond = actual === expected
  if (!cond) console.error(`  FAIL  ${name}  (got: ${String(actual)}, want: ${String(expected)})`)
  record(cond)
}

const dir = mkdtempSync(join(tmpdir(), 'vp-ndjson-'))

/**
 * @param {string} name
 * @param {string} content
 * @returns {string} the written path
 */
function fixture (name, content) {
  const p = join(dir, name)
  writeFileSync(p, content)
  return p
}

// --- the happy path ---
const ok = readNdjson(fixture('ok.ndjson', '{"id":"a","v":1}\n{"id":"b","v":2}\n'))
check('reads every row', ok.rows, 2)
check('keys by id', ok.map.get('b')?.['v'], 2)
check('no malformed lines', ok.malformed, 0)
check('no duplicates', ok.duplicates.length, 0)

// --- a truncated write: counted and reported, never dropped and never fatal ---
const cut = readNdjson(fixture('cut.ndjson', '{"id":"a","v":1}\n{"id":"b","v":\n{"id":"c","v":3}\n'))
check('a truncated line is counted, not thrown', cut.malformed, 1)
check('...and the surrounding rows still load', cut.rows, 2)
check('...so coverage loss is visible rather than silent', cut.map.has('c'), true)

// --- blank lines are structure, not data ---
const blanks = readNdjson(fixture('blanks.ndjson', '\n{"id":"a"}\n\n\n{"id":"b"}\n\n'))
check('blank lines are skipped without counting as malformed', blanks.malformed, 0)
check('...and do not inflate the row count', blanks.rows, 2)

// --- duplicates: first wins, and the collision is reported ---
const dup = readNdjson(fixture('dup.ndjson', '{"id":"a","v":1}\n{"id":"a","v":9}\n'))
check('the first row for an id wins', dup.map.get('a')?.['v'], 1)
check('...and the duplicate is named', dup.duplicates[0], 'a')
check('...counted as a row, since it parsed', dup.rows, 2)

// --- absence is an empty result, not a throw: the caller decides ---
const missing = readNdjson(join(dir, 'does-not-exist.ndjson'))
check('a missing file yields no rows', missing.rows, 0)
check('...and is NOT reported as malformed — absent and corrupt differ', missing.malformed, 0)

// --- round trip ---
const rt = join(dir, 'roundtrip.ndjson')
writeNdjson(rt, [{ id: 'a', v: 1 }, { id: 'b', v: 2 }])
const back = readNdjson(rt)
check('write → read preserves the row count', back.rows, 2)
check('...and the values', back.map.get('a')?.['v'], 1)

// --- the trailing newline, asserted on RAW BYTES ---
//
// Not through `readNdjson`. Every assertion above tolerates a missing trailing
// newline, because the reader skips blank lines — so a round trip through it can
// never see the byte go missing, whatever the comment above it used to claim.
// Plant-and-revert proved that: deleting `+ '\n'` from `writeNdjson` left this
// file green. The expectation here is a literal and the actual is the file
// itself, so the two no longer share the reader's tolerance.
//
// It is `wc -l` that cares. The orchestrator verifies every shard write by
// comparing line counts (`stale-npm-triage.js:222`), and `wc -l` counts
// NEWLINES: drop the last one and the final row of every shard silently stops
// being counted.
check('the file ends with a newline', readFileSync(rt, 'utf8').endsWith('\n'), true)
check('...and `wc -l` therefore agrees with the row count',
  readFileSync(rt, 'utf8').split('\n').length - 1, 2)

// An empty row set writes an EMPTY file, not a lone newline. `readNdjson` reads
// both as zero rows, but `wc -l` reads a lone newline as 1 — the same
// disagreement in the opposite direction, inflating a count rather than losing
// one. Found by the same plant.
const empty = join(dir, 'empty.ndjson')
writeNdjson(empty, [])
check('an empty row set is still parseable', readNdjson(empty).rows, 0)
check('...and is zero bytes, so `wc -l` reports 0 lines, not 1',
  readFileSync(empty, 'utf8').length, 0)

// A line can parse as JSON and still not be a row. `null` is the one that bit:
// `writeNdjson` took `unknown[]`, so `[null]` was a legal call, and reading it
// back died on `String(row.id)` — the uncaught throw this module was extracted
// to prevent, reintroduced through the writer.
const notObjects = fixture('not-objects.ndjson', 'null\n[1,2]\n42\n"str"\n{"id":"a"}\n')
check('a JSON null is malformed, not a throw', readNdjson(notObjects).malformed, 4)
check('...and the one real row still lands', readNdjson(notObjects).rows, 1)

// A row with no `id` used to key itself under the STRING "undefined": it counted
// as valid, and a SECOND such row was then dropped as a duplicate while
// `malformed` stayed 0. Every count reconciled around data that had gone
// missing, which is the quietest shape this file exists to make loud.
const noIds = fixture('no-ids.ndjson', '{"v":1}\n{"v":2}\n{"id":"real"}\n')
const noIdRead = readNdjson(noIds)
check('an id-less row is malformed, not silently keyed "undefined"', noIdRead.malformed, 2)
check('...so the second one is not mistaken for a duplicate', noIdRead.duplicates.length, 0)
check('...and only the real row is keyed', [...noIdRead.map.keys()].join(','), 'real')
check('a non-string id is malformed too', readNdjson(fixture('num-id.ndjson', '{"id":7}\n')).malformed, 1)

done(15)
