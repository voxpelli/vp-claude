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
  CADENCE_SPRINT_RANGE, ERROR_CATEGORY_EQUIVALENCE, ERROR_CORPUS,
  PI_ERROR_CATEGORIES, PI_ONLY_ERROR_CATEGORIES,
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
for (const sample of ERROR_CORPUS) {
  const ctx = additionalContext(runHook('post-bm-failure-classify.sh', JSON.stringify({ error: sample })))
  const claudeTag = /\[([a-z-]+)\]/.exec(ctx)?.[1] ?? '(none)'
  const piCategory = classifyBmError(sample)
  seenPiCategories.add(piCategory)
  const expected = ERROR_CATEGORY_EQUIVALENCE[claudeTag]
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
// source passes for any content — this repo has shipped that five times, most
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

done(50)
