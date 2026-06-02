// Regression test + live check for the release-count contract
// (lib/release-counts.mjs). Mirrors check-staleness-contract.mjs: it both
// (1) asserts the live CLAUDE.md Components counts match disk, and (2)
// fixture-tests the pure parse/compare functions so the guard is proven to
// catch drift. Wired into `npm run check` via run-p check:*.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  COUNTED_COMPONENTS,
  parseStatedCounts,
  compareCounts,
} from '../lib/release-counts.mjs'

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

// --- on-disk counts ---
function countSkills () {
  return readdirSync(join(ROOT, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'skills', d.name, 'SKILL.md')))
    .length
}
function countAgents () {
  return readdirSync(join(ROOT, 'agents')).filter((f) => f.endsWith('.md')).length
}
function countHooks () {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'hooks/hooks.json'), 'utf8'))
  let n = 0
  for (const matchers of Object.values(cfg.hooks)) {
    for (const matcher of /** @type {any[]} */ (matchers)) {
      n += matcher.hooks?.length ?? 0
    }
  }
  return n
}

const actual = { Skills: countSkills(), Agents: countAgents(), Hooks: countHooks() }

console.log('\nrelease-counts: CLAUDE.md Components index ↔ disk')
console.log(`  disk: Skills ${actual.Skills}, Agents ${actual.Agents}, Hooks ${actual.Hooks}`)
const claudeMd = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8')
const stated = parseStatedCounts(claudeMd)
const liveErrors = compareCounts(stated, actual)
for (const e of liveErrors) console.log(`    ${e}`)
for (const label of COUNTED_COMPONENTS) {
  check(`${label}: disk ${actual[label]} == CLAUDE.md ${stated[label] ?? '(missing)'}`, stated[label] === actual[label])
}
check('CLAUDE.md component counts all match disk', liveErrors.length === 0)

console.log('\nrelease-counts: fixture self-test')
const FIX = '## Components\n\n### Skills (3)\n\nfoo\n\n### Agents (2)\n\n### Hooks (1)\n'
const fixStated = parseStatedCounts(FIX)
check('parses all 3 stated counts from headings', fixStated.Skills === 3 && fixStated.Agents === 2 && fixStated.Hooks === 1)
check('prose "9 skills" does not match (heading-anchored)', parseStatedCounts('This plugin ships 9 skills.').Skills === undefined)
check('catches a planted count mismatch', compareCounts(fixStated, { Skills: 3, Agents: 9, Hooks: 1 }).some((e) => e.includes('Agents')))
check('flags a missing count heading', compareCounts({ Skills: 3, Agents: 2 }, { Skills: 3, Agents: 2, Hooks: 1 }).some((e) => e.includes('Hooks')))

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
