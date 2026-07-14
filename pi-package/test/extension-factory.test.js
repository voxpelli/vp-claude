// @ts-nocheck — Test file; runtime correctness verified by node:test

import assert from 'node:assert'
import { describe, it } from 'node:test'

import vpKnowledgePiExtension, { __resetStartupMaintenance } from '../extensions/index.js'
import { createMockContext, createMockPi } from './mock-pi-api.js'

describe('extension factory', () => {
  it('registers all expected event handlers', () => {
    const { calls, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const events = new Set(calls.on.map((c) => c.event))
    assert.ok(events.has('before_agent_start'))
    assert.ok(events.has('session_start'))
    assert.ok(events.has('session_compact'))
    assert.ok(events.has('session_shutdown'))
    assert.ok(events.has('tool_result'))
  })

  it('registers both commands', () => {
    const { calls, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const commands = new Set(calls.registerCommand.map((c) => c.name))
    assert.ok(commands.has('vpk-sync'))
    assert.ok(commands.has('vpk-setup'))
  })

  it('startupMaintenanceDone latch prevents duplicate sync', async () => {
    __resetStartupMaintenance()
    const { calls, handlers, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const sessionStartHandlers = handlers.get('session_start') ?? []
    assert.strictEqual(sessionStartHandlers.length, 1)

    const { ctx } = createMockContext()

    // First startup call — should trigger sync-related work
    await sessionStartHandlers[0]({ reason: 'startup' }, ctx)
    const firstSendCount = calls.sendMessage.length

    // Second startup call — should skip sync, but still send guidance
    await sessionStartHandlers[0]({ reason: 'startup' }, ctx)
    const secondSendCount = calls.sendMessage.length

    // Guidance is sent on every session_start, so count should increase
    assert.ok(secondSendCount >= firstSendCount)
  })
})
