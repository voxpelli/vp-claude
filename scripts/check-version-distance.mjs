#!/usr/bin/env node
/**
 * Fixture self-test for the version-distance classifier (`lib/version-distance.mjs`).
 *
 * Proves the scheme-mismatch guard and the version-zero rule actually hold, so a
 * future edit to the gardener/staleness prose can be checked against committed
 * fixtures rather than trusted. Wired into `npm run check` as `check:distance`.
 */

import { classifyVersionDistance, isCalVer } from '../lib/version-distance.mjs'

let passed = 0
let failed = 0

/**
 * @param {string} name
 * @param {unknown} actual
 * @param {unknown} expected
 */
function check (name, actual, expected) {
  if (actual === expected) {
    passed++
  } else {
    failed++
    console.error(`  FAIL  ${name}  (got: ${String(actual)}, want: ${String(expected)})`)
  }
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

console.log(`${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
