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
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildAuditReminder, classifyBmError } from '../extensions/index.js'
import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  CADENCE_SPRINT_RANGE, CROSS_HOST_ERROR_CASES, PI_ERROR_CATEGORIES, PI_ONLY_ERROR_CATEGORIES,
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
// Not byte-parity: the two vocabularies genuinely differ (5 bash tags, 7 JS
// categories). What must hold is that the same error text reaches CORRESPONDING
// categories, so the advice a user gets does not depend on their host.
console.log('\nBM error taxonomy (same input → corresponding category)')
for (const { claude, pi, sample } of CROSS_HOST_ERROR_CASES) {
  const ctx = additionalContext(runHook('post-bm-failure-classify.sh', JSON.stringify({ error: sample })))
  check(`"${sample}" → [${claude}] on Claude Code`, ctx.includes(`[${claude}]`))
  check(`"${sample}" → ${pi} on Pi`, classifyBmError(sample) === pi)
}

// ── 3. Coverage: is every Pi category either mapped or declared Pi-only? ─────
//
// The two sides come from different places ON PURPOSE. `PI_ERROR_CATEGORIES` is
// hand-written in lib/host-parity.mjs; the reachable set below is what the
// classifier actually returns for the mapped samples. A coverage check whose
// sides both derive from one source passes for any content — this repo has
// shipped that mistake five times, most recently inside the guard written to
// end it.
console.log('\ntaxonomy coverage')
const mapped = new Set(CROSS_HOST_ERROR_CASES.map((c) => c.pi))
const declaredPiOnly = new Set(Object.keys(PI_ONLY_ERROR_CATEGORIES))
for (const category of PI_ERROR_CATEGORIES) {
  check(
    `${category} is either cross-host mapped or declared Pi-only`,
    mapped.has(category) || declaredPiOnly.has(category)
  )
}
// The reverse direction: a hand-written list that has fallen behind the code is
// the more likely drift, since the code is what changes.
for (const category of [...mapped, ...declaredPiOnly]) {
  check(
    `${category} is a category the classifier can actually return`,
    /** @type {readonly string[]} */ (PI_ERROR_CATEGORIES).includes(category)
  )
}

// ── 4. Shared prose both hosts inject ───────────────────────────────────────
//
// One deliberate difference must SURVIVE this check: the Pi recovery text says
// "the basic-memory (mcp__basic-memory__*) tools" where Claude Code says "the
// mcp__basic-memory__* tools", because on Pi the server is addressed by name.
// A byte-identical assertion would be wrong, so this checks the invariant
// instead — both must point the reader at the same tool namespace.
console.log('\nshared guidance')
const compactCtx = additionalContext(runHook('session-start.sh', JSON.stringify({ source: 'compact' })))
check('the Claude Code recovery block names the BM tool namespace', compactCtx.includes('mcp__basic-memory__'))
check('...and tells the reader not to edit the store directly', /never edit ~\/basic-memory files directly/.test(compactCtx))

done(30)
