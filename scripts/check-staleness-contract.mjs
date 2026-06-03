// Regression test for the staleness drift-bucket contract check
// (lib/staleness-contract.mjs). Mirrors the check-hooks.mjs precedent: the
// contract check is a guard against emit↔consume string drift, so it must
// itself be proven to CATCH drift — a guard that silently stops guarding is
// worse than no guard. Wired into `npm run check` via check:plugin's sibling.

import {
  CANONICAL_STALENESS_BUCKETS,
  checkStalenessConsume,
  checkStalenessEmit,
} from '../lib/staleness-contract.mjs'

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

// A canonical emit section, as it appears inside a fenced example block (the
// headings are real `####` lines that a line-regex sees but an AST parser
// would not — that is the whole point of the line-regex approach).
const EMIT_OK = [
  '### Version Drift — npm — 12 documented notes checked',
  '',
  '#### Drifted >30d (3 notes — refresh recommended)',
  '- npm-fastify 4.28.1 → 5.8.5',
  '',
  '#### Archive candidates (1 note)',
  '- npm-request',
  '',
  '#### Not in registry (2 notes — drift check skipped)',
  '- npm-foo',
  '',
  '#### Summary',
  '- Drifted >30d: 3 notes',
  '',
  '### Graph Statistics',
  '- Total: 12',
].join('\n')

console.log('\nstaleness-contract: emit side')
{
  const { bucketCount, errors } = checkStalenessEmit(EMIT_OK)
  check('canonical section → no errors', errors.length === 0)
  check('canonical section → counts 3 buckets (Summary allow-listed)', bucketCount === 3)
}
{
  // A mutated bucket heading must be caught.
  const bad = EMIT_OK.replace('#### Drifted >30d', '#### Driftd >30d')
  const { errors } = checkStalenessEmit(bad)
  check('typo bucket heading → exactly 1 error', errors.length === 1)
  check('typo error names the bad heading', errors[0].includes('Driftd >30d'))
}
{
  // A non-canonical `####` OUTSIDE any Version Drift section must be ignored
  // (the gardener's `#### Source-URL provenance nudge` is such a case).
  const withOutsider = [
    '#### Source-URL provenance nudge',
    '- some note',
    '',
    EMIT_OK,
  ].join('\n')
  const { bucketCount, errors } = checkStalenessEmit(withOutsider)
  check('non-canonical #### before the drift section → ignored', errors.length === 0)
  check('outsider does not inflate bucketCount', bucketCount === 3)
}
{
  // No Version Drift section at all → the "found none" guard fires.
  const { errors } = checkStalenessEmit('# A doc\n\n## Something else\n\n#### Drifted >30d\n')
  check('no Version Drift heading → "found none" error', errors.some((e) => e.includes('found none')))
}

// Consume side: maintainer Section 3b routing bullets.
const CONSUME_OK = [
  'If a report contains a `### Version Drift — <eco>` section, act on it.',
  '',
  '- **`Drifted >30d`** → auto-refresh tier.',
  '- **`Drifted <30d`** or **`Drifted, age unknown`** → surface for approval.',
  '- **`Not in registry`** → ignore.',
  '',
  'After a refresh, entries flip to `Drifted` removed.', // decoy bare code-span
].join('\n')

console.log('\nstaleness-contract: consume side')
{
  const { bulletBuckets, errors } = checkStalenessConsume(CONSUME_OK)
  check('canonical routing bullets → no errors', errors.length === 0)
  check('two-bucket bullet counted as 2 (4 buckets total)', bulletBuckets === 4)
}
{
  const bad = CONSUME_OK.replace('**`Not in registry`**', '**`Tap-only`**')
  const { errors } = checkStalenessConsume(bad)
  check('non-canonical routing bucket → exactly 1 error', errors.length === 1)
  check('error names the stale bucket', errors[0].includes('Tap-only'))
}
{
  // A doc with the section reference but no routing bullets → "found none".
  const { errors } = checkStalenessConsume('Mentions Version Drift — but has no bullets.')
  check('no routing bullets → "found none" error', errors.some((e) => e.includes('found none')))
}
{
  // Missing the section reference entirely → its own error.
  const onlyBullets = '- **`Drifted >30d`** → refresh.'
  const { errors } = checkStalenessConsume(onlyBullets)
  check('missing "Version Drift —" reference → error', errors.some((e) => e.includes('Version Drift —')))
}

// Sanity: the canonical list is non-empty and unique.
console.log('\nstaleness-contract: canonical list')
check('canonical bucket list is non-empty', CANONICAL_STALENESS_BUCKETS.length > 0)
check('canonical bucket list has no duplicates', new Set(CANONICAL_STALENESS_BUCKETS).size === CANONICAL_STALENESS_BUCKETS.length)

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
