/**
 * Fixture self-test for `lib/ndjson.mjs`'s neighbour, `lib/pool.mjs`. Wired
 * into `npm run check` as `check:pool`.
 *
 * The extraction it guards replaced three hand-written copies of the same
 * bounded-worker loop — two named `pool()`, one inlined in `downloads-batch.mjs`
 * — so the property that matters is that nothing about their behaviour moved.
 * Concurrency and ordering are exactly the pair a live 21-minute sweep cannot
 * show you: a broken cap still finishes, and a scrambled order still reconciles.
 */

import { createCheckHarness } from '../lib/check-harness.mjs'
import { errorMessage, pool } from '../lib/pool.mjs'

const { check, done } = createCheckHarness()

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

// ── Order is preserved regardless of completion order ────────────────────────
// The drivers join these results back to note ids positionally in one case and
// by row `id` in another, and a shuffled array would corrupt the first silently.
// Longest-sleeping item first, so completion order is the REVERSE of input.
const items = [40, 30, 20, 10, 0]
const ordered = await pool(items, 3, async (ms) => {
  await sleep(ms)
  return ms
}, () => -1)
check('results keep INPUT order, not completion order', ordered.join(',') === items.join(','))

// ── The concurrency cap is the load-bearing parameter ────────────────────────
// Each `bm` call is its own OS process, so a cap that silently does not apply
// is the difference between 8 processes and 580.
let live = 0
let peak = 0
await pool(Array.from({ length: 30 }, (_, i) => i), 4, async (i) => {
  live++
  peak = Math.max(peak, live)
  await sleep(1)
  live--
  return i
}, () => -1)
check('never exceeds the cap', peak <= 4)
check('...and actually reaches it (a cap of 1 would also satisfy the line above)', peak === 4)

// ── A rejection cannot discard the work already done ─────────────────────────
// This is the whole reason `onError` is a required parameter rather than a
// default: a silent drop would shrink the cohort while every count still
// reconciled, which is this workflow's signature failure.
// `onError` must return the SAME type as `fn` — the drivers rely on that (a
// failed scan is still a ScanRow), and tsc enforces it, which it caught in an
// earlier draft of this very fixture.
const withFailure = await pool([1, 2, 3, 4], 2, async (n) => {
  if (n === 2) throw new Error('boom')
  return `ok:${n * 10}`
}, (item, err) => `failed:${item}:${errorMessage(err)}`)
check('a rejection becomes a result in its own slot', withFailure[1] === 'failed:2:boom')
check('...and the surrounding items are unaffected', `${withFailure[0]},${withFailure[2]},${withFailure[3]}` === 'ok:10,ok:30,ok:40')
check('...so the array is still the full length', withFailure.length === 4)

// ── Degenerate inputs ────────────────────────────────────────────────────────
// Reaching the next line at all is what proves `Math.min(limit, 0)` spawns no
// workers and does not hang; asserting that separately would be a `check(name,
// true)`, which is the exact bug class this file is part of closing.
const emptyRun = await pool([], 4, async () => 1, () => 0)
check('an empty item list resolves to an empty array', emptyRun.length === 0)
const overLimit = await pool([1, 2], 99, async (n) => n * 2, () => 0)
check('a limit above the item count still processes every item', overLimit.join(',') === '2,4')

// ── errorMessage ─────────────────────────────────────────────────────────────
// The two shards wrote this by hand with different truncation lengths, 200 and
// 80, which looks deliberate and was not.
check('reads .message off an Error', errorMessage(new Error('hello')) === 'hello')
check('truncates to the requested length', errorMessage(new Error('abcdefghij'), 4) === 'abcd')
check('defaults to 200', errorMessage(new Error('x'.repeat(300))).length === 200)
check('a non-Error rejection does not throw', typeof errorMessage('a string') === 'string')
// eslint-disable-next-line unicorn/no-useless-undefined -- the explicit undefined IS the case under test
check('null and undefined do not throw', errorMessage(null) === 'null' && errorMessage(undefined) === 'undefined')

done(12)
