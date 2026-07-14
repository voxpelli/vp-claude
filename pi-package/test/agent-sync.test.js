import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs'

import { syncAgentProfiles } from '../extensions/agent-sync.js'

describe('agent-sync', () => {
  const testBase = join(tmpdir(), 'vp-knowledge-sync-test')
  const sourceDir = join(testBase, 'source')
  const targetDir = join(testBase, 'target')

  function clean () {
    try { rmSync(testBase, { recursive: true, force: true }) } catch { /* ignore */ }
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(targetDir, { recursive: true })
  }

  it('first run: copies all source files', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'content a', 'utf8')
    writeFileSync(join(sourceDir, 'agent-b.md'), 'content b', 'utf8')

    const result = syncAgentProfiles(sourceDir, targetDir, false)

    assert.deepStrictEqual(result.added.sort(), ['agent-a.md', 'agent-b.md'])
    assert.deepStrictEqual(result.updated, [])
    assert.deepStrictEqual(result.unchanged, [])
    assert.deepStrictEqual(result.pendingUpdate, [])
    assert.deepStrictEqual(result.errors, [])

    assert.strictEqual(readFileSync(join(targetDir, 'agent-a.md'), 'utf8'), 'content a')
    assert.strictEqual(readFileSync(join(targetDir, 'agent-b.md'), 'utf8'), 'content b')
  })

  it('second run with no changes: reports unchanged', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'content a', 'utf8')

    syncAgentProfiles(sourceDir, targetDir, false)
    const result = syncAgentProfiles(sourceDir, targetDir, false)

    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, [])
    assert.deepStrictEqual(result.unchanged, ['agent-a.md'])
    assert.deepStrictEqual(result.pendingUpdate, [])
    assert.deepStrictEqual(result.errors, [])
  })

  it('smart gate: does not overwrite user-edited file', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'original', 'utf8')

    // First sync
    syncAgentProfiles(sourceDir, targetDir, false)

    // User edits the file
    writeFileSync(join(targetDir, 'agent-a.md'), 'user-edited', 'utf8')

    // Source changes
    writeFileSync(join(sourceDir, 'agent-a.md'), 'updated', 'utf8')

    // Second sync (apply=false) — should gate the update
    const result = syncAgentProfiles(sourceDir, targetDir, false)

    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, [])
    assert.deepStrictEqual(result.unchanged, [])
    assert.deepStrictEqual(result.pendingUpdate, ['agent-a.md'])
    assert.deepStrictEqual(result.errors, [])

    // User edit preserved
    assert.strictEqual(readFileSync(join(targetDir, 'agent-a.md'), 'utf8'), 'user-edited')
  })

  it('forced sync (apply=true) overwrites user-edited file', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'original', 'utf8')

    // First sync
    syncAgentProfiles(sourceDir, targetDir, false)

    // User edits
    writeFileSync(join(targetDir, 'agent-a.md'), 'user-edited', 'utf8')

    // Source changes
    writeFileSync(join(sourceDir, 'agent-a.md'), 'updated', 'utf8')

    // Forced sync (apply=true)
    const result = syncAgentProfiles(sourceDir, targetDir, true)

    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, ['agent-a.md'])
    assert.deepStrictEqual(result.pendingUpdate, [])
    assert.deepStrictEqual(result.errors, [])

    // File overwritten
    assert.strictEqual(readFileSync(join(targetDir, 'agent-a.md'), 'utf8'), 'updated')
  })

  it('ignores non-.md files in source', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'content a', 'utf8')
    writeFileSync(join(sourceDir, 'readme.txt'), 'not an agent', 'utf8')

    const result = syncAgentProfiles(sourceDir, targetDir, false)

    assert.deepStrictEqual(result.added, ['agent-a.md'])
    assert.strictEqual(readFileSync(join(targetDir, 'agent-a.md'), 'utf8'), 'content a')
    // readme.txt should NOT be copied
    try {
      readFileSync(join(targetDir, 'readme.txt'), 'utf8')
      assert.fail('readme.txt should not be copied')
    } catch (err) {
      assert.ok(
        err instanceof Error &&
        (
          err.message.includes('ENOENT') ||
          ('code' in err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT')
        )
      )
    }
  })

  it('manifest is written after sync', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'content a', 'utf8')

    syncAgentProfiles(sourceDir, targetDir, false)

    const manifestPath = join(targetDir, '.vp-knowledge-managed.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    assert.ok(typeof manifest['agent-a.md'] === 'string')
    assert.strictEqual(manifest['agent-a.md'].length, 64) // sha256 hex
  })

  it('empty source directory: no changes', () => {
    clean()
    const result = syncAgentProfiles(sourceDir, targetDir, false)
    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, [])
    assert.deepStrictEqual(result.unchanged, [])
    assert.deepStrictEqual(result.pendingUpdate, [])
    assert.deepStrictEqual(result.errors, [])
  })

  it('non-existent source directory: no changes', () => {
    clean()
    rmSync(sourceDir, { recursive: true, force: true })
    const result = syncAgentProfiles(sourceDir, targetDir, false)
    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, [])
    assert.deepStrictEqual(result.unchanged, [])
    assert.deepStrictEqual(result.pendingUpdate, [])
    assert.deepStrictEqual(result.errors, [])
  })
})
