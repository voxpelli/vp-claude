// @ts-nocheck — Test file; runtime correctness verified by node:test

import assert from 'node:assert'
import { describe, it } from 'node:test'

import vpKnowledgePiExtension from '../extensions/index.js'
import { createMockContext, createMockPi } from './mock-pi-api.js'

describe('commands', () => {
  it('/vp-knowledge-update-agents handler exists and is callable', () => {
    const { commands, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const cmd = commands.get('vp-knowledge-update-agents')
    assert.ok(cmd, 'command should be registered')
    assert.strictEqual(typeof cmd.handler, 'function')
  })

  it('/vp-knowledge-update-agents silently no-ops when !ctx.hasUI', async () => {
    const { commands, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const cmd = commands.get('vp-knowledge-update-agents')
    const { ctx, uiCalls } = createMockContext({ hasUI: false })

    await cmd.handler('', ctx)

    assert.strictEqual(uiCalls.length, 0, 'should not call any UI methods')
  })

  it('/vp-knowledge-settings handler exists and is callable', () => {
    const { commands, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const cmd = commands.get('vp-knowledge-settings')
    assert.ok(cmd, 'command should be registered')
    assert.strictEqual(typeof cmd.handler, 'function')
  })

  it('/vp-knowledge-settings returns early in non-tui mode', async () => {
    const { commands, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const cmd = commands.get('vp-knowledge-settings')
    const { ctx, uiCalls } = createMockContext({ mode: 'json' })

    await cmd.handler('', ctx)

    // Should not invoke custom() TUI component in non-tui mode
    const customCalls = uiCalls.filter((u) => u.method === 'custom')
    assert.strictEqual(customCalls.length, 0)
  })
})
