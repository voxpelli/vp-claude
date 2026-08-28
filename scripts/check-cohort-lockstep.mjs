// Live check + regression test for the cohort-table lockstep contract
// (lib/cohort-table-contract.mjs): the `--stale` cohort configuration table in
// skills/knowledge-gaps/references/staleness-detection.md and the mirrored
// table in agents/knowledge-gardener.md Step 5b must list the same cohort
// set. Mirrors check-upstream-headings.mjs's live+fixture split. Wired into
// `npm run check` via run-p check:*.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCheckHarness } from '../lib/check-harness.mjs'
import { checkCohortLockstep, extractCohortTokens } from '../lib/cohort-table-contract.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { check, done } = createCheckHarness()

const STALENESS_DETECTION_PATH = join(ROOT, 'skills/knowledge-gaps/references/staleness-detection.md')
const KNOWLEDGE_GARDENER_PATH = join(ROOT, 'agents/knowledge-gardener.md')

// --- live check ---

console.log('\ncohort-lockstep: staleness-detection.md and knowledge-gardener.md Step 5b list the same cohort set')

const stalenessDetectionContent = readFileSync(STALENESS_DETECTION_PATH, 'utf8')
const knowledgeGardenerContent = readFileSync(KNOWLEDGE_GARDENER_PATH, 'utf8')

const live = checkCohortLockstep(stalenessDetectionContent, knowledgeGardenerContent)
for (const error of live.errors) console.log(`    ${error}`)
check('the two cohort tables are in lockstep', live.errors.length === 0)

// --- fixture self-test ---

console.log('\ncohort-lockstep: fixture self-test')

const HEADER_A = '| Token | Prefix | BM directory | Fetch script | Upstream version | Deprecation? |'
const HEADER_B = '| Cohort | Prefix | BM dir | Fetch script | Upstream version | Deprecation? | Tap dim? |'
const SEP_A = '|-------|--------|--------------|--------------|------------------|--------------|'
const SEP_B = '|--------|--------|--------|--------------|------------------|--------------|----------|'

console.log('\ncohort-lockstep: extractCohortTokens reads backtick-wrapped and bare tokens identically')
const backtickTable = [HEADER_A, SEP_A, '| `brew` | `brew-` | `brew/` | x | y | yes |', '| `npm` | `npm-` | `npm/` | x | y | yes |'].join('\n')
const bareTable = [HEADER_B, SEP_B, '| brew | `brew-` | `brew/` | x | y | yes | yes |', '| npm | `npm-` | `npm/` | x | y | yes | no |'].join('\n')
check('backtick-wrapped tokens extracted correctly', JSON.stringify(extractCohortTokens(backtickTable).tokens) === JSON.stringify(['brew', 'npm']))
check('bare tokens extracted correctly', JSON.stringify(extractCohortTokens(bareTable).tokens) === JSON.stringify(['brew', 'npm']))

console.log('\ncohort-lockstep: matching tables produce zero errors')
check('identical cohort sets (different formatting) are in lockstep', checkCohortLockstep(backtickTable, bareTable).errors.length === 0)

console.log('\ncohort-lockstep: a planted one-sided addition is detected (the exact regression this guards against)')
const backtickTableMissingPlugin = [HEADER_A, SEP_A, '| `brew` | `brew-` | `brew/` | x | y | yes |'].join('\n')
const bareTableWithPlugin = [HEADER_B, SEP_B, '| brew | `brew-` | `brew/` | x | y | yes | yes |', '| plugin | `plugin-` | `plugins/` | x | y | no | no |'].join('\n')
const drifted = checkCohortLockstep(backtickTableMissingPlugin, bareTableWithPlugin)
check('detects the one-sided "plugin" addition', drifted.errors.some((e) => e.includes('plugin')))

console.log('\ncohort-lockstep: a missing table (header row not found) is reported, not silently empty')
const noTable = 'Some unrelated prose with no table at all.\n'
check('missing-table error surfaces', extractCohortTokens(noTable).errors.length > 0)

console.log('\ncohort-lockstep: a malformed table (no separator row) is reported')
const malformedTable = [HEADER_A, '| `brew` | `brew-` | `brew/` | x | y | yes |'].join('\n')
check('malformed-table error surfaces', extractCohortTokens(malformedTable).errors.length > 0)

done()
