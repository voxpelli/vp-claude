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

/**
 * Render a SyncResult as one user-facing line.
 *
 * The `considered === 0` arm is the whole point: "the source held no profiles"
 * used to render as "no changes needed", so a sparse checkout reported success
 * having installed nothing. See the SyncResult docblock.
 *
 * @param {import('./agent-sync.js').SyncResult} result
 * @returns {string}
 */
function formatResult (result) {
  if (result.errors.length > 0) {
    return `Agent sync: ${formatSyncErrors(result)}`
  }
  if (result.considered === 0) {
    return 'Agent sync: no agent profiles found in the source directory — nothing was installed'
  }
  /** @type {string[]} */
  const parts = []
  if (result.added.length > 0) parts.push(`${result.added.length} added`)
  if (result.updated.length > 0) parts.push(`${result.updated.length} updated`)

  if (parts.length === 0) return `Agent sync: ${result.unchanged.length} profile(s) already current`
  return `Agent sync: ${parts.join(', ')}`
}

/**
 * @param {import('./agent-sync.js').SyncResult} result
 * @returns {'error'|'warning'|'info'}
 */
function severityFor (result) {
  if (result.errors.length > 0) return 'error'
  if (result.considered === 0) return 'warning'
  return 'info'
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
      const result = syncAgentProfiles(sourceDir, getAgentsDir())
      ctx.ui.notify(formatResult(result), severityFor(result))
    },
  }

  pi.registerCommand('vpk-sync', config)
}
