/**
 * Agent profile sync engine.
 *
 * Copies bundled agent .md files from a source directory into
 * `~/.pi/agent/agents/`, overwriting unconditionally. Managed files: edit
 * the source in `agents/`, not the installed copies.
 */

import { fileURLToPath } from 'node:url'
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync,
} from 'node:fs'
import {
  dirname, isAbsolute, join, resolve, sep,
} from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

/* ── Types ─────────────────────────────────────────────────────────────── */

/** @typedef {'read-src'|'copy'|'mkdir'} SyncOp */

/** @typedef {{ file?: string, op: SyncOp, message: string }} SyncError */

/** @typedef {{ added: string[], updated: string[], errors: SyncError[] }} SyncResult */

/**
 * Allowlist for managed-agent filenames.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isManagedAgentName (name) {
  if (typeof name !== 'string' || name.length === 0) return false
  if (name.includes('\0')) return false
  if (name.includes('/') || name.includes('\\')) return false
  if (name === '.' || name === '..') return false
  if (name.includes('..')) return false
  if (isAbsolute(name)) return false
  if (!name.endsWith('.md')) return false
  return true
}

/**
 * @param {string} targetDir
 * @param {string} name
 * @returns {string|null}
 */
function safeJoin (targetDir, name) {
  const resolved = resolve(targetDir, name)
  const root = resolve(targetDir) + sep
  if (!resolved.startsWith(root)) return null
  return resolved
}

/* ── Sync Engine ───────────────────────────────────────────────────────── */

// TODO(revive): agent profiles are now dumb-copied (source of truth is
// agents/ in the repo — edit there, not the installed copies). The removed
// sha256 manifest gated user-edited copies as pendingUpdate; restore it (see
// git history) if users start hand-editing ~/.pi/agent/agents/*.md and need
// those edits preserved across syncs.

/**
 * @param {string} sourceDir
 * @param {string} targetDir
 * @returns {SyncResult}
 */
export function syncAgentProfiles (sourceDir, targetDir) {
  /** @type {SyncResult} */
  const result = {
    added: [],
    updated: [],
    errors: [],
  }

  if (!existsSync(sourceDir)) return result

  try {
    mkdirSync(targetDir, { recursive: true })
  } catch (err) {
    result.errors.push({
      op: 'mkdir',
      message: err instanceof Error ? err.message : String(err),
    })
    return result
  }

  // Enumerate source .md files
  /** @type {string[]} */
  let sourceEntries
  try {
    sourceEntries = readdirSync(sourceDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
  } catch (err) {
    result.errors.push({
      op: 'read-src',
      message: err instanceof Error ? err.message : String(err),
    })
    return result
  }

  for (const entry of sourceEntries) {
    if (!isManagedAgentName(entry)) {
      result.errors.push({ file: entry, op: 'copy', message: 'rejected unsafe path' })
      continue
    }

    const dest = safeJoin(targetDir, entry)
    if (dest === null) {
      result.errors.push({ file: entry, op: 'copy', message: 'rejected unsafe path' })
      continue
    }

    const src = join(sourceDir, entry)
    const existedBefore = existsSync(dest)

    try {
      // Content-diff before overwrite: skip an identical dest so `updated`
      // counts only real changes, not every no-op sync. Both reads are inside
      // this try, so an I/O error is collected like any other copy failure.
      if (existedBefore && readFileSync(src).equals(readFileSync(dest))) {
        continue
      }
      copyFileSync(src, dest)
      if (existedBefore) {
        result.updated.push(entry)
      } else {
        result.added.push(entry)
      }
    } catch (err) {
      result.errors.push({
        file: entry,
        op: 'copy',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

/**
 * Format a SyncResult's errors into one human line naming each op/file/message,
 * or '' when there were none. Shared so the startup path and `/vpk-sync` report
 * errors identically rather than as a bare count.
 *
 * @param {SyncResult} result
 * @returns {string}
 */
export function formatSyncErrors (result) {
  if (result.errors.length === 0) return ''
  const detail = result.errors
    .map((e) => `${e.op}${e.file ? ` ${e.file}` : ''}: ${e.message}`)
    .join('; ')
  return `${result.errors.length} error(s): ${detail}`
}

/* ── Source/target resolution ──────────────────────────────────────────── */

/**
 * Resolve the agent-profiles target dir (`~/.pi/agent/agents/`) at call time.
 *
 * Deliberately a function, not a module-load `const`: an ESM `const` binds its
 * value once at import, before a test can redirect it, so the startup sync
 * would write into the contributor's real `~/.pi/agent/agents/` during
 * `npm test`. Reading `VP_KNOWLEDGE_AGENTS_DIR` at call time lets tests point it
 * at an isolated tmpdir (see `test/isolate-agents-dir.js`); the override is also
 * a legitimate way to redirect an install. Mirrors the `VP_KNOWLEDGE_*`
 * env-isolation pattern already used by `scripts/check-hooks.mjs`.
 *
 * An empty `VP_KNOWLEDGE_AGENTS_DIR` (e.g. `VAR= npm test`) is treated as unset:
 * `||` (not `??`) falls back to the real dir, and `test/isolate-agents-dir.js`
 * uses the same falsy check so the two never disagree on the empty string.
 *
 * @returns {string}
 */
export function getAgentsDir () {
  return process.env.VP_KNOWLEDGE_AGENTS_DIR || join(getAgentDir(), 'agents')
}

/**
 * Resolve the extension's install directory at runtime.
 *
 * @returns {string}
 */
function resolveExtensionDir () {
  return dirname(fileURLToPath(import.meta.url))
}

/**
 * Find the agents source directory: the sibling `../agents` dir relative to
 * the extension's install dir. In the single-root hybrid layout the
 * extension lives at repo-root `extensions/`, so `../agents` is the one
 * canonical location for both local dev and a `pi install git:` whole-tree
 * clone.
 *
 * @returns {string | undefined}
 */
export function findAgentsSourceDir () {
  /** @type {string | undefined} */
  let extDir
  try {
    extDir = resolveExtensionDir()
  } catch {
    return
  }
  const candidate = join(extDir, '..', 'agents')
  if (existsSync(candidate)) return candidate
}
