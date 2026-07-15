/**
 * Flatten a Claude-style MCP tool reference (`mcp__<server>__<tool>`) to the
 * direct-tool name a Pi MCP shim (e.g. pi-mcp-adapter) exposes: drop the
 * `mcp__` prefix, replace the server's hyphens with underscores, and append the
 * tool name UNCHANGED (hyphens inside the tool name are preserved, e.g.
 * `resolve-library-id`). Returns null for anything that is not a Claude MCP
 * reference.
 *
 * This replaces a hand-maintained lookup table. A rule covers every server and
 * tool without enumeration, so a skill referencing a tool the table forgot can
 * no longer silently break, and the mapping cannot promise a `directTools:false`
 * tool that does not actually exist. Where a Pi host registered a server under a
 * different name than the Claude prefix implies, the injected guidance points the
 * model at the `mcp` proxy fallback (see `buildMappingGuidance` in index.js).
 *
 * @param {string} claudeName
 * @returns {string | null}
 */
export function flattenMcpToolName (claudeName) {
  if (!claudeName.startsWith('mcp__')) return null
  const rest = claudeName.slice('mcp__'.length)
  const sep = rest.indexOf('__')
  if (sep === -1) return null
  const server = rest.slice(0, sep)
  const tool = rest.slice(sep + 2)
  if (!server || !tool) return null
  return `${server.replaceAll('-', '_')}_${tool}`
}

/**
 * The set of skill names whose activation triggers MCP-guidance injection.
 * Skills that reference no `mcp__*` tools (the nudge pair) are deliberately
 * omitted so the guidance only appears when it is relevant.
 *
 * @type {Set<string>}
 */
export const VP_KNOWLEDGE_SKILL_NAMES = new Set([
  'knowledge-ask',
  'knowledge-gaps',
  'knowledge-garden',
  'knowledge-maintain',
  'knowledge-prime',
  'package-intel',
  'people-intel',
  'raindrop-triage',
  'schema-evolve',
  'session-bookmarks',
  'session-reflect',
  'tag-sync',
  'tool-intel',
  'vp-note-quality',
])
