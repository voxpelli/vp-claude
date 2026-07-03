// Regression test for the observation-metadata trailer parser
// (lib/observation-metadata.mjs). Mirrors the check-staleness-contract.mjs /
// check-fourthwall.mjs precedent: fixture-only, planted valid examples plus
// near-miss non-matches that must NOT parse. Wired into `npm run check` via
// check:obs-metadata.
//
// None of the fixtures below use a markdown-link `[text](url)` shape for
// `[source]`-style provenance — see the module header for why that shape is
// off-limits even in test data (the BM observation-drop bug).

import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  isObservationOwnership,
  OBSERVATION_OWNERSHIP_VALUES,
  parseObservationMetadataTrailer,
} from '../lib/observation-metadata.mjs'

const { check, done } = createCheckHarness()

console.log('\nobservation-metadata: valid trailers')
{
  const line = '- [gotcha] Some behavior breaks under load — Verified: 2026-06-20'
  const result = parseObservationMetadataTrailer(line)
  check('Verified-only trailer → present', result.present)
  check('Verified-only trailer → verified valid', result.verified?.valid === true)
  check('Verified-only trailer → no since/ownership', result.since === undefined && result.ownership === undefined)
  check('Verified-only trailer → no errors', result.errors.length === 0)
}
{
  const line = '- [convention] Some fact worth recording — Verified: 2026-06-20 · Since: v0.32.0'
  const result = parseObservationMetadataTrailer(line)
  check('Verified+Since trailer → present', result.present)
  check('Verified+Since trailer → since valid', result.since?.valid === true)
  check('Verified+Since trailer → no errors', result.errors.length === 0)
}
{
  const line = '- [convention] Some fact worth recording — Verified: 2026-06-20 · Since: v0.32.0 · Ownership: shared'
  const result = parseObservationMetadataTrailer(line)
  check('all-three trailer → present', result.present)
  check('all-three trailer → ownership valid', result.ownership?.valid === true)
  check('all-three trailer → no errors', result.errors.length === 0)
}
{
  const line = '- [gotcha] Standalone behavior — Ownership: upstream'
  const result = parseObservationMetadataTrailer(line)
  check('Ownership-only trailer → present (fields are independently optional)', result.present)
  check('Ownership-only trailer → verified/since absent', result.verified === undefined && result.since === undefined)
}

console.log('\nobservation-metadata: near-miss non-matches (must NOT parse as a trailer)')
{
  const line = '- [gotcha] We verified this works fine.'
  const result = parseObservationMetadataTrailer(line)
  check('lowercase prose "verified" (no em dash, no colon) → not present', !result.present)
}
{
  const line = '- [gotcha] Something happens here — see also the related note for context'
  const result = parseObservationMetadataTrailer(line)
  check('em-dash prose that is not a Label: value trailer → not present', !result.present)
}
{
  const line = '- [gotcha] Something happens here — verified: 2026-06-20'
  const result = parseObservationMetadataTrailer(line)
  check('lowercase field name "verified:" → not present (case-sensitive convention)', !result.present)
}
{
  const line = '- [gotcha] Something happens here — Verified 2026-06-20'
  const result = parseObservationMetadataTrailer(line)
  check('missing colon after field name → not present', !result.present)
}
{
  const line = '- [gotcha] Something happens here'
  const result = parseObservationMetadataTrailer(line)
  check('no em dash at all → not present', !result.present)
}

console.log('\nobservation-metadata: malformed values (present, but flagged invalid)')
{
  const line = '- [gotcha] Something happens here — Verified: 06-20-2026'
  const result = parseObservationMetadataTrailer(line)
  check('US-style date → present but verified invalid', result.present && result.verified?.valid === false)
  check('US-style date → error recorded', result.errors.length === 1)
}
{
  const line = '- [gotcha] Something happens here — Verified: 2026-13-01'
  const result = parseObservationMetadataTrailer(line)
  check('month 13 → present but verified invalid', result.present && result.verified?.valid === false)
}
{
  const line = '- [gotcha] Something happens here — Verified: 2026-02-30'
  const result = parseObservationMetadataTrailer(line)
  check('Feb 30 (no such day) → present but verified invalid', result.present && result.verified?.valid === false)
}
{
  const line = '- [gotcha] Something happens here — Since: latest'
  const result = parseObservationMetadataTrailer(line)
  check('non-version Since value → present but since invalid', result.present && result.since?.valid === false)
}
{
  const line = '- [gotcha] Something happens here — Ownership: contractor'
  const result = parseObservationMetadataTrailer(line)
  check('unenumerated Ownership value → present but ownership invalid', result.present && result.ownership?.valid === false)
}

console.log('\nobservation-metadata: Ownership enum guard')
check('canonical Ownership list is non-empty', OBSERVATION_OWNERSHIP_VALUES.length > 0)
check('isObservationOwnership accepts every canonical value', OBSERVATION_OWNERSHIP_VALUES.every((v) => isObservationOwnership(v)))
check('isObservationOwnership rejects an unknown value', !isObservationOwnership('contractor'))

done()
