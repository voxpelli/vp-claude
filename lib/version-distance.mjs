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
 * Every value `classifyVersionDistance` can return, most severe first.
 *
 * Exported as data, not just as a JSDoc union, because a consumer that ORDERS by
 * distance class has to enumerate them — the same open-vs-closed hazard this
 * repo already fixed once in the upstream-state chain.
 *
 * An unmapped class sorts **LAST**, not first (`?? Number.MAX_SAFE_INTEGER` in
 * `lib/npm-triage.mjs`'s `DRIFT_ORDER` lookup) — a fixture pins that. It is also
 * not entirely silent: `rank.mjs` collects such rows into `summary.json`'s
 * `unknownDriftClasses`. That half has no fixture (it is driver code) and is in
 * neither the rank schema nor the gate, so it reaches an operator only through a
 * prose instruction to the report agent. The residual risk is therefore quiet
 * demotion inside a table, not a stranger at the top of a triage list — which is
 * why the guard lives where it does.
 *
 * That guard is the SOURCE SCAN in `scripts/check-version-distance.mjs`, which
 * reads this function's own `return` literals. The obvious alternative — assert
 * the consumer's map covers this tuple — was written first and deleted: the map
 * is DERIVED from the tuple, so both sides move together and planting a fifth
 * class failed nothing.
 */
export const VERSION_DISTANCE_CLASSES = /** @type {const} */ ([
  'semver-major', 'semver-minor-multi', 'distance-unknown', 'upstream-prerelease', 'patch',
])

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
 * @returns {typeof VERSION_DISTANCE_CLASSES[number]}
 */
export function classifyVersionDistance (bmVersion, upstreamVersion) {
  if (!bmVersion || !upstreamVersion) return 'distance-unknown'
  if (bmVersion === upstreamVersion) return 'patch'

  // Scheme-mismatch guard — must run before any major comparison.
  if (isCalVer(bmVersion) !== isCalVer(upstreamVersion)) return 'distance-unknown'

  // Prerelease-upstream guard — refuse rather than guess.
  //
  // `parseSemver` below matches a PREFIX, so `4.0.0-beta.5` parses as {4,0,0} and
  // the tag silently disappears. Without this branch a note on 3.3.3 against an
  // upstream `latest` of `4.0.0-beta.5` escalates to `semver-major` and rises to
  // the top of a triage list — which is what happened to `npm-c12` in the
  // 2026-08-06 report, where the true stable delta was 3.3.3 → 3.3.4.
  //
  // Emitting a distance here would mean asserting which release line the reader
  // cares about: when `latest` points at a prerelease, the stable line usually
  // lives under a separate dist-tag (c12 publishes `3x`) that this pipeline
  // deliberately does not fetch. So the honest output is a flag, not a number.
  //
  // Only the UPSTREAM side is tested. A note that records a prerelease against a
  // stable upstream still has a sound comparison base — the registry has told us
  // a real release exists — so that direction stays classified.
  if (parseVersionParts(upstreamVersion)?.prerelease != null) return 'upstream-prerelease'

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

/**
 * Is `bmVersion` cleanly ahead of `upstreamVersion` — the *ordering* half of
 * the staleness model that {@link classifyVersionDistance} does not provide
 * (that function classifies the magnitude of a difference, never its
 * direction). This is the "same-scheme, cleanly semver-parseable comparison"
 * guard for the ahead-of-registry annotation (staleness S4 / gardener
 * Step 5b-iv): a note can legitimately record a version newer than the
 * registry's (e.g. it tracks a `@latest` channel that moves faster than a
 * versioned registry entry), but only when direction can be determined from
 * clean structure.
 *
 * Returns `false` — never "ahead" — for anything that fails to cleanly
 * satisfy the same-scheme/semver-parseable requirement: a CalVer version on
 * either side, or either value failing the `MAJOR.MINOR[.PATCH]` split.
 * "Ahead" cannot be reliably distinguished from "malformed extraction"
 * without clean structure (the 0.31.4 yaml/semver incident is exactly this
 * failure mode: a wrong extraction pattern silently looked like "ahead" when
 * it was actually a parsing bug). Callers MUST additionally check a timing
 * guard (the note's `updated_at` newer than the upstream registry's
 * last-observed movement) before treating the result as benign — that half
 * lives in workflow prose (staleness-detection.md S4 / knowledge-gardener.md
 * 5b-iv), not here, since it depends on BM frontmatter and fetch-script
 * timestamps this pure module never sees.
 *
 * @param {string} bmVersion - version recorded in the Basic Memory note
 * @param {string} upstreamVersion - version reported by the registry
 * @returns {boolean}
 */
export function isAheadOfRegistry (bmVersion, upstreamVersion) {
  if (!bmVersion || !upstreamVersion) return false
  if (bmVersion === upstreamVersion) return false

  // Same-scheme requirement — CalVer on either side never qualifies, even
  // when both sides are CalVer (a same-scheme CalVer pair is still excluded
  // per the ahead-of-registry contract, unlike classifyVersionDistance's
  // scheme-mismatch guard which only rejects when the schemes *differ*).
  if (isCalVer(bmVersion) || isCalVer(upstreamVersion)) return false

  const bm = parseSemver(bmVersion)
  const up = parseSemver(upstreamVersion)
  if (!bm || !up) return false

  if (bm.major !== up.major) return bm.major > up.major
  if (bm.minor !== up.minor) return bm.minor > up.minor
  return bm.patch > up.patch
}

/**
 * @typedef VersionParts
 * @property {number} major
 * @property {number} minor
 * @property {number} patch
 * @property {string | null} prerelease - the `-rc.1` tag without its hyphen, or null
 */

/**
 * Parse a version into fully-qualified comparable parts.
 *
 * Deliberately NOT a reuse of the private `parseSemver` above: that one exists
 * for distance classification and discards the prerelease tag, which is exactly
 * the component that decides whether two versions are the same release. Build
 * metadata (`+build.9`) is dropped, per semver, because it never affects
 * precedence.
 *
 * @param {string} v - version string, with or without a leading `v`
 * @returns {VersionParts | null} null when not `MAJOR[.MINOR[.PATCH]]`
 */
export function parseVersionParts (v) {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v ?? '').trim())
  if (!m || m[1] === undefined) return null
  return {
    major: Number.parseInt(m[1], 10),
    minor: Number.parseInt(m[2] ?? '0', 10),
    patch: Number.parseInt(m[3] ?? '0', 10),
    prerelease: m[4] ?? null,
  }
}

/**
 * Do two version strings denote the SAME release?
 *
 * String equality is not good enough for this question and gets it wrong in
 * both directions: `1.2` and `1.2.0` are the same release spelled differently,
 * `1.2.3+build.9` and `1.2.3` differ only by ignorable metadata, while
 * `1.2.3-rc.1` and `1.2.3` look adjacent but are genuinely different releases.
 * A drift sweep that compares with `===` reports the first two as drift that
 * does not exist.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean | null} null when either side cannot be parsed
 */
export function versionsEquivalent (a, b) {
  const pa = parseVersionParts(a)
  const pb = parseVersionParts(b)
  if (!pa || !pb) return null
  return pa.major === pb.major && pa.minor === pb.minor && pa.patch === pb.patch &&
    pa.prerelease === pb.prerelease
}

/**
 * Numeric precedence between two versions on the SAME versioning axis.
 *
 * Unlike {@link isAheadOfRegistry} this does not refuse CalVer — the caller is
 * responsible for having established that both sides share a scheme (via
 * {@link isCalVer}). That split exists because "is the note ahead of the
 * registry" and "which of these two numbers is larger" are different questions:
 * the former must fail closed on an ambiguous scheme, the latter is pure
 * comparison. Prerelease ordering follows semver: a prerelease precedes its
 * own release, and two prereleases compare as strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1 | null} null when either side cannot be parsed
 */
export function compareVersionParts (a, b) {
  const pa = parseVersionParts(a)
  const pb = parseVersionParts(b)
  if (!pa || !pb) return null
  for (const key of /** @type {const} */ (['major', 'minor', 'patch'])) {
    if (pa[key] !== pb[key]) return pa[key] > pb[key] ? 1 : -1
  }
  if (pa.prerelease === pb.prerelease) return 0
  if (pa.prerelease === null) return 1
  if (pb.prerelease === null) return -1
  return pa.prerelease > pb.prerelease ? 1 : -1
}
