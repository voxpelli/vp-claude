import assert from 'node:assert'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs'

import { getAgentsDir, syncAgentProfiles } from '../extensions/agent-sync.js'

describe('agent-sync', () => {
  const testBase = join(tmpdir(), 'vp-knowledge-sync-test')
  const sourceDir = join(testBase, 'source')
  const targetDir = join(testBase, 'target')

  function clean () {
    try { rmSync(testBase, { recursive: true, force: true }) } catch { /* ignore */ }
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(targetDir, { recursive: true })
  }

  it('copies new files into an empty target: reports added', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'content a', 'utf8')
    writeFileSync(join(sourceDir, 'agent-b.md'), 'content b', 'utf8')

    const result = syncAgentProfiles(sourceDir, targetDir)

    assert.deepStrictEqual(result.added.sort(), ['agent-a.md', 'agent-b.md'])
    assert.deepStrictEqual(result.updated, [])
    assert.deepStrictEqual(result.errors, [])

    assert.strictEqual(readFileSync(join(targetDir, 'agent-a.md'), 'utf8'), 'content a')
    assert.strictEqual(readFileSync(join(targetDir, 'agent-b.md'), 'utf8'), 'content b')
  })

  it('overwrites an existing dest unconditionally: reports updated', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'updated source content', 'utf8')
    // Dest already exists with different (e.g. user-edited) content
    writeFileSync(join(targetDir, 'agent-a.md'), 'stale dest content', 'utf8')

    const result = syncAgentProfiles(sourceDir, targetDir)

    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, ['agent-a.md'])
    assert.deepStrictEqual(result.errors, [])

    assert.strictEqual(readFileSync(join(targetDir, 'agent-a.md'), 'utf8'), 'updated source content')
  })

  it('ignores non-.md files in source', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'content a', 'utf8')
    writeFileSync(join(sourceDir, 'readme.txt'), 'not an agent', 'utf8')

    const result = syncAgentProfiles(sourceDir, targetDir)

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

  it('path safety: rejects an unsafe source filename without escaping targetDir', () => {
    clean()
    // ".. md" contains the ".." traversal substring while still passing the
    // ".md" readdir filter — isManagedAgentName must reject it before any
    // safeJoin/copy is attempted.
    const unsafeName = '..md'
    writeFileSync(join(sourceDir, unsafeName), 'should never land', 'utf8')
    writeFileSync(join(sourceDir, 'agent-a.md'), 'content a', 'utf8')

    const result = syncAgentProfiles(sourceDir, targetDir)

    assert.deepStrictEqual(result.added, ['agent-a.md'])
    assert.deepStrictEqual(result.updated, [])
    assert.strictEqual(result.errors.length, 1)
    assert.strictEqual(result.errors[0]?.file, unsafeName)
    assert.strictEqual(result.errors[0]?.op, 'copy')

    // Nothing escaped targetDir: no file with the unsafe name landed anywhere
    // under testBase outside of the original source copy.
    try {
      readFileSync(join(targetDir, unsafeName), 'utf8')
      assert.fail('unsafe file should not have been copied into targetDir')
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

  it('missing source directory: empty result, no throw', () => {
    clean()
    rmSync(sourceDir, { recursive: true, force: true })

    const result = syncAgentProfiles(sourceDir, targetDir)

    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, [])
    assert.deepStrictEqual(result.errors, [])
  })

  it('empty source directory: no changes', () => {
    clean()
    const result = syncAgentProfiles(sourceDir, targetDir)
    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, [])
    assert.deepStrictEqual(result.errors, [])
  })

  it('collects mkdir errors instead of throwing', () => {
    clean()
    writeFileSync(join(sourceDir, 'agent-a.md'), 'content a', 'utf8')
    // Make targetDir unreachable: its parent is a regular file, so mkdirSync
    // with recursive:true cannot create a directory through it (ENOTDIR).
    const blockerFile = join(testBase, 'blocker')
    writeFileSync(blockerFile, 'not a directory', 'utf8')
    const unreachableTarget = join(blockerFile, 'target')

    const result = syncAgentProfiles(sourceDir, unreachableTarget)

    assert.deepStrictEqual(result.added, [])
    assert.deepStrictEqual(result.updated, [])
    assert.strictEqual(result.errors.length, 1)
    assert.strictEqual(result.errors[0]?.op, 'mkdir')
  })
})

/* eslint-disable n/no-process-env -- getAgentsDir reads the env by design; these tests must set and clear it */

/**
 * Save/restore the VP_KNOWLEDGE_AGENTS_DIR override around a test.
 *
 * @param {string | undefined} saved
 */
function restoreAgentsDirEnv (saved) {
  if (saved === undefined) delete process.env.VP_KNOWLEDGE_AGENTS_DIR
  else process.env.VP_KNOWLEDGE_AGENTS_DIR = saved
}

// This file deliberately does NOT import ./isolate-agents-dir.js, so each test
// owns the VP_KNOWLEDGE_AGENTS_DIR value via save/restore — otherwise the
// `--import` preload (npm test) would pin it and the fallback branch could
// never be exercised.
describe('getAgentsDir', () => {
  it('returns the override when VP_KNOWLEDGE_AGENTS_DIR is set', () => {
    const saved = process.env.VP_KNOWLEDGE_AGENTS_DIR
    const override = join(tmpdir(), 'vpk-explicit-override')
    try {
      process.env.VP_KNOWLEDGE_AGENTS_DIR = override
      // Fails the instant getAgentsDir() reverts to a module-load const that
      // ignores the env — the exact C1 regression class.
      assert.strictEqual(getAgentsDir(), override)
    } finally {
      restoreAgentsDirEnv(saved)
    }
  })

  it('falls back to a ~/.pi/agent/agents path when the override is unset', () => {
    const saved = process.env.VP_KNOWLEDGE_AGENTS_DIR
    try {
      delete process.env.VP_KNOWLEDGE_AGENTS_DIR
      const resolved = getAgentsDir()
      assert.ok(resolved.endsWith(join('agent', 'agents')), `expected a .pi/agent/agents path, got ${resolved}`)
    } finally {
      restoreAgentsDirEnv(saved)
    }
  })

  it('treats an empty override as unset (falsy), matching the isolate module', () => {
    const saved = process.env.VP_KNOWLEDGE_AGENTS_DIR
    try {
      process.env.VP_KNOWLEDGE_AGENTS_DIR = ''
      const resolved = getAgentsDir()
      assert.ok(resolved.endsWith(join('agent', 'agents')), `empty env must fall back to real dir, got ${resolved}`)
    } finally {
      restoreAgentsDirEnv(saved)
    }
  })
})
/* eslint-enable n/no-process-env */
