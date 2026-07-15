/**
 * Config loader for vp-knowledge-pi.
 *
 * Reads/writes `~/.pi/agent/extensions/vp-knowledge.json`.
 * Deep-merges with defaults so partial configs work (user sets one
 * toggle, the rest stay at their defaults).
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  existsSync, mkdirSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs'

import { CONFIG_DIR_NAME } from '@earendil-works/pi-coding-agent'

/**
 * @typedef {object} AgentsConfig
 * @property {boolean} autoSync
 * @typedef {object} QualityChecksConfig
 * @property {boolean} fourthWall
 * @property {boolean} schemaValidate
 * @typedef {object} GuidanceConfig
 * @property {boolean} auditReminders
 * @typedef {object} VpKnowledgeConfig
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
 * Simple deep merge: recursively copy `source` properties into `target`.
 * Only merges plain objects; arrays and other types are overwritten.
 *
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} source
 * @returns {Record<string, unknown>}
 */
function deepMerge (target, source) {
  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = target[key]
    // eslint-disable-next-line unicorn/prefer-ternary
    if (
      typeof sourceVal === 'object' &&
      sourceVal !== null &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      target[key] = deepMerge(
        /** @type {Record<string, unknown>} */ (targetVal),
        /** @type {Record<string, unknown>} */ (sourceVal)
      )
    } else {
      target[key] = sourceVal
    }
  }
  return target
}

/**
 * Load config from disk, merged with defaults.
 *
 * @param {string} [configFile]
 * @returns {VpKnowledgeConfig}
 */
export function loadConfig (configFile = CONFIG_FILE) {
  /** @type {VpKnowledgeConfig} */
  const config = structuredClone(DEFAULTS)
  if (!existsSync(configFile)) return config
  try {
    const raw = readFileSync(configFile, 'utf8')
    /** @type {unknown} */
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      deepMerge(
        /** @type {Record<string, unknown>} */ (config),
        /** @type {Record<string, unknown>} */ (parsed)
      )
    }
  } catch {
    // fail-soft: return defaults on parse error
  }
  return config
}

/**
 * Save config to disk. Writes atomically (tmp + rename) to avoid
 * truncating the existing file on crash.
 *
 * @param {VpKnowledgeConfig} config
 * @param {string} [configFile]
 * @returns {void}
 */
export function saveConfig (config, configFile = CONFIG_FILE) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true })
    const content = `${JSON.stringify(config, null, 2)}\n`
    const tmpFile = `${configFile}.${process.pid}.tmp`
    writeFileSync(tmpFile, content, 'utf8')
    // Atomic rename (POSIX same-filesystem guarantee within ~/.pi)
    renameSync(tmpFile, configFile)
  } catch {
    // fail-soft: don't crash the extension on permission errors
  }
}
