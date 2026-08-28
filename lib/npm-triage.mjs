/**
 * Action classification, the ranked-table ordering, and the completeness gate
 * for the npm staleness sweep (`.claude/workflows/stale-npm-triage/`).
 *
 * This lives in `lib/` rather than in the driver because of the repo convention
 * recorded in `.claude/rules/scripts-and-validation.md`: file I/O belongs in a
 * script, resolution belongs in a library. The driver reads NDJSON and writes
 * tables; every decision it used to make inline is here, where `tsc`,
 * `type-coverage`, eslint and ast-grep can see it and where
 * `scripts/check-npm-triage.mjs` can pin it to fixtures.
 *
 * That split is not cosmetic. The sweep has now shipped FOUR checks that could
 * not fail — three completeness-gate checks, plus one written inside the fixture
 * file itself — and the first three survived because the only way to exercise
 * the logic was a 21-minute live run over 578 notes.
 */

import {
  classifyVersionDistance, compareVersionParts, isAheadOfRegistry, isCalVer, parseVersionParts,
  VERSION_DISTANCE_CLASSES, versionsEquivalent,
} from './version-distance.mjs'

/**
 * Where each action class sits in `ranked.ndjson`. The tables filter by action,
 * so this only orders the persisted file — but it orders it by what the reader
 * is being asked to DO, rather than by whatever the old score happened to make
 * numerically largest.
 *
 * Unknown actions sort last (see `actionRank`), never first.
 */
const ACTION_ORDER = /** @type {Record<string, number>} */ ({
  intel: 0,
  unmeasured: 1,
  archive: 2,
  investigate: 3,
  modernize: 4,
  blocked: 5,
  ahead: 6,
  current: 7,
  excluded: 8,
})

/**
 * Action classes the report renders as their own table.
 *
 * A hand-written literal, deliberately NOT derived from `ACTION_ORDER` or from
 * `rank.mjs`'s `tables` object. Derivation is what makes a coverage check
 * vacuous — this repo has shipped that mistake five times — so the two sides of
 * `actionsRendered` below must come from different places: the ACTIONS come from
 * the classifier's output on real rows, this list comes from a human writing it
 * down. Add an action to the classifier without adding it here and the gate
 * fails, which is the entire point.
 *
 * @see ACTIONS_WITHOUT_TABLE for the deliberate omissions.
 */
export const RENDERED_ACTIONS = /** @type {const} */ ([
  'intel', 'unmeasured', 'modernize', 'archive', 'investigate', 'blocked', 'excluded', 'ahead',
])

/**
 * Action classes that legitimately have rows but NO table of their own.
 *
 * `current` is the whole list: a note whose documented version matched the
 * registry needs no entry and no action, so rendering 137 of them would be pure
 * noise. It is counted in the action histogram, which is where a reader looks to
 * confirm the run saw them.
 *
 * This set exists so the omission is DECLARED rather than incidental. Without
 * it, `actionsRendered` would have to be weakened to "or has no table", which is
 * the same as not checking. Anything added here should be a class whose absence
 * from the report is a design decision someone can defend.
 */
export const ACTIONS_WITHOUT_TABLE = /** @type {const} */ (['current'])

/**
 * Drift classes in priority order — the FIRST level of the intel sort key.
 *
 * This replaces a weighted sum (`semver-major` 40, `semver-minor-multi` 26,
 * `distance-unknown` 14, `patch` 10, plus age/reach/compliance terms). The sum
 * was the defect, and the arithmetic is worse than "tied": the drift gap was 30
 * (40 vs 10) while the terms below it offered **50** — release age 18, note age
 * 12, compliance 10, reach 10. A `patch` row maxing every one of them scored
 * **60 against a bare `semver-major`'s 40**. It did not tie a confirmed
 * breaking change; it beat it by 20.
 *
 * A breaking change is not compensable by tidiness, so the classes are now
 * strictly ordered and nothing below can cross a boundary.
 *
 * `distance-unknown` keeps its old position between `semver-minor-multi` and
 * `patch`, for the reason recorded when Phase 3 removed its second population:
 * what reaches it now is TWO FULLY PARSED versions on incomparable schemes (e.g.
 * `3.6.1` against `2026.3.311859`) — confirmed, large drift whose magnitude is
 * merely unclassifiable, not an unread version. Note the consequence the sum
 * used to blur: it now outranks EVERY `patch` row unconditionally, however
 * popular that patch row is.
 *
 * Derived from `VERSION_DISTANCE_CLASSES` so the two cannot drift apart —
 * STRUCTURALLY, not by assertion. No fixture asserts the coverage is exact and
 * none can: a check comparing this map's keys against the tuple it is built
 * from passes for any content. That check was written, shipped, and found by
 * planting a fifth class and watching nothing fail. What guards the real risk —
 * a `return` in `classifyVersionDistance` that never reaches the tuple — is the
 * source scan in `scripts/check-version-distance.mjs`, which reads the
 * function's own body. `scripts/check-npm-triage.mjs` pins this map's ORDER
 * against literals, which the source scan cannot see (it sorts both sides).
 */
export const DRIFT_ORDER = /** @type {Record<string, number>} */ (
  Object.fromEntries(VERSION_DISTANCE_CLASSES.map((c, i) => [c, i]))
)

/**
 * Remediation classes for the `unmeasured` table, cheapest-to-fix first — the
 * FIRST level of that table's own sort key.
 *
 * Deliberately not a severity ordering. Three of these four are one-line slot
 * repairs that make the note measurable on the next sweep; only
 * `no-version-recorded` costs an `/intel` run. So this table is a worklist
 * ordered by what unblocks the most measurement per edit, while the intel table
 * is the priority list. Ordering them by "urgency" would interleave a
 * five-second fix with a research task and make neither list actionable.
 */
export const UNMEASURED_ORDER = /** @type {Record<string, number>} */ ({
  'version-slot-malformed': 0,
  'version-in-wrong-slot': 1,
  'version-unparseable': 2,
  'no-version-recorded': 3,
})

/**
 * Actions that prove the pipeline ran end to end for a note: each requires BOTH
 * a successful note read AND a registry answer of `ok`.
 *
 * `excluded` is absent because it is decided before the registry is consulted,
 * and `investigate` because an all-`investigate` cohort is what a systematically
 * broken lookup key looks like, not a healthy run.
 */
export const RESOLVED_ACTIONS = /** @type {const} */ (['intel', 'current', 'modernize', 'ahead', 'unmeasured', 'archive'])

/**
 * Whether a row's action means the pipeline actually reached a verdict for that
 * note — as opposed to `blocked`, `investigate` or `excluded`, none of which
 * required both a successful read and an `ok` registry answer.
 *
 * @param {unknown} action
 * @returns {boolean}
 */
export function isResolvedAction (action) {
  return /** @type {readonly string[]} */ (RESOLVED_ACTIONS).includes(String(action))
}

/**
 * One note's scan verdict, as `scan-shard.mjs` writes it.
 *
 * `id` and `status` are REQUIRED, and that is the only thing keeping these four
 * row types apart. With every property optional each one was structurally
 * satisfied by `Record<string, unknown>` — and so by every other row type — so
 * wiring `downloads.get(id)` into `scanRow:` type-checked cleanly and would
 * have classified the whole cohort as unscanned with no error anywhere. That is
 * worse than an explicit cast, which at least leaves a token to distrust.
 *
 * Every `return` in `scan-shard.mjs` carries both fields, so requiring them
 * describes the producer rather than constraining it.
 *
 * @typedef ScanRow
 * @property {string} id
 * @property {string} status
 * @property {string} [npmName]
 * @property {string} [npmNameRaw] the note's own recorded name, present only
 *   when it differed from the normalized form actually queried
 * @property {string[]} [missingSections]
 * @property {string} [packagesShape]
 * @property {string} [titleForm]
 * @property {boolean} [hasVersionObs]
 * @property {number} [relationCount]
 * @property {string[]} [relationVerbsUnknown] verbs used that the npm schema does not declare — report-only
 * @property {string | null} [version]
 * @property {string | null} [altVersion]
 * @property {string | null} [altVersionSource]
 * @property {string | null} [versionBearingCategory]
 * @property {boolean} [versionRecoverableFromObservation]
 * @property {boolean} [isRange]
 * @property {string[]} [fourthWall]
 * @property {string | null} [fourthWallError] the detector's own failure, kept
 *   rather than swallowed — a systematically throwing detector would otherwise
 *   render as "no fourth-wall problems anywhere in the cohort". Undeclared here
 *   until the discriminants were made required: `scan-shard.mjs` emitted it and
 *   `rank.mjs` counts it, but with the map typed `Record<string, unknown>` no
 *   reader could tell the field was missing from the contract
 * @property {string | null} [extractError]
 * @property {string} [error] the thrown message on a `read-failed` row, set by
 *   the shard's own pool rather than by `scanOne`
 * @property {string} [returnedTitle] set only on the `read-mismatch` status
 * @property {string[]} [extraPackages]
 * @property {number | null} [pattern]
 * @property {string} [nameSource]
 */

/**
 * The registry's answer for one package. `upstreamState` is required — every
 * path in `registry-shard.mjs` sets it, including both failure arms — and it is
 * what stops this row being interchangeable with the other three. See `ScanRow`.
 *
 * @typedef RegistryRow
 * @property {string} upstreamState
 * @property {string | null} [upstreamVersion]
 * @property {string | null} [releaseDate]
 * @property {string} [dateState]
 */

/**
 * Weekly downloads, produced by `downloads-batch.mjs` in a separate pass over
 * the merged cohort rather than per-shard. Split out of `RegistryRow` because
 * the two now come from different requests at different times, and conflating
 * "the registry answered" with "the downloads API answered" is what let a
 * throttled lookup score as genuine unpopularity.
 *
 * `downloadsState` is required for the same reason as the other discriminants
 * (see `ScanRow`), and `weeklyDownloads` is nullable because the producer
 * writes an explicit `null` whenever the API did not answer — the whole point
 * of splitting this row out was to stop "no answer" reading as "zero".
 *
 * @typedef DownloadsRow
 * @property {number | null} [weeklyDownloads]
 * @property {string} downloadsState
 */

/**
 * A note's observed schema fields, from `enumerate.mjs`. `fields` is required:
 * it is the row's entire payload, so an optional one left the type satisfied by
 * literally any object. See `ScanRow`.
 *
 * @typedef SchemaRow
 * @property {string[]} fields
 */

/**
 * One cohort member's verdict — the NDJSON row shape `rank.mjs` renders and
 * `ranked.ndjson` persists.
 *
 * Spelled out rather than left as `Record<string, unknown>` because the driver
 * reads ~40 of these properties: an untyped return moved every one of those
 * accesses to `unknown`, which is a cast at each site or nothing checked at all.
 *
 * @typedef ClassifiedRow
 * @property {string} id
 * @property {string} npmName
 * @property {string} action one of blocked/excluded/investigate + RESOLVED_ACTIONS
 * @property {string} reason
 * @property {string} distance
 * @property {string | null} documented the version the note records, if readable
 * @property {string} versionBasis `extracted` (the six-pattern extractor matched
 *   — see `versionPattern` for WHICH of the six) | the alt slot's name | `none`.
 *   Renamed from `canonical`, which was read as "from the `[version]`
 *   observation" and never meant that.
 * @property {number | null} versionPattern which of the six extraction patterns
 *   matched; `3` is the declared `[version]` observation, the rest are
 *   inferences. null when the value came from the alt slot or nothing matched.
 * @property {string | null} upstream
 * @property {string | null} releaseDate
 * @property {number | null} releaseAgeDays
 * @property {string | null} dateState
 * @property {string | null} downloadsState
 * @property {number | null} noteAgeDays
 * @property {number | null} weeklyDownloads
 * @property {string[]} gaps structural defects; non-empty moves current → modernize
 * @property {string[]} qualityFlags report-only, deliberately NOT in `gaps`
 * @property {string} fix
 * @property {boolean} slotUnreadable
 * @property {string[]} extraPackages
 * @property {boolean | null} versionRecoverableFromObservation
 * @property {number | null} pattern
 * @property {string | null} nameSource
 * @property {number | null} relationCount
 * @property {string[]} relationVerbsUnknown
 * @property {boolean} reachMeasured whether `weeklyDownloads` is an ANSWER from
 *   the downloads API rather than the absence of one
 * @property {string[]} missingInputs ordering inputs that could not be measured
 */

/**
 * Strip the decorations that stop a documented package identifier from being a
 * registry key: a leading `npm:` protocol prefix, and a trailing `@<version>`.
 *
 * The `> 0` guard is the whole subtlety — a scoped name BEGINS with `@`, so an
 * unguarded `lastIndexOf('@')` would turn `@lit-labs/signals` into the empty
 * string. Verified against the four real shapes that reached the registry
 * unnormalized: `fuse.js@7.1.0`, `npm:solid-js`, `flowbite@4.0.1`,
 * `npm:@lit-labs/signals`.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeNpmName (raw) {
  let s = String(raw ?? '').trim()
  if (s.startsWith('npm:')) s = s.slice(4)
  const at = s.lastIndexOf('@')
  if (at > 0) s = s.slice(0, at)
  return s
}

/**
 * Map a registry answer's state to an action, or `null` when the registry
 * answered normally and the caller should go on to compare versions.
 *
 * `default` rather than a list of known-bad states: an upstream state this build
 * does not recognise must be reported as blocked with the state named, never
 * fall through to a version comparison it cannot support.
 *
 * @param {string | undefined} state
 * @returns {{ action: string, reason: string } | null}
 */
function classifyUpstreamState (state) {
  switch (state) {
    case 'ok': return null
    case 'api-unavailable': return { action: 'blocked', reason: 'api-unavailable' }
    case 'not-in-registry': return { action: 'investigate', reason: 'not-in-registry' }
    case 'deprecated': return { action: 'archive', reason: 'deprecated-upstream' }
    default: return { action: 'blocked', reason: `unknown-upstream-state:${String(state)}` }
  }
}

/**
 * @param {string | null | undefined} iso
 * @param {Date} today
 * @returns {number | null}
 */
export function daysSince (iso, today) {
  if (!iso) return null
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return null
  // Clamp: a release timestamped later today in UTC yields -1, which is not a
  // meaningful age and must not be reported as one.
  return Math.max(0, Math.floor((today.getTime() - t.getTime()) / 86400000))
}

/**
 * The `| undefined` on each optional is required, not noise: `tsconfig` sets
 * `exactOptionalPropertyTypes`, so a caller that passes `scanRow: undefined`
 * explicitly — which `cohort.map(id => ...)` over a sparse Map always does —
 * would otherwise be rejected.
 *
 * @typedef ClassifyInput
 * @property {string} id
 * @property {ScanRow | undefined} [scanRow]
 * @property {RegistryRow | undefined} [registryRow]
 * @property {DownloadsRow | undefined} [downloadsRow]
 * @property {SchemaRow | undefined} [schemaRow]
 * @property {string | null | undefined} [censusDate] ISO date the note file was last touched
 * @property {Date} today
 */

/**
 * Assign one action class to a cohort member and score it.
 *
 * Exactly one action per note, and the classes are epistemically distinct rather
 * than ranked: `unmeasured` is not a milder `intel`, it is a different state.
 * Ranking "we could not read a version" alongside "a lookup proved this is
 * behind" is what put seven already-current notes above a breaking change in the
 * first full run.
 *
 * @param {ClassifyInput} input
 * @returns {ClassifiedRow}
 */
export function classifyRow (input) {
  const { censusDate, downloadsRow: d, id, registryRow: r, scanRow: s, schemaRow: sch, today } = input
  const scanned = !!s && s.status === 'ok'

  // Compliance is only meaningful for a note that was actually READ. Computed
  // unconditionally, a `not-found` row (which carries only `{id, status}`)
  // yields `undefined !== 'string-array'` and is recorded as having a malformed
  // packages field and a malformed title — fabricated defects on a note that
  // does not exist.
  const missingSections = scanned ? (s.missingSections ?? []) : []
  const badPackages = scanned ? s.packagesShape !== 'string-array' : false
  const badTitle = scanned ? s.titleForm !== 'hyphen' : false
  const noVersionSlot = scanned ? !s.hasVersionObs : false
  const noRelations = scanned ? s.relationCount === 0 : false

  // Cross-check: schema-validate says a `version` field exists, yet the repo's
  // extractor read nothing from the body. The slot is present but malformed —
  // typically a narrative sentence where a bare version token belongs. This is
  // NOT an extractor defect: the schema asks for a clean leading token, so the
  // note is what is out of contract.
  const schemaHasVersion = (sch?.fields ?? []).includes('version')
  const slotUnreadable = !!(schemaHasVersion && scanned && s.version == null)

  // Compliance is reported, never ordered on. Under the old sum it carried a
  // deliberately LOW capped weight so that tidiness could not outrank a
  // confirmed breaking change; in a lexicographic key there is no "low" — any
  // level above the id tie-break is strictly decisive — so the conservative
  // reading of that cap is to leave it out of the key entirely. `gaps` still
  // decides `current` vs `modernize`, which is where it was always load-bearing.

  // Every label that can contain a `[` is backtick-wrapped at the point of
  // construction. That is the whole escaping contract for table cells: inside a
  // code span `[` is literal, so nothing downstream needs to escape it — and
  // escaping it there would render a visible backslash.
  const gaps = [
    missingSections.length ? `${missingSections.length} missing §` : null,
    slotUnreadable ? '`[version]` unreadable' : (noVersionSlot ? 'no `[version]`' : null),
    scanned && s.altVersionSource && !s.version ? `version in \`${s.altVersionSource}\`` : null,
    badPackages ? `packages: \`${String(s?.packagesShape)}\`` : null,
    // The lookup succeeded because scan-shard normalized the name, but the note
    // still records a name npm would reject. Reporting it is the whole point —
    // repairing it silently every sweep would hide the defect forever.
    scanned && s.npmNameRaw ? `packages: \`${String(s.npmNameRaw)}\`` : null,
    badTitle ? `title: \`${String(s?.titleForm)}\`` : null,
    noRelations && !missingSections.includes('Relations') ? 'no relations' : null,
  ].flatMap(v => (v === null ? [] : [v]))

  // Deliberately NOT part of `gaps`. A non-empty `gaps` moves a note from
  // `current` to `modernize`, and the fourth-wall detector's false-positive
  // rate over a full cohort is unmeasured — it must not change an action class.
  const qualityFlags = scanned ? (s.fourthWall ?? []) : []

  // `extracted`, NOT `canonical`. The old name was read — including by this
  // pipeline's own verifier — as "came from the note's `[version]` observation",
  // and it never meant that: it means only that the six-pattern extractor
  // produced a value, from ANY of its six sources. 4 of the 12 top rows in the
  // 2026-08-06 report had no `[version]` observation at all yet rendered
  // unmarked, and `npm-uuid`'s version was read off a narrative Release
  // Highlights passage. Which pattern actually matched now travels alongside, in
  // `versionPattern`, so a reader can tell a declared version from an inferred
  // one instead of inferring provenance from a word that does not carry it.
  const extracted = scanned && s.version ? String(s.version) : null
  const alt = scanned && s.altVersion ? String(s.altVersion) : null
  const bm = extracted ?? alt
  const versionBasis = extracted ? 'extracted' : (alt ? String(s?.altVersionSource) : 'none')
  // Pattern 3 is the `[version]` / `[version-range]` observation — the only
  // source the note author DECLARED as the version. 1/2/4/5/6 are all inferences
  // from somewhere else in the document, and 5 (a prose release reel) is the
  // weakest. null when no pattern matched or the value came from the alt slot.
  const versionPattern = extracted && typeof s?.pattern === 'number' ? s.pattern : null
  const up = r?.upstreamVersion ? String(r.upstreamVersion) : null
  const releaseAgeDays = daysSince(r?.releaseDate ?? null, today)
  const noteAgeDays = daysSince(censusDate ?? null, today)
  const weeklyDownloads = typeof d?.weeklyDownloads === 'number' ? d.weeklyDownloads : null
  // Keyed on the STATE, not on the number being non-null. The two agree today —
  // `downloads-batch.mjs` writes a count only alongside `ok` — but the state is
  // the epistemic claim ("the API answered"), and it is the claim the sort key
  // needs. Deriving reach-measured from the number instead would put the
  // decision back in the hands of the field that goes empty under a throttle,
  // which is exactly how 462 rate-limited rows scored as genuinely unpopular.
  const reachMeasured = d?.downloadsState === 'ok' && weeklyDownloads != null

  const upstreamVerdict = r ? classifyUpstreamState(r.upstreamState) : null

  // Annotated, not inferred: these two ARE the classification, and left
  // undeclared they were implicit `any` — 29 of the file's unchecked
  // expressions, in the one place a wrong string matters most.
  /** @type {string} */
  let action
  /** @type {string} */
  let reason
  let distance = ''

  if (!s) {
    action = 'blocked'; reason = 'not-scanned'
  } else if (s.status !== 'ok') {
    action = 'blocked'; reason = String(s.status)
  } else if (!s.npmName) {
    action = 'blocked'; reason = 'no-package-name'
  } else if (/^@types\//.test(String(s.npmName))) {
    // A @types/* note tracks its target's version by design; a gap is not drift.
    action = 'excluded'; reason = 'types-package'
  } else if (s.isRange) {
    action = 'excluded'; reason = 'range-pinned'
  } else if (!r) {
    action = 'blocked'; reason = 'not-resolved'
  } else if (upstreamVerdict) {
    action = upstreamVerdict.action; reason = upstreamVerdict.reason
  } else if (bm == null || parseVersionParts(bm) == null) {
    // Drift was NOT measured. Never ranked against confirmed drift.
    //
    // The second clause is the fall-through this sweep shipped: a non-empty but
    // unparseable version (`0.x`, `1.x`, `2026.x` — the only strings that reach
    // here, since the extractor already returns null for `n/a`, `unknown`,
    // `latest`, `^1.2.0`, `~2.0`) fell past every comparison to the
    // unconditional `else` and was filed as CONFIRMED drift with a
    // `/intel` fix. Live instance: npm-@atjson-document, documented `0.x`, at
    // rank #77 of the 2026-08-05 run.
    action = 'unmeasured'
    if (bm == null) {
      reason = slotUnreadable
        ? 'version-slot-malformed'
        : (s.versionRecoverableFromObservation ? 'version-in-wrong-slot' : 'no-version-recorded')
    } else {
      reason = 'version-unparseable'
    }
    distance = 'unmeasured'
  } else if (up == null) {
    action = 'blocked'; reason = 'no-upstream-version'
  } else if (parseVersionParts(up) == null) {
    // Symmetric to the guard above, and `blocked` rather than `unmeasured`
    // because the defect is in the registry answer, not in the note — nothing
    // an edit to this note could fix.
    action = 'blocked'; reason = 'upstream-unparseable'
  } else if (versionsEquivalent(bm, up) === true) {
    // Semantic equality, not string equality: `1.2` and `1.2.0` are the same
    // release, and `1.2.3+build.9` differs only by ignorable metadata. Comparing
    // with `===` reports both as drift that does not exist.
    action = gaps.length ? 'modernize' : 'current'
    reason = gaps.length ? 'current-but-noncompliant' : 'current'
    distance = 'none'
  } else if (isAheadOfRegistry(bm, up) || (isCalVer(bm) && isCalVer(up) && compareVersionParts(bm, up) === 1)) {
    // The second clause covers the CalVer axis `isAheadOfRegistry` refuses by
    // design: a note on `2026.4.1` against an upstream `2026.3.9` is ahead, and
    // without this would be reported as confirmed drift.
    action = 'ahead'; reason = 'ahead-of-registry'; distance = 'ahead'
  } else {
    action = 'intel'
    reason = extracted ? 'drifted' : 'drifted-off-slot'
    distance = classifyVersionDistance(bm, up)
  }

  const isIntel = action === 'intel'
  const isUnmeasured = action === 'unmeasured'

  // Which of THIS row's ordering inputs the sweep failed to measure. The
  // predecessor of this field was `imputedZeros` — "which score components are
  // 0 for want of data" — and that description died with the sum: a missing
  // reach is no longer imputed to 0 and ranked as unpopular, it sorts last
  // within its drift class. Renamed rather than kept, because a field whose name
  // describes a mechanism the code no longer has is this pipeline's most
  // reliable way of shipping a wrong claim.
  //
  // `releaseAgeDays` is absent here on purpose: it is displayed, never ordered
  // on, and `summary.json`'s `intelWithoutReleaseDate` already counts it.
  const missingInputs = [
    ((isIntel || isUnmeasured) && noteAgeDays == null) ? 'noteAge' : null,
    (isIntel && !reachMeasured) ? 'reach' : null,
  ].flatMap(v => (v === null ? [] : [v]))

  // Derived from the gap set, not from the action class. A `modernize` row is
  // reached because SOME gap is non-empty — telling every such row to add a
  // `[version]` observation instructs a no-op on a note that already has one
  // and buries the real remediation.
  let fix = ''
  if (isIntel) {
    fix = `\`/intel npm:${String(s?.npmName)}\``
  } else if (isUnmeasured) {
    // Four different remediations, not four severities: research it, repair a
    // malformed line, repair an unparseable token, or copy a version the note
    // already contains elsewhere. Only the first costs an /intel run.
    switch (reason) {
      case 'no-version-recorded':
        fix = `\`/intel npm:${String(s?.npmName)}\``
        break
      case 'version-slot-malformed':
        fix = 'repair the existing `[version]` line to a bare version token'
        break
      case 'version-unparseable':
        fix = `replace the recorded \`${String(bm)}\` with a bare \`MAJOR.MINOR[.PATCH]\` token`
        break
      default:
        fix = `install \`- [version] <x>\` from the note’s \`[${String(s?.versionBearingCategory ?? 'version-history')}]\` line`
    }
  } else if (action === 'modernize') {
    if (noVersionSlot) fix = `add \`- [version] ${String(up)}\``
    else if (missingSections.length) fix = `add missing section(s): ${missingSections.join(', ')}`
    else if (badPackages) fix = 'fix `packages` frontmatter to a single-name string array'
    else if (scanned && s.npmNameRaw) fix = `set \`packages: ["${String(s.npmName)}"]\` — the recorded \`${String(s.npmNameRaw)}\` is not a package name npm accepts`
    else if (badTitle) fix = 'rename to the `npm-<name>` title form'
    else fix = 'add relations'
  } else if (action === 'blocked' && reason === 'no-package-name') {
    fix = 'add `packages: ["<name>"]` to frontmatter'
  }

  return {
    id,
    npmName: scanned ? String(s.npmName) : '',
    action,
    reason,
    distance,
    documented: bm,
    versionBasis,
    versionPattern,
    upstream: up,
    releaseDate: r?.releaseDate ?? null,
    releaseAgeDays,
    dateState: r?.dateState ?? null,
    // `null` here means the downloads step produced no row for this note at
    // all — reported as its own state rather than folded into "0 downloads".
    downloadsState: d?.downloadsState ?? null,
    noteAgeDays,
    weeklyDownloads,
    gaps,
    qualityFlags,
    fix,
    slotUnreadable,
    extraPackages: scanned ? (s.extraPackages ?? []) : [],
    // `?? null` on each, not just the ternary: these are OPTIONAL ScanRow
    // properties, so a scanned row that simply omits one yields `undefined`,
    // which is not the same as "we read the note and there was nothing there".
    // NDJSON has no `undefined` — it would drop the key entirely.
    versionRecoverableFromObservation: scanned ? (s.versionRecoverableFromObservation ?? null) : null,
    pattern: scanned ? (s.pattern ?? null) : null,
    nameSource: scanned ? (s.nameSource ?? null) : null,
    relationCount: scanned ? (s.relationCount ?? null) : null,
    // Report-only, like qualityFlags: it never enters `gaps`, so it cannot move
    // a note between action classes.
    relationVerbsUnknown: scanned ? (s.relationVerbsUnknown ?? []) : [],
    reachMeasured,
    missingInputs,
  }
}

/**
 * Exactly the fields the ordering reads — a narrower view than `ClassifiedRow`,
 * which satisfies it structurally.
 *
 * Declared separately for two reasons: it makes the comparator's real
 * dependencies visible at a glance (compliance, release age and every other
 * displayed field are absent, and that absence is the design), and it lets
 * `scripts/check-npm-triage.mjs` exercise the ordering with seven-field fixtures
 * instead of fabricating twenty-odd unrelated properties per row.
 *
 * @typedef OrderableRow
 * @property {string} id
 * @property {string} action
 * @property {string} reason
 * @property {string} distance
 * @property {boolean} reachMeasured
 * @property {number | null} weeklyDownloads
 * @property {number | null} noteAgeDays
 */

/**
 * @param {string} action
 * @returns {number}
 */
function actionRank (action) {
  // `?? Number.MAX_SAFE_INTEGER`, not `?? 0`: an action this build does not know
  // about must land at the BOTTOM of the file, never silently at the top of a
  // triage list. Same open-vs-closed discipline as `classifyUpstreamState`'s
  // `default` arm.
  return ACTION_ORDER[action] ?? Number.MAX_SAFE_INTEGER
}

/**
 * Compare two rows on the ordering inputs shared by both ranked tables:
 * measured reach first (descending), then note age (oldest first), then id.
 *
 * `useReach` is a parameter rather than a branch inside, because the two tables
 * genuinely differ: reach decides priority among CONFIRMED drift, while the
 * `unmeasured` table is a worklist whose per-row cost is uniform.
 *
 * @param {OrderableRow} a
 * @param {OrderableRow} b
 * @param {boolean} useReach
 * @returns {number}
 */
function compareTail (a, b, useReach) {
  if (useReach) {
    // A row whose reach was never measured sorts AFTER every measured row in
    // its class — it is not a low value, and treating it as one is precisely
    // the defect this key replaces. It is never promoted above a measured row
    // either; both directions of that mistake are available and both are wrong.
    if (a.reachMeasured !== b.reachMeasured) return a.reachMeasured ? -1 : 1
    if (a.reachMeasured && a.weeklyDownloads !== b.weeklyDownloads) {
      return (b.weeklyDownloads ?? 0) - (a.weeklyDownloads ?? 0)
    }
  }
  const an = a.noteAgeDays
  const bn = b.noteAgeDays
  if ((an == null) !== (bn == null)) return an == null ? 1 : -1
  if (an != null && bn != null && an !== bn) return bn - an
  return String(a.id).localeCompare(String(b.id))
}

/**
 * The whole ordering, as one comparator: **lexicographic, not weighted**.
 *
 * Each level is decisive — nothing below it can compensate. That is the point.
 * The sum it replaces let a `patch` bump on an old, popular, untidy note reach
 * the same total as a confirmed `semver-major`, and a lookup lost to HTTP 429
 * contribute the same 0 as a genuinely unused package. Neither is expressible
 * here: a drift class cannot be bought back, and an unmeasured reach is a
 * distinct branch rather than a zero.
 *
 * Levels, in order:
 *   1. action class (`ACTION_ORDER`) — so `ranked.ndjson` groups by what to do
 *   2. `intel` only: drift class (`DRIFT_ORDER`)
 *      `unmeasured` only: remediation class (`UNMEASURED_ORDER`)
 *   3. `intel` only: measured weekly downloads, descending; unmeasured last
 *   4. note age, oldest first; unknown last
 *   5. id, so the whole order is total and stable across runs
 *
 * @param {OrderableRow} a
 * @param {OrderableRow} b
 * @returns {number}
 */
export function compareRows (a, b) {
  const byAction = actionRank(a.action) - actionRank(b.action)
  if (byAction !== 0) return byAction

  if (a.action === 'intel') {
    const byDrift = (DRIFT_ORDER[a.distance] ?? Number.MAX_SAFE_INTEGER) -
      (DRIFT_ORDER[b.distance] ?? Number.MAX_SAFE_INTEGER)
    if (byDrift !== 0) return byDrift
    return compareTail(a, b, true)
  }
  if (a.action === 'unmeasured') {
    const byFix = (UNMEASURED_ORDER[a.reason] ?? Number.MAX_SAFE_INTEGER) -
      (UNMEASURED_ORDER[b.reason] ?? Number.MAX_SAFE_INTEGER)
    if (byFix !== 0) return byFix
    return compareTail(a, b, false)
  }
  // Every other class is rendered id-sorted by its own table; this only keeps
  // `ranked.ndjson` deterministic.
  return String(a.id).localeCompare(String(b.id))
}

/**
 * The share of download-eligible rows that must carry a real count.
 *
 * A LITERAL, and the check is a rate rather than a `downloadsFilePresent`
 * boolean, because presence is not the failure mode: on 2026-08-05 the file
 * existed, parsed cleanly, and 462 of the 512 ELIGIBLE rows were empty — a
 * 9.8% success rate (50 of 512) that the run reported as a clean pass. A
 * presence check would have been the fourth check in this pipeline's history
 * that could not fail.
 *
 * 512, not 578: the cohort was 578, but eligibility comes from the registry
 * answering (510 `ok` + 2 `deprecated`), and that is this check's denominator.
 */
export const MIN_DOWNLOADS_OK_RATE = 0.9

/**
 * The share of cohort members that must appear in the census with a well-formed
 * date before its ages are trusted for ordering.
 *
 * A LITERAL, and sized against the real file rather than guessed: the
 * 2026-08-04 census matched 575 of 578 (0.9948). A systematic break — the wrong
 * date format, a census from a different ecosystem, a truncated write — lands
 * near 0, so 0.95 separates the two cleanly while tolerating the handful of
 * notes genuinely absent from any given capture.
 */
export const MIN_CENSUS_MATCH_RATE = 0.95

/**
 * @typedef GateInput
 * @property {string[]} cohort
 * @property {{ action?: unknown, reason?: unknown, distance?: unknown }[]} rows
 * @property {Map<string, ScanRow>} scan
 * @property {Map<string, RegistryRow>} registry
 * @property {boolean} scanFilePresent
 * @property {boolean} registryFilePresent
 * @property {number} malformedLines
 * @property {boolean | null} scanReconciled
 * @property {number} downloadsEligible rows the registry answered for, so a
 *   count was worth asking about. Comes from the REGISTRY step, which a
 *   downloads outage cannot shrink.
 * @property {number} downloadsOk of those, how many carry a real count
 * @property {boolean} artefactsFromThisRun whether `enumerate.json`'s stamped
 *   run date matches the date this rank step was invoked with
 * @property {number | null} expectedTotal unique identifiers BM enumerated, from
 *   `enumerate.json` — produced before sharding, so neither a note-read failure
 *   nor a registry outage can move it. `null` when that file is absent or
 *   unparseable, which is itself a gate failure rather than a pass.
 * @property {boolean} censusSupplied whether a census FILE was given and exists.
 *   Not `censusRows > 0`: a wholesale format break parses to zero rows, so
 *   deriving this from the parse result would excuse the exact failure the
 *   check exists to catch.
 * @property {number} censusMatched cohort members found in the census with a
 *   well-formed date
 */

/**
 * Build the completeness gate: named sub-checks reported individually.
 *
 * The rule every check here must satisfy, learned from three that could not
 * fail: **compare a measured count against a literal constant, or against a
 * value from a source the failure itself cannot touch.** A check that
 * quantifies over a set (`[].every()` is `true`) or compares two values both
 * derived from `cohort` is decoration. This pipeline has exactly two
 * failure-independent sources — the literal `0`, and `enumerate.json`.
 *
 * @param {GateInput} input
 * @returns {Record<string, boolean>}
 */
export function buildGate (input) {
  const { cohort, downloadsEligible, downloadsOk, expectedTotal, malformedLines, registry, rows, scan, scanReconciled } = input
  const namedRows = [...scan.values()].filter(r => r.status === 'ok' && r.npmName)

  return {
    cohortNonEmpty: cohort.length > 0,
    cohortUnique: new Set(cohort).size === cohort.length,
    scanFilePresent: input.scanFilePresent,
    registryFilePresent: input.registryFilePresent,
    inputsParsed: malformedLines === 0,
    scanCoversCohort: cohort.every(id => scan.has(id)),
    // ⚠️ Vacuous on its own: a total scan failure empties `namedRows`, and
    // `[].every()` is `true`. Kept because it still catches a real hole this
    // gate has no other witness for — scan fine, one registry shard dead — and
    // because `resolvedSomeNote` below is what actually closes the wholesale
    // case. Do not read a green here as evidence the scan worked.
    registryCoversNamed: namedRows.every(r => registry.has(String(r.id))),
    // The substance floor, and the only check with no denominator: the
    // reference is the literal 0. Every action in RESOLVED_ACTIONS requires a
    // successful note read, and five of the six additionally require an `ok`
    // registry answer — so one such row proves the pipeline completed end to
    // end at least once. `archive` is the exception: it comes from
    // `upstreamState === 'deprecated'`, which is decided before the version
    // branches. That is still a real answer no outage can synthesize (an
    // unreachable registry yields `api-unavailable`, never `deprecated`), so
    // it belongs in the set — but the claim is "the registry answered", not
    // "the registry answered ok".
    //
    // `unmeasured` is deliberately included too: reaching it needs an `ok`
    // answer, so no outage can fake it, while a small cohort where every note
    // simply lacks a version slot is a finding about the data, not a broken
    // run. A floor that cries wolf gets commented out.
    resolvedSomeNote: rows.some(r => isResolvedAction(r.action)),
    // Replaces `partitioned`, which compared `rows.length` to `cohort.length`
    // after building `rows` by mapping over `cohort`. The denominator now comes
    // from enumeration. One-directional by design: `limit` truncates cohort.txt
    // *after* enumerate.json is written, so a smaller cohort is legitimate and
    // only a LARGER one (a stale cohort.txt from a previous, bigger sweep)
    // fails here.
    cohortWithinEnumeration: expectedTotal != null && expectedTotal > 0 &&
      cohort.length > 0 && cohort.length <= expectedTotal,
    // Reach is level 3 of the intel sort key, so losing it wholesale does not
    // blank the report — it collapses that level and hands the ordering to note
    // age, which is worse than a visible gap. (Under the weighted sum it was
    // worse still: an unmeasured reach scored 0 and read as unpopularity. The
    // key no longer does that, but a run measuring 9.8% of its cohort is still
    // not one to act on.) The denominator is the registry's answer count, which
    // no downloads failure can shrink into agreement.
    downloadsMeasured: downloadsEligible > 0 &&
      (downloadsOk / downloadsEligible) >= MIN_DOWNLOADS_OK_RATE,
    // The other direction `cohortWithinEnumeration` cannot see: artefacts left
    // by an OLDER, smaller sweep. Both dates are argv-supplied, so a run whose
    // enumeration step failed and left last week's cohort.txt in place fails
    // here instead of producing a coherent report about the wrong data.
    artefactsFromThisRun: input.artefactsFromThisRun,
    // null (no enumerate.json) is not a failure; false is.
    enumerationReconciled: scanReconciled !== false,
    // Note age is level 4 of the intel key and the sole tie-break above `id`,
    // and it was the one ordering input with no gate check at all. A census in
    // the wrong date format is the failure that matters: `new Date()` parses
    // `05/08/2026` as May 8, so wrong ages reach the sort while every coverage
    // counter stays green.
    //
    // NOT supplying a census is legitimate (the run then reports no ages), so
    // the check passes on `!censusSupplied` — and `censusSupplied` is the file's
    // existence, never the parsed row count, because a wholesale format break
    // parses to zero. The denominator is `cohort.length`, one of the two sources
    // a census failure cannot touch.
    //
    // 0.95 is sized against real data, not guessed: the 2026-08-04 census
    // matched 575 of 578 (0.9948), so the floor tolerates a handful of
    // genuinely-absent notes while any systematic break lands near 0.
    censusUsable: !input.censusSupplied ||
      (cohort.length > 0 && (input.censusMatched / cohort.length) >= MIN_CENSUS_MATCH_RATE),
    // ── Do the three ORDER maps actually cover the data that arrived? ────────
    //
    // Each compares a set produced by the CLASSIFIER against a set written by
    // hand, so neither side can drift into agreement with the other. A tenth
    // action, a fifth drift class, or a new unmeasured reason currently reaches
    // a reader as a silently-unranked row — or, for an action, as a count line
    // with no table at all — while every total still reconciles. That is why no
    // other check sees it: nothing is missing, it is merely unrankable.
    //
    // This was a deferred item with the revival trigger "adding any action or
    // reason class". Adding `upstream-prerelease` fired it, so it ships here
    // rather than staying deferred: without these three, the 4 flagged
    // prerelease rows could vanish from the report while the histogram still
    // summed to the cohort size.
    actionsRendered: [...new Set(rows.map(r => String(r.action)))].every(
      a => /** @type {readonly string[]} */ (RENDERED_ACTIONS).includes(a) ||
      /** @type {readonly string[]} */ (ACTIONS_WITHOUT_TABLE).includes(a)
    ),
    driftClassesRanked: rows
      .filter(r => r.action === 'intel')
      .every(r => Object.hasOwn(DRIFT_ORDER, String(r.distance))),
    unmeasuredReasonsRanked: rows
      .filter(r => r.action === 'unmeasured')
      .every(r => Object.hasOwn(UNMEASURED_ORDER, String(r.reason))),
  }
}
