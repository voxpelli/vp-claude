/**
 * /vp-knowledge-update-agents — forced sync of bundled agent profiles.
 *
 * Calls syncAgentProfiles with apply=true (bypasses the smart gate) and
 * reports results via ctx.ui.notify().
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
  if (result.unchanged.length > 0) parts.push(`${result.unchanged.length} unchanged`)
  if (result.pendingUpdate.length > 0) parts.push(`${result.pendingUpdate.length} pending update (user-edited)`)

  if (parts.length === 0) return 'Agent sync: no changes needed'
  return `Agent sync: ${parts.join(', ')}`
}

/**
 * @param {import('@earendil-works/pi-coding-agent').ExtensionAPI} pi
 * @returns {void}
 */
export function registerUpdateAgentsCommand (pi) {
  pi.registerCommand('vp-knowledge-update-agents', {
    description: 'Force-sync vp-knowledge agent profiles into ~/.pi/agent/agents/',
    handler: async (_args, ctx) => {
      const sourceDir = findAgentsSourceDir()
      if (!sourceDir) {
        ctx.ui.notify('Agent sync: could not find agent source directory', 'warning')
        return
      }
      const result = syncAgentProfiles(sourceDir, AGENTS_DIR, true)
      const severity = result.errors.length > 0 ? 'warning' : 'info'
      ctx.ui.notify(formatResult(result), severity)
    },
  })
}
