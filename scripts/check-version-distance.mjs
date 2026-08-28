/**
 * Fixture self-test for the version-distance classifier (`lib/version-distance.mjs`).
 *
 * Proves the scheme-mismatch guard and the version-zero rule actually hold, so a
 * future edit to the gardener/staleness prose can be checked against committed
 * fixtures rather than trusted. Wired into `npm run check` as `check:distance`.
 */

import { readFileSync } from 'node:fs'

import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  classifyVersionDistance, compareVersionParts, isAheadOfRegistry, isCalVer, parseVersionParts,
  VERSION_DISTANCE_CLASSES, versionsEquivalent,
} from '../lib/version-distance.mjs'

const { checkEqual: check, done } = createCheckHarness()

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

// --- Prerelease upstream: refuse to classify, do not guess a distance ---
//
// The defect these pin shipped in the 2026-08-06 report: `parseSemver` matches a
// PREFIX, so `4.0.0-beta.5` parsed as `{4,0,0}` and the `-beta.5` vanished. A note
// documenting c12 3.3.3 against npm's `latest` (a beta) escalated to `semver-major`
// and reached rank 6 — while the real stable delta was 3.3.3 → 3.3.4, a `patch`,
// because c12's stable line lives under a separate `3x` dist-tag this pipeline
// never reads.
//
// Refusing is the honest answer, not a cop-out: npm has no stable release on
// `latest`, so any distance we emitted would be asserting which release line the
// reader cares about. Only the UPSTREAM side is checked — a note that records a
// prerelease against a stable upstream still has a sound comparison base.
check('prerelease upstream (the c12 case) → upstream-prerelease',
  classifyVersionDistance('3.3.3', '4.0.0-beta.5'), 'upstream-prerelease')
check('prerelease upstream: rc → upstream-prerelease',
  classifyVersionDistance('1.9.0', '2.0.0-rc13'), 'upstream-prerelease')
check('prerelease upstream: alpha → upstream-prerelease',
  classifyVersionDistance('3.0.1', '4.0.0-alpha.0'), 'upstream-prerelease')
check('prerelease upstream that is NOT a major jump still refuses',
  classifyVersionDistance('1.2.0', '1.2.1-next.1'), 'upstream-prerelease')
// The asymmetry, pinned so it cannot be "tidied" into symmetry unnoticed.
check('prerelease on the BM side only → classified as normal',
  classifyVersionDistance('4.0.0-beta.5', '4.0.1'), 'patch')
// Build metadata is not a prerelease (semver: it never affects precedence).
check('build metadata is not a prerelease',
  classifyVersionDistance('1.2.0', '1.5.0+build.9'), 'semver-minor-multi')
// Scheme mismatch keeps precedence — it is the more fundamental refusal, and
// its "must run before any major comparison" invariant predates this class.
check('CalVer-vs-semver outranks the prerelease refusal',
  classifyVersionDistance('3.6.1', '2026.3.1-rc1'), 'distance-unknown')
// Equality is decided before either refusal: a note already ON the prerelease
// has no drift to report (this is c12's note, which documents the beta verbatim).
check('note already documents the same prerelease → patch, not a refusal',
  classifyVersionDistance('4.0.0-beta.5', '4.0.0-beta.5'), 'patch')

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

// --- versionsEquivalent: the cases where `===` on strings fabricates drift ---
// Each of the first three was observed producing a phantom "confirmed drift"
// row in a staleness sweep that compared documented and upstream versions with
// string equality.
check('arity difference is the same release → true', versionsEquivalent('1.2', '1.2.0'), true)
check('build metadata is ignorable → true', versionsEquivalent('1.2.3+build.9', '1.2.3'), true)
check('leading v is ignorable → true', versionsEquivalent('v4.0.2', '4.0.2'), true)
check('prerelease vs release are DIFFERENT releases → false', versionsEquivalent('1.2.3-rc.1', '1.2.3'), false)
check('genuinely different patch → false', versionsEquivalent('1.2.3', '1.2.4'), false)
check('unparseable side → null', versionsEquivalent('not-a-version', '1.2.3'), null)

// --- compareVersionParts: precedence, including the CalVer axis isAheadOfRegistry refuses ---
check('same-scheme CalVer, note ahead → 1', compareVersionParts('2026.4.1', '2026.3.9'), 1)
check('same-scheme CalVer, note behind → -1', compareVersionParts('2026.3.9', '2026.4.1'), -1)
check('prerelease precedes its own release → -1', compareVersionParts('1.2.3-rc.1', '1.2.3'), -1)
check('release follows its prerelease → 1', compareVersionParts('1.2.3', '1.2.3-rc.1'), 1)
check('equivalent arity → 0', compareVersionParts('1.2', '1.2.0'), 0)
check('unparseable side → null', compareVersionParts('', '1.2.3'), null)

// --- parseVersionParts: the shapes the drivers actually feed it ---
check('bare major parses with defaulted components', parseVersionParts('7')?.minor, 0)
check('prerelease tag is retained', parseVersionParts('1.2.3-rc.1')?.prerelease, 'rc.1')
check('build metadata is dropped, not retained as prerelease', parseVersionParts('1.2.3+b.9')?.prerelease, null)
check('a range operator is NOT a version', parseVersionParts('^1.2.3'), null)

// --- VERSION_DISTANCE_CLASSES must list what the function actually returns ---
//
// Scanned from SOURCE, deliberately. Consumers order by distance class
// (`lib/npm-triage.mjs`'s `DRIFT_ORDER`), so a class that never reaches this
// tuple gets a fallback position in a triage list nobody asked for. The obvious
// guard — assert the consumer's map covers the tuple — is vacuous, because the
// map is derived FROM the tuple: it was written that way first, and planting a
// fifth class failed nothing. Reading the function's own `return` literals is
// the only available source the tuple cannot move.
const distanceSource = readFileSync(new URL('../lib/version-distance.mjs', import.meta.url), 'utf8')
const fnStart = distanceSource.indexOf('export function classifyVersionDistance')
const fnBody = distanceSource.slice(fnStart, distanceSource.indexOf('\nexport ', fnStart + 1))
const returned = [...new Set([...fnBody.matchAll(/return '([^']+)'/g)].map(m => m[1]))].sort()
check('the source scan found the function at all — a rename must fail loudly, not pass vacuously',
  fnStart > 0 && returned.length > 0, true)
check('every class the function returns is declared in VERSION_DISTANCE_CLASSES',
  returned.join(','), [...VERSION_DISTANCE_CLASSES].sort().join(','))

done(50)
