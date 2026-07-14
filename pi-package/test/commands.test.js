// @ts-nocheck — Test file; runtime correctness verified by node:test

import assert from 'node:assert'
import { describe, it } from 'node:test'

import vpKnowledgePiExtension from '../extensions/index.js'
import { createMockContext, createMockPi } from './mock-pi-api.js'

describe('commands', () => {
  it('/vpk-sync handler exists and is callable', () => {
    const { commands, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const cmd = commands.get('vpk-sync')
    assert.ok(cmd, 'command should be registered')
    assert.strictEqual(typeof cmd.handler, 'function')
  })

  it('/vpk-sync silently no-ops when !ctx.hasUI', async () => {
    const { commands, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const cmd = commands.get('vpk-sync')
    const { ctx, uiCalls } = createMockContext({ hasUI: false })

    await cmd.handler('', ctx)

    assert.strictEqual(uiCalls.length, 0, 'should not call any UI methods')
  })

  it('/vpk-setup handler exists and is callable', () => {
    const { commands, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const cmd = commands.get('vpk-setup')
    assert.ok(cmd, 'command should be registered')
    assert.strictEqual(typeof cmd.handler, 'function')
  })

  it('/vpk-setup returns early in non-tui mode', async () => {
    const { commands, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const cmd = commands.get('vpk-setup')
    const { ctx, uiCalls } = createMockContext({ mode: 'json' })

    await cmd.handler('', ctx)

    // Should not invoke custom() TUI component in non-tui mode
    const customCalls = uiCalls.filter((u) => u.method === 'custom')
    assert.strictEqual(customCalls.length, 0)
  })
})
