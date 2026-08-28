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
 * shim exposes WHEN `directTools` covers it: drop the `mcp__` prefix, join the
 * server and tool segments with `_`, and change NEITHER segment — hyphens
 * survive on both sides (`basic-memory_search_notes`,
 * `hyper-mcp_context7-query_docs`). Returns null for anything that is not a
 * Claude MCP reference.
 *
 * This used to replace the server's hyphens with underscores, and the docblock
 * asserted that as fact. It was wrong: `pi-mcp-adapter`'s `sanitizeServerPrefix`
 * keeps `-` in its valid-character class (`/^[A-Za-z0-9_-]$/`) under the default
 * `"server"` prefix mode, so the adapter registers `basic-memory_search_notes`
 * while this returned `basic_memory_search_notes`. Six of ten sampled
 * derivations missed, including every `basic-memory` tool. The names are not
 * merely unused — `buildMappingGuidance` states the rule in the injected system
 * prompt, and an unknown tool name is silently dropped rather than refused, so
 * the model was told to call tools that do not exist.
 *
 * `test/mcp-mapping.test.js` pins this against a captured registry. Note it runs
 * under `test:node`, which `npm test` includes but `npm run check` does not —
 * this sentence previously named a `check:mcp-mapping` script that has never
 * existed, which is the same overclaiming shape as the bug above.
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
  return `${parsed.server}_${parsed.tool}`
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
