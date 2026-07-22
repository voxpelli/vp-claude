/**
 * /vpk-sync — forced sync of bundled agent profiles.
 *
 * Calls syncAgentProfiles to copy source agent profiles into
 * ~/.pi/agent/agents/, overwriting unconditionally, and reports results via
 * ctx.ui.notify().
 */

import {
  findAgentsSourceDir, formatSyncErrors, getAgentsDir, syncAgentProfiles,
} from './agent-sync.js'

/** @import { SyncResult } from './agent-sync.js' */
/** @import { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent' */

/**
 * @param {SyncResult} result
 * @returns {string}
 */
function formatResult (result) {
  if (result.errors.length > 0) {
    return `Agent sync: ${formatSyncErrors(result)}`
  }
  /** @type {string[]} */
  const parts = []
  if (result.added.length > 0) parts.push(`${result.added.length} added`)
  if (result.updated.length > 0) parts.push(`${result.updated.length} updated`)

  if (parts.length === 0) return 'Agent sync: no changes needed'
  return `Agent sync: ${parts.join(', ')}`
}

/**
 * @param {ExtensionAPI} pi
 * @returns {void}
 */
export function registerUpdateAgentsCommand (pi) {
  const config = {
    description: 'Force-sync vp-knowledge agent profiles into ~/.pi/agent/agents/',
    handler: async (/** @type {string} */ _args, /** @type {ExtensionContext} */ ctx) => {
      if (!ctx.hasUI) return

      const sourceDir = findAgentsSourceDir()
      if (!sourceDir) {
        ctx.ui.notify('Agent sync: could not find agent source directory', 'warning')
        return
      }
      const result = syncAgentProfiles(sourceDir, getAgentsDir())
      const severity = result.errors.length > 0 ? 'error' : 'info'
      ctx.ui.notify(formatResult(result), severity)
    },
  }

  pi.registerCommand('vpk-sync', config)
}
