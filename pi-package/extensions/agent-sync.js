/**
 * Agent profile sync engine.
 *
 * Synchronises bundled agent .md files from a source directory into
 * `~/.pi/agent/agents/` with a sha256 manifest for smart gating.
 *
 * Simplified from rpiv-pi's syncBundledAgents — no stale removal, no model
 * injection, no per-cwd cleanup. Just copy new, update unchanged-managed,
 * and gate user-edited files.
 */

import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  copyFileSync, existsSync, mkdirSync, readdirSync,
  readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs'
import {
  dirname, isAbsolute, join, resolve, sep,
} from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'

/* ── Types ─────────────────────────────────────────────────────────────── */

/** @typedef {'read-src'|'read-dest'|'copy'|'mkdir'|'manifest-write'} SyncOp */

/** @typedef {{ file?: string, op: SyncOp, message: string }} SyncError */

/** @typedef {{ added: string[], updated: string[], unchanged: string[], pendingUpdate: string[], errors: SyncError[] }} SyncResult */

/* ── Manifest ──────────────────────────────────────────────────────────── */

const MANIFEST_FILE = '.vp-knowledge-managed.json'

/** @typedef {Record<string, string>} Manifest */

/**
 * @param {Buffer|string} buf
 * @returns {string}
 */
function sha256 (buf) {
  return createHash('sha256').update(buf).digest('hex')
}

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

/**
 * @param {string} targetDir
 * @returns {Manifest}
 */
function readManifest (targetDir) {
  const manifestPath = join(targetDir, MANIFEST_FILE)
  if (!existsSync(manifestPath)) return {}
  try {
    const raw = readFileSync(manifestPath, 'utf8')
    /** @type {unknown} */
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      /** @type {Manifest} */
      const out = {}
      for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (parsed))) {
        if (typeof v === 'string' && isManagedAgentName(k)) out[k] = v
      }
      return out
    }
    return {}
  } catch {
    return {}
  }
}

/**
 * @param {string} targetDir
 * @param {Manifest} manifest
 * @param {SyncResult} result
 */
function writeManifest (targetDir, manifest, result) {
  const manifestPath = join(targetDir, MANIFEST_FILE)
  try {
    /** @type {Manifest} */
    const ordered = {}
    for (const k of Object.keys(manifest).sort()) ordered[k] = manifest[k] ?? ''
    const content = `${JSON.stringify(ordered, null, 2)}\n`
    const tmpFile = join(targetDir, `${MANIFEST_FILE}.${process.pid}.tmp`)
    try {
      writeFileSync(tmpFile, content, 'utf8')
      renameSync(tmpFile, manifestPath)
    } catch (err) {
      try { unlinkSync(tmpFile) } catch { /* ignore */ }
      throw err
    }
  } catch (err) {
    result.errors.push({
      op: 'manifest-write',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

/* ── Sync Engine ───────────────────────────────────────────────────────── */

/**
 * @param {{ knownHash: string, destHash: string }} opts
 * @returns {boolean}
 */
function isSafeToOverwrite (opts) {
  const { destHash, knownHash } = opts
  return knownHash !== '' && destHash === knownHash
}

/**
 * @param {string} sourceDir
 * @param {string} targetDir
 * @param {boolean} apply
 * @returns {SyncResult}
 */
export function syncAgentProfiles (sourceDir, targetDir, apply) {
  /** @type {SyncResult} */
  const result = {
    added: [],
    updated: [],
    unchanged: [],
    pendingUpdate: [],
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
    sourceEntries = readdirSync(sourceDir).filter((f) => f.endsWith('.md'))
  } catch (err) {
    result.errors.push({
      op: 'read-src',
      message: err instanceof Error ? err.message : String(err),
    })
    return result
  }

  const manifest = readManifest(targetDir)
  /** @type {Manifest} */
  const newManifest = {}

  // Process each source file
  for (const entry of sourceEntries) {
    const src = join(sourceDir, entry)
    const dest = safeJoin(targetDir, entry)
    const knownHash = manifest[entry] ?? ''

    if (dest === null) {
      result.errors.push({ file: entry, op: 'copy', message: 'rejected unsafe path' })
      newManifest[entry] = knownHash
      continue
    }

    /** @type {Buffer} */
    let srcContent
    try {
      srcContent = readFileSync(src)
    } catch (err) {
      result.errors.push({
        file: entry,
        op: 'read-src',
        message: err instanceof Error ? err.message : String(err),
      })
      newManifest[entry] = knownHash
      continue
    }
    const srcHash = sha256(srcContent)

    if (!existsSync(dest)) {
      try {
        copyFileSync(src, dest)
        result.added.push(entry)
        newManifest[entry] = srcHash
      } catch (err) {
        result.errors.push({
          file: entry,
          op: 'copy',
          message: err instanceof Error ? err.message : String(err),
        })
        newManifest[entry] = knownHash
      }
      continue
    }

    /** @type {Buffer} */
    let destContent
    try {
      destContent = readFileSync(dest)
    } catch (err) {
      result.errors.push({
        file: entry,
        op: 'read-dest',
        message: err instanceof Error ? err.message : String(err),
      })
      newManifest[entry] = knownHash
      continue
    }
    const destHash = sha256(destContent)

    if (srcHash === destHash) {
      result.unchanged.push(entry)
      newManifest[entry] = srcHash
      continue
    }

    if (apply || isSafeToOverwrite({ knownHash, destHash })) {
      try {
        copyFileSync(src, dest)
        result.updated.push(entry)
        newManifest[entry] = srcHash
      } catch (err) {
        result.errors.push({
          file: entry,
          op: 'copy',
          message: err instanceof Error ? err.message : String(err),
        })
        newManifest[entry] = knownHash
      }
    } else {
      result.pendingUpdate.push(entry)
      newManifest[entry] = knownHash
    }
  }

  // Carry forward manifest entries for files not in source (no stale removal,
  // but we need to preserve their hashes so future syncs can detect drift).
  for (const [name, hash] of Object.entries(manifest)) {
    if (!newManifest[name]) newManifest[name] = hash
  }

  writeManifest(targetDir, newManifest, result)
  return result
}

/* ── Source/target resolution ──────────────────────────────────────────── */

/** Target directory for agent profiles. */
export const AGENTS_DIR = join(getAgentDir(), 'agents')

/**
 * Resolve the extension's install directory at runtime.
 *
 * @returns {string}
 */
function resolveExtensionDir () {
  return dirname(fileURLToPath(import.meta.url))
}

/**
 * Find the agents source directory.
 * Tries sibling `agents/` (npm/local dev) then grandparent `agents/` (git clone).
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
  const candidates = [
    join(extDir, '..', 'agents'),
    join(extDir, '..', '..', 'agents'),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
}
