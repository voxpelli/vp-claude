import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  mkdirSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs'

import { DEFAULTS, loadConfig, saveConfig } from '../extensions/config.js'

describe('config', () => {
  const testDir = join(tmpdir(), 'vp-knowledge-config-test')
  const testFile = join(testDir, 'test-config.json')

  // Ensure clean state
  try { mkdirSync(testDir, { recursive: true }) } catch { /* ignore */ }
  try { unlinkSync(testFile) } catch { /* ignore */ }

  it('exports DEFAULTS with expected structure', () => {
    assert.strictEqual(typeof DEFAULTS, 'object')
    assert.strictEqual(DEFAULTS.agents.autoSync, true)
    assert.strictEqual(DEFAULTS.qualityChecks.fourthWall, true)
    assert.strictEqual(DEFAULTS.qualityChecks.schemaValidate, true)
    assert.strictEqual(DEFAULTS.guidance.auditReminders, true)
  })

  it('loadConfig returns defaults when file does not exist', () => {
    const config = loadConfig(testFile)
    assert.deepStrictEqual(config.agents, DEFAULTS.agents)
    assert.deepStrictEqual(config.qualityChecks, DEFAULTS.qualityChecks)
    assert.deepStrictEqual(config.guidance, DEFAULTS.guidance)
  })

  it('loadConfig merges partial config with defaults', () => {
    writeFileSync(testFile, JSON.stringify({ agents: { autoSync: false } }), 'utf8')
    const config = loadConfig(testFile)
    // Changed field
    assert.strictEqual(config.agents.autoSync, false)
    // Unchanged fields still have defaults
    assert.strictEqual(config.qualityChecks.fourthWall, true)
    assert.strictEqual(config.qualityChecks.schemaValidate, true)
    assert.strictEqual(config.guidance.auditReminders, true)
  })

  it('loadConfig handles nested partial config', () => {
    writeFileSync(testFile, JSON.stringify({
      qualityChecks: { fourthWall: false },
    }), 'utf8')
    const config = loadConfig(testFile)
    assert.strictEqual(config.agents.autoSync, true) // default
    assert.strictEqual(config.qualityChecks.fourthWall, false) // changed
    assert.strictEqual(config.qualityChecks.schemaValidate, true) // default
    assert.strictEqual(config.guidance.auditReminders, true) // default
  })

  it('loadConfig handles empty object as defaults', () => {
    writeFileSync(testFile, '{}', 'utf8')
    const config = loadConfig(testFile)
    assert.deepStrictEqual(config, DEFAULTS)
  })

  it('loadConfig handles malformed JSON gracefully', () => {
    writeFileSync(testFile, '{ not json', 'utf8')
    const config = loadConfig(testFile)
    assert.deepStrictEqual(config, DEFAULTS)
  })

  it('saveConfig writes valid JSON', () => {
    const config = {
      agents: { autoSync: false },
      qualityChecks: { fourthWall: false, schemaValidate: true },
      guidance: { auditReminders: false },
    }
    saveConfig(config, testFile)
    const raw = readFileSync(testFile, 'utf8')
    const parsed = JSON.parse(raw)
    assert.deepStrictEqual(parsed, config)
  })

  it('round-trip: save then load preserves values', () => {
    const original = {
      agents: { autoSync: false },
      qualityChecks: { fourthWall: true, schemaValidate: false },
      guidance: { auditReminders: true },
    }
    saveConfig(original, testFile)
    const loaded = loadConfig(testFile)
    assert.deepStrictEqual(loaded, original)
  })

  it('saveConfig is atomic (writes complete file)', () => {
    const config = { agents: { autoSync: true }, qualityChecks: { fourthWall: true, schemaValidate: true }, guidance: { auditReminders: true } }
    saveConfig(config, testFile)
    // File should be valid JSON, not truncated
    const raw = readFileSync(testFile, 'utf8')
    assert.ok(raw.endsWith('\n')) // trailing newline
    assert.doesNotThrow(() => JSON.parse(raw))
  })
})
