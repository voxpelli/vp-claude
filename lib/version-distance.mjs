/**
 * Version-distance classification for the staleness 2-D model.
 *
 * Shared pure logic referenced by the `knowledge-gardener` (Step 5b-iv) and the
 * `knowledge-gaps` staleness-detection workflow (S4). Extracted as a tested
 * module so the scheme-mismatch guard is proven by fixtures, not trusted prose
 * (mirrors `lib/staleness-contract.mjs` + `check:contract`).
 *
 * Distance classes (consumed as `[<class>]` annotations by the maintainer's
 * batch ordering): `semver-major` > `semver-minor-multi` > `patch`, plus
 * `distance-unknown` for unparseable or cross-scheme comparisons.
 */

/**
 * The CalVer threshold: a leading numeric component at or above this value is
 * treated as a calendar year, never a semver major. No real software ships a
 * semver major ≥ 2000; CalVer year components start at the current year.
 */
export const CALVER_LEADING_MIN = 2000

/**
 * Extract the leading numeric component of a version string.
 *
 * @param {string} v - version string (leading `v` already stripped by the caller)
 * @returns {number | null} the leading integer, or null if it does not start with digits
 */
function leadingComponent (v) {
  const m = /^(\d+)/.exec(v)
  return m?.[1] !== undefined ? Number.parseInt(m[1], 10) : null
}

/**
 * Parse a version into `{ major, minor, patch }`. Missing components default to 0.
 *
 * @param {string} v - version string
 * @returns {{ major: number, minor: number, patch: number } | null} or null if not `MAJOR.MINOR[.PATCH]`
 */
function parseSemver (v) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(v)
  // m[1]/m[2] are non-optional groups — a match guarantees them; narrow for tsc.
  if (!m || m[1] === undefined || m[2] === undefined) return null
  return {
    major: Number.parseInt(m[1], 10),
    minor: Number.parseInt(m[2], 10),
    patch: Number.parseInt(m[3] ?? '0', 10),
  }
}

/**
 * Is this version CalVer (calendar-based) rather than semver?
 *
 * @param {string} v - version string
 * @returns {boolean} true when the leading component is a plausible year (≥ {@link CALVER_LEADING_MIN})
 */
export function isCalVer (v) {
  const lead = leadingComponent(v)
  return lead !== null && lead >= CALVER_LEADING_MIN
}

/**
 * Classify the version distance between a BM-documented version and an upstream
 * version. Both must be pre-stripped of a leading `v`.
 *
 * The scheme-mismatch guard fires FIRST: a CalVer-vs-semver comparison is never
 * a `semver-major` escalation, because their leading components are not on the
 * same axis (e.g. `3.6.1` → `2026.3.311859` is a versioning-scheme change, not a
 * 2023-major jump). Such pairs resolve to `distance-unknown`.
 *
 * @param {string} bmVersion - version recorded in the Basic Memory note
 * @param {string} upstreamVersion - version reported by the registry
 * @returns {'semver-major' | 'semver-minor-multi' | 'patch' | 'distance-unknown'}
 */
export function classifyVersionDistance (bmVersion, upstreamVersion) {
  if (!bmVersion || !upstreamVersion) return 'distance-unknown'
  if (bmVersion === upstreamVersion) return 'patch'

  // Scheme-mismatch guard — must run before any major comparison.
  if (isCalVer(bmVersion) !== isCalVer(upstreamVersion)) return 'distance-unknown'

  const bm = parseSemver(bmVersion)
  const up = parseSemver(upstreamVersion)
  if (!bm || !up) return 'distance-unknown'

  // Version-zero rule: in a 0.x line, any minor bump is breaking. Checked
  // BEFORE the major-differ branch, since a 0.x pair shares major 0.
  if (bm.major === 0 && up.major === 0) {
    return bm.minor !== up.minor ? 'semver-major' : 'patch'
  }
  if (bm.major !== up.major) return 'semver-major'
  if (Math.abs(up.minor - bm.minor) >= 3) return 'semver-minor-multi'
  return 'patch'
}
