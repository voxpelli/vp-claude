import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  mkdirSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs'

import {
  __resetConfigCache, DEFAULTS, getConfigPath, loadConfig,
} from '../extensions/config.js'

let counter = 0

/**
 * Allocate a unique temp path and write `contents` to it. Returns the
 * path plus a cleanup function.
 *
 * @param {string} contents
 * @returns {{ path: string, cleanup: () => void }}
 */
function tempConfig (contents) {
  const path = join(tmpdir(), `vp-knowledge-config-${process.pid}-${counter++}.json`)
  writeFileSync(path, contents, 'utf8')
  return {
    cleanup () {
      try { unlinkSync(path) } catch { /* ignore */ }
    },
    path,
  }
}

describe('config', () => {
  it('exports DEFAULTS with expected structure', () => {
    assert.strictEqual(typeof DEFAULTS, 'object')
    assert.strictEqual(DEFAULTS.agents.autoSync, true)
    assert.strictEqual(DEFAULTS.qualityChecks.fourthWall, true)
    assert.strictEqual(DEFAULTS.qualityChecks.schemaValidate, true)
    assert.strictEqual(DEFAULTS.guidance.auditReminders, true)
  })

  it('getConfigPath returns the vp-knowledge.json path', () => {
    assert.ok(getConfigPath().endsWith('vp-knowledge.json'))
  })

  it('loadConfig returns defaults when file does not exist', () => {
    const missing = join(tmpdir(), `vp-knowledge-config-missing-${process.pid}-${counter++}.json`)
    const config = loadConfig(missing)
    assert.deepStrictEqual(config, DEFAULTS)
  })

  it('loadConfig applies a partial override, leaving other leaves default', () => {
    const { cleanup, path } = tempConfig(JSON.stringify({ qualityChecks: { fourthWall: false } }))
    try {
      const config = loadConfig(path)
      assert.strictEqual(config.qualityChecks.fourthWall, false) // flipped
      assert.strictEqual(config.qualityChecks.schemaValidate, true) // default
      assert.strictEqual(config.agents.autoSync, true) // default
      assert.strictEqual(config.guidance.auditReminders, true) // default
    } finally {
      cleanup()
    }
  })

  it('loadConfig returns defaults for malformed JSON (fail-soft, no throw)', () => {
    const { cleanup, path } = tempConfig('{ not json')
    try {
      const config = loadConfig(path)
      assert.deepStrictEqual(config, DEFAULTS)
    } finally {
      cleanup()
    }
  })

  it('loadConfig is immune to a null section (no null-deref crash)', () => {
    const { cleanup, path } = tempConfig(JSON.stringify({ agents: null }))
    try {
      const config = loadConfig(path)
      assert.deepStrictEqual(config, DEFAULTS)
      // The returned object is always the full DEFAULTS shape, so this is safe.
      assert.strictEqual(config.agents.autoSync, true)
    } finally {
      cleanup()
    }
  })

  it('loadConfig is immune to __proto__ pollution', () => {
    // Raw JSON text so the __proto__ key is a real own property in the parse.
    const { cleanup, path } = tempConfig('{ "__proto__": { "polluted": true } }')
    try {
      const config = loadConfig(path)
      // Object.prototype must be untouched.
      assert.strictEqual(/** @type {Record<string, unknown>} */ ({}).polluted, undefined)
      assert.deepStrictEqual(config, DEFAULTS)
    } finally {
      cleanup()
    }
  })

  it('does not cache a transient read failure (a later successful read wins)', () => {
    // Regression for the gate finding: a directory at `path` exists (existsSync
    // true) but readFileSync throws EISDIR — a transient-style read failure.
    // The failed read must NOT be memoized, or it would pin DEFAULTS and mask
    // the user's real config for the whole process.
    __resetConfigCache()
    const path = join(tmpdir(), `vp-knowledge-config-transient-${process.pid}-${counter++}`)
    mkdirSync(path)
    try {
      assert.deepStrictEqual(loadConfig(path), DEFAULTS) // EISDIR → defaults, uncached
      rmSync(path, { recursive: true, force: true })
      writeFileSync(path, JSON.stringify({ qualityChecks: { fourthWall: false } }), 'utf8')
      // If the failed read had been cached, this would still be the default true.
      assert.strictEqual(loadConfig(path).qualityChecks.fourthWall, false)
    } finally {
      rmSync(path, { recursive: true, force: true })
    }
  })

  it('loadConfig ignores a non-boolean leaf, keeping the default', () => {
    const { cleanup, path } = tempConfig(JSON.stringify({ agents: { autoSync: 'yes' } }))
    try {
      const config = loadConfig(path)
      assert.strictEqual(config.agents.autoSync, true) // default, not the string
    } finally {
      cleanup()
    }
  })
})
