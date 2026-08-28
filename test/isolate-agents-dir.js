// Side-effect import: redirect agent-profile sync to an isolated tmpdir.
//
// Two tests instantiate the extension factory and fire `session_start` with
// `reason: 'startup'`, which triggers `syncAgentProfiles` into the dir returned
// by `getAgentsDir()`. Without this, that dir is the contributor's real
// `~/.pi/agent/agents/` and `npm test` would overwrite their installed agent
// profiles. Setting `VP_KNOWLEDGE_AGENTS_DIR` before those handlers run (import
// side effects execute at module load, before any `it()` body) makes the sync
// land in a throwaway tmpdir instead. `getAgentsDir()` reads the env at call
// time, so this holds whether the file is run via `npm test` or directly.
//
// This module is ALSO preloaded for the whole run via `node --test --import`
// (see package.json), so a future test that forgets the per-file import is still
// isolated on the `npm test`/CI path; the per-file imports additionally cover a
// direct `node --test <one-file>` run.
//
// `||=` (not `??=`): an inherited EMPTY value must also be replaced by the
// tmpdir, matching getAgentsDir()'s `||` fallback — otherwise `??=` would keep a
// blank string and the startup sync would resolve to the real home dir.

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/* eslint-disable n/no-process-env -- these env overrides ARE the isolation seam */

// Redirect the agent-profile sync target to a throwaway tmpdir.
process.env.VP_KNOWLEDGE_AGENTS_DIR ||= mkdtempSync(join(tmpdir(), 'vpk-agents-'))

// Pin the config read to a tmp file that explicitly enables agent auto-sync.
// autoSync is OPT-IN by default (DEFAULTS.agents.autoSync === false), so a
// nonexistent config would yield the new default and the startup-sync code
// paths in the factory tests would silently stop being exercised. An explicit
// {"agents":{"autoSync":true}} keeps them deterministically exercised,
// independent of the contributor's real ~/.pi/agent/extensions/vp-knowledge.json
// — otherwise a contributor with autoSync disabled would silently skip the very
// code paths these tests exercise.
if (!process.env.VP_KNOWLEDGE_CONFIG_FILE) {
  const cfgPath = join(tmpdir(), `vpk-test-config-${process.pid}.json`)
  writeFileSync(cfgPath, JSON.stringify({ agents: { autoSync: true } }), 'utf8')
  process.env.VP_KNOWLEDGE_CONFIG_FILE = cfgPath
}

/* eslint-enable n/no-process-env */
