// @ts-check
// check-hooks.mjs — Integration tests for hook scripts.
// Verifies every hook emits exactly ONE valid JSON object on stdout (or none
// for silent-exit cases). Guards against the multi-object bug that went
// undetected in session-start.sh for 3 releases (v0.15.0–v0.16.0).

import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  mkdirSync, mkdtempSync, readFileSync, writeFileSync,
} from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HOOKS_DIR = join(__dirname, '..', 'hooks')

// Hermetic baseline for the nudge-tip env vars, applied to EVERY runHook call
// by default — not just the nudge-specific fixtures. hooks/session-start.sh
// unconditionally invokes tip-fragment.sh for any non-compact source, so
// without this baseline every session-start.sh test (including the 4
// pre-existing RETRO-count / source=startup cases that predate the nudge
// feature) reads/writes the developer's REAL ~/.claude/references/... and
// ~/.local/state/vp-knowledge/nudge-state on every `npm run check` — this
// was confirmed happening on this machine, not theoretical. Pointing both
// vars at a nonexistent path makes tip-fragment.sh exit at its own
// missing-file guard before it ever touches the real $HOME. A future test
// that doesn't override these stays isolated by default rather than
// depending on the author remembering to add overrides manually.
const NUDGE_ISOLATION_ENV = {
  VP_KNOWLEDGE_NUDGE_TIPS_FILE: join(tmpdir(), 'check-hooks-no-nudge', 'no-such-tips.txt'),
  VP_KNOWLEDGE_STATE_DIR: join(tmpdir(), 'check-hooks-no-nudge', 'no-such-state'),
}

// --- Helpers ---

/**
 * @param {number} n
 * @returns {string}
 */
function makeTempDirWithRetros (n) {
  const dir = mkdtempSync(join(tmpdir(), 'check-hooks-'))
  for (let i = 1; i <= n; i++) {
    writeFileSync(join(dir, `RETRO-0${i}.md`), '')
  }
  return dir
}

function makeTempPluginRoot () {
  const dir = mkdtempSync(join(tmpdir(), 'check-hooks-plugin-'))
  mkdirSync(join(dir, 'schemas'))
  mkdirSync(join(dir, 'hooks'))
  writeFileSync(join(dir, 'schemas', 'npm_package.md'), '# schema\n')
  writeFileSync(join(dir, 'hooks', 'session-start.sh'), '#!/bin/bash\n')
  return dir
}

/**
 * @param {string} script
 * @param {string} stdinJson
 * @param {{ args?: string[], cwd?: string, env?: Record<string, string> }} [opts]
 * @returns {{ stdout: string, stderr: string, status: number }}
 */
function runHook (script, stdinJson, { args = [], cwd = process.cwd(), env = {} } = {}) {
  const result = spawnSync('bash', [script, ...args], {
    input: stdinJson,
    cwd,
    env: { ...process.env, ...NUDGE_ISOLATION_ENV, ...env },
    encoding: 'utf8',
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  }
}

/**
 * Build a real, populated tips file + state dir for tests that need to
 * exercise actual nudge-tip behavior (as opposed to the hermetic
 * `NUDGE_ISOLATION_ENV` baseline every `runHook` call gets by default, which
 * points at paths that don't exist). Every session-start.sh test — not just
 * the ones using this fixture — is already isolated from the real $HOME by
 * default; call this helper only when a test specifically wants the tip
 * feature to actually fire.
 *
 * @param {{ tipLines?: string[] }} [opts]
 * @returns {{ tipsFile: string, stateDir: string }}
 */
function makeNudgeFixture ({ tipLines = ['- [nudge] Sample tip. Feature: sample-feature Added: 2026-07-01'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'check-hooks-nudge-'))
  const tipsFile = join(dir, 'nudge-tips.txt')
  const stateDir = join(dir, 'state')
  writeFileSync(tipsFile, tipLines.join('\n') + '\n')
  return { tipsFile, stateDir }
}

/**
 * @param {string} stdout
 * @returns {{ count: number, objects: unknown[], parseError: string|null }}
 */
function parseJsonObjects (stdout) {
  const trimmed = stdout.trim()
  if (trimmed === '') return { count: 0, objects: [], parseError: null }
  // Try parsing as a single JSON object (handles both compact and pretty-printed)
  try {
    const obj = JSON.parse(trimmed)
    return { count: 1, objects: [obj], parseError: null }
  } catch {
    // If single-parse fails, try splitting by }{ boundary (multi-object detection)
    // This catches the bug class: two separate JSON objects emitted sequentially
    const parts = trimmed.split(/\}\s*\{/).filter(Boolean)
    if (parts.length > 1) {
      return { count: parts.length, objects: [], parseError: `Multiple JSON objects detected (${parts.length}) — multi-object bug!` }
    }
    return { count: 0, objects: [], parseError: `Invalid JSON: ${trimmed.slice(0, 120)}` }
  }
}

// --- Test runner ---

let passed = 0
let failed = 0

/**
 * @param {string} label
 * @param {() => { ok: boolean, reason?: string }} check
 */
function test (label, check) {
  try {
    const result = check()
    if (result.ok) {
      console.log(`  PASS  ${label}`)
      passed++
    } else {
      console.error(`  FAIL  ${label}`)
      console.error(`        ${result.reason ?? 'no reason given'}`)
      failed++
    }
  } catch (/** @type {unknown} */ err) {
    console.error(`  FAIL  ${label}`)
    console.error(`        threw: ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }
}

// --- Pre-flight ---
const jqCheck = spawnSync('jq', ['--version'], { encoding: 'utf8' })
if (jqCheck.status !== 0) {
  console.error('FATAL: jq not found — all hook scripts require it')
  process.exit(1)
}

// --- session-start.sh ---
console.log('\nsession-start.sh')

test('no RETRO files → 1 object with additionalContext', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), '{}', { cwd: makeTempDirWithRetros(0) })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
  const obj = /** @type {Record<string,unknown>} */ (objects[0])
  if (!('additionalContext' in obj)) return { ok: false, reason: `missing additionalContext — keys: ${Object.keys(obj)}` }
  return { ok: true }
})

test('3 RETRO files → 1 object, contains audit reminder', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), '{}', { cwd: makeTempDirWithRetros(3) })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('Graph-audit reminder')) return { ok: false, reason: 'missing audit reminder text' }
  return { ok: true }
})

test('4 RETRO files → 1 object, contains audit sprint', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), '{}', { cwd: makeTempDirWithRetros(4) })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('Graph-audit sprint')) return { ok: false, reason: 'missing audit sprint text' }
  return { ok: true }
})

test('source=compact → 1 object, contains post-compaction recovery', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'compact' }), { cwd: makeTempDirWithRetros(0) })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('Post-compaction recovery')) return { ok: false, reason: 'missing recovery text on compact' }
  return { ok: true }
})

test('source=startup → 1 object, recovery absent (gated)', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), { cwd: makeTempDirWithRetros(0) })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (ctx.includes('Post-compaction recovery')) return { ok: false, reason: 'recovery text leaked on non-compact source' }
  return { ok: true }
})

// --- tip-fragment.sh (via session-start.sh, isolated $HOME-equivalent state) ---

test('fires once: tip present on first run today', () => {
  const { stateDir, tipsFile } = makeNudgeFixture()
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), {
    cwd: makeTempDirWithRetros(0),
    env: { VP_KNOWLEDGE_NUDGE_TIPS_FILE: tipsFile, VP_KNOWLEDGE_STATE_DIR: stateDir },
  })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('Feature: sample-feature')) return { ok: false, reason: 'tip fragment missing on first run' }
  return { ok: true }
})

test('already-shown-today: tip absent on second run same day', () => {
  const { stateDir, tipsFile } = makeNudgeFixture()
  const env = { VP_KNOWLEDGE_NUDGE_TIPS_FILE: tipsFile, VP_KNOWLEDGE_STATE_DIR: stateDir }
  runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), { cwd: makeTempDirWithRetros(0), env })
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), { cwd: makeTempDirWithRetros(0), env })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (ctx.includes('Feature: sample-feature')) return { ok: false, reason: 'tip fragment leaked on already-shown-today run — throttle not working' }
  return { ok: true }
})

test('missing reference file: tip absent, hook still succeeds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-hooks-nudge-'))
  const { status, stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), {
    cwd: makeTempDirWithRetros(0),
    env: { VP_KNOWLEDGE_NUDGE_TIPS_FILE: join(dir, 'does-not-exist.txt'), VP_KNOWLEDGE_STATE_DIR: join(dir, 'state') },
  })
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status} on missing reference file — should degrade to empty, not fail` }
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (ctx.includes('Feature:')) return { ok: false, reason: 'tip fragment present despite missing reference file' }
  return { ok: true }
})

test('kill-switch VP_KNOWLEDGE_DISABLE_NUDGE=1: tip absent even with tips available', () => {
  const { stateDir, tipsFile } = makeNudgeFixture()
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), {
    cwd: makeTempDirWithRetros(0),
    env: { VP_KNOWLEDGE_NUDGE_TIPS_FILE: tipsFile, VP_KNOWLEDGE_STATE_DIR: stateDir, VP_KNOWLEDGE_DISABLE_NUDGE: '1' },
  })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (ctx.includes('Feature:')) return { ok: false, reason: 'tip fragment present despite kill-switch set' }
  return { ok: true }
})

test('ring-buffer excludes a recently-shown slug, picks the other tip', () => {
  const { stateDir, tipsFile } = makeNudgeFixture({
    tipLines: [
      '- [nudge] Tip A. Feature: tip-a Added: 2026-01-01',
      '- [nudge] Tip B. Feature: tip-b Added: 2026-01-02',
    ],
  })
  mkdirSync(stateDir, { recursive: true })
  // Far-past date: throttle passes (not "already shown today"), ring populated with tip-a.
  writeFileSync(join(stateDir, 'nudge-state'), '2000-01-01 tip-a\n')
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), {
    cwd: makeTempDirWithRetros(0),
    env: { VP_KNOWLEDGE_NUDGE_TIPS_FILE: tipsFile, VP_KNOWLEDGE_STATE_DIR: stateDir },
  })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (ctx.includes('Feature: tip-a')) return { ok: false, reason: 'recently-shown slug was not excluded from candidates' }
  if (!ctx.includes('Feature: tip-b')) return { ok: false, reason: 'expected the non-excluded tip to be shown' }
  return { ok: true }
})

test('exhausted pool: excludes only the last-shown slug, never repeats it immediately', () => {
  const { stateDir, tipsFile } = makeNudgeFixture({
    tipLines: [
      '- [nudge] Tip A. Feature: tip-a Added: 2026-01-01',
      '- [nudge] Tip B. Feature: tip-b Added: 2026-01-02',
    ],
  })
  mkdirSync(stateDir, { recursive: true })
  // Both tips already shown, tip-b is the LAST (most recent) — the fallback
  // must exclude only tip-b, not fall back to the unfiltered full pool
  // (that would let tip-b repeat immediately, defeating anti-repeat).
  writeFileSync(join(stateDir, 'nudge-state'), '2000-01-01 tip-a tip-b\n')
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), {
    cwd: makeTempDirWithRetros(0),
    env: { VP_KNOWLEDGE_NUDGE_TIPS_FILE: tipsFile, VP_KNOWLEDGE_STATE_DIR: stateDir },
  })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (ctx.includes('Feature: tip-b')) return { ok: false, reason: 'exhausted-pool fallback repeated the most-recently-shown slug immediately' }
  if (!ctx.includes('Feature: tip-a')) return { ok: false, reason: 'expected the non-last-shown tip to fire' }
  return { ok: true }
})

test('single-tip pool: still fires even when that tip is the last shown (no silent fallback)', () => {
  const { stateDir, tipsFile } = makeNudgeFixture({
    tipLines: ['- [nudge] Only tip. Feature: only-one Added: 2026-01-01'],
  })
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(join(stateDir, 'nudge-state'), '2000-01-01 only-one\n')
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), {
    cwd: makeTempDirWithRetros(0),
    env: { VP_KNOWLEDGE_NUDGE_TIPS_FILE: tipsFile, VP_KNOWLEDGE_STATE_DIR: stateDir },
  })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('Feature: only-one')) return { ok: false, reason: 'single-tip pool went silent instead of showing its only tip' }
  return { ok: true }
})

test('ring buffer trims to 5 entries, dropping the oldest slug', () => {
  const { stateDir, tipsFile } = makeNudgeFixture({
    tipLines: [1, 2, 3, 4, 5, 6].map((n) => `- [nudge] Tip ${n}. Feature: s${n} Added: 2026-01-01`),
  })
  mkdirSync(stateDir, { recursive: true })
  // Ring already at max (5 entries); s6 is the only tip not yet shown.
  writeFileSync(join(stateDir, 'nudge-state'), '2000-01-01 s1 s2 s3 s4 s5\n')
  const { stdout } = runHook(join(HOOKS_DIR, 'session-start.sh'), JSON.stringify({ source: 'startup' }), {
    cwd: makeTempDirWithRetros(0),
    env: { VP_KNOWLEDGE_NUDGE_TIPS_FILE: tipsFile, VP_KNOWLEDGE_STATE_DIR: stateDir },
  })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('Feature: s6')) return { ok: false, reason: 'expected the only non-excluded tip (s6) to fire' }
  const state = readFileSync(join(stateDir, 'nudge-state'), 'utf8').trim()
  if (!/^\d{4}-\d{2}-\d{2} s2 s3 s4 s5 s6$/.test(state)) {
    return { ok: false, reason: `ring buffer did not trim correctly, expected "<today> s2 s3 s4 s5 s6", got "${state}"` }
  }
  return { ok: true }
})

// --- post-bm-write-validate.sh ---
console.log('\npost-bm-write-validate.sh')

test('tool_response.permalink → 1 object with schema_validate', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'post-bm-write-validate.sh'),
    JSON.stringify({ tool_response: { permalink: 'npm/my-package' } }))
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('schema_validate')) return { ok: false, reason: 'missing schema_validate instruction' }
  return { ok: true }
})

test('schema permalink → silent', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'post-bm-write-validate.sh'),
    JSON.stringify({ tool_response: { permalink: 'main/schema/npm_package' } }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

test('no permalink → silent', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'post-bm-write-validate.sh'),
    JSON.stringify({ tool_response: {} }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

test('note body with a fourth-wall violation → flagged in additionalContext, still 1 object', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'post-bm-write-validate.sh'),
    JSON.stringify({
      tool_response: { permalink: 'npm/my-package' },
      tool_input: { content: 'my-package does X. It has zero presence in Raindrop.' },
    }))
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('schema_validate')) return { ok: false, reason: 'missing schema_validate instruction alongside the fourth-wall flag' }
  if (!ctx.includes('fw-inventory-claim')) return { ok: false, reason: 'missing fourth-wall violation id in additionalContext' }
  return { ok: true }
})

test('clean note body → no fourth-wall flag, still 1 object', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'post-bm-write-validate.sh'),
    JSON.stringify({
      tool_response: { permalink: 'npm/my-package' },
      tool_input: { content: 'my-package is a solid little utility for doing X.' },
    }))
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count} — multi-object bug!` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (ctx.includes('fw-') || ctx.includes('Fourth-wall check flagged')) return { ok: false, reason: 'unexpected fourth-wall flag on a clean note body — false positive' }
  return { ok: true }
})

test('schema permalink with a violating body → still fully silent (schema skip wins)', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'post-bm-write-validate.sh'),
    JSON.stringify({
      tool_response: { permalink: 'main/schema/npm_package' },
      tool_input: { content: 'zero presence in Raindrop' },
    }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

// --- post-bm-failure-classify.sh ---
console.log('\npost-bm-failure-classify.sh')

for (const [error, contains] of /** @type {const} */ ([
  ['connection refused', '[server-unavailable]'],
  ['note does not exist', '[note-not-found]'],
  ['missing required field', '[invalid-argument]'],
  ['permission denied', '[permission-error]'],
  ['something unexpected', '[unknown-error]'],
])) {
  test(`"${error}" → ${contains}`, () => {
    const { stdout } = runHook(join(HOOKS_DIR, 'post-bm-failure-classify.sh'),
      JSON.stringify({ error }))
    const { count, objects, parseError } = parseJsonObjects(stdout)
    if (parseError) return { ok: false, reason: parseError }
    if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
    const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
    if (!ctx.includes(contains)) return { ok: false, reason: `missing ${contains}` }
    return { ok: true }
  })
}

test('no error field → silent', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'post-bm-failure-classify.sh'),
    JSON.stringify({ tool_input: {} }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

// --- post-file-edit.sh ---
console.log('\npost-file-edit.sh')

const pluginRoot = makeTempPluginRoot()

test('no PLUGIN_ROOT arg → silent', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'post-file-edit.sh'),
    JSON.stringify({ tool_input: { file_path: '/any/path' } }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

test('schema file → 1 object with additionalContext', () => {
  const filePath = join(pluginRoot, 'schemas', 'npm_package.md')
  const { stdout } = runHook(join(HOOKS_DIR, 'post-file-edit.sh'),
    JSON.stringify({ tool_input: { file_path: filePath } }), { args: [pluginRoot] })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
  if (!('additionalContext' in /** @type {Record<string,unknown>} */ (objects[0]))) {
    return { ok: false, reason: 'missing additionalContext' }
  }
  return { ok: true }
})

test('non-matching path → silent', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'post-file-edit.sh'),
    JSON.stringify({ tool_input: { file_path: '/other/file.js' } }), { args: [pluginRoot] })
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

test('shell file with formatting drift → 1 object with shfmt diff', () => {
  const shFile = join(pluginRoot, 'hooks', 'test-drift.sh')
  // Deliberately mis-formatted (no spaces around then, no newline after)
  writeFileSync(shFile, '#!/bin/bash\nif [ x ];then echo hi;fi\n')
  const { stdout } = runHook(join(HOOKS_DIR, 'post-file-edit.sh'),
    JSON.stringify({ tool_input: { file_path: shFile } }), { args: [pluginRoot] })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
  const ctx = String(/** @type {Record<string,unknown>} */ (objects[0]).additionalContext ?? '')
  if (!ctx.includes('shfmt detected formatting drift')) return { ok: false, reason: 'missing drift message' }
  return { ok: true }
})

test('shell file already well-formatted → silent', () => {
  const shFile = join(pluginRoot, 'hooks', 'test-clean.sh')
  // shfmt canonical: spaces around then, newlines after each clause, tab indent
  writeFileSync(shFile, '#!/bin/bash\nif [ x ]; then\n\techo hi\nfi\n')
  const { status, stdout } = runHook(join(HOOKS_DIR, 'post-file-edit.sh'),
    JSON.stringify({ tool_input: { file_path: shFile } }), { args: [pluginRoot] })
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent (no drift), got ${count} objects` }
  return { ok: true }
})

// --- pre-bash-no-python.sh (scoped to knowledge-gardener via agent_type) ---
console.log('\npre-bash-no-python.sh')

// Helper: build stdin with optional agent_type
/**
 * @param {string} command
 * @param {string} [agentType]
 * @returns {string}
 */
function bashInput (command, agentType) {
  /** @type {Record<string,unknown>} */
  const input = { tool_input: { command } }
  if (agentType) input.agent_type = agentType
  return JSON.stringify(input)
}

// --- Scoping tests: main session + other agents should pass through ---

test('python3 from main session (no agent_type) → allowed', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    bashInput('python3 -c "print(1)"'))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} — main session should NOT be blocked` }
  return { ok: true }
})

test('node from main session → allowed', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    bashInput('node -e "console.log(1)"'))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: 'expected silent — main session should NOT be blocked' }
  return { ok: true }
})

test('python3 from other agent (knowledge-maintainer) → allowed', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    bashInput('python3 script.py', 'knowledge-maintainer'))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: 'expected silent — other agents should NOT be blocked' }
  return { ok: true }
})

// --- Gardener-specific blocking tests ---

test('python3 from knowledge-gardener → blocked', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    bashInput('python3 -c "import json"', 'knowledge-gardener'))
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected block, got ${count}` }
  const hso = /** @type {Record<string,unknown>} */ (/** @type {Record<string,unknown>} */ (objects[0]).hookSpecificOutput ?? {})
  if (hso.permissionDecision !== 'deny') return { ok: false, reason: 'expected permissionDecision: deny' }
  return { ok: true }
})

test('node -e from knowledge-gardener → blocked', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    bashInput('node -e "console.log(1)"', 'knowledge-gardener'))
  const { count, objects } = parseJsonObjects(stdout)
  if (count !== 1) return { ok: false, reason: `expected block, got ${count}` }
  const hso = /** @type {Record<string,unknown>} */ (/** @type {Record<string,unknown>} */ (objects[0]).hookSpecificOutput ?? {})
  if (hso.permissionDecision !== 'deny') return { ok: false, reason: 'expected permissionDecision: deny' }
  return { ok: true }
})

test('bash -c "python3 ..." from gardener → blocked (bypass vector)', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    bashInput('bash -c "python3 -c \'import json\'"', 'knowledge-gardener'))
  const { count, objects } = parseJsonObjects(stdout)
  if (count !== 1) return { ok: false, reason: `expected block, got ${count}` }
  const hso = /** @type {Record<string,unknown>} */ (/** @type {Record<string,unknown>} */ (objects[0]).hookSpecificOutput ?? {})
  if (hso.permissionDecision !== 'deny') return { ok: false, reason: 'expected permissionDecision: deny' }
  return { ok: true }
})

// --- Gardener-allowed commands ---

test('jq from knowledge-gardener → allowed', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    bashInput('bm project info main --json | jq .statistics', 'knowledge-gardener'))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count}` }
  return { ok: true }
})

test('bash script from gardener → allowed', () => {
  const { status, stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    bashInput('bash scripts/audit-helpers.sh bm-stats', 'knowledge-gardener'))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count}` }
  return { ok: true }
})

// --- Summary ---
const total = passed + failed
console.log(`\n${passed}/${total} passed`)
if (failed > 0) {
  console.error(`${failed} test(s) failed`)
  process.exit(1)
}
