// Defensive: this file instantiates the extension factory. Import the isolation
// seam so any future session_start test added here can't clobber the real dir,
// and so loadConfig() returns DEFAULTS (quality checks ON) deterministically.
import './isolate-agents-dir.js'

import assert from 'node:assert'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { __resetConfigCache } from '../extensions/config.js'
import vpKnowledgePiExtension, { isToolNameError, normalizeBmToolCall } from '../extensions/index.js'
import { createMockContext, createMockPi } from './mock-pi-api.js'

/** @typedef {{ content?: Array<{ type: string, text: string }> } | undefined} ToolResultPatch */

/** @returns {(event: unknown, ctx: unknown) => Promise<ToolResultPatch>} */
function toolResultHandler () {
  const { handlers, pi } = createMockPi()
  vpKnowledgePiExtension(pi)
  const handler = handlers.get('tool_result')?.[0]
  assert.ok(handler, 'tool_result handler should be registered')
  return /** @type {(event: unknown, ctx: unknown) => Promise<ToolResultPatch>} */ (handler)
}

let cfgCounter = 0

/**
 * Run `fn` with `loadConfig()` pinned to a temp config file holding `configObj`,
 * restoring the env + config cache afterwards. loadConfig caches per resolved
 * path, so resetting before AND after keeps a pinned read from leaking into (or
 * out of) other tests.
 *
 * @param {Record<string, unknown>} configObj
 * @param {() => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withConfig (configObj, fn) {
  /* eslint-disable n/no-process-env -- the config-path override is the test seam */
  const orig = process.env.VP_KNOWLEDGE_CONFIG_FILE
  const path = join(tmpdir(), `vpk-tr-config-${process.pid}-${cfgCounter++}.json`)
  writeFileSync(path, JSON.stringify(configObj), 'utf8')
  process.env.VP_KNOWLEDGE_CONFIG_FILE = path
  __resetConfigCache()
  try {
    await fn()
  } finally {
    if (orig === undefined) delete process.env.VP_KNOWLEDGE_CONFIG_FILE
    else process.env.VP_KNOWLEDGE_CONFIG_FILE = orig
    __resetConfigCache()
    try { unlinkSync(path) } catch { /* ignore */ }
  }
  /* eslint-enable n/no-process-env */
}

describe('normalizeBmToolCall', () => {
  it('proxy path: extracts the real tool + parses the JSON-string args', () => {
    const r = normalizeBmToolCall({
      toolName: 'mcp',
      input: { server: 'basic-memory', tool: 'write_note', args: JSON.stringify({ content: 'hi' }) },
    })
    assert.deepStrictEqual(r, { tool: 'write_note', params: { content: 'hi' } })
  })

  it('proxy path: a non-basic-memory server is not a BM call', () => {
    assert.strictEqual(
      normalizeBmToolCall({ toolName: 'mcp', input: { server: 'context7', tool: 'resolve-library-id', args: '{}' } }),
      null
    )
  })

  it('proxy path: malformed args yield empty params (no throw)', () => {
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'mcp', input: { server: 'basic-memory', tool: 'read_note', args: 'not json' } }),
      { tool: 'read_note', params: {} }
    )
  })

  it('flat direct name — the spelling the adapter actually registers', () => {
    // The regression: `basic-memory_` (hyphen) is what pi-mcp-adapter registers.
    // This returned null before 0.34.0, so on every host with directTools for
    // basic-memory the write-time quality checks silently never ran.
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'basic-memory_read_note', input: { identifier: 'x' } }),
      { tool: 'read_note', params: { identifier: 'x' } }
    )
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'basic-memory_write_note', input: { title: 'T' } }),
      { tool: 'write_note', params: { title: 'T' } }
    )
  })

  it('flat direct name — the pre-0.34.0 spelling still matches', () => {
    // Kept deliberately: an older install or a toolPrefix variant may emit it.
    // This is a detector for running checks, not a security boundary, so a
    // false positive costs nothing and a false negative costs a skipped check.
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'basic_memory_read_note', input: { identifier: 'x' } }),
      { tool: 'read_note', params: { identifier: 'x' } }
    )
  })

  it('Claude-style verbatim', () => {
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'mcp__basic-memory__edit_note', input: {} }),
      { tool: 'edit_note', params: {} }
    )
  })

  it('every registered spelling normalizes — all four toolPrefix modes', () => {
    // pi-mcp-adapter registers a different name per mode. Missing one means a
    // real write silently skips every quality check on that host.
    const shapes = {
      'server/short mode': 'basic-memory_read_note',
      'mcp mode (SINGLE underscore before the tool)': 'mcp__basic-memory_read_note',
      'none mode (bare name)': 'read_note',
      'claude-style verbatim': 'mcp__basic-memory__read_note',
      'pre-0.34.0 derived form': 'basic_memory_read_note',
    }
    for (const [label, toolName] of Object.entries(shapes)) {
      assert.deepStrictEqual(
        normalizeBmToolCall({ toolName, input: { identifier: 'x' } }),
        { tool: 'read_note', params: { identifier: 'x' } },
        `${label} (${toolName}) must normalize`
      )
    }
  })

  it('proxy args accept an object, not only a JSON string', () => {
    // The adapter's schema is Union([String, Object]); reading only the string
    // form yielded empty params while still returning a TRUTHY result, so the
    // write was recognised and the fourth-wall check skipped itself silently.
    const expected = { tool: 'write_note', params: { content: 'x' } }
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'mcp', input: { server: 'basic-memory', tool: 'write_note', args: { content: 'x' } } }),
      expected, 'object args'
    )
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'mcp', input: { server: 'basic-memory', tool: 'write_note', args: '{"content":"x"}' } }),
      expected, 'string args'
    )
  })

  it('proxy `server` is optional, and a prefixed tool name is accepted', () => {
    // `server` disambiguates; the adapter resolves an unqualified tool across
    // servers. And mcp({ search }) hands the model the PREFIXED name, so a
    // proxy call carrying it is a documented, working call.
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'mcp', input: { tool: 'write_note', args: '{}' } }),
      { tool: 'write_note', params: {} }
    )
    assert.deepStrictEqual(
      normalizeBmToolCall({ toolName: 'mcp', input: { server: 'basic-memory', tool: 'basic-memory_write_note', args: '{}' } }),
      { tool: 'write_note', params: {} }
    )
  })

  it('does not over-claim a neighbouring server or an unrelated tool', () => {
    // The permissive prefix set must not start swallowing other servers' calls.
    assert.strictEqual(normalizeBmToolCall({ toolName: 'mcp', input: { server: 'raindrop', tool: 'find_bookmarks', args: '{}' } }), null)
    assert.strictEqual(normalizeBmToolCall({ toolName: 'raindrop_find_bookmarks', input: {} }), null)
    assert.strictEqual(normalizeBmToolCall({ toolName: 'search_files', input: {} }), null, 'a bare non-BM name must not match')
  })

  it('isToolNameError matches what a host actually emits', () => {
    // Regression: the old substrings 'tool not found' / 'unknown tool' never
    // matched the adapter's real text, because the name sits between the words.
    assert.ok(isToolNameError('Tool "basic-memory_read_note" not found. Use mcp({ search: "..." }) to search.'))
    assert.ok(isToolNameError('Server "basic-memory" not found. Use mcp({}) to see available servers.'))
    assert.ok(isToolNameError('unknown tool: read_note'), 'the bare phrasing other servers use')
    assert.ok(!isToolNameError('schema validation failed'))
    assert.ok(!isToolNameError('Entity not found: some/note'), 'a missing NOTE is not a missing tool')
  })

  it('returns null for non-BM tools', () => {
    assert.strictEqual(normalizeBmToolCall({ toolName: 'Read', input: {} }), null)
    assert.strictEqual(normalizeBmToolCall({ toolName: 'mcp', input: {} }), null)
  })
})

describe('tool_result handler on the mcp proxy path (the default Pi config)', () => {
  it('fires the fourth-wall check on a write, reading content from the JSON args', async () => {
    const handler = toolResultHandler()
    const { ctx } = createMockContext()
    const result = await handler({
      toolName: 'mcp',
      input: {
        server: 'basic-memory',
        tool: 'write_note',
        args: JSON.stringify({ title: 'X', content: 'This note has zero presence in Raindrop.' }),
      },
      details: {},
      isError: false,
    }, ctx)
    assert.ok(result?.content, 'a proxy write should produce quality-check patches')
    assert.ok(
      result.content.some((c) => c.text.includes('Fourth-wall check flagged')),
      'the fourth-wall check must fire on the proxy path'
    )
  })

  it('preserves the original write result when appending a fourth-wall advisory', async () => {
    const handler = toolResultHandler()
    const { ctx } = createMockContext()
    const original = { type: 'text', text: 'Note created (permalink: npm/example)' }
    const result = await handler({
      toolName: 'mcp',
      input: {
        server: 'basic-memory',
        tool: 'write_note',
        args: JSON.stringify({ title: 'X', content: 'This note has zero presence in Raindrop.' }),
      },
      content: [original],
      details: {},
      isError: false,
    }, ctx)
    assert.ok(result?.content)
    assert.ok(
      result.content.some((c) => c.text.includes('Fourth-wall check flagged')),
      'the advisory must be appended'
    )
    assert.ok(
      result.content.some((c) => c.text === original.text),
      'the original write_note result must survive, not be replaced by the advisory'
    )
  })

  it('adds the schema_validate reminder for a clean write with a permalink', async () => {
    const handler = toolResultHandler()
    const { ctx } = createMockContext()
    const result = await handler({
      toolName: 'mcp',
      input: {
        server: 'basic-memory',
        tool: 'write_note',
        args: JSON.stringify({ content: 'A clean subject sentence about the thing itself.' }),
      },
      details: { permalink: 'npm/example' },
      isError: false,
    }, ctx)
    assert.ok(result?.content)
    assert.ok(result.content.some((c) => c.text.includes('schema_validate')))
  })

  it('classifies a read-family error via the proxy', async () => {
    const handler = toolResultHandler()
    const { ctx } = createMockContext()
    const result = await handler({
      toolName: 'mcp',
      input: { server: 'basic-memory', tool: 'read_note', args: '{}' },
      content: [{ type: 'text', text: 'unknown tool: basic_memory_read_note' }],
      isError: true,
      details: {},
    }, ctx)
    assert.ok(result?.content)
    const lastText = result.content.at(-1)?.text ?? ''
    assert.ok(lastText.includes('tool-missing'))
  })

  it('ignores a non-BM proxy call', async () => {
    const handler = toolResultHandler()
    const { ctx } = createMockContext()
    const result = await handler({
      toolName: 'mcp',
      input: { server: 'context7', tool: 'resolve-library-id', args: '{}' },
      isError: false,
    }, ctx)
    assert.strictEqual(result, undefined)
  })
})

describe('tool_result quality-check opt-outs (config gates)', () => {
  it('qualityChecks.fourthWall:false suppresses the fourth-wall advisory', async () => {
    await withConfig({ qualityChecks: { fourthWall: false } }, async () => {
      const handler = toolResultHandler()
      const { ctx } = createMockContext()
      const result = await handler({
        toolName: 'mcp',
        input: {
          server: 'basic-memory',
          tool: 'write_note',
          // Same planted trigger the enabled test uses; no permalink, so the
          // schema reminder can't fire and mask the fourth-wall gate.
          args: JSON.stringify({ content: 'This note has zero presence in Raindrop.' }),
        },
        details: {},
        isError: false,
      }, ctx)
      assert.ok(
        !(result?.content ?? []).some((c) => c.text.includes('Fourth-wall check flagged')),
        'no fourth-wall advisory when the gate is off'
      )
    })
  })

  it('qualityChecks.schemaValidate:false suppresses the schema_validate reminder', async () => {
    await withConfig({ qualityChecks: { schemaValidate: false } }, async () => {
      const handler = toolResultHandler()
      const { ctx } = createMockContext()
      const result = await handler({
        toolName: 'mcp',
        input: {
          server: 'basic-memory',
          tool: 'write_note',
          // Clean content (no fourth-wall trigger) + a permalink: only the
          // schema gate could fire, so its absence is what the assert isolates.
          args: JSON.stringify({ content: 'A clean subject sentence about the thing itself.' }),
        },
        details: { permalink: 'npm/example' },
        isError: false,
      }, ctx)
      assert.ok(
        !(result?.content ?? []).some((c) => c.text.includes('schema_validate')),
        'no schema reminder when the gate is off'
      )
    })
  })
})
