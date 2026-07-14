import assert from 'node:assert'
import { describe, it } from 'node:test'

import { MCP_MAPPINGS, VP_KNOWLEDGE_SKILL_NAMES } from '../extensions/mcp-mapping.js'

describe('MCP mappings', () => {
  it('contains basic-memory tools', () => {
    assert.ok(MCP_MAPPINGS.some(m => m.piName === 'basic_memory_write_note'))
    assert.ok(MCP_MAPPINGS.some(m => m.piName === 'basic_memory_search_notes'))
    assert.ok(MCP_MAPPINGS.some(m => m.piName === 'basic_memory_build_context'))
  })

  it('contains raindrop tools', () => {
    assert.ok(MCP_MAPPINGS.some(m => m.piName === 'raindrop_create_bookmarks'))
    assert.ok(MCP_MAPPINGS.some(m => m.piName === 'raindrop_find_bookmarks'))
  })

  it('contains readwise tools', () => {
    assert.ok(MCP_MAPPINGS.some(m => m.piName === 'readwise_reader_search_documents'))
  })

  it('contains tavily tools', () => {
    assert.ok(MCP_MAPPINGS.some(m => m.piName === 'tavily_tavily_search'))
  })

  it('every mapping has claudeName and piName', () => {
    for (const m of MCP_MAPPINGS) {
      assert.ok(m.claudeName, `missing claudeName in ${JSON.stringify(m)}`)
      assert.ok(m.piName, `missing piName in ${JSON.stringify(m)}`)
    }
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
