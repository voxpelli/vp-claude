/**
 * Config loader for vp-knowledge-pi.
 *
 * Reads `~/.pi/agent/extensions/vp-knowledge.json` (read-only). Users
 * hand-edit that file; the extension never writes it. Every load returns
 * the full DEFAULTS shape with only the four known boolean leaves
 * overridden, so missing/null sections can never cause a downstream
 * null-deref and arbitrary keys are never copied (prototype-pollution safe).
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { CONFIG_DIR_NAME } from '@earendil-works/pi-coding-agent'

/**
 * @typedef AgentsConfig
 * @property {boolean} autoSync
 * @typedef QualityChecksConfig
 * @property {boolean} fourthWall
 * @property {boolean} schemaValidate
 * @typedef GuidanceConfig
 * @property {boolean} auditReminders
 * @typedef VpKnowledgeConfig
 * @property {AgentsConfig} agents
 * @property {QualityChecksConfig} qualityChecks
 * @property {GuidanceConfig} guidance
 */

/** @type {VpKnowledgeConfig} */
export const DEFAULTS = {
  agents: {
    autoSync: true,
  },
  qualityChecks: {
    fourthWall: true,
    schemaValidate: true,
  },
  guidance: {
    auditReminders: true,
  },
}

const CONFIG_DIR = join(homedir(), CONFIG_DIR_NAME, 'agent', 'extensions')
const CONFIG_FILE = join(CONFIG_DIR, 'vp-knowledge.json')

/**
 * @returns {string}
 */
export function getConfigPath () {
  return CONFIG_FILE
}

/**
 * Extract a plain-object section from a parsed config, or `undefined`
 * when the section is missing, null, an array, or a non-object. Never
 * indexes into a non-object, so a null section (`{"agents":null}`) is
 * treated as "no overrides" rather than crashing downstream reads.
 *
 * @param {Record<string, unknown>} parsed
 * @param {string} key
 * @returns {Record<string, unknown> | undefined}
 */
function readSection (parsed, key) {
  const section = parsed[key]
  if (typeof section === 'object' && section !== null && !Array.isArray(section)) {
    return /** @type {Record<string, unknown>} */ (section)
  }
}

/** @type {Map<string, VpKnowledgeConfig>} */
const configCache = new Map()

/**
 * Clear the config cache. The module-scope cache is naturally reset by a
 * `/reload` (which re-evaluates the module); this export exists for tests.
 * Safe because config is read-only — nothing mutates a cached value.
 *
 * @returns {void}
 */
export function __resetConfigCache () {
  configCache.clear()
}

/**
 * Load config from disk, overlaying the four known boolean leaves onto a fresh
 * copy of DEFAULTS. Read-only and fail-soft: any missing file, parse error, or
 * non-object shape returns defaults unchanged. Cached per resolved path (config
 * does not change within a process without a `/reload`).
 *
 * The default path honors `VP_KNOWLEDGE_CONFIG_FILE` so tests (and unusual
 * installs) can redirect the read away from the real
 * `~/.pi/agent/extensions/vp-knowledge.json` — matching the VP_KNOWLEDGE_* env
 * isolation used by `test/isolate-agents-dir.js` and `scripts/check-hooks.mjs`.
 *
 * @param {string} [configFile]
 * @returns {VpKnowledgeConfig}
 */
export function loadConfig (configFile = process.env.VP_KNOWLEDGE_CONFIG_FILE || CONFIG_FILE) {
  const cached = configCache.get(configFile)
  if (cached) return cached
  const config = readConfigFile(configFile)
  configCache.set(configFile, config)
  return config
}

/**
 * Read and parse a config file into a full VpKnowledgeConfig. Uncached; the
 * fail-soft parsing body that `loadConfig` memoizes.
 *
 * @param {string} configFile
 * @returns {VpKnowledgeConfig}
 */
function readConfigFile (configFile) {
  /** @type {VpKnowledgeConfig} */
  const config = structuredClone(DEFAULTS)
  if (!existsSync(configFile)) return config
  try {
    const raw = readFileSync(configFile, 'utf8')
    /** @type {unknown} */
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return config
    }
    const root = /** @type {Record<string, unknown>} */ (parsed)

    const agents = readSection(root, 'agents')
    if (agents && typeof agents.autoSync === 'boolean') {
      config.agents.autoSync = agents.autoSync
    }

    const qualityChecks = readSection(root, 'qualityChecks')
    if (qualityChecks && typeof qualityChecks.fourthWall === 'boolean') {
      config.qualityChecks.fourthWall = qualityChecks.fourthWall
    }
    if (qualityChecks && typeof qualityChecks.schemaValidate === 'boolean') {
      config.qualityChecks.schemaValidate = qualityChecks.schemaValidate
    }

    const guidance = readSection(root, 'guidance')
    if (guidance && typeof guidance.auditReminders === 'boolean') {
      config.guidance.auditReminders = guidance.auditReminders
    }
  } catch {
    // fail-soft: return defaults on parse/read error
  }
  return config
}

// TODO(revive): config is read-only — users hand-edit ~/.pi/agent/extensions/vp-knowledge.json.
// If a real user wants persistent toggles from within Pi, re-add an atomic writer here plus a
// /vpk-setup command (see git history for the deleted TUI).
