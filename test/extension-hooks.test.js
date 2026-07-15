// @ts-nocheck — Test file; runtime correctness verified by node:test

// Must precede the extension import: isolates the agent-sync target dir so the
// startup handler never writes to the real ~/.pi/agent/agents/.
import './isolate-agents-dir.js'

import assert from 'node:assert'
import { describe, it } from 'node:test'

import vpKnowledgePiExtension, { __resetStartupMaintenance } from '../extensions/index.js'
import { createMockContext, createMockPi } from './mock-pi-api.js'

// @ts-nocheck — Test file; runtime correctness verified by node:test

describe('event hooks', () => {
  describe('before_agent_start', () => {
    it('injects guidance when vp-knowledge skills are active', async () => {
      const { handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)

      const handler = handlers.get('before_agent_start')[0]
      const event = {
        systemPromptOptions: {
          skills: [{ name: 'knowledge-prime' }],
        },
        systemPrompt: 'base prompt',
      }

      const result = await handler(event, {})

      assert.ok(result)
      assert.ok(result.systemPrompt.includes('MCP Tool Names'))
      // the rule-based guidance shows a flattened example + the proxy fallback
      assert.ok(result.systemPrompt.includes('basic_memory_write_note'))
      assert.ok(result.systemPrompt.includes('`mcp` proxy'))
    })

    it('no-op when skills are absent', async () => {
      const { handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)

      const handler = handlers.get('before_agent_start')[0]
      const event = {
        systemPromptOptions: { skills: [{ name: 'some-other-skill' }] },
        systemPrompt: 'base prompt',
      }

      const result = await handler(event, {})

      assert.strictEqual(result, undefined)
    })
  })

  describe('session_start', () => {
    it('sends guidance message on startup', async () => {
      __resetStartupMaintenance()
      const { calls, handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)

      const handler = handlers.get('session_start')[0]
      const { ctx } = createMockContext()

      await handler({ reason: 'startup' }, ctx)

      const msgCalls = calls.sendMessage.filter(
        (c) => c.message.customType === 'vp-knowledge-context'
      )
      assert.ok(msgCalls.length > 0, 'should send guidance message')
      assert.ok(msgCalls[0].message.content.includes('Knowledge graph context'))
      assert.strictEqual(msgCalls[0].message.display, false)
    })

    it('appends recovery note on reload', async () => {
      __resetStartupMaintenance()
      const { calls, handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)

      const handler = handlers.get('session_start')[0]
      const { ctx } = createMockContext()

      await handler({ reason: 'reload' }, ctx)

      const msgCalls = calls.sendMessage.filter(
        (c) => c.message.customType === 'vp-knowledge-context'
      )
      assert.ok(msgCalls.length > 0)
      assert.ok(
        msgCalls[0].message.content.includes('Session reloaded'),
        'should include reload recovery note'
      )
    })
  })

  describe('tool_result', () => {
    it('returns undefined on aborted signal', async () => {
      const { handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)

      const handler = handlers.get('tool_result')[0]
      const controller = new AbortController()
      controller.abort()
      const { ctx } = createMockContext({ signal: controller.signal })

      const result = await handler({ toolName: 'basic_memory_write_note' }, ctx)

      assert.strictEqual(result, undefined)
    })

    it('classifies BM error and appends recovery text', async () => {
      const { handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)

      const handler = handlers.get('tool_result')[0]
      const { ctx } = createMockContext()

      const event = {
        toolName: 'basic_memory_write_note',
        toolCallId: 'call-1',
        input: {},
        content: [{ type: 'text', text: 'ValidationError: schema validation failed' }],
        details: {},
        isError: true,
      }

      const result = await handler(event, ctx)

      assert.ok(result)
      assert.ok(Array.isArray(result.content))
      const lastText = result.content.at(-1).text
      assert.ok(lastText.includes('schema-violation'))
      assert.ok(lastText.includes('Fix the note structure'))
    })
  })

  describe('session_compact', () => {
    it('sends recovery message', async () => {
      const { calls, handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)

      const handler = handlers.get('session_compact')[0]
      const { ctx } = createMockContext()

      await handler({}, ctx)

      const msgCalls = calls.sendMessage.filter(
        (c) => c.message.customType === 'vp-knowledge-context'
      )
      assert.ok(msgCalls.length > 0)
      assert.ok(msgCalls[0].message.content.includes('Post-compaction recovery'))
      assert.strictEqual(msgCalls[0].message.display, false)
    })

    it('bails silently on stale context error', async () => {
      const { handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)

      const handler = handlers.get('session_compact')[0]
      const { ctx } = createMockContext()

      // Override sendMessage to throw stale-context error
      pi.sendMessage = () => {
        throw new Error('This extension ctx is stale after session replacement or reload.')
      }

      // Should not throw
      await assert.doesNotReject(async () => handler({}, ctx))
    })
  })
})
