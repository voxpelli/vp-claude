/**
 * Fixture self-test for the version-distance classifier (`lib/version-distance.mjs`).
 *
 * Proves the scheme-mismatch guard and the version-zero rule actually hold, so a
 * future edit to the gardener/staleness prose can be checked against committed
 * fixtures rather than trusted. Wired into `npm run check` as `check:distance`.
 */

import { createCheckHarness } from '../lib/check-harness.mjs'
import { classifyVersionDistance, isAheadOfRegistry, isCalVer } from '../lib/version-distance.mjs'

const { done, record } = createCheckHarness()

/**
 * Richer form of `check-harness.mjs`'s `check(name, cond)`: reports both the
 * actual and expected value on failure, silent on pass. Built on the shared
 * harness's `record()` so the pass/fail bookkeeping stays centralized.
 *
 * @param {string} name
 * @param {unknown} actual
 * @param {unknown} expected
 */
function check (name, actual, expected) {
  const cond = actual === expected
  if (!cond) {
    console.error(`  FAIL  ${name}  (got: ${String(actual)}, want: ${String(expected)})`)
  }
  record(cond)
}

// --- Scheme-mismatch guard (the bug this fix exists for) ---
check('biome: semver bm vs CalVer pre-release upstream → distance-unknown',
  classifyVersionDistance('3.5.0', '2026.3.311859'), 'distance-unknown')
check('biome (newer stable) vs CalVer upstream → distance-unknown',
  classifyVersionDistance('3.6.1', '2026.3.311859'), 'distance-unknown')
check('CalVer bm vs semver upstream → distance-unknown',
  classifyVersionDistance('2025.10.1', '3.6.1'), 'distance-unknown')

// --- Post-fix biome case: once the script resolves the stable line ---
check('biome documented 3.5.0 vs resolved stable 3.6.1 → patch',
  classifyVersionDistance('3.5.0', '3.6.1'), 'patch')

// --- Both CalVer: comparable again on the same axis ---
check('CalVer same minor, patch bump → patch',
  classifyVersionDistance('2025.10.1', '2025.10.2'), 'patch')
check('CalVer year bump → semver-major',
  classifyVersionDistance('2025.10.1', '2026.3.1'), 'semver-major')

// --- Version-zero rule (regression: the blueprint draft returned patch here) ---
check('0.x minor bump is breaking → semver-major',
  classifyVersionDistance('0.4.0', '0.5.0'), 'semver-major')
check('0.x patch-only bump → patch',
  classifyVersionDistance('0.8.8', '0.8.9'), 'patch')
check('0.x → 1.x major crossing → semver-major',
  classifyVersionDistance('0.9.0', '1.0.0'), 'semver-major')

// --- Normal semver ---
check('1.x → 2.x → semver-major', classifyVersionDistance('1.84.0', '2.0.1'), 'semver-major')
check('minor jumped by ≥3 → semver-minor-multi', classifyVersionDistance('1.2.0', '1.5.0'), 'semver-minor-multi')
check('minor jumped by 1 → patch', classifyVersionDistance('1.6.0', '1.7.0'), 'patch')
check('trailing-component only → patch', classifyVersionDistance('1.0.3', '1.0.4'), 'patch')
check('large but real semver major (Angular-style) → semver-major',
  classifyVersionDistance('18.0.0', '19.0.0'), 'semver-major')

// --- Unparseable / empty ---
check('empty bm → distance-unknown', classifyVersionDistance('', '1.0.0'), 'distance-unknown')
check('unparseable bm → distance-unknown', classifyVersionDistance('unparseable', '1.0.0'), 'distance-unknown')
check('unparseable upstream → distance-unknown', classifyVersionDistance('1.0.0', 'nightly'), 'distance-unknown')
check('identical versions → patch', classifyVersionDistance('3.6.1', '3.6.1'), 'patch')

// --- isCalVer helper ---
check('isCalVer: 2026.x → true', isCalVer('2026.3.311859'), true)
check('isCalVer: 3.6.1 → false', isCalVer('3.6.1'), false)
check('isCalVer: 1999.x boundary → false', isCalVer('1999.1.1'), false)

// --- isAheadOfRegistry: the ahead-of-registry annotation's ordering guard ---
// (cask-claude-code shape: note tracks @latest, registry lags on an
// unsuffixed token)
check('cask-claude-code shape: note ahead on clean semver → true',
  isAheadOfRegistry('2.1.170', '2.1.153'), true)
check('note behind upstream → false (not ahead)',
  isAheadOfRegistry('2.1.153', '2.1.170'), false)
check('identical versions → false (not ahead)',
  isAheadOfRegistry('3.6.1', '3.6.1'), false)
check('CalVer bm side → false (must stay in normal drift path)',
  isAheadOfRegistry('2026.3.311859', '3.6.1'), false)
check('CalVer upstream side → false (must stay in normal drift path)',
  isAheadOfRegistry('3.6.1', '2026.3.311859'), false)
check('both CalVer, bm ahead → false (same-scheme CalVer still excluded)',
  isAheadOfRegistry('2026.3.2', '2026.3.1'), false)
check('malformed bm → false (cannot distinguish ahead from mis-extraction)',
  isAheadOfRegistry('unparseable', '1.0.0'), false)
check('malformed upstream → false',
  isAheadOfRegistry('1.0.0', 'nightly'), false)
check('ahead by minor → true', isAheadOfRegistry('1.5.0', '1.4.9'), true)
check('ahead by major → true', isAheadOfRegistry('2.0.0', '1.9.9'), true)

// --- isAheadOfRegistry: pre-release / build-metadata handling (current,
// chosen behavior — parseSemver only reads the leading MAJOR.MINOR[.PATCH]
// and ignores everything after, so a pre-release or build-metadata suffix
// does not block an "ahead" verdict. The two checks below have a numeric
// difference that decides the verdict on its own, so they pin the regex
// still matches a suffixed string (catches an anchoring regression) but do
// NOT by themselves prove the suffix is ignored — the check after them is
// the discriminating case: it's the one input pair where "ignore suffix"
// actually diverges from real semver precedence.) ---
check('pre-release suffix on bm side still counts as ahead → true',
  isAheadOfRegistry('1.0.1-beta.1', '1.0.0'), true)
check('build-metadata suffix on bm side is ignored, still ahead → true',
  isAheadOfRegistry('1.0.1+build', '1.0.0'), true)
check('pre-release-only difference does not count as ahead → false (the case where "ignore suffix" actually diverges from real semver precedence)',
  isAheadOfRegistry('1.0.0', '1.0.0-beta.1'), false)

// --- isAheadOfRegistry: falsy-input guard ---
check('empty bm string → false', isAheadOfRegistry('', '1.0.0'), false)
check('empty upstream string → false', isAheadOfRegistry('1.0.0', ''), false)
check('null bm → false', isAheadOfRegistry(/** @type {string} */ (/** @type {unknown} */ (null)), '1.0.0'), false)
// eslint-disable-next-line unicorn/no-useless-undefined -- deliberately exercising the `!upstreamVersion` falsy-input branch, not an accidental default
check('undefined upstream → false', isAheadOfRegistry('1.0.0', /** @type {string} */ (/** @type {unknown} */ (undefined))), false)

done()
