// Regression test for the fourth-wall rule registry (lib/fourth-wall-rules.mjs).
// Mirrors check-staleness-contract.mjs: a guard against drift must itself be
// proven to CATCH drift. Verifies: (1) every deterministic `detect` fires on a
// planted violation AND each detect alternation branch is exercised; (2) near-miss
// legitimate prose does NOT fire (guards against an over-broadened regex); (3) the
// vp-note-quality SKILL.md documents every rule id; (4) the SKILL.md Rule-Registry
// table's Detection column matches each rule's `deterministic` flag.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  CANONICAL_FOURTH_WALL_RULES,
  detectFourthWallViolations,
  checklistMissingRuleIds,
  checkDetectionColumnParity,
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
// One planted violation per deterministic rule (fw-relation-type uses mixed case
// to exercise the /i flag).
/** @type {Record<string, string>} */
const VIOLATIONS = {
  'fw-inventory-claim': 'Rust has zero presence in Raindrop as of this session.',
  'fw-significance-ranking': 'This is the most significant gap in the knowledge graph.',
  'fw-self-ref-section': '## Connection to the Knowledge Graph\n\nThis note fills a hole.',
  'fw-session-boundary': 'This topic was undocumented prior to this session.',
  'fw-relation-type': '- Fills_Gap_In [[Some Hub]]',
}
for (const [id, text] of Object.entries(VIOLATIONS)) {
  check(`${id} fires on its planted violation`, detectFourthWallViolations(text).some((h) => h.id === id))
}
const deterministicIds = CANONICAL_FOURTH_WALL_RULES.filter((r) => r.deterministic).map((r) => r.id)
check('every deterministic rule has a planted-violation fixture', deterministicIds.every((id) => id in VIOLATIONS))

console.log('\nfourth-wall: every detect alternation branch is exercised')
// Each additional alternation arm beyond the one in VIOLATIONS above, so a botched
// escape in any single branch fails the suite (equivalence-partitioning per branch).
const ALT_FIXTURES = [
  { id: 'fw-inventory-claim', text: 'This package is absent from the knowledge graph.' },
  { id: 'fw-inventory-claim', text: 'The tool is not yet in basic memory.' },
  { id: 'fw-inventory-claim', text: 'There is no presence in Raindrop for this.' },
  { id: 'fw-inventory-claim', text: 'No raindrop bookmarks exist for this author.' },
  { id: 'fw-significance-ranking', text: 'This is the most important connection in the graph.' },
  { id: 'fw-session-boundary', text: 'Undocumented prior to this note.' },
  { id: 'fw-relation-type', text: '- adds_coverage_for [[Some Topic]]' },
  { id: 'fw-relation-type', text: '- documents_gap_in [[Some Hub]]' },
]
for (const { id, text } of ALT_FIXTURES) {
  check(`${id} alternation fires: "${text.slice(0, 44)}"`, detectFourthWallViolations(text).some((h) => h.id === id))
}

console.log('\nfourth-wall: near-miss legitimate prose stays silent (over-broadening guard)')
// Each string is lexically close to a deterministic rule's trigger but is
// legitimate subject prose that MUST NOT fire — an accidentally over-broadened
// regex fails here.
const NEAR_MISS = [
  { id: 'fw-inventory-claim', text: 'CSS `transform` has zero presence in Internet Explorer 9.' },
  { id: 'fw-significance-ranking', text: 'This was the most common gap in early TLS implementations.' },
  { id: 'fw-self-ref-section', text: '## Graph Coverage Algorithms\n\nDepth-first search is standard.' },
  { id: 'fw-session-boundary', text: 'The release prior to this one fixed the regression.' },
  { id: 'fw-relation-type', text: 'The module fills_gap_in_understanding by adding hooks.' },
]
for (const { id, text } of NEAR_MISS) {
  check(`${id} stays silent on near-miss: "${text.slice(0, 44)}"`, !detectFourthWallViolations(text).some((h) => h.id === id))
}

console.log('\nfourth-wall: clean subject text fires nothing')
const CLEAN = 'Fastify is a fast, low-overhead web framework for Node.js. It uses a plugin architecture and schema-based validation, and is maintained by Matteo Collina and Tomas Della Vedova.'
check('clean subject text → no deterministic hits', detectFourthWallViolations(CLEAN).length === 0)

console.log('\nfourth-wall: vp-note-quality checklist contracts')
const skillMd = readFileSync(join(ROOT, 'skills/vp-note-quality/SKILL.md'), 'utf8')
const { missing } = checklistMissingRuleIds(skillMd)
check('SKILL.md documents every canonical rule id', missing.length === 0)
if (missing.length) console.log(`    missing ids: ${missing.join(', ')}`)
const { mismatches } = checkDetectionColumnParity(skillMd)
check('SKILL.md Rule-Registry Detection column matches registry flags', mismatches.length === 0)
for (const mm of mismatches) console.log(`    ${mm.id}: table says "${mm.found}", registry expects "${mm.expected}"`)

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
