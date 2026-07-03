// Regression test + live check for the release-count contract
// (lib/release-counts.mjs). Mirrors check-staleness-contract.mjs: it both
// (1) asserts the live counts stated across gated release surfaces (CLAUDE.md
// headings + schema-count comment, README.md's hooks sentence) match disk,
// and (2) fixture-tests the pure parse/compare functions so the guard is
// proven to catch drift. Wired into `npm run check` via run-p check:*.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  compareCounts,
  compareSingleCount,
  COUNTED_COMPONENTS,
  parseReadmeHooksCount,
  parseSchemaCountComment,
  parseStatedCounts,
} from '../lib/release-counts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { check, done } = createCheckHarness()

// --- on-disk counts ---
function countSkills () {
  return readdirSync(join(ROOT, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'skills', d.name, 'SKILL.md')))
    .length
}
function countAgents () {
  // Mirror countSkills's structure check: isFile() + exclude README so a
  // documentation-only .md (e.g. agents/README.md) cannot inflate the count.
  return readdirSync(join(ROOT, 'agents'), { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.md') && d.name !== 'README.md')
    .length
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
function countSchemas () {
  return readdirSync(join(ROOT, 'schemas'), { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.md'))
    .length
}

const actual = { Skills: countSkills(), Agents: countAgents(), Hooks: countHooks() }
const actualSchemas = countSchemas()

console.log('\nrelease-counts: CLAUDE.md Components index ↔ disk')
console.log(`  disk: Skills ${actual.Skills}, Agents ${actual.Agents}, Hooks ${actual.Hooks}, Schemas ${actualSchemas}`)
const claudeMd = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8')
const stated = parseStatedCounts(claudeMd)
const liveErrors = compareCounts(stated, actual)
for (const e of liveErrors) console.log(`    ${e}`)
for (const label of COUNTED_COMPONENTS) {
  check(`${label}: disk ${actual[label]} == CLAUDE.md ${stated[label] ?? '(missing)'}`, stated[label] === actual[label])
}
check('CLAUDE.md component counts all match disk', liveErrors.length === 0)

console.log('\nrelease-counts: CLAUDE.md schema-count comment ↔ disk')
const schemaStated = parseSchemaCountComment(claudeMd)
const schemaErrors = compareSingleCount('CLAUDE.md schema-count comment', 'Schemas', schemaStated, actualSchemas)
for (const e of schemaErrors) console.log(`    ${e}`)
check(`Schemas: disk ${actualSchemas} == CLAUDE.md schema-count comment ${schemaStated ?? '(missing)'}`, schemaErrors.length === 0)

console.log('\nrelease-counts: README.md hooks sentence ↔ disk')
const readmeMd = readFileSync(join(ROOT, 'README.md'), 'utf8')
const readmeHooksStated = parseReadmeHooksCount(readmeMd)
const readmeErrors = compareSingleCount('README.md', 'Hooks', readmeHooksStated, actual.Hooks)
for (const e of readmeErrors) console.log(`    ${e}`)
check(`Hooks: disk ${actual.Hooks} == README.md stated ${readmeHooksStated ?? '(missing)'}`, readmeErrors.length === 0)

console.log('  note: plugin.json and marketplace.json state no raw skill/agent/hook/schema count in prose (verified by grep) — those two surfaces stay in sync via the release checklist; extend this module if that ever changes.')

console.log('\nrelease-counts: fixture self-test')
const FIX = '## Components\n\n### Skills (3)\n\nfoo\n\n### Agents (2)\n\n### Hooks (1)\n'
const fixStated = parseStatedCounts(FIX)
check('parses all 3 stated counts from headings', fixStated.Skills === 3 && fixStated.Agents === 2 && fixStated.Hooks === 1)
check('prose "9 skills" does not match (heading-anchored)', parseStatedCounts('This plugin ships 9 skills.').Skills === undefined)
check('catches a planted count mismatch', compareCounts(fixStated, { Skills: 3, Agents: 9, Hooks: 1 }).some((e) => e.includes('Agents')))
check('flags a missing count heading', compareCounts({ Skills: 3, Agents: 2 }, { Skills: 3, Agents: 2, Hooks: 1 }).some((e) => e.includes('Hooks')))
check('parses ALL counted labels (parser-failure guard)', COUNTED_COMPONENTS.every((l) => l in fixStated))
check('compareCounts({}, actual) errors for all 3 labels — not a vacuous pass', compareCounts({}, { Skills: 14, Agents: 4, Hooks: 5 }).length === 3)
// "Schemas" is deliberately NOT a counted component — assert it never lands in the
// parsed record (read via bracket access since it is not a ComponentLabel key).
check('non-canonical label "Schemas" does not parse (alternation derived from array)', !('Schemas' in parseStatedCounts('### Schemas (7)\n')))
check('level-1 heading ignored (out-of-range)', parseStatedCounts('# Skills (14)\n').Skills === undefined)
check('level-5 heading ignored (out-of-range)', parseStatedCounts('##### Skills (14)\n').Skills === undefined)
check('duplicate headings: last value wins (documented behavior)', parseStatedCounts('### Skills (3)\n### Skills (99)\n').Skills === 99)
check('count heading inside a fenced block is NOT matched (mdast skips code nodes)', parseStatedCounts('```\n### Skills (99)\n```\n').Skills === undefined)

// --- parseReadmeHooksCount fixtures ---
check('parses a spelled-out README hooks sentence', parseReadmeHooksCount('Five hooks run automatically in the background:') === 5)
check('parses a digit README hooks sentence too', parseReadmeHooksCount('5 hooks run automatically in the background:') === 5)
check('near-miss "these hooks run in order" does not match (no anchor phrase)', parseReadmeHooksCount('These hooks run in order, not in parallel.') === undefined)
check('README hooks sentence inside a fenced block is NOT matched (mdast skips code nodes)', parseReadmeHooksCount('```\nFive hooks run automatically in the background:\n```\n') === undefined)
check('README with no hooks sentence at all returns undefined', parseReadmeHooksCount('# Nothing to see here\n') === undefined)

// --- parseSchemaCountComment fixtures ---
check('parses the schema-count anchor comment', parseSchemaCountComment('<!-- schema-count: 23 -->') === 23)
check('parses the schema-count anchor comment amid other prose', parseSchemaCountComment('It contains twenty-three files:\n<!-- schema-count: 23 -->\n') === 23)
check('parses the anchor with trailing prose before the close (real CLAUDE.md shape)', parseSchemaCountComment('<!-- schema-count: 23 — keep in sync with `ls schemas/*.md | wc -l` -->') === 23)
check('missing schema-count comment returns undefined', parseSchemaCountComment('It contains twenty-three files, no anchor here.') === undefined)

// --- compareSingleCount fixtures ---
check('compareSingleCount passes silently on a match', compareSingleCount('README.md', 'Hooks', 5, 5).length === 0)
check('compareSingleCount catches a planted mismatch', compareSingleCount('README.md', 'Hooks', 5, 6).some((e) => e.includes('README.md') && e.includes('Hooks')))
check('compareSingleCount flags a missing stated value — not a vacuous pass', compareSingleCount('README.md', 'Hooks', undefined, 5).length === 1)

done()
