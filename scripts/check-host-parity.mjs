// @ts-check
// check-host-parity.mjs — the guard that did not exist when the audit cadence
// disagreed between hosts for every release up to 0.34.0.
//
// `check:agent-parity` guards agents/ against agents-pi/. This is its
// counterpart for hooks/ (Claude Code, bash) against extensions/ (Pi, JS),
// which implement four policies once each.
//
// BEHAVIOURAL, not textual: it runs the real bash hook as a subprocess and the
// real JS function in-process and compares what they produce. Both sides of the
// cadence bug were already tested — each guard checked only that its own copy
// was self-consistent, which is exactly the shape a comparison of two DOCUMENTS
// would have reproduced.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { guardedArrayIncludes } from '@voxpelli/typed-utils'
import { buildAuditReminder, buildRecoveryGuidance, classifyBmError } from '../extensions/index.js'
import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  CADENCE_SPRINT_RANGE, CLAUDE_ERROR_CATEGORIES, ERROR_CATEGORY_EQUIVALENCE, ERROR_CORPUS,
  PI_ERROR_CATEGORIES, PI_ONLY_ERROR_CATEGORIES, RECOVERY_HOST_SUBSTITUTIONS,
} from '../lib/host-parity.mjs'

const { check, done } = createCheckHarness()

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOOKS_DIR = join(ROOT, 'hooks')

// hooks/session-start.sh shells out to tip-fragment.sh, which reads the real
// $HOME. Point both at paths that do not exist so it exits at its own
// missing-file guard — same isolation check-hooks.mjs applies, same reason.
const ISOLATION = {
  VP_KNOWLEDGE_NUDGE_TIPS_FILE: join(tmpdir(), 'host-parity-none', 'no-such-tips.txt'),
  VP_KNOWLEDGE_STATE_DIR: join(tmpdir(), 'host-parity-none', 'no-such-state'),
}

/**
 * @param {string} script
 * @param {string} stdinJson
 * @param {string} [cwd]
 * @returns {string}
 */
function runHook (script, stdinJson, cwd = ROOT) {
  const r = spawnSync('bash', [join(HOOKS_DIR, script)], {
    input: stdinJson,
    cwd,
    env: { ...process.env, ...ISOLATION },
    encoding: 'utf8',
  })
  return r.stdout ?? ''
}

/**
 * @param {string} stdout
 * @returns {string}
 */
function additionalContext (stdout) {
  const trimmed = stdout.trim()
  if (!trimmed) return ''
  try {
    const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(trimmed))
    return String(parsed.additionalContext ?? '')
  } catch {
    return ''
  }
}

/**
 * The audit sentence, or '' — the only part of additionalContext both hosts
 * are contracted to agree on.
 *
 * @param {string} ctx
 * @returns {string}
 */
function auditSentence (ctx) {
  const line = ctx.split('\n\n').find((p) => p.startsWith('Graph-audit'))
  return line ?? ''
}

/**
 * @param {number} n
 * @returns {string} a temp dir holding n RETRO files
 */
function dirWithRetros (n) {
  const dir = mkdtempSync(join(tmpdir(), 'host-parity-'))
  for (let i = 1; i <= n; i++) writeFileSync(join(dir, `RETRO-${i}.md`), '')
  return dir
}

// ── 1. Audit cadence ────────────────────────────────────────────────────────
//
// The bug this file exists for. Compared BYTE for byte across more than one
// full 4-sprint cycle: an off-by-one that happens to agree at the sampled
// points is exactly what shipped, so sampling two counts is not enough.
console.log('\naudit cadence (bash hook vs extensions/index.js)')
for (let n = 0; n < CADENCE_SPRINT_RANGE; n++) {
  const dir = dirWithRetros(n)
  const fromBash = auditSentence(additionalContext(runHook('session-start.sh', '{}', dir)))
  const fromJs = buildAuditReminder(dir)
  const same = fromBash === fromJs
  if (!same) {
    console.error(`        bash: ${fromBash || '(silent)'}`)
    console.error(`        js:   ${fromJs || '(silent)'}`)
  }
  check(`${n} RETRO file(s): both hosts emit the same audit sentence`, same)
}

// ── 2. Basic Memory error taxonomy ──────────────────────────────────────────
//
// Not byte-parity: the two vocabularies genuinely differ (server-unavailable vs
// transient, and so on), so equality would be the wrong claim. What must hold is
// that the same error text reaches EQUIVALENT categories, so the advice a user
// gets does not depend on their host.
//
// Run over the WHOLE corpus. The first version of this check listed nine
// hand-picked samples and passed while the two hosts disagreed on 17 of 27 real
// inputs — a check that could not fail, because it chose its own inputs.
console.log('\nBM error taxonomy (same input → equivalent category)')
/** @type {Set<string>} */
const seenPiCategories = new Set()
/** @type {Set<string>} */
const seenClaudeTags = new Set()
for (const sample of ERROR_CORPUS) {
  const ctx = additionalContext(runHook('post-bm-failure-classify.sh', JSON.stringify({ error: sample })))
  const claudeTag = /\[([a-z-]+)\]/.exec(ctx)?.[1] ?? '(none)'
  const piCategory = classifyBmError(sample)
  seenPiCategories.add(piCategory)
  seenClaudeTags.add(claudeTag)
  // Guarded rather than indexed straight: the equivalence map is keyed over the
  // ClaudeErrorCategory union now, so an unrecognised tag has to be handled
  // rather than silently yielding undefined. That narrowing is the whole benefit
  // of the union — before, `@type {Record<string,string>}` accepted anything.
  const expected = guardedArrayIncludes(CLAUDE_ERROR_CATEGORIES, claudeTag)
    ? ERROR_CATEGORY_EQUIVALENCE[claudeTag]
    : undefined
  const same = expected === piCategory
  if (!same) {
    console.error(`        Claude Code: [${claudeTag}] → expects "${expected ?? '(unmapped tag)'}"`)
    console.error(`        Pi:          ${piCategory}`)
  }
  check(`"${sample}": [${claudeTag}] ≡ ${piCategory}`, same)
}

// ── 3. Coverage ─────────────────────────────────────────────────────────────
//
// The sides come from different places ON PURPOSE. `PI_ERROR_CATEGORIES` is
// hand-written in lib/host-parity.mjs; `seenPiCategories` is what the classifier
// actually returned above. A coverage check whose sides both derive from one
// source passes for any content — this repo keeps shipping that shape, most
// recently inside the guard written to end it.
console.log('\ntaxonomy coverage')
const declaredPiOnly = new Set(Object.keys(PI_ONLY_ERROR_CATEGORIES))
for (const category of PI_ERROR_CATEGORIES) {
  check(
    `${category} is exercised by the corpus, or declared unreachable from it`,
    seenPiCategories.has(category) || declaredPiOnly.has(category)
  )
}
for (const category of seenPiCategories) {
  check(
    `${category} is a category the hand-written list knows about`,
    /** @type {readonly string[]} */ (PI_ERROR_CATEGORIES).includes(category)
  )
}
// Both directions of the name map must be live: an equivalence entry naming a
// category the classifier cannot return is a map that has fallen behind.
for (const piName of Object.values(ERROR_CATEGORY_EQUIVALENCE)) {
  check(
    `equivalence target "${piName}" is a real Pi category`,
    /** @type {readonly string[]} */ (PI_ERROR_CATEGORIES).includes(piName)
  )
}
// ...and the CLAUDE side, which had no coverage at all. A seventh arm added to
// the hook — no Pi counterpart, no equivalence entry, no corpus string — left
// this check at 61/61.
for (const tag of CLAUDE_ERROR_CATEGORIES) {
  check(`${tag} is reachable from the corpus`, seenClaudeTags.has(tag))
  check(`${tag} has an equivalence entry`, tag in ERROR_CATEGORY_EQUIVALENCE)
}
for (const tag of seenClaudeTags) {
  check(`emitted tag "${tag}" is one the hand-written list knows about`,
    /** @type {readonly string[]} */ (CLAUDE_ERROR_CATEGORIES).includes(tag))
}

// ── 3b. SOURCE SCAN: every category either side can EMIT is declared ────────
//
// The behavioural coverage above cannot see an arm no corpus string reaches. A
// seventh branch planted in the bash hook — `quota exceeded` → `[rate-limited]`,
// with no Pi counterpart, no equivalence entry and no corpus string — left this
// file fully green, because nothing ever triggered it.
//
// So this reads each implementation's own source for the literals it can emit,
// the way `check:distance` scans `classifyVersionDistance` for its `return`
// literals. Both scans assert they found something first: a rename must fail
// loudly rather than compare two empty sets.
console.log('\ncategory declarations (source scan)')

const hookSource = readFileSync(join(HOOKS_DIR, 'post-bm-failure-classify.sh'), 'utf8')
const emittedTags = [...new Set([...hookSource.matchAll(/MSG="\[([a-z-]+)\]/g)].map((m) => m[1]))]
check('the hook scan found tags at all (a rewrite must fail loudly, not vacuously)', emittedTags.length >= 5)
for (const tag of emittedTags) {
  check(`hook emits [${tag}], which CLAUDE_ERROR_CATEGORIES declares`,
    /** @type {readonly string[]} */ (CLAUDE_ERROR_CATEGORIES).includes(String(tag)))
}
for (const tag of CLAUDE_ERROR_CATEGORIES) {
  check(`CLAUDE_ERROR_CATEGORIES declares [${tag}], which the hook can still emit`, emittedTags.includes(tag))
}

const extSource = readFileSync(join(ROOT, 'extensions', 'index.js'), 'utf8')
const classifyBody = /export function classifyBmError \([\s\S]*?\n\}/.exec(extSource)?.[0] ?? ''
check('the classifyBmError scan found the function at all', classifyBody.length > 0)
const returnedCategories = [...new Set([...classifyBody.matchAll(/return '([a-z-]+)'/g)].map((m) => m[1]))]
check('...and its return literals', returnedCategories.length >= 5)
for (const category of returnedCategories) {
  check(`classifyBmError can return "${category}", which PI_ERROR_CATEGORIES declares`,
    /** @type {readonly string[]} */ (PI_ERROR_CATEGORIES).includes(String(category)))
}

// ── 4. The post-compaction recovery text ────────────────────────────────────
//
// A REAL two-host comparison. This section used to describe the Pi wording in
// detail and then assert only against `compactCtx` — the bash host — so it
// passed with the entire Pi recovery sentence deleted. Verified: a reviewer
// replaced it with placeholder text and got 61/61.
//
// The two texts differ in exactly one declared place, so everything else is
// compared BYTE FOR BYTE rather than by a "both mention the namespace"
// invariant that a wholesale rewrite would satisfy.
console.log('\npost-compaction recovery (both hosts)')
const claudeRecovery = additionalContext(runHook('session-start.sh', JSON.stringify({ source: 'compact' })))
  .split('\n\n').find((p) => p.startsWith('Post-compaction recovery')) ?? ''
let piRecovery = buildRecoveryGuidance('Post-compaction recovery')
for (const { claude, pi } of RECOVERY_HOST_SUBSTITUTIONS) {
  check(`the declared Pi-only wording is actually present: "${pi.slice(0, 40)}…"`, piRecovery.includes(pi))
  piRecovery = piRecovery.replace(pi, claude)
}
check('both hosts emit a recovery block at all', claudeRecovery.length > 0 && piRecovery.length > 0)
if (claudeRecovery !== piRecovery) {
  console.error(`        claude: ${claudeRecovery.slice(0, 160)}`)
  console.error(`        pi:    ${piRecovery.slice(0, 160)}`)
}
check('the two recovery texts are identical once the declared difference is normalised',
  claudeRecovery === piRecovery)

// ── 5. The constants the sections above depend on ───────────────────────────
//
// Asserted directly, because an assertion-count floor cannot see them shrink.
// With CADENCE_SPRINT_RANGE at 2 instead of 13 this file reported 50/50 and
// exit 0 — against a floor of 50 — while losing the very property its own
// docblock says the constant exists to protect.
console.log('\ncorpus sizes')
check(`CADENCE_SPRINT_RANGE (${CADENCE_SPRINT_RANGE}) spans more than one 4-sprint cycle`, CADENCE_SPRINT_RANGE > 8)
check(`ERROR_CORPUS (${ERROR_CORPUS.length}) has not been trimmed`, ERROR_CORPUS.length >= 33)
check('the corpus still contains strings matching TWO arms, or branch order is unobservable',
  ERROR_CORPUS.filter((sample) => {
    const t = sample.toLowerCase()
    return [
      /connection refused|timeout|unavailable|econnrefused|etimedout/,
      /not found|does not exist|no note|no such/,
      /invalid|missing.*field|malformed|validation\s*error|schema validation|too long|too short/,
      /permission|denied|unauthorized|forbidden/,
      /already exists|duplicate|conflict/,
    ].filter((re) => re.test(t)).length > 1
  }).length >= 5)

done(70)
