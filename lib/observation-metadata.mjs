// Observation-metadata trailer parser — Phase A of a two-phase bead
// (vp-claude-fwnq.3). Parses an OPTIONAL trailing `Verified:`/`Since:`/
// `Ownership:` token block that may follow a Basic Memory observation's
// substantive text, mirroring the `Severity: … · Ownership: … · Workaround:
// …` structured-field convention already used in this repo's UPSTREAM-*.md
// files (middle-dot `·` separated `Label: value` pairs). Pure functions,
// fixture-tested by scripts/check-observation-metadata.mjs — mirrors
// lib/staleness-contract.mjs and lib/fourth-wall-rules.mjs in shape.
//
// Scope (Phase A only, per the bead): parse + validate the trailer shape.
// Phase B (deferred, separate bead) would add `Verified` as a formal field
// to the 23 dual-synced schemas/*.md files — this module does not touch
// schema files and makes no claim about schema conformance.
//
// Convention: an observation line ending in ` — Verified: 2026-06-20 ·
// Since: v0.32.0 · Ownership: shared` (em dash `—` lead-in, exactly as used
// throughout this repo's schema prose; middle-dot `·` field separator,
// exactly as used in UPSTREAM-*.md's inline Severity/Ownership/Workaround
// convention). All three fields are independently optional; only fields
// present in the trailer are validated. `[source]` provenance (a separate,
// pre-existing convention) must stay plain text, never an inline markdown
// link — see the BM observation-drop bug documented in
// .claude/rules/schema-and-notes.md — so no fixture or example in this file
// or its self-test ever constructs a `[text](url)` shape.

/** Canonical Ownership enum, mirrored from UPSTREAM-*.md's real usage (`Ownership: upstream|shared|us`). */
export const OBSERVATION_OWNERSHIP_VALUES = /** @type {const} */ (['upstream', 'shared', 'us'])

/** @typedef {typeof OBSERVATION_OWNERSHIP_VALUES[number]} ObservationOwnership */

/**
 * Narrowing guard — is a parsed string an exact canonical Ownership value?
 *
 * @param {string} value
 * @returns {value is ObservationOwnership}
 */
export function isObservationOwnership (value) {
  return /** @type {readonly string[]} */ (OBSERVATION_OWNERSHIP_VALUES).includes(value)
}

/**
 * Discriminated on `valid` so a caller narrowing via `if (!field.valid)` gets
 * `error: string` (not `string | undefined`) — the raw-text/error-presence
 * pairing is guaranteed at the type level, not just by the two validators'
 * runtime convention.
 *
 * @typedef {{ raw: string, valid: true } | { raw: string, valid: false, error: string }} ObservationMetadataField
 */

/**
 * @typedef ObservationMetadataTrailer
 * @property {boolean} present - whether a well-formed `Label: value [· Label: value]*` trailer was found
 * @property {ObservationMetadataField} [verified]
 * @property {ObservationMetadataField} [since]
 * @property {ObservationMetadataField} [ownership]
 * @property {string[]} errors - flattened field-level error messages, for convenience
 */

const TRAILER_SEPARATOR = ' — '
const FIELD_SEPARATOR = ' · '
const RECOGNIZED_FIELDS = /** @type {const} */ (['Verified', 'Since', 'Ownership'])

/**
 * @param {string} value - e.g. "2026-06-20"
 * @returns {ObservationMetadataField}
 */
function validateVerified (value) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) {
    return { raw: value, valid: false, error: `Verified value "${value}" is not an ISO date (YYYY-MM-DD)` }
  }
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12) {
    return { raw: value, valid: false, error: `Verified value "${value}" has an out-of-range month` }
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > daysInMonth) {
    return { raw: value, valid: false, error: `Verified value "${value}" has an out-of-range day for that month` }
  }
  return { raw: value, valid: true }
}

/**
 * @param {string} value - e.g. "v0.32.0" or "0.32.0"
 * @returns {ObservationMetadataField}
 */
function validateSince (value) {
  if (!/^v?\d+\.\d+(?:\.\d+)?$/.test(value)) {
    return { raw: value, valid: false, error: `Since value "${value}" is not a version-like token (expected e.g. "v0.32.0" or "0.32.0")` }
  }
  return { raw: value, valid: true }
}

/**
 * @param {string} value - e.g. "shared"
 * @returns {ObservationMetadataField}
 */
function validateOwnership (value) {
  if (!isObservationOwnership(value)) {
    return { raw: value, valid: false, error: `Ownership value "${value}" is not one of: ${OBSERVATION_OWNERSHIP_VALUES.join(', ')}` }
  }
  return { raw: value, valid: true }
}

/**
 * Parses an optional trailing metadata block from a single observation line
 * (or any text ending in the trailer shape). Deliberately conservative: if
 * ANY `·`-separated segment after the last ` — ` doesn't match `Label:
 * value` for one of the three recognized labels, the whole trailer is
 * treated as ordinary prose (`present: false`) rather than a malformed
 * trailer — this is what keeps a sentence like "does X — see also the
 * related note" from false-positiving. Only a segment that DOES look like
 * `Verified:`/`Since:`/`Ownership:` gets value-level validation.
 *
 * @param {string} text - full observation text (or just its trailing portion)
 * @returns {ObservationMetadataTrailer}
 */
export function parseObservationMetadataTrailer (text) {
  const sepIndex = text.lastIndexOf(TRAILER_SEPARATOR)
  if (sepIndex === -1) {
    return { present: false, errors: [] }
  }
  const trailerText = text.slice(sepIndex + TRAILER_SEPARATOR.length).trim()
  if (trailerText === '') {
    return { present: false, errors: [] }
  }

  const parts = trailerText.split(FIELD_SEPARATOR)
  /** @type {Map<string, string>} */
  const byLabel = new Map()
  for (const part of parts) {
    const m = part.match(/^([a-z]+): (.+)$/i)
    if (!m || m[1] === undefined || m[2] === undefined) return { present: false, errors: [] }
    const label = m[1]
    if (!isMember(RECOGNIZED_FIELDS, label)) return { present: false, errors: [] }
    byLabel.set(label, m[2])
  }
  if (byLabel.size === 0) return { present: false, errors: [] }

  /** @type {ObservationMetadataTrailer} */
  const result = { present: true, errors: [] }

  const verifiedRaw = byLabel.get('Verified')
  if (verifiedRaw !== undefined) {
    result.verified = validateVerified(verifiedRaw)
    if (!result.verified.valid) result.errors.push(result.verified.error)
  }
  const sinceRaw = byLabel.get('Since')
  if (sinceRaw !== undefined) {
    result.since = validateSince(sinceRaw)
    if (!result.since.valid) result.errors.push(result.since.error)
  }
  const ownershipRaw = byLabel.get('Ownership')
  if (ownershipRaw !== undefined) {
    result.ownership = validateOwnership(ownershipRaw)
    if (!result.ownership.valid) result.errors.push(result.ownership.error)
  }

  return result
}

/**
 * @template {string} T
 * @param {readonly T[]} set
 * @param {string} value
 * @returns {value is T}
 */
function isMember (set, value) {
  return /** @type {readonly string[]} */ (set).includes(value)
}
