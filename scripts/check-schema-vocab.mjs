// Regression test for the relation-vocabulary drift guard
// (lib/schema-vocab.mjs). Mirrors the check-staleness-contract.mjs
// precedent: fixture-only, proves the picoschema extractor and the
// malformed-variant detector both work, and proves the detector deliberately
// does NOT flag a well-formed-but-undeclared verb (that class is 7cq's job,
// not this guard's — see the module header). Wired into `npm run check` via
// check:schema-vocab.

import {
  buildCanonicalRelationVerbs,
  checkRelationVocabDrift,
  extractPicoschemaRelationVerbs,
  extractRelationVocabCandidates,
} from '../lib/schema-vocab.mjs'

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

const FIXTURE_SCHEMA_A = [
  '---',
  'title: fixture_a',
  'type: schema',
  'schema:',
  '  purpose?: string, what it does',
  '  relates_to?(array): Note, related notes',
  '  depends_on?(array): Note, upstream dependencies',
  '  see_also?(array): Note, related tool in the same space',
  'settings:',
  '  validation: warn',
  '---',
  '',
  '# fixture_a',
].join('\n')

const FIXTURE_SCHEMA_B = [
  '---',
  'title: fixture_b',
  'type: schema',
  'schema:',
  '  alternative_to?(array): Note, competes in the same space',
  'settings:',
  '  validation: warn',
  '---',
].join('\n')

console.log('\nschema-vocab: picoschema extraction')
{
  const verbs = extractPicoschemaRelationVerbs(FIXTURE_SCHEMA_A)
  check('extracts all three Note-typed fields', verbs.length === 3)
  check('extracts relates_to', verbs.includes('relates_to'))
  check('extracts depends_on', verbs.includes('depends_on'))
  check('extracts see_also', verbs.includes('see_also'))
  check('does not extract non-Note string field "purpose"', !verbs.includes('purpose'))
}
{
  const canonical = buildCanonicalRelationVerbs([FIXTURE_SCHEMA_A, FIXTURE_SCHEMA_B])
  check('global union spans both fixtures', canonical.has('relates_to') && canonical.has('alternative_to'))
  check('global union size is 4', canonical.size === 4)
}

console.log('\nschema-vocab: Relation Vocabulary candidate extraction')
{
  const withSection = [
    FIXTURE_SCHEMA_A,
    '',
    '## Relation Vocabulary',
    '',
    'Preferred relation labels:',
    '- `see_also [[fixture-x]]` — related fixture in the same space',
    '- `relates_to` — `fixture-<name>` — related fixture, formula, or note',
    '- `application pattern in [[engineering/x]]` — links to a patterns note (non-verb descriptive form, not a bullet this guard parses as a verb)',
    '',
    '## Observations',
    '',
    '- [purpose] fixture',
  ].join('\n')
  const candidates = extractRelationVocabCandidates(withSection)
  check('extracts 3 candidates (including the descriptive-form one)', candidates.length === 3)
  check('extracts bare verb-with-target label "see_also"', candidates.some((c) => c.label === 'see_also'))
  check('extracts split-backtick label "relates_to"', candidates.some((c) => c.label === 'relates_to'))
  check('extracts descriptive-form label verbatim (multi-word, no [[)', candidates.some((c) => c.label === 'application pattern in'))
}
{
  const noSection = extractRelationVocabCandidates(FIXTURE_SCHEMA_A)
  check('no "## Relation Vocabulary" heading → zero candidates', noSection.length === 0)
}

console.log('\nschema-vocab: malformed-variant drift detection')
{
  const canonical = buildCanonicalRelationVerbs([FIXTURE_SCHEMA_A, FIXTURE_SCHEMA_B])
  const clean = [
    FIXTURE_SCHEMA_A,
    '',
    '## Relation Vocabulary',
    '',
    '- `see_also [[fixture-x]]` — related fixture',
    '- `relates_to [[fixture-x]]` — related fixture',
    '',
    '## Observations',
  ].join('\n')
  const { checked, errors } = checkRelationVocabDrift(clean, canonical)
  check('well-formed canonical verbs → zero errors', errors.length === 0)
  check('checked count matches candidate count', checked === 2)
}
{
  // The historical bug class (v0.29.1): a space instead of an underscore.
  // "see_also" IS canonical (declared in FIXTURE_SCHEMA_A), so "see also"
  // must be flagged as a malformed variant of it.
  const canonical = buildCanonicalRelationVerbs([FIXTURE_SCHEMA_A, FIXTURE_SCHEMA_B])
  const spaced = [
    FIXTURE_SCHEMA_A,
    '',
    '## Relation Vocabulary',
    '',
    '- `see also [[fixture-x]]` — related fixture',
    '',
    '## Observations',
  ].join('\n')
  const { errors } = checkRelationVocabDrift(spaced, canonical)
  check('spaced variant of a canonical verb → exactly 1 error', errors.length === 1)
  check('error names both the malformed and canonical forms', (errors[0]?.includes('see also') && errors[0]?.includes('see_also')) ?? false)
}
{
  // A trailing colon on an otherwise-canonical verb — the other historical
  // pattern named in CLAUDE.md ("related_to:" — colon suffix).
  const canonical = buildCanonicalRelationVerbs([FIXTURE_SCHEMA_A, FIXTURE_SCHEMA_B])
  const colonSuffix = [
    FIXTURE_SCHEMA_A,
    '',
    '## Relation Vocabulary',
    '',
    '- `relates_to: [[fixture-x]]` — related fixture',
    '',
    '## Observations',
  ].join('\n')
  const { errors } = checkRelationVocabDrift(colonSuffix, canonical)
  check('trailing-colon variant of a canonical verb → exactly 1 error', errors.length === 1)
}
{
  // A well-formed verb that simply isn't declared ANYWHERE in the picoschema
  // corpus is deliberately NOT this guard's job (see module header) — it
  // must be silently skipped, not flagged, so this stays 7cq's territory.
  const canonical = buildCanonicalRelationVerbs([FIXTURE_SCHEMA_A, FIXTURE_SCHEMA_B])
  const undeclared = [
    FIXTURE_SCHEMA_A,
    '',
    '## Relation Vocabulary',
    '',
    '- `configured_in_dotfiles` — tracked in the dotfiles repo',
    '',
    '## Observations',
  ].join('\n')
  const { errors } = checkRelationVocabDrift(undeclared, canonical)
  check('well-formed but undeclared verb → zero errors (out of scope for this guard)', errors.length === 0)
}

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
