/**
 * check:mcp-naming-guidance — the retired MCP naming rule must not come back.
 *
 * Live scan over `MCP_NAMING_FILES` plus a fixture self-test proving the
 * detector fires on each real phrasing and stays silent on the correct prose,
 * on history, and on the unrelated hyphen/underscore talk elsewhere in the repo.
 *
 * NOTE on the harness: `check(name, cond)` takes a BOOLEAN, not a thunk. The
 * first draft of this file passed arrow functions, which are always truthy, so
 * all seventeen checks passed unconditionally with a planted violation sitting
 * in `docs/pi-setup.md`. That is this repo's recurring bug class, written into
 * the guard built to prevent it, and only plant-and-revert caught it.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCheckHarness } from '../lib/check-harness.mjs'
import { detectRetiredNamingRule, MCP_NAMING_FILES } from '../lib/mcp-naming-guidance.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const { check, done } = createCheckHarness()

/** Each real phrasing this repo actually contained must be caught. */
const VIOLATIONS = [
  'a direct name drops the mcp__ prefix and turns server hyphens into underscores',
  'drop `mcp__`, server hyphens→`_`, tool unchanged',
  "replace the server's hyphens with underscores",
  'it converts hyphens in the server segment to underscores',
]
for (const [i, text] of VIOLATIONS.entries()) {
  check(`violation ${i + 1} is detected`, detectRetiredNamingRule(text).length > 0)
}

/** Correct prose, history, and unrelated domains must stay silent. */
/** @type {readonly [string, string][]} */
const NEAR_MISSES = [
  ['the correct rule', 'join the two segments with `_`, changing neither — hyphens survive on both sides'],
  ['history in a docblock', "This used to replace the server's hyphens with underscores. It was wrong."],
  ['history in a design record', 'The rule this bullet used to prescribe — server hyphens→`_` — was wrong.'],
  ['a rust crate name', 'Replace hyphens with underscores for the crate name in a `use` statement.'],
  ['the colon-title migration', 'Titles migrated from a colon prefix to a hyphen prefix.'],
]
for (const [label, text] of NEAR_MISSES) {
  check(`near-miss stays silent: ${label}`, detectRetiredNamingRule(text).length === 0)
}

/** The live scan. */
for (const rel of MCP_NAMING_FILES) {
  const path = join(ROOT, rel)
  if (!existsSync(path)) {
    check(`${rel} exists (it is on the guarded list)`, false)
    continue
  }
  const hits = detectRetiredNamingRule(readFileSync(path, 'utf8'))
  if (hits.length > 0) {
    console.log(`        ${rel}: ${hits.map((h) => `[${h.id}] "${h.match}"`).join('; ')}`)
  }
  check(`${rel} states no retired rule`, hits.length === 0)
}

done()
