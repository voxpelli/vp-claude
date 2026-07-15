/**
 * /vpk-sync — forced sync of bundled agent profiles.
 *
 * Calls syncAgentProfiles to copy source agent profiles into
 * ~/.pi/agent/agents/, overwriting unconditionally, and reports results via
 * ctx.ui.notify().
 */

import { AGENTS_DIR, findAgentsSourceDir, syncAgentProfiles } from './agent-sync.js'

/**
 * @param {import('./agent-sync.js').SyncResult} result
 * @returns {string}
 */
function formatResult (result) {
  if (result.errors.length > 0) {
    const errorMsgs = result.errors.map((e) => e.message)
    return `Agent sync: ${result.errors.length} error(s): ${errorMsgs.join('; ')}`
  }
  /** @type {string[]} */
  const parts = []
  if (result.added.length > 0) parts.push(`${result.added.length} added`)
  if (result.updated.length > 0) parts.push(`${result.updated.length} updated`)

  if (parts.length === 0) return 'Agent sync: no changes needed'
  return `Agent sync: ${parts.join(', ')}`
}

/**
 * @param {import('@earendil-works/pi-coding-agent').ExtensionAPI} pi
 * @returns {void}
 */
export function registerUpdateAgentsCommand (pi) {
  const config = {
    description: 'Force-sync vp-knowledge agent profiles into ~/.pi/agent/agents/',
    handler: async (/** @type {string} */ _args, /** @type {import('@earendil-works/pi-coding-agent').ExtensionContext} */ ctx) => {
      if (!ctx.hasUI) return

      const sourceDir = findAgentsSourceDir()
      if (!sourceDir) {
        ctx.ui.notify('Agent sync: could not find agent source directory', 'warning')
        return
      }
      const result = syncAgentProfiles(sourceDir, AGENTS_DIR)
      const severity = result.errors.length > 0 ? 'error' : 'info'
      ctx.ui.notify(formatResult(result), severity)
    },
  }

  pi.registerCommand('vpk-sync', config)
}
