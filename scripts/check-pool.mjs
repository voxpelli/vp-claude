/**
 * Fixture self-test for `lib/pool.mjs`. Wired into `npm run check` as
 * `check:pool`.
 *
 * The extraction it guards replaced three hand-written copies of the same
 * bounded-worker loop — two named `pool()`, one inlined in `downloads-batch.mjs`
 * — so the property that matters is that nothing about their behaviour moved.
 * Concurrency and ordering are exactly the pair a live 21-minute sweep cannot
 * show you: a broken cap still finishes, and a scrambled order still reconciles.
 *
 * Two assertions here were themselves found unable to fail, by an adversarial
 * review of this file. Both are marked below. The lesson worth keeping is that
 * `typeof x === 'string'` on a function whose body ends in `String(...)` is a
 * tautology however it is worded — assert the VALUE.
 */

import { createCheckHarness } from '../lib/check-harness.mjs'
import { errorMessage, pool } from '../lib/pool.mjs'

const { check, checkEqual, done } = createCheckHarness()

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

// ── Order is preserved regardless of completion order ────────────────────────
// The drivers join these results back to note ids positionally in one case and
// by row `id` in another, and a shuffled array would corrupt the first silently.
// Longest-sleeping item first, so completion order differs from input order.
// (Measured at limit 3 it is 20,30,10,0,40 — NOT the exact reverse an earlier
// version of this comment asserted. Only three workers start together, so 20
// finishes first and picks up the tail. The assertion needs the two orders to
// differ, which they do; the stated reason was wrong and the assertion was not.)
const items = [40, 30, 20, 10, 0]
const ordered = await pool(items, 3, async (ms) => {
  await sleep(ms)
  return ms
}, () => -1)
checkEqual('results keep INPUT order, not completion order', ordered.join(','), items.join(','))

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
}, (item, err) => `failed:${item}:${errorMessage(err, 80)}`)
checkEqual('a rejection becomes a result in its own slot', withFailure[1], 'failed:2:boom')
checkEqual('...and the surrounding items are unaffected',
  `${withFailure[0]},${withFailure[2]},${withFailure[3]}`, 'ok:10,ok:30,ok:40')
checkEqual('...so the array is still the full length', withFailure.length, 4)

// ── Degenerate inputs ────────────────────────────────────────────────────────
const emptyRun = await pool([], 4, async () => 1, () => 0)
checkEqual('an empty item list resolves to an empty array', emptyRun.length, 0)
const overLimit = await pool([1, 2], 99, async (n) => n * 2, () => 0)
checkEqual('a limit above the item count still processes every item', overLimit.join(','), '2,4')

// A `limit` below 1 used to spawn ZERO workers: `Math.min(limit, n)` is 0,
// `Promise.all([])` resolves at once, and the pre-sized array came back full of
// holes typed as `TResult[]` with `fn` and `onError` both unrun and nothing
// thrown. All three callers clamp with `Math.max(1, …)`; the extraction took the
// loop and left the precondition behind, in a module whose own reason for
// existing is that a fourth caller is expected.
for (const bad of [0, -5, 1.5, Number.NaN]) {
  let threw = false
  try {
    await pool([1, 2], bad, async (n) => n, () => 0)
  } catch { threw = true }
  check(`limit ${String(bad)} is refused, not silently emptied`, threw)
}

// ── errorMessage ─────────────────────────────────────────────────────────────
checkEqual('reads .message off an Error', errorMessage(new Error('hello'), 80), 'hello')
checkEqual('truncates to the requested length', errorMessage(new Error('abcdefghij'), 4), 'abcd')

// These assert the VALUE, and that is the whole point. The line they replace was
// `typeof errorMessage('a string') === 'string'` — true for EVERY possible
// implementation, since the body ends in `String(...)`. Planting a
// `return 'DISCARDED'` at the top of errorMessage left this file green at 13/13.
// What it was hiding: the old `/** @type {Error} */` cast on an `unknown` made
// `String(undefined)` type-check, so a thrown string arrived in the sweep's
// report columns as the literal text "undefined".
checkEqual('a thrown string keeps its text, not the literal "undefined"', errorMessage('a string', 80), 'a string')
checkEqual('a thrown object does not become "undefined" either', errorMessage({}, 80), '[object Object]')

checkEqual('null and undefined stringify rather than throw', `${errorMessage(null, 80)}/${errorMessage(undefined, 80)}`, 'null/undefined')

done()
