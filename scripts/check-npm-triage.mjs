/**
 * Fixture self-test for the npm staleness sweep's decision logic
 * (`lib/npm-triage.mjs`). Wired into `npm run check` as `check:npm-triage`.
 *
 * This exists because the sweep has shipped three completeness checks that could
 * not fail, each surviving review because the only way to exercise the logic was
 * a 21-minute live run over 578 notes. A FOURTH was then written in this file —
 * see the DRIFT_ORDER block below — and only plant-and-revert found it, so the
 * rule applies to the guards as much as to the code they guard. This file
 * therefore does something
 * unusual: it PINS THE DEFECTS. Each `DEFECT:` case asserts the wrong answer the
 * code currently gives, so the remediation commit has to flip a failing
 * assertion rather than quietly change behaviour nobody was watching.
 *
 * When a `DEFECT:` case starts failing, that is the fix landing. Flip it. All
 * five originally pinned here have now been flipped; the convention stays
 * documented because the next one will be found the same way.
 */

import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  buildGate, classifyRow, compareRows, daysSince, DRIFT_ORDER, normalizeNpmName,
} from '../lib/npm-triage.mjs'

const { checkEqual: check, done } = createCheckHarness()

const TODAY = new Date('2026-08-05T00:00:00Z')

/**
 * @param {Partial<import('../lib/npm-triage.mjs').ScanRow>} [scanRow]
 * @param {Partial<import('../lib/npm-triage.mjs').RegistryRow>} [registryRow]
 * @param {{ schemaRow?: import('../lib/npm-triage.mjs').SchemaRow, censusDate?: string | null }} [extra]
 * @returns {Record<string, unknown>} the classified row
 */
function row (scanRow, registryRow, extra) {
  return classifyRow({
    id: 'npm-fixture',
    scanRow: scanRow ? { id: 'npm-fixture', status: 'ok', packagesShape: 'string-array', titleForm: 'hyphen', hasVersionObs: true, relationCount: 3, missingSections: [], ...scanRow } : undefined,
    registryRow: registryRow ? { upstreamState: 'ok', ...registryRow } : undefined,
    schemaRow: extra?.schemaRow,
    censusDate: extra?.censusDate ?? null,
    today: TODAY,
  })
}

// --- normalizeNpmName: the four shapes that reached the registry unnormalized ---
check('strips a trailing @version', normalizeNpmName('fuse.js@7.1.0'), 'fuse.js')
check('strips a leading npm: prefix', normalizeNpmName('npm:solid-js'), 'solid-js')
check('strips both at once', normalizeNpmName('npm:flowbite@4.0.1'), 'flowbite')
check('a scoped name is left intact — the leading @ is not a version separator',
  normalizeNpmName('npm:@lit-labs/signals'), '@lit-labs/signals')
check('a bare scoped name is untouched', normalizeNpmName('@types/node'), '@types/node')
check('a scoped name WITH a version keeps its scope', normalizeNpmName('@scope/pkg@1.2.3'), '@scope/pkg')
check('a plain name is untouched', normalizeNpmName('fastify'), 'fastify')

// --- daysSince: the clamp that stops a same-day release reporting -1 ---
check('a release later today clamps to 0', daysSince('2026-08-05T23:00:00Z', TODAY), 0)
check('a release 10 days ago', daysSince('2026-07-26T00:00:00Z', TODAY), 10)
check('null input → null', daysSince(null, TODAY), null)
check('unparseable input → null', daysSince('not-a-date', TODAY), null)

// --- classifyRow: one action per note, and the classes are distinct STATES ---
check('a missing scan row → blocked/not-scanned', row(undefined, { upstreamVersion: '1.0.0' }).reason, 'not-scanned')
check('a failed read → blocked', row({ status: 'read-failed' }, { upstreamVersion: '1.0.0' }).action, 'blocked')
check('no recoverable package name → blocked/no-package-name',
  row({ npmName: '' }, { upstreamVersion: '1.0.0' }).reason, 'no-package-name')
check('a @types/* note is excluded, not drifted — it tracks its target by design',
  row({ npmName: '@types/node', version: '20.0.0' }, { upstreamVersion: '22.0.0' }).action, 'excluded')
check('a range-pinned note is excluded',
  row({ npmName: 'x', version: '1.0.0', isRange: true }, { upstreamVersion: '2.0.0' }).reason, 'range-pinned')
check('a registry outage → blocked, never a drift verdict',
  row({ npmName: 'x', version: '1.0.0' }, { upstreamState: 'api-unavailable' }).action, 'blocked')
check('an unrecognised upstream state is closed off, not passed through',
  row({ npmName: 'x', version: '1.0.0' }, { upstreamState: 'something-new' }).action, 'blocked')
check('deprecated upstream → archive', row({ npmName: 'x', version: '1.0.0' }, { upstreamState: 'deprecated', upstreamVersion: '1.0.0' }).action, 'archive')
check('absent from the registry → investigate',
  row({ npmName: 'x', version: '1.0.0' }, { upstreamState: 'not-in-registry' }).action, 'investigate')

check('no readable version → unmeasured, NOT a mild intel',
  row({ npmName: 'x' }, { upstreamVersion: '2.0.0' }).action, 'unmeasured')
check('unmeasured with nothing recoverable → no-version-recorded',
  row({ npmName: 'x' }, { upstreamVersion: '2.0.0' }).reason, 'no-version-recorded')
check('unmeasured but recoverable from an observation → version-in-wrong-slot',
  row({ npmName: 'x', versionRecoverableFromObservation: true }, { upstreamVersion: '2.0.0' }).reason, 'version-in-wrong-slot')
check('schema says a version field exists but the body read nothing → version-slot-malformed',
  row({ npmName: 'x' }, { upstreamVersion: '2.0.0' }, { schemaRow: { fields: ['version'] } }).reason, 'version-slot-malformed')

check('same version, no gaps → current',
  row({ npmName: 'x', version: '1.2.3' }, { upstreamVersion: '1.2.3' }).action, 'current')
check('semantically equal versions are NOT drift (1.2 === 1.2.0)',
  row({ npmName: 'x', version: '1.2' }, { upstreamVersion: '1.2.0' }).action, 'current')
check('same version but structurally incomplete → modernize, a slot fix not research',
  row({ npmName: 'x', version: '1.2.3', missingSections: ['Security'] }, { upstreamVersion: '1.2.3' }).action, 'modernize')
check('note ahead of the registry → ahead, never confirmed drift',
  row({ npmName: 'x', version: '2.0.0' }, { upstreamVersion: '1.9.0' }).action, 'ahead')
check('a CalVer note ahead of a CalVer registry is also ahead',
  row({ npmName: 'x', version: '2026.4.1' }, { upstreamVersion: '2026.3.9' }).action, 'ahead')
check('a real major gap → intel', row({ npmName: 'x', version: '1.0.0' }, { upstreamVersion: '2.0.0' }).action, 'intel')
check('and it carries the distance', row({ npmName: 'x', version: '1.0.0' }, { upstreamVersion: '2.0.0' }).distance, 'semver-major')

// The fall-through this sweep shipped: an unparseable-but-non-empty version
// reached the unconditional `else` and was filed as CONFIRMED drift. The live
// instance was npm-@atjson-document, documented `0.x`, at rank #77.
check('a `<digits>.x` version is unmeasured, not confirmed drift',
  row({ npmName: 'x', version: '0.x' }, { upstreamVersion: '0.31.0' }).action, 'unmeasured')
check('...with a reason naming the actual defect',
  row({ npmName: 'x', version: '0.x' }, { upstreamVersion: '0.31.0' }).reason, 'version-unparseable')
check('...and a fix that repairs the token rather than commissioning research',
  row({ npmName: 'x', version: '0.x' }, { upstreamVersion: '0.31.0' }).fix,
  'replace the recorded `0.x` with a bare `MAJOR.MINOR[.PATCH]` token')
check('a `<year>.x` CalVer-shaped stub routes the same way',
  row({ npmName: 'x', version: '2026.x' }, { upstreamVersion: '2026.3.9' }).action, 'unmeasured')
// The guard must not widen past the class that needs it. These parse, so they
// stay measurable — including the scheme-mismatch pair, which is genuine
// confirmed drift whose MAGNITUDE is merely unclassifiable.
check('a two-part version still measures', row({ npmName: 'x', version: '1.2' }, { upstreamVersion: '3.0.0' }).action, 'intel')
check('incomparable schemes are still confirmed drift, not unmeasured',
  row({ npmName: 'x', version: '3.6.1' }, { upstreamVersion: '2026.3.311859' }).action, 'intel')
check('...carrying distance-unknown, the one population left in that bucket',
  row({ npmName: 'x', version: '3.6.1' }, { upstreamVersion: '2026.3.311859' }).distance, 'distance-unknown')
// An unparseable UPSTREAM answer is the registry's defect, not the note's, so
// it blocks rather than asking anyone to edit the note.
check('an unparseable upstream version blocks',
  row({ npmName: 'x', version: '1.0.0' }, { upstreamVersion: 'latest' }).action, 'blocked')
check('...naming the registry as the source of the problem',
  row({ npmName: 'x', version: '1.0.0' }, { upstreamVersion: 'latest' }).reason, 'upstream-unparseable')
// By contrast these route via the extractor, which returns null for them, so
// they never reach the classifier with a value at all.
check('an empty version routes to unmeasured', row({ npmName: 'x', version: '' }, { upstreamVersion: '1.0.0' }).action, 'unmeasured')
check('...and keeps the no-version reason, not the unparseable one',
  row({ npmName: 'x', version: '' }, { upstreamVersion: '1.0.0' }).reason, 'no-version-recorded')

// --- A name the scan had to repair is REPORTED, not silently fixed ---
check('a normalized name still resolves against the registry',
  row({ npmName: 'solid-js', npmNameRaw: 'npm:solid-js', version: '1.9.0' }, { upstreamVersion: '1.9.0' }).action, 'modernize')
check('...and the note\'s own recorded form is named in the gaps',
  /** @type {string[]} */ (row({ npmName: 'solid-js', npmNameRaw: 'npm:solid-js', version: '1.9.0' }, { upstreamVersion: '1.9.0' }).gaps).includes('packages: `npm:solid-js`'), true)
check('...with a fix that repairs the frontmatter',
  row({ npmName: 'solid-js', npmNameRaw: 'npm:solid-js', version: '1.9.0' }, { upstreamVersion: '1.9.0' }).fix,
  'set `packages: ["solid-js"]` — the recorded `npm:solid-js` is not a package name npm accepts')
check('a clean name adds no gap', row({ npmName: 'solid-js', version: '1.9.0' }, { upstreamVersion: '1.9.0' }).action, 'current')

// --- Relation-verb vocabulary is REPORT-ONLY: it must not move an action class ---
check('an undeclared relation verb is carried through',
  /** @type {string[]} */ (row({ npmName: 'x', version: '1.0.0', relationVerbsUnknown: ['forked_from'] }, { upstreamVersion: '1.0.0' }).relationVerbsUnknown)[0], 'forked_from')
check('...but the note stays current, not modernize',
  row({ npmName: 'x', version: '1.0.0', relationVerbsUnknown: ['forked_from'] }, { upstreamVersion: '1.0.0' }).action, 'current')
check('...and it never enters the gap set',
  /** @type {string[]} */ (row({ npmName: 'x', version: '1.0.0', relationVerbsUnknown: ['forked_from'] }, { upstreamVersion: '1.0.0' }).gaps).length, 0)
check('an unread note is not credited with vocabulary findings',
  /** @type {string[]} */ (row({ status: 'read-failed', relationVerbsUnknown: ['forked_from'] }, { upstreamVersion: '1.0.0' }).relationVerbsUnknown).length, 0)

// --- Compliance is only computed for a note that was READ ---
check('an unread note is not credited with fabricated defects',
  /** @type {string[]} */ (row({ status: 'read-failed' }, { upstreamVersion: '1.0.0' }).gaps).length, 0)

// --- buildGate ---------------------------------------------------------------
/**
 * `expectedTotal` defaults to the cohort size so the healthy path passes, but is
 * overridable — it is the gate's only failure-independent denominator, so the
 * cases that matter set it apart from `cohort`.
 *
 * @param {{ cohort?: string[], rows?: Record<string, unknown>[], scan?: Map<string, import('../lib/npm-triage.mjs').ScanRow>, registry?: Map<string, import('../lib/npm-triage.mjs').RegistryRow>, expectedTotal?: number | null, artefactsFromThisRun?: boolean, downloadsEligible?: number, downloadsOk?: number, censusSupplied?: boolean, censusMatched?: number }} [o]
 * @returns {Record<string, boolean>} the named sub-checks
 */
function gate (o) {
  const cohort = o?.cohort ?? ['a']
  // `distance` is part of the DEFAULT row because `classifyRow` sets it on every
  // `intel` row it produces — a distance-less intel row does not occur in real
  // data (the 578-row 2026-08-05 replay confirms it), so a fixture without one
  // was simply under-specified. `driftClassesRanked` found that the moment it
  // was added; the fix is a more realistic fixture, not a laxer check.
  const rows = o?.rows ?? [{ action: 'intel', reason: 'drifted', distance: 'patch' }]
  return buildGate({
    cohort,
    rows,
    scan: o?.scan ?? new Map(cohort.map(id => [id, { id, status: 'ok', npmName: id }])),
    registry: o?.registry ?? new Map(cohort.map(id => [id, { upstreamState: 'ok' }])),
    scanFilePresent: true,
    registryFilePresent: true,
    malformedLines: 0,
    scanReconciled: null,
    expectedTotal: o?.expectedTotal === undefined ? cohort.length : o.expectedTotal,
    artefactsFromThisRun: o?.artefactsFromThisRun ?? true,
    // Default to a fully-measured run so the healthy path passes; the cases
    // that exercise this check set them apart explicitly.
    downloadsEligible: o?.downloadsEligible ?? cohort.length,
    downloadsOk: o?.downloadsOk ?? cohort.length,
    // Default to a fully-matched census, for the same reason.
    censusSupplied: o?.censusSupplied ?? true,
    censusMatched: o?.censusMatched ?? cohort.length,
  })
}

const allTrue = (/** @type {Record<string, boolean>} */ g) => Object.values(g).every(Boolean)

check('a healthy run passes every sub-check', allTrue(gate()), true)
check('a duplicate cohort entry fails cohortUnique', gate({ cohort: ['a', 'a'] }).cohortUnique, false)
check('a cohort member with no scan row fails scanCoversCohort',
  gate({ cohort: ['a', 'b'], scan: new Map([['a', { id: 'a', status: 'ok', npmName: 'a' }]]), rows: [{ action: 'intel' }, { action: 'blocked', reason: 'not-scanned' }] }).scanCoversCohort, false)
check('an empty cohort fails cohortNonEmpty', gate({ cohort: [], rows: [] }).cohortNonEmpty, false)

// --- The three ORDER-map coverage checks (added 2026-08-12 with
// `upstream-prerelease`) -------------------------------------------------------
//
// These exist because every one of their failure modes produces a report where
// nothing is missing and every total reconciles — the row is merely unrankable,
// or silently has no table. That is invisible to every other check here.
//
// Note what makes them non-vacuous: one side is the ACTION/DISTANCE/REASON the
// classifier emitted, the other is a hand-written literal in `lib/npm-triage.mjs`.
// The derived form (assert the map covers the tuple it is built from) is the
// vacuity this file already shipped once — see the DRIFT_ORDER block below.
check('an action with rows but no table fails actionsRendered',
  gate({ rows: [{ action: 'intel', reason: 'drifted' }, { action: 'newly-invented', reason: 'x' }] }).actionsRendered, false)
check('`current` is a DECLARED no-table action and must NOT fail actionsRendered',
  gate({ rows: [{ action: 'current', reason: 'up-to-date' }] }).actionsRendered, true)
check('every action that does render a table passes actionsRendered',
  gate({ rows: ['intel', 'unmeasured', 'modernize', 'archive', 'investigate', 'blocked', 'excluded', 'ahead'].map(a => ({ action: a, reason: 'r', distance: 'patch' })) }).actionsRendered, true)

check('an intel row whose distance is not in DRIFT_ORDER fails driftClassesRanked',
  gate({ rows: [{ action: 'intel', reason: 'drifted', distance: 'invented-class' }] }).driftClassesRanked, false)
check('the new upstream-prerelease class IS ranked',
  gate({ rows: [{ action: 'intel', reason: 'drifted', distance: 'upstream-prerelease' }] }).driftClassesRanked, true)
// Scoped to `intel` on purpose: non-intel rows legitimately carry `none` /
// `unmeasured` as a distance, and checking every row would fail every real run.
check('a NON-intel row with an unranked distance does not fail driftClassesRanked',
  gate({ rows: [{ action: 'intel', reason: 'drifted', distance: 'patch' }, { action: 'blocked', reason: 'b', distance: 'none' }] }).driftClassesRanked, true)

check('an unmeasured row whose reason is not in UNMEASURED_ORDER fails unmeasuredReasonsRanked',
  gate({ rows: [{ action: 'unmeasured', reason: 'invented-reason' }] }).unmeasuredReasonsRanked, false)
check('each real unmeasured reason is ranked',
  gate({ rows: ['version-slot-malformed', 'version-in-wrong-slot', 'version-unparseable', 'no-version-recorded'].map(r => ({ action: 'unmeasured', reason: r })) }).unmeasuredReasonsRanked, true)

// The two disasters that used to pass. Both are wholesale failures in which
// every row lands in `blocked`, so `resolvedSomeNote` — the one check with no
// denominator — is what fails them.
const allReadsFailed = {
  cohort: ['a', 'b'],
  scan: new Map([['a', { id: 'a', status: 'read-failed' }], ['b', { id: 'b', status: 'read-failed' }]]),
  registry: new Map(),
  rows: [{ action: 'blocked', reason: 'read-failed' }, { action: 'blocked', reason: 'read-failed' }],
}
const registryOutage = {
  cohort: ['a', 'b'],
  registry: new Map([['a', { upstreamState: 'api-unavailable' }], ['b', { upstreamState: 'api-unavailable' }]]),
  rows: [{ action: 'blocked', reason: 'api-unavailable' }, { action: 'blocked', reason: 'api-unavailable' }],
}

check('a run where every note failed to read FAILS the gate', allTrue(gate(allReadsFailed)), false)
check('...specifically on resolvedSomeNote', gate(allReadsFailed).resolvedSomeNote, false)
check('a total registry outage FAILS the gate', allTrue(gate(registryOutage)), false)
check('...specifically on resolvedSomeNote', gate(registryOutage).resolvedSomeNote, false)

// DOCUMENTED LIMITATION, not a defect: `registryCoversNamed` quantifies over a
// set that a total scan failure empties, and `[].every()` is `true`. It is kept
// for the hole it does catch (scan fine, one registry shard dead) and its
// comment in lib/ says so. Pinned here so a future reader does not mistake its
// green for evidence the scan worked.
check('registryCoversNamed is vacuous alone — a total scan failure still passes it',
  gate(allReadsFailed).registryCoversNamed, true)

// The denominator now comes from enumerate.json, which is written before any
// note is read. A failure downstream cannot shrink it into agreement.
check('an empty cohort fails cohortWithinEnumeration', gate({ cohort: [], rows: [], expectedTotal: 578 }).cohortWithinEnumeration, false)
check('a cohort LARGER than enumeration fails it — a stale cohort.txt from a bigger sweep',
  gate({ cohort: ['a', 'b', 'c'], expectedTotal: 2, rows: [{ action: 'intel' }] }).cohortWithinEnumeration, false)
check('a cohort SMALLER than enumeration passes — that is what `limit` does',
  gate({ cohort: ['a'], expectedTotal: 578 }).cohortWithinEnumeration, true)
check('a missing enumerate.json fails rather than passing vacuously',
  gate({ expectedTotal: null }).cohortWithinEnumeration, false)
check('the substance floor tolerates a cohort where every note simply lacks a version slot',
  gate({ cohort: ['a'], rows: [{ action: 'unmeasured', reason: 'no-version-recorded' }] }).resolvedSomeNote, true)
// The direction cohortWithinEnumeration cannot see: an older, SMALLER sweep's
// artefacts, which are within enumeration and self-consistent in every way.
check('artefacts from a previous run fail the gate', allTrue(gate({ artefactsFromThisRun: false })), false)
check('...on artefactsFromThisRun specifically', gate({ artefactsFromThisRun: false }).artefactsFromThisRun, false)

// Reach is a tie-breaker, so losing it wholesale does not blank the report — it
// silently REORDERS it. The 2026-08-05 run measured 50 of 512 ELIGIBLE rows
// (9.8%) and reported clean. 512, not the 578-note cohort: eligibility is the
// registry's answer count, and that is this check's denominator. The earlier
// `578` here was an impossible input (eligible ≤ registryRows ≤ cohort) that
// happened to fail for the right reason anyway.
check('the 2026-08-05 downloads rate (50 of 512 eligible, 9.8%) fails the gate',
  gate({ downloadsEligible: 512, downloadsOk: 50 }).downloadsMeasured, false)
check('...as does anything under the threshold',
  gate({ downloadsEligible: 100, downloadsOk: 89 }).downloadsMeasured, false)
check('exactly at the threshold passes', gate({ downloadsEligible: 100, downloadsOk: 90 }).downloadsMeasured, true)
check('a fully measured run passes', gate({ downloadsEligible: 100, downloadsOk: 100 }).downloadsMeasured, true)
// The denominator comes from the REGISTRY step, so a total downloads outage
// cannot shrink it into agreement with its own zero numerator.
check('a total downloads outage fails rather than dividing 0 by 0',
  gate({ downloadsEligible: 523, downloadsOk: 0 }).downloadsMeasured, false)
check('...and zero eligible rows is not a vacuous pass either',
  gate({ downloadsEligible: 0, downloadsOk: 0 }).downloadsMeasured, false)

// Note age is level 4 of the intel key and the sole tie-break above `id`, and
// until now it was the one ordering input with no gate check at all. The
// failure that matters is a census in the wrong date format: `new Date()` reads
// `05/08/2026` as May 8, so wrong ages reach the sort while `censusRows` and
// `cohortMatchedInCensus` stay green.
check('a DD/MM/YYYY census fails the gate — every row rejected, nothing matched',
  gate({ censusSupplied: true, censusMatched: 0 }).censusUsable, false)
check('...and fails the run as a whole', allTrue(gate({ censusSupplied: true, censusMatched: 0 })), false)
check('no census supplied is legitimate and passes',
  gate({ censusSupplied: false, censusMatched: 0 }).censusUsable, true)
// THE DISCRIMINATING PAIR, and the reason `censusSupplied` is the file's
// existence rather than its parsed row count. Both of these carry
// `censusMatched: 0` — identical numerators, opposite verdicts. Derive
// `censusSupplied` from the parse result and the two collapse into one, making
// this check unfailable in exactly the case it exists for.
check('a supplied-but-unusable census and an absent census are NOT the same verdict',
  gate({ censusSupplied: true, censusMatched: 0 }).censusUsable ===
    gate({ censusSupplied: false, censusMatched: 0 }).censusUsable, false)
check('the real 2026-08-04 census (575 of 578) passes',
  gate({ cohort: Array.from({ length: 578 }, (_, i) => `n${i}`), rows: [{ action: 'intel' }], censusMatched: 575 }).censusUsable, true)
check('exactly at the threshold passes',
  gate({ cohort: Array.from({ length: 100 }, (_, i) => `n${i}`), rows: [{ action: 'intel' }], censusMatched: 95 }).censusUsable, true)
check('one below the threshold fails',
  gate({ cohort: Array.from({ length: 100 }, (_, i) => `n${i}`), rows: [{ action: 'intel' }], censusMatched: 94 }).censusUsable, false)
check('an empty cohort with a census supplied fails rather than dividing by zero',
  gate({ cohort: [], rows: [], censusSupplied: true, censusMatched: 0 }).censusUsable, false)
// The case above does NOT prove the `cohort.length > 0` guard: 0/0 is NaN and
// `NaN >= 0.95` is already false, so deleting the guard leaves it passing
// (verified by planting). This one does — a positive numerator over an empty
// cohort divides to Infinity, which clears any threshold. The input is
// impossible in the pipeline (matched counts cohort members), which is exactly
// why it needs a fixture: nothing else would ever reveal the guard was gone.
check('a positive match count over an empty cohort does not pass via Infinity',
  gate({ cohort: [], rows: [], censusSupplied: true, censusMatched: 5 }).censusUsable, false)

// This one DOES work and must keep working — it is the reason the gate is not a
// total loss today.
check('a malformed NDJSON line fails inputsParsed', buildGate({
  cohort: ['a'],
  rows: [{ action: 'intel' }],
  scan: new Map([['a', { id: 'a', status: 'ok', npmName: 'a' }]]),
  registry: new Map([['a', { upstreamState: 'ok' }]]),
  scanFilePresent: true,
  registryFilePresent: true,
  malformedLines: 1,
  scanReconciled: null,
  expectedTotal: 1,
  artefactsFromThisRun: true,
  downloadsEligible: 1,
  downloadsOk: 1,
  censusSupplied: true,
  censusMatched: 1,
}).inputsParsed, false)

// ── The ordering key ────────────────────────────────────────────────────────
// Exercised by SORTING and asserting the resulting id sequence, never by
// inspecting an intermediate key: the order IS the observable, and a key that is
// correct in isolation but compared wrongly still produces a wrong report.
//
// These replace no fixtures — the weighted sum this key supersedes had none.
// It could only be observed by reading a 578-row table and disagreeing with it,
// which is how it survived a full run and an agent review before a human noticed
// that a patch bump was tying a confirmed breaking change.

/**
 * @param {string} id
 * @param {Partial<import('../lib/npm-triage.mjs').OrderableRow>} [over]
 * @returns {import('../lib/npm-triage.mjs').OrderableRow}
 */
function ord (id, over) {
  return {
    id,
    action: 'intel',
    reason: 'drifted',
    distance: 'patch',
    reachMeasured: false,
    weeklyDownloads: null,
    noteAgeDays: null,
    ...over,
  }
}

/**
 * @param {import('../lib/npm-triage.mjs').OrderableRow[]} rows
 * @returns {string}
 */
const order = rows => [...rows].sort(compareRows).map(r => r.id).join(',')

// Asserted against LITERALS, not against `VERSION_DISTANCE_CLASSES`.
//
// The obvious form — `Object.keys(DRIFT_ORDER)` set-equals the exported tuple —
// was written here first and does not work: `DRIFT_ORDER` is DERIVED from that
// tuple, so both sides move together and the check passes for any content. It
// was caught by planting a fifth class and watching nothing fail: the fourth
// check that could not fail in this pipeline's history, and the first one this
// file itself shipped. The real drift risk — a new `return` in
// `classifyVersionDistance` that never reaches the tuple — is guarded in
// `check-version-distance.mjs`, which scans the function's source and therefore
// has a source the tuple cannot touch.
// `upstream-prerelease` was added 2026-08-12 and sits BELOW `distance-unknown`
// deliberately. Both are refusals, but they refuse different things:
// `distance-unknown` has two fully parsed versions that are confirmed different
// and merely unclassifiable in magnitude, whereas `upstream-prerelease` means the
// comparison base itself is unsound — drift against the stable line is not
// established at all. `npm-c12` is the worked example: it looked like a
// `semver-major` and the true stable delta was 3.3.3 → 3.3.4, one patch. Ordering
// by strength-of-evidence-that-drift-exists therefore puts it under
// `distance-unknown`. It stays ABOVE `patch` for the reason already recorded on
// `DRIFT_ORDER`: an unknown magnitude outranks a confirmed-small one.
check('DRIFT_ORDER has exactly five classes', Object.keys(DRIFT_ORDER).length, 5)
check('...ranked semver-major, semver-minor-multi, distance-unknown, upstream-prerelease, patch',
  Object.entries(DRIFT_ORDER).sort((x, y) => x[1] - y[1]).map(e => e[0]).join(','),
  'semver-major,semver-minor-multi,distance-unknown,upstream-prerelease,patch')

// --- versionBasis / versionPattern provenance (renamed 2026-08-12) ------------
//
// `versionBasis` used to say `canonical`, which everyone — including this
// pipeline's own verifier — read as "came from the note's `[version]`
// observation". It never meant that: it meant only that the six-pattern
// extractor matched SOMETHING. 4 of the 12 top rows in the 2026-08-06 report had
// no `[version]` observation at all and still rendered unmarked.
//
// `versionPattern` is the field that carries the missing distinction. It was
// already computed by the scanner and thrown away here.
// `npmName` is not optional here: without it the row is `blocked`/`no-package-name`
// long before the version branches run, so the `reason` assertion below would be
// testing the wrong thing. (It was, on the first draft.)
const basis = (/** @type {Partial<import('../lib/npm-triage.mjs').ScanRow>} */ sr) =>
  row({ npmName: 'pkg', ...sr }, { upstreamVersion: '9.9.9' })

check('extractor matched the [version] observation → extracted / pattern 3',
  `${basis({ version: '1.0.0', pattern: 3 }).versionBasis}/${basis({ version: '1.0.0', pattern: 3 }).versionPattern}`,
  'extracted/3')
check('extractor matched a header pipe → still extracted, but pattern 1',
  `${basis({ version: '1.0.0', pattern: 1 }).versionBasis}/${basis({ version: '1.0.0', pattern: 1 }).versionPattern}`,
  'extracted/1')
check('extractor matched a prose release reel → pattern 5, the weakest source',
  basis({ version: '1.0.0', pattern: 5 }).versionPattern, 5)
// The rename must not silently become a synonym: nothing may still emit the old
// word, or a consumer keyed on it would keep working while meaning the wrong thing.
check('the string `canonical` is gone from versionBasis entirely',
  [3, 1, 5].map(p => basis({ version: '1.0.0', pattern: p }).versionBasis).join(','),
  'extracted,extracted,extracted')
check('off-slot frontmatter value → versionBasis names the slot, pattern null',
  `${basis({ altVersion: '1.0.0', altVersionSource: 'current_version' }).versionBasis}/` +
  `${basis({ altVersion: '1.0.0', altVersionSource: 'current_version' }).versionPattern}`,
  'current_version/null')
check('off-slot value still routes to drifted-off-slot, not drifted',
  basis({ altVersion: '1.0.0', altVersionSource: 'current_version' }).reason, 'drifted-off-slot')
check('no version anywhere → versionBasis none',
  basis({}).versionBasis, 'none')

// ⚠️ THE ID NAMING IS LOAD-BEARING. Every expected sequence below must
// CONTRADICT alphabetical order, so `z-` marks the row that should win and `a-`
// the row that should lose. The first draft of these fixtures named rows
// descriptively (`big`/`small`, `ancient`/`fresh`, `a`/`b`/`c`/`d`) and nine of
// them happened to expect an alphabetically-sorted sequence — which the final
// `localeCompare` tie-break reproduces on its own. Deleting the level each one
// was written to test changed nothing. They still caught the specific inversion
// they described; what they could not catch was a whole level going missing.
//
// The one deliberate exception is the id tie-break fixture itself, where
// alphabetical IS the property under test — it is marked in place.
//
// Verify with the level-deletion sweep, not by reading: copy `compareRows` to a
// scratchpad, remove one level at a time, and confirm each removal fails
// something here. Restore from the scratchpad copy — never `git checkout`, which
// has already destroyed an uncommitted phase of this work once.

// The defect this whole phase exists to remove: under the weighted sum a patch
// bump that was old, popular and untidy could reach the same total as a
// confirmed breaking change. Lexicographically it cannot, at any magnitude.
check('a semver-major beats a patch that wins every lower level', order([
  ord('a-patch-huge', { distance: 'patch', reachMeasured: true, weeklyDownloads: 50e6, noteAgeDays: 900 }),
  ord('z-major-obscure', { distance: 'semver-major', reachMeasured: true, weeklyDownloads: 3, noteAgeDays: 1 }),
]), 'z-major-obscure,a-patch-huge')
check('distance-unknown outranks every patch row unconditionally', order([
  ord('patch-huge', { distance: 'patch', reachMeasured: true, weeklyDownloads: 50e6 }),
  ord('unknown-tiny', { distance: 'distance-unknown', reachMeasured: true, weeklyDownloads: 1 }),
]), 'unknown-tiny,patch-huge')
check('within a drift class, higher measured reach leads', order([
  ord('a-small', { distance: 'semver-major', reachMeasured: true, weeklyDownloads: 100 }),
  ord('z-big', { distance: 'semver-major', reachMeasured: true, weeklyDownloads: 100_000 }),
]), 'z-big,a-small')

// The 2026-08-05 failure, as a fixture: 462 rows lost their downloads to HTTP
// 429 and were scored as unpopular. An unmeasured reach must sort AFTER every
// measured row in its class — including after a measured ZERO, which is a real
// answer — and must not be promoted above one either.
check('an unmeasured reach sorts after a measured one, not as a low value', order([
  ord('a-throttled', { distance: 'semver-major', reachMeasured: false, weeklyDownloads: null }),
  ord('z-measured-low', { distance: 'semver-major', reachMeasured: true, weeklyDownloads: 5 }),
]), 'z-measured-low,a-throttled')
check('...including after a measured ZERO, which is an answer', order([
  ord('a-throttled', { distance: 'semver-major', reachMeasured: false, weeklyDownloads: null }),
  ord('z-measured-zero', { distance: 'semver-major', reachMeasured: true, weeklyDownloads: 0 }),
]), 'z-measured-zero,a-throttled')
check('...and a stale count with a failed state is NOT treated as measured', order([
  ord('a-stale-number', { distance: 'semver-major', reachMeasured: false, weeklyDownloads: 9e6 }),
  ord('z-honest-low', { distance: 'semver-major', reachMeasured: true, weeklyDownloads: 2 }),
]), 'z-honest-low,a-stale-number')

check('note age breaks a reach tie, oldest first', order([
  ord('a-fresh', { distance: 'patch', reachMeasured: true, weeklyDownloads: 10, noteAgeDays: 5 }),
  ord('z-ancient', { distance: 'patch', reachMeasured: true, weeklyDownloads: 10, noteAgeDays: 500 }),
]), 'z-ancient,a-fresh')
check('an unknown note age sorts last, not as age 0', order([
  ord('a-nocensus', { distance: 'patch', reachMeasured: true, weeklyDownloads: 10, noteAgeDays: null }),
  ord('z-known', { distance: 'patch', reachMeasured: true, weeklyDownloads: 10, noteAgeDays: 1 }),
]), 'z-known,a-nocensus')
// THE EXCEPTION: alphabetical is the property here, so the expectation must be
// alphabetical. What keeps it non-vacuous is the INPUT order — reversed, so a
// comparator that returned 0 and left a stable sort untouched would fail it.
check('id is the final tie-break, so the order is total and stable', order([
  ord('npm-zulu', { noteAgeDays: 7 }),
  ord('npm-alpha', { noteAgeDays: 7 }),
]), 'npm-alpha,npm-zulu')

// The unmeasured table is a WORKLIST: cheapest fix first, because three of the
// four classes are the same one-line slot repair and only one costs research.
// Reverse-alphabetical by design: `a,b,c,d` was the worst offender of the nine,
// reproducible by the id tie-break alone with the remediation level deleted.
check('unmeasured orders by remediation cost, cheapest first', order([
  ord('a', { action: 'unmeasured', reason: 'no-version-recorded' }),
  ord('b', { action: 'unmeasured', reason: 'version-unparseable' }),
  ord('c', { action: 'unmeasured', reason: 'version-in-wrong-slot' }),
  ord('d', { action: 'unmeasured', reason: 'version-slot-malformed' }),
]), 'd,c,b,a')
// Reach is deliberately NOT a level here — the per-row cost is uniform, so
// ordering a five-second edit by npm popularity would be noise dressed as signal.
// So this one legitimately falls through to the id tie-break and its expectation
// IS alphabetical; the input order is reversed to keep it honest, and the reach
// values are set so the two candidate orders differ.
check('...and reach does not reorder within a remediation class', order([
  ord('z-huge', { action: 'unmeasured', reason: 'version-unparseable', reachMeasured: true, weeklyDownloads: 9e6, noteAgeDays: 10 }),
  ord('a-tiny', { action: 'unmeasured', reason: 'version-unparseable', reachMeasured: true, weeklyDownloads: 1, noteAgeDays: 10 }),
]), 'a-tiny,z-huge')

// Epistemic separation, enforced by the outermost level: `unmeasured` is a
// different STATE from `intel`, so no unmeasured row can reach the confirmed
// drift table's ordering however costly its blindness.
check('every intel row precedes every unmeasured row', order([
  ord('a-unmeasured', { action: 'unmeasured', reason: 'no-version-recorded', reachMeasured: true, weeklyDownloads: 9e6 }),
  ord('z-intel', { action: 'intel', distance: 'patch', reachMeasured: true, weeklyDownloads: 1 }),
]), 'z-intel,a-unmeasured')

// Same open-vs-closed discipline as `classifyUpstreamState`'s `default` arm: an
// unrecognised value must never be promoted by its own unfamiliarity.
check('an unknown action sorts last, never first', order([
  ord('a-weird', { action: 'no-such-action' }),
  ord('z-known', { action: 'excluded' }),
]), 'z-known,a-weird')
check('an unknown drift class sorts last within intel, never first', order([
  ord('mystery', { distance: 'not-a-class', reachMeasured: true, weeklyDownloads: 9e6 }),
  ord('patchy', { distance: 'patch', reachMeasured: true, weeklyDownloads: 1 }),
]), 'patchy,mystery')
check('an unknown unmeasured reason sorts last, never first', order([
  ord('mystery', { action: 'unmeasured', reason: 'not-a-reason' }),
  ord('research', { action: 'unmeasured', reason: 'no-version-recorded' }),
]), 'research,mystery')

// `classifyRow` must produce rows the comparator can actually read — the two
// halves live in one module but nothing else couples them.
const orderable = row({ npmName: 'x', version: '1.0.0' }, { upstreamVersion: '3.0.0', dateState: 'ok' })
check('a classified row carries reachMeasured', typeof orderable.reachMeasured, 'boolean')
check('...false when no downloads row was joined', orderable.reachMeasured, false)
check('...and reports reach as a missing ordering input',
  /** @type {string[]} */ (orderable.missingInputs).includes('reach'), true)

done()
