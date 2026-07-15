import assert from 'node:assert'
import { describe, it } from 'node:test'

import { flattenMcpToolName, parseMcpToolName, VP_KNOWLEDGE_SKILL_NAMES } from '../extensions/mcp-mapping.js'

describe('MCP mappings', () => {
  it('flattens the server hyphens and keeps the tool name verbatim', () => {
    assert.strictEqual(flattenMcpToolName('mcp__basic-memory__write_note'), 'basic_memory_write_note')
    assert.strictEqual(flattenMcpToolName('mcp__basic-memory__build_context'), 'basic_memory_build_context')
    assert.strictEqual(flattenMcpToolName('mcp__socket-mcp__depscore'), 'socket_mcp_depscore')
    assert.strictEqual(flattenMcpToolName('mcp__tavily__tavily_search'), 'tavily_tavily_search')
  })

  it('preserves hyphens inside the tool name', () => {
    assert.strictEqual(
      flattenMcpToolName('mcp__plugin_context7_context7__resolve-library-id'),
      'plugin_context7_context7_resolve-library-id'
    )
  })

  it('covers tools the old hand-table forgot (context7, extra raindrop)', () => {
    // These were the silently-unmapped tools; the rule handles them for free.
    assert.strictEqual(flattenMcpToolName('mcp__raindrop__update_tags'), 'raindrop_update_tags')
    assert.strictEqual(flattenMcpToolName('mcp__raindrop__create_highlight'), 'raindrop_create_highlight')
    assert.strictEqual(flattenMcpToolName('mcp__plugin_context7_context7__query-docs'), 'plugin_context7_context7_query-docs')
  })

  it('returns null for non-MCP names', () => {
    assert.strictEqual(flattenMcpToolName('Read'), null)
    assert.strictEqual(flattenMcpToolName('basic_memory_write_note'), null)
    assert.strictEqual(flattenMcpToolName('mcp__incomplete'), null)
  })

  it('VP_KNOWLEDGE_SKILL_NAMES contains expected skills', () => {
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('intel'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('knowledge-prime'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('nudge'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('schema-evolve'))
  })

  it('VP_KNOWLEDGE_SKILL_NAMES no longer carries the pre-0.33.0 merged-away skills', () => {
    // Wave 3 (0.33.0) merged package-intel + tool-intel -> intel and
    // nudge-sync + nudge-adoption -> nudge. Guard against a stale re-add.
    for (const gone of ['package-intel', 'tool-intel', 'nudge-sync', 'nudge-adoption']) {
      assert.ok(!VP_KNOWLEDGE_SKILL_NAMES.has(gone), `${gone} should be gone after the 0.33.0 merge`)
    }
  })

  it('parseMcpToolName splits server and tool (the raw split the proxy path uses)', () => {
    assert.deepStrictEqual(parseMcpToolName('mcp__basic-memory__write_note'), { server: 'basic-memory', tool: 'write_note' })
    // context7: the server SEGMENT is the Claude plugin-prefixed name; guidance
    // maps it to the user's mcp.json key (commonly `context7`) separately.
    assert.deepStrictEqual(
      parseMcpToolName('mcp__plugin_context7_context7__resolve-library-id'),
      { server: 'plugin_context7_context7', tool: 'resolve-library-id' }
    )
    assert.strictEqual(parseMcpToolName('Read'), null)
    assert.strictEqual(parseMcpToolName('mcp__incomplete'), null)
  })
})
