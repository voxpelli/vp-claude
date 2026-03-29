// @ts-check
// check-hooks.mjs — Integration tests for hook scripts.
// Verifies every hook emits exactly ONE valid JSON object on stdout (or none
// for silent-exit cases). Guards against the multi-object bug that went
// undetected in session-start.sh for 3 releases (v0.15.0–v0.16.0).

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HOOKS_DIR = join(__dirname, '..', 'hooks')

// --- Helpers ---

/** @param {number} n */
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
 * @param {{ args?: string[], cwd?: string }} [opts]
 */
function runHook (script, stdinJson, { args = [], cwd = process.cwd() } = {}) {
  const result = spawnSync('bash', [script, ...args], {
    input: stdinJson,
    cwd,
    env: { ...process.env },
    encoding: 'utf8'
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1
  }
}

/** @param {string} stdout */
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
  const { stdout, status } = runHook(join(HOOKS_DIR, 'post-bm-write-validate.sh'),
    JSON.stringify({ tool_response: { permalink: 'main/schema/npm_package' } }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

test('no permalink → silent', () => {
  const { stdout, status } = runHook(join(HOOKS_DIR, 'post-bm-write-validate.sh'),
    JSON.stringify({ tool_response: {} }))
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
  ['something unexpected', '[unknown-error]']
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
  const { stdout, status } = runHook(join(HOOKS_DIR, 'post-bm-failure-classify.sh'),
    JSON.stringify({ tool_input: {} }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

// --- precompact.sh ---
console.log('\nprecompact.sh')

test('always emits 1 object with additionalContext', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'precompact.sh'), '{}')
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
  if (!('additionalContext' in /** @type {Record<string,unknown>} */ (objects[0]))) {
    return { ok: false, reason: 'missing additionalContext' }
  }
  return { ok: true }
})

// --- post-file-edit.sh ---
console.log('\npost-file-edit.sh')

const pluginRoot = makeTempPluginRoot()

test('no PLUGIN_ROOT arg → silent', () => {
  const { stdout, status } = runHook(join(HOOKS_DIR, 'post-file-edit.sh'),
    JSON.stringify({ tool_input: { file_path: '/any/path' } }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

test('schema file → 1 object with systemMessage', () => {
  const filePath = join(pluginRoot, 'schemas', 'npm_package.md')
  const { stdout } = runHook(join(HOOKS_DIR, 'post-file-edit.sh'),
    JSON.stringify({ tool_input: { file_path: filePath } }), { args: [pluginRoot] })
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 object, got ${count}` }
  if (!('systemMessage' in /** @type {Record<string,unknown>} */ (objects[0]))) {
    return { ok: false, reason: 'missing systemMessage' }
  }
  return { ok: true }
})

test('non-matching path → silent', () => {
  const { stdout, status } = runHook(join(HOOKS_DIR, 'post-file-edit.sh'),
    JSON.stringify({ tool_input: { file_path: '/other/file.js' } }), { args: [pluginRoot] })
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count} objects` }
  return { ok: true }
})

// --- pre-bash-no-python.sh ---
console.log('\npre-bash-no-python.sh')

test('python3 command → blocked', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'python3 -c "import json; print(1)"' } }))
  const { count, objects, parseError } = parseJsonObjects(stdout)
  if (parseError) return { ok: false, reason: parseError }
  if (count !== 1) return { ok: false, reason: `expected 1 block object, got ${count}` }
  const obj = /** @type {Record<string,unknown>} */ (objects[0])
  if (obj.decision !== 'block') return { ok: false, reason: `expected block, got ${JSON.stringify(obj.decision)}` }
  return { ok: true }
})

test('python heredoc → blocked', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'python3 << \'PYEOF\'\nimport json\nPYEOF' } }))
  const { count, objects } = parseJsonObjects(stdout)
  if (count !== 1) return { ok: false, reason: `expected 1 block, got ${count}` }
  if (/** @type {Record<string,unknown>} */ (objects[0]).decision !== 'block') return { ok: false, reason: 'expected block' }
  return { ok: true }
})

test('jq command → allowed (silent)', () => {
  const { stdout, status } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'bm project info main --json | jq .statistics' } }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count}` }
  return { ok: true }
})

test('bash -c "python3 ..." → blocked (bypass vector)', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'bash -c "python3 -c \'import json\'"' } }))
  const { count, objects } = parseJsonObjects(stdout)
  if (count !== 1) return { ok: false, reason: `expected block, got ${count}` }
  if (/** @type {Record<string,unknown>} */ (objects[0]).decision !== 'block') return { ok: false, reason: 'expected block' }
  return { ok: true }
})

test('env python3 → blocked (bypass vector)', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'env python3 -c "print(1)"' } }))
  const { count, objects } = parseJsonObjects(stdout)
  if (count !== 1) return { ok: false, reason: `expected block, got ${count}` }
  if (/** @type {Record<string,unknown>} */ (objects[0]).decision !== 'block') return { ok: false, reason: 'expected block' }
  return { ok: true }
})

test('/usr/bin/python3 → blocked (absolute path)', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: '/usr/bin/python3 script.py' } }))
  const { count, objects } = parseJsonObjects(stdout)
  if (count !== 1) return { ok: false, reason: `expected block, got ${count}` }
  if (/** @type {Record<string,unknown>} */ (objects[0]).decision !== 'block') return { ok: false, reason: 'expected block' }
  return { ok: true }
})

test('echo ... | python3 → blocked (pipe)', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'echo "import json" | python3' } }))
  const { count, objects } = parseJsonObjects(stdout)
  if (count !== 1) return { ok: false, reason: `expected block, got ${count}` }
  if (/** @type {Record<string,unknown>} */ (objects[0]).decision !== 'block') return { ok: false, reason: 'expected block' }
  return { ok: true }
})

test('node -e → blocked', () => {
  const { stdout } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'node -e "console.log(JSON.parse(...))"' } }))
  const { count, objects } = parseJsonObjects(stdout)
  if (count !== 1) return { ok: false, reason: `expected block, got ${count}` }
  if (/** @type {Record<string,unknown>} */ (objects[0]).decision !== 'block') return { ok: false, reason: 'expected block' }
  return { ok: true }
})

test('jq command → allowed (silent)', () => {
  const { stdout, status } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'bm project info main --json | jq .statistics' } }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count}` }
  return { ok: true }
})

test('bash script → allowed (silent)', () => {
  const { stdout, status } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: { command: 'bash scripts/audit-helpers.sh bm-stats' } }))
  if (status !== 0) return { ok: false, reason: `non-zero exit ${status}` }
  const { count } = parseJsonObjects(stdout)
  if (count !== 0) return { ok: false, reason: `expected silent, got ${count}` }
  return { ok: true }
})

test('no command field → silent', () => {
  const { stdout, status } = runHook(join(HOOKS_DIR, 'pre-bash-no-python.sh'),
    JSON.stringify({ tool_input: {} }))
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
