import assert from 'node:assert'
import { describe, it } from 'node:test'

import { flattenMcpToolName, VP_KNOWLEDGE_SKILL_NAMES } from '../extensions/mcp-mapping.js'

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
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('package-intel'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('knowledge-prime'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('tool-intel'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('schema-evolve'))
  })

  it('VP_KNOWLEDGE_SKILL_NAMES does not contain nudge skills', () => {
    assert.strictEqual(VP_KNOWLEDGE_SKILL_NAMES.has('nudge-sync'), false)
    assert.strictEqual(VP_KNOWLEDGE_SKILL_NAMES.has('nudge-adoption'), false)
  })
})
