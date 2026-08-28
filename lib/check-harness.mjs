// Shared fixture-test harness for scripts/check-*.mjs self-tests. Every one of
// those scripts previously reimplemented an identical ~20-line
// passed/failed counter + PASS/FAIL logger + summary line + `process.exit(1)`
// block. This module extracts that bookkeeping into one factory.
//
// Most scripts only need the bare-boolean `check(name, cond)` form this
// factory returns directly. The next most common shape — report BOTH the actual
// and the expected value on failure — is `checkEqual`, which four scripts had
// each redeclared as a byte-identical local function (verified: one md5 across
// check-{http-json,npm-downloads,ndjson,npm-triage}.mjs).
//
// A genuinely custom equality still belongs in the calling script: a structural
// comparison over an object (check-bm-version-extract.mjs) or a try/catch
// wrapper around a `{ ok, reason }` result (check-hooks.mjs) would each need a
// different signature, and forcing them into one union here would make every
// caller worse. Those feed the same shared counters via `record()`, so the
// counting, summary line and exit code stay centralized either way.

/**
 * @typedef CheckCounts
 * @property {number} passed
 * @property {number} failed
 */

/**
 * @typedef CheckHarness
 * @property {(name: string, cond: boolean) => void} check - bare-boolean
 *   check: logs `PASS`/`FAIL` with the given name and records the result.
 * @property {(name: string, actual: unknown, expected: unknown) => void} checkEqual -
 *   strict-equality check that names both values on failure. Silent on pass,
 *   unlike `check`.
 * @property {(cond: boolean) => void} record - records a pass/fail without
 *   logging, for scripts whose own check()/test() wrapper does its own
 *   (richer) logging.
 * @property {() => CheckCounts} getCounts - current pass/fail snapshot, for
 *   a script that needs the total before or instead of calling `done()`.
 * @property {(minChecks: number) => void} done - logs the summary line and
 *   calls `process.exit(1)` if any check failed OR if fewer than `minChecks`
 *   ran at all. The floor is a REQUIRED argument; see `done` for why.
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

  /**
   * Strict-equality check that reports what it got alongside what it wanted.
   *
   * Silent on pass — deliberately, and unlike `check`. The four scripts this
   * was lifted from run 20-118 assertions each, and a PASS line per assertion
   * buries the one FAIL that matters.
   *
   * @param {string} name
   * @param {unknown} actual
   * @param {unknown} expected
   */
  function checkEqual (name, actual, expected) {
    const cond = actual === expected
    if (!cond) console.error(`  FAIL  ${name}  (got: ${String(actual)}, want: ${String(expected)})`)
    record(cond)
  }

  /** @returns {CheckCounts} */
  function getCounts () {
    return { passed, failed }
  }

  /**
   * Report and exit.
   *
   * `minChecks` is the number of assertions this script is contracted to run,
   * and it is REQUIRED for the reason this whole parameter exists: `done()`
   * used to print `0/0 passed` and exit 0. Any script whose fixture list comes
   * from a glob, a `readdirSync`, or a `JSON.parse` went green having verified
   * nothing the moment that list came up empty — the ninth instance of this
   * repo's signature defect, and the first in the shared substrate rather than
   * in one check. A required positional forces all 22 call sites to write down
   * what they are contracted to run.
   *
   * A floor of 0 is refused rather than accepted: a guard against vacuous
   * checks that permits its own vacuous configuration is the same bug wearing
   * the remedy's clothes. `tsc` rejects a missing argument, but `done(0)` and
   * `done(undefined)` are still callable JS, so the check is at runtime too.
   *
   * Set the floor to a STABLE LOWER BOUND, not to the current total. A floor
   * equal to today's count has to be edited every time a case is added, which
   * turns it into a speed bump people bump reflexively; a floor comfortably
   * below the count still catches an emptied fixture list and a suite that
   * silently stopped halfway, and it only moves when the contract really does.
   *
   * @param {number} minChecks - stable lower bound on assertions run; ≥ 1
   * @returns {void}
   */
  function done (minChecks) {
    const total = passed + failed
    if (!Number.isInteger(minChecks) || minChecks < 1) {
      console.error(`\ndone() needs a positive integer floor, got ${String(minChecks)} — a script with no contracted minimum cannot fail on having run nothing`)
      process.exit(1)
    }
    console.log(`\n${passed}/${total} passed`)
    if (total < minChecks) {
      console.error(`ran ${total} check(s), below the contracted floor of ${minChecks} — the fixture list or scanned input came up short, so this run verified less than it claims`)
      process.exit(1)
    }
    if (failed > 0) process.exit(1)
  }

  return { check, checkEqual, record, getCounts, done }
}
