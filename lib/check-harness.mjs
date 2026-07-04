// Shared fixture-test harness for scripts/check-*.mjs self-tests. Every one of
// those scripts previously reimplemented an identical ~20-line
// passed/failed counter + PASS/FAIL logger + summary line + `process.exit(1)`
// block. This module extracts that bookkeeping into one factory.
//
// Most scripts only need the bare-boolean `check(name, cond)` form this
// factory returns directly. A few need a richer comparison — reporting both
// the actual and expected value on failure (check-version-distance.mjs), or a
// custom equality over a structured object (check-bm-version-extract.mjs), or
// a try/catch test wrapper around a `{ ok, reason }` result
// (check-hooks.mjs). Rather than force those shapes into one awkward union
// signature here, those scripts define their own local `check()`/`test()`
// wrapper and feed the same shared counters via `record()` — the counting,
// summary line, and exit code stay centralized in this module either way.

/**
 * @typedef CheckCounts
 * @property {number} passed
 * @property {number} failed
 */

/**
 * @typedef CheckHarness
 * @property {(name: string, cond: boolean) => void} check - bare-boolean
 *   check: logs `PASS`/`FAIL` with the given name and records the result.
 * @property {(cond: boolean) => void} record - records a pass/fail without
 *   logging, for scripts whose own check()/test() wrapper does its own
 *   (richer) logging.
 * @property {() => CheckCounts} getCounts - current pass/fail snapshot, for
 *   a script that needs the total before or instead of calling `done()`.
 * @property {() => void} done - logs the summary line and, if any check
 *   failed, calls `process.exit(1)`.
 */

/**
 * Creates a fixture-test harness with shared pass/fail bookkeeping, used by
 * every `scripts/check-*.mjs` self-test wired into `npm run check`.
 *
 * @returns {CheckHarness}
 */
export function createCheckHarness () {
  let passed = 0
  let failed = 0

  /** @param {boolean} cond */
  function record (cond) {
    if (cond) {
      passed++
    } else {
      failed++
    }
  }

  /**
   * @param {string} name
   * @param {boolean} cond
   */
  function check (name, cond) {
    record(cond)
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`)
  }

  /** @returns {CheckCounts} */
  function getCounts () {
    return { passed, failed }
  }

  function done () {
    console.log(`\n${passed}/${passed + failed} passed`)
    if (failed > 0) process.exit(1)
  }

  return { check, record, getCounts, done }
}
