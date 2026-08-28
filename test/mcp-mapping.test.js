import assert from 'node:assert'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'

import { flattenMcpToolName, parseMcpToolName, VP_KNOWLEDGE_SKILL_NAMES } from '../extensions/mcp-mapping.js'

/**
 * A captured observation of what `pi-mcp-adapter` 2.30.0 actually registered on
 * a real host — NOT a derivation. It must never be regenerated from
 * `flattenMcpToolName`, or this file would assert the transform against itself
 * and pass no matter what the transform does. That is the failure mode this
 * repo has shipped six times.
 *
 * It is also the evidence that settled the bug below: the previous assertions
 * pinned `basic_memory_write_note`, so the test agreed with the code and both
 * were wrong together.
 */
const registry = JSON.parse(
  readFileSync(new URL('fixtures/pi-tool-registry.json', import.meta.url), 'utf8')
)

describe('MCP mappings', () => {
  it('joins the two segments with `_` and changes neither', () => {
    // Regression: these four asserted the underscore-substituted forms until
    // 0.34.0. The adapter keeps `-` in its server-prefix character class, so
    // every one of them named a tool that does not exist.
    assert.strictEqual(flattenMcpToolName('mcp__basic-memory__write_note'), 'basic-memory_write_note')
    assert.strictEqual(flattenMcpToolName('mcp__basic-memory__build_context'), 'basic-memory_build_context')
    assert.strictEqual(flattenMcpToolName('mcp__socket-mcp__depscore'), 'socket-mcp_depscore')
    assert.strictEqual(flattenMcpToolName('mcp__tavily__tavily_search'), 'tavily_tavily_search')
  })

  it('every derivation lands in the real registry', () => {
    // The check that would have caught the bug. Each entry exercises a distinct
    // shape, so a partial regression cannot hide behind the easy cases.
    const direct = new Set(registry.mcpDirect)
    const cases = [
      // hyphen in the server only
      'mcp__basic-memory__search_notes',
      'mcp__basic-memory__read_note',
      'mcp__basic-memory__build_context',
      'mcp__basic-memory__list_directory',
      'mcp__socket-mcp__depscore',
      // hyphens in BOTH segments
      'mcp__hyper-mcp__context7-query_docs',
      'mcp__hyper-mcp__dash-search_documentation',
      // no hyphen anywhere
      'mcp__deepwiki__ask_question',
      'mcp__raindrop__find_bookmarks',
      'mcp__huggingface__read_huggingface_papers',
      // a genuine double prefix — the repetition is in the TOOL name, not a bug
      'mcp__readwise__readwise_search_highlights',
    ]
    for (const claudeName of cases) {
      const flat = flattenMcpToolName(claudeName)
      assert.ok(
        flat && direct.has(flat),
        `${claudeName} -> ${flat} is not a tool the adapter registered`
      )
    }
  })

  it('the fixture still contains a name no derivation could produce', () => {
    // This test used to be called "the fixture is a real capture, not a shape
    // we invented" and asserted only a length, a hyphen, and the builtins
    // array. A reviewer disproved it by building the forged fixture its own
    // note forbids — 28 entries mapped straight through flattenMcpToolName —
    // and all three assertions passed. It was a guard that could not fail,
    // shipped inside the test written to end that bug class.
    //
    // This is the anchor that actually bites. `hyper-mcp_hyper_mcp-list_plugins`
    // is not derivable from any Claude-style `mcp__server__tool` input: the
    // adapter's own server segment appears twice, once hyphenated and once
    // underscored, which no single join of two segments produces. A fixture
    // regenerated from the transform cannot contain it.
    const underivable = 'hyper-mcp_hyper_mcp-list_plugins'
    assert.ok(
      registry.mcpDirect.includes(underivable),
      `the capture must retain ${underivable} — it is the evidence the fixture was observed, not generated`
    )
    assert.strictEqual(
      flattenMcpToolName('mcp__hyper-mcp__hyper_mcp-list_plugins'), underivable,
      'and the transform must still agree with it'
    )
    assert.ok(registry.mcpDirect.length >= 20, 'fixture looks truncated')
    assert.ok(registry._source && registry._capturedAt, 'capture metadata must survive a refresh')
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
    assert.strictEqual(flattenMcpToolName('basic-memory_write_note'), null)
    assert.strictEqual(flattenMcpToolName('mcp__incomplete'), null)
  })

  it('VP_KNOWLEDGE_SKILL_NAMES contains expected skills', () => {
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('intel'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('knowledge-prime'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('nudge'))
    assert.ok(VP_KNOWLEDGE_SKILL_NAMES.has('schema-evolve'))
  })

  it('VP_KNOWLEDGE_SKILL_NAMES matches skills/ on disk', () => {
    // The Set gates system-prompt injection, and is hand-maintained. The two
    // tests around this one assert a few members and a few non-members, which
    // cannot see a skill added or removed later. This can: it globs the source
    // of truth, following check-plugin-load-paths.mjs's precedent of asserting
    // a hand list against disk rather than against another hand list.
    const onDisk = readdirSync(new URL('../skills/', import.meta.url), { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(new URL(`../skills/${e.name}/SKILL.md`, import.meta.url)))
      .map((e) => e.name)
    assert.deepStrictEqual(
      [...VP_KNOWLEDGE_SKILL_NAMES].sort(),
      onDisk.sort(),
      'the Set and skills/ have diverged — a skill was added or removed without updating mcp-mapping.js'
    )
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
