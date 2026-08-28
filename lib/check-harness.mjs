import { inspect } from 'node:util'

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
 * @property {<T>(name: string, actual: T, expected: T) => void} checkEqual -
 *   strict-equality check that names both values on failure, formatted so a
 *   number and its string are distinguishable. Silent on pass, unlike `check`.
 * @property {(cond: boolean) => void} record - records a pass/fail without
 *   logging, for scripts whose own check()/test() wrapper does its own
 *   (richer) logging.
 * @property {() => CheckCounts} getCounts - current pass/fail snapshot, for
 *   a script that needs the total before or instead of calling `done()`.
 * @property {(minChecks?: number) => void} done - logs the summary line and
 *   calls `process.exit(1)` if any check failed OR if fewer than `minChecks`
 *   ran at all. Defaults to 1; pass a number only where the assertion COUNT is
 *   data-driven. See `done` for why that is rare.
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
   * Silent on pass — deliberately, and unlike `check`. The scripts this was
   * lifted from run 20-118 assertions each, and a PASS line per assertion buries
   * the one FAIL that matters.
   *
   * `inspect`, not `String`. With `String` the three cases where a reader most
   * needs the two values named printed them IDENTICALLY: `(5, '5')`,
   * `({a:1}, {a:1})` and `(NaN, NaN)` all rendered as `got: X, want: X` while
   * failing. That is a failure message that cannot do its one job, and it
   * shipped at 24 call sites at once because this replaced four byte-identical
   * local copies that all had it.
   *
   * @template T
   * @param {string} name
   * @param {T} actual
   * @param {T} expected
   */
  function checkEqual (name, actual, expected) {
    const cond = actual === expected
    if (!cond) console.error(`  FAIL  ${name}  (got: ${inspect(actual)}, want: ${inspect(expected)})`)
    record(cond)
  }

  /** @returns {CheckCounts} */
  function getCounts () {
    return { passed, failed }
  }

  /**
   * Report and exit.
   *
   * `done()` used to print `0/0 passed` and exit 0, so any script whose fixture
   * list came from a glob, a `readdirSync`, or a `JSON.parse` went green having
   * verified nothing the moment that list emptied. The default floor of 1 closes
   * that, and is all most callers need.
   *
   * An explicit `minChecks` is for the few scripts whose assertion COUNT is
   * genuinely data-driven — where a corpus can shrink without emptying. Do not
   * add one elsewhere. A first version required the argument at all 24 call
   * sites, and adversarial review showed 20 of those scripts have counts that
   * vary with nothing but hand-edited source: for them a partial shrink means a
   * throw, a throw means `done()` never runs, and the process exits non-zero
   * anyway. Those floors bounded nothing, and the numbers were a standing
   * invitation to bump them.
   *
   * Where the count IS data-driven, prefer a direct assertion on the thing that
   * can shrink (`check('corpus not trimmed', CORPUS.length >= N)`) over a floor
   * on the total: a floor drifts as unrelated sections grow, and
   * `check-host-parity` proved it — its corpus could lose a quarter of its
   * strings and its cadence range could fall from 13 to 2 with the total still
   * above the floor.
   *
   * A floor below 1 is refused rather than accepted: a guard against vacuous
   * checks that permits its own vacuous configuration is the same bug wearing
   * the remedy's clothes.
   *
   * @param {number} [minChecks] - lower bound on assertions run; defaults to 1
   * @returns {void}
   */
  function done (minChecks = 1) {
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
