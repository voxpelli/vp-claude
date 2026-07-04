// Live check + regression test for the UPSTREAM-*.md heading-membership
// contract (lib/upstream-heading-vocab.mjs). Mirrors
// check-analytics-guidance.mjs: (1) live-globs every UPSTREAM-*.md file in
// the repo root, skips the allowlisted ones, and asserts every `## ` heading
// in the rest is a member of the canonical vocabulary; (2) fixture-tests the
// pure detector so the guard is proven to catch a planted invalid heading,
// pass on the real canonical headings, and skip an allowlisted file's
// content entirely (rather than silently check-and-pass it). Wired into
// `npm run check` via run-p check:*.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  CANONICAL_UPSTREAM_HEADINGS,
  detectInvalidHeadings,
  UPSTREAM_HEADING_ALLOWLIST,
} from '../lib/upstream-heading-vocab.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { check, done } = createCheckHarness()

// --- live check ---

console.log('\nupstream-headings: UPSTREAM-*.md `## ` headings stay within the canonical vocabulary')

const upstreamFiles = readdirSync(ROOT)
  .filter((f) => /^UPSTREAM-.+\.md$/.test(f))
  .toSorted()
check('at least one UPSTREAM-*.md file exists (guard against a vacuous pass)', upstreamFiles.length > 0)

const allowlistSet = new Set(UPSTREAM_HEADING_ALLOWLIST)
const checkedFiles = upstreamFiles.filter((f) => !allowlistSet.has(f))
const skippedFiles = upstreamFiles.filter((f) => allowlistSet.has(f))
check('at least one non-allowlisted file was actually checked (guard against a vacuous pass)', checkedFiles.length > 0)

for (const file of checkedFiles) {
  const content = readFileSync(join(ROOT, file), 'utf8')
  const invalid = detectInvalidHeadings(content)
  for (const heading of invalid) console.log(`    ${file}: invalid heading "## ${heading}"`)
  check(`${file}: every ## heading is a member of the canonical vocabulary`, invalid.length === 0)
}

for (const file of skippedFiles) {
  console.log(`  SKIP  ${file} (allowlisted — structurally divergent by design)`)
}

// --- fixture self-test ---

console.log('\nupstream-headings: fixture self-test')

console.log('\nupstream-headings: a planted invalid heading is detected')
const PLANTED_INVALID = '## Feature Requests\n\ntext\n\n## Bugz\n\ntext\n'
check(
  'detects the misspelled "Bugz" heading',
  detectInvalidHeadings(PLANTED_INVALID).length === 1 && detectInvalidHeadings(PLANTED_INVALID)[0] === 'Bugz'
)

console.log('\nupstream-headings: all real canonical headings produce zero violations, regardless of order or subset')
const ALL_CANONICAL_HEADINGS_DOC = CANONICAL_UPSTREAM_HEADINGS.map((h) => `## ${h}\n\ntext\n`).join('\n')
check('the full canonical set in document order has zero violations', detectInvalidHeadings(ALL_CANONICAL_HEADINGS_DOC).length === 0)

const REORDERED_SUBSET_DOC = '## Bugs\n\ntext\n\n## Resolved\n\ntext\n\n## Feature Requests\n\ntext\n'
check('a reordered subset of canonical headings has zero violations (order-agnostic)', detectInvalidHeadings(REORDERED_SUBSET_DOC).length === 0)

const MISSING_SECTIONS_DOC = '## Feature Requests\n\ntext\n\n## Bugs\n\ntext\n'
check('a document missing optional sections has zero violations (completeness-agnostic)', detectInvalidHeadings(MISSING_SECTIONS_DOC).length === 0)

console.log('\nupstream-headings: an allowlisted file is excluded from the live loop, not silently checked-and-passed')
check('the allowlist is non-empty (guard against a vacuous allowlist skip)', UPSTREAM_HEADING_ALLOWLIST.length > 0)
for (const allowlistedFile of UPSTREAM_HEADING_ALLOWLIST) {
  check(`${allowlistedFile} was excluded from the live checked-files loop`, !checkedFiles.includes(allowlistedFile))
  const content = readFileSync(join(ROOT, allowlistedFile), 'utf8')
  const wouldFailIfChecked = detectInvalidHeadings(content).length > 0
  check(`${allowlistedFile}'s real content WOULD fail the membership check if it weren't allowlisted (proves the skip is meaningful, not vacuous)`, wouldFailIfChecked)
}

done()
