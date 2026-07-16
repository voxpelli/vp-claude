// @ts-nocheck — Test file; runtime correctness verified by node:test

// Must precede the extension import: isolates the agent-sync target dir so the
// factory's startup handler never writes to the real ~/.pi/agent/agents/.
import './isolate-agents-dir.js'

import assert from 'node:assert'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
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

  /* eslint-disable n/no-process-env -- redirecting the isolation seam is the point of this test */
  it('startupMaintenanceDone latch skips the second startup sync', async () => {
    // A real latch test: the first startup populates the override dir; delete a
    // synced file and fire startup again. If the latch holds, the second sync is
    // skipped and the file is NOT restored. (The old test only asserted a
    // monotonic sendMessage count, which is true whether or not the latch works —
    // guidance is sent on every session_start regardless of the latch.)
    __resetStartupMaintenance()
    const saved = process.env.VP_KNOWLEDGE_AGENTS_DIR
    const fresh = mkdtempSync(join(tmpdir(), 'vpk-latch-'))
    try {
      process.env.VP_KNOWLEDGE_AGENTS_DIR = fresh
      const { handlers, pi } = createMockPi()
      vpKnowledgePiExtension(pi)
      const { ctx } = createMockContext()
      const startup = handlers.get('session_start')[0]

      await startup({ reason: 'startup' }, ctx)
      const populated = readdirSync(fresh)
      assert.ok(populated.length > 0, 'first startup should populate the override dir')

      rmSync(join(fresh, populated[0]))
      await startup({ reason: 'startup' }, ctx)
      assert.ok(
        !existsSync(join(fresh, populated[0])),
        'the latch must skip the second sync — a deleted file must not be restored'
      )
    } finally {
      process.env.VP_KNOWLEDGE_AGENTS_DIR = saved
      rmSync(fresh, { recursive: true, force: true })
    }
  })
  /* eslint-enable n/no-process-env */

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
