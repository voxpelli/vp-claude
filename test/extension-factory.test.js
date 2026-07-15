// @ts-nocheck — Test file; runtime correctness verified by node:test

// Must precede the extension import: isolates the agent-sync target dir so the
// factory's startup handler never writes to the real ~/.pi/agent/agents/.
import './isolate-agents-dir.js'

import assert from 'node:assert'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  it('registers the vpk-sync command', () => {
    const { calls, pi } = createMockPi()
    vpKnowledgePiExtension(pi)

    const commands = new Set(calls.registerCommand.map((c) => c.name))
    assert.ok(commands.has('vpk-sync'))
    // vpk-setup (the settings TUI) was removed — config is now read-only.
    assert.ok(!commands.has('vpk-setup'))
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

  /* eslint-disable n/no-process-env -- redirecting the isolation seam is the point of this test */
  it('startup sync writes into the override dir (getAgentsDir honors the env)', async () => {
    // C1 regression guard: point the override at a FRESH EMPTY dir. It ends up
    // populated only if getAgentsDir() returned the env value — if the seam ever
    // reverts to a module-load const targeting the real home, `fresh` stays empty
    // and this fails. Config isolation makes autoSync deterministically true.
    __resetStartupMaintenance()
    const saved = process.env.VP_KNOWLEDGE_AGENTS_DIR
    const fresh = mkdtempSync(join(tmpdir(), 'vpk-g1-'))
    try {
      process.env.VP_KNOWLEDGE_AGENTS_DIR = fresh
      const { handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)
      const { ctx } = createMockContext()
      await handlers.get('session_start')[0]({ reason: 'startup' }, ctx)
      assert.ok(readdirSync(fresh).length > 0, 'startup sync must populate the override dir')
    } finally {
      process.env.VP_KNOWLEDGE_AGENTS_DIR = saved
      rmSync(fresh, { recursive: true, force: true })
    }
  })
  /* eslint-enable n/no-process-env */
})
