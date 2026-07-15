/**
 * Split a Claude-style MCP tool reference (`mcp__<server>__<tool>`) into its
 * server and tool segments. Returns null for anything that is not a Claude MCP
 * reference. This is the raw split that both `flattenMcpToolName` (the
 * `directTools:true` direct-tool name) and the `mcp` proxy path build on.
 *
 * NOTE ON THE SERVER SEGMENT: `server` here is the segment of the CLAUDE name,
 * which is not always the key a Pi host registers the server under. Claude
 * plugin-hosted servers carry a `plugin_<plugin>_<server>` prefix (e.g.
 * `mcp__plugin_context7_context7__…` → server segment `plugin_context7_context7`,
 * while the Pi `mcp.json` key is typically just `context7`). Servers wired
 * directly (e.g. `basic-memory`, `socket-mcp`) match 1:1. The injected guidance
 * (see `buildMappingGuidance` in index.js) tells the model the proxy `server`
 * arg is the user's `mcp.json` key, and calls out the context7 case.
 *
 * @param {string} claudeName
 * @returns {{ server: string, tool: string } | null}
 */
export function parseMcpToolName (claudeName) {
  if (!claudeName.startsWith('mcp__')) return null
  const rest = claudeName.slice('mcp__'.length)
  const sep = rest.indexOf('__')
  if (sep === -1) return null
  const server = rest.slice(0, sep)
  const tool = rest.slice(sep + 2)
  if (!server || !tool) return null
  return { server, tool }
}

/**
 * Flatten a Claude-style MCP tool reference to the direct-tool name a Pi MCP
 * shim exposes WHEN `directTools:true` is set: drop the `mcp__` prefix, replace
 * the server's hyphens with underscores, and append the tool name UNCHANGED
 * (hyphens inside the tool name are preserved, e.g. `resolve-library-id`).
 * Returns null for anything that is not a Claude MCP reference.
 *
 * Direct-tool names DO NOT EXIST on the default pi-mcp-adapter config
 * (`directTools:false`), where every MCP tool is reachable only through the
 * single `mcp` proxy tool. So the injected guidance leads with the proxy and
 * treats these flat names as the opt-in `directTools:true` path — never assume a
 * flat name is callable without confirming it is in the tool list.
 *
 * @param {string} claudeName
 * @returns {string | null}
 */
export function flattenMcpToolName (claudeName) {
  const parsed = parseMcpToolName(claudeName)
  if (!parsed) return null
  return `${parsed.server.replaceAll('-', '_')}_${parsed.tool}`
}

/**
 * The set of skill names whose activation triggers MCP-guidance injection.
 * These are the vp-knowledge skills that reference `mcp__*` tools and therefore
 * need the Claude→Pi mapping guidance. The merged `nudge` skill is included: it
 * calls `mcp__basic-memory__read_note` in sync mode and additionally
 * `…__edit_note` in check mode, so on a Pi host it needs the mapping too.
 *
 * @type {Set<string>}
 */
export const VP_KNOWLEDGE_SKILL_NAMES = new Set([
  'intel',
  'knowledge-ask',
  'knowledge-gaps',
  'knowledge-garden',
  'knowledge-maintain',
  'knowledge-prime',
  'nudge',
  'people-intel',
  'raindrop-triage',
  'schema-evolve',
  'session-bookmarks',
  'session-reflect',
  'tag-sync',
  'vp-note-quality',
])
