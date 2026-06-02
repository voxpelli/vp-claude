// Regression test for the fourth-wall rule registry (lib/fourth-wall-rules.mjs).
// Mirrors check-staleness-contract.mjs: a guard against drift between the
// canonical rule set, the vp-note-quality checklist (emit), and the gardener
// Red-Flags scan (consume) — so it must itself be proven to CATCH drift.
// Two things are verified: (1) every deterministic `detect` pattern fires on a
// planted violation and stays silent on clean subject text; (2) the
// vp-note-quality SKILL.md documents every canonical rule id (the contract).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  CANONICAL_FOURTH_WALL_RULES,
  detectFourthWallViolations,
  checklistMissingRuleIds,
} from '../lib/fourth-wall-rules.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

/**
 * @param {string} name
 * @param {boolean} cond
 */
function check (name, cond) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}`)
  }
}

console.log('\nfourth-wall: registry')
check('registry is non-empty', CANONICAL_FOURTH_WALL_RULES.length > 0)
const ids = CANONICAL_FOURTH_WALL_RULES.map((r) => r.id)
check('rule ids are unique', new Set(ids).size === ids.length)
check('every deterministic rule carries a detect RegExp', CANONICAL_FOURTH_WALL_RULES.every((r) => !r.deterministic || r.detect instanceof RegExp))
check('every non-deterministic rule has no detect pattern', CANONICAL_FOURTH_WALL_RULES.every((r) => r.deterministic || !r.detect))

console.log('\nfourth-wall: deterministic detection fires on planted violations')
/** @type {Record<string, string>} */
const VIOLATIONS = {
  'fw-inventory-claim': 'Rust has zero presence in Raindrop as of this session.',
  'fw-significance-ranking': 'This is the most significant gap in the knowledge graph.',
  'fw-self-ref-section': '## Connection to the Knowledge Graph\n\nThis note fills a hole.',
  'fw-relation-type': '- fills_gap_in [[Some Hub]]',
}
for (const [id, text] of Object.entries(VIOLATIONS)) {
  check(`${id} fires on its planted violation`, detectFourthWallViolations(text).some((h) => h.id === id))
}
// Every deterministic rule must have a fixture above (drift guard: a new
// deterministic rule without a fixture should fail this, not pass silently).
const deterministicIds = CANONICAL_FOURTH_WALL_RULES.filter((r) => r.deterministic).map((r) => r.id)
check('every deterministic rule has a planted-violation fixture', deterministicIds.every((id) => id in VIOLATIONS))

console.log('\nfourth-wall: clean subject text fires nothing')
const CLEAN = 'Fastify is a fast, low-overhead web framework for Node.js. It uses a plugin architecture and schema-based validation, and is maintained by Matteo Collina and Tomas Della Vedova.'
check('clean subject text → no deterministic hits', detectFourthWallViolations(CLEAN).length === 0)

console.log('\nfourth-wall: checklist contract')
const skillMd = readFileSync(join(ROOT, 'skills/vp-note-quality/SKILL.md'), 'utf8')
const { missing } = checklistMissingRuleIds(skillMd)
check('vp-note-quality SKILL.md documents every canonical rule id', missing.length === 0)
if (missing.length) console.log(`    missing ids: ${missing.join(', ')}`)

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
