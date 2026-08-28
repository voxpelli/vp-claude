// enumerate.mjs — establish the authoritative cohort and the schema-side
// compliance view in ONE `bm tool schema-validate <type>` call (~13s for 580
// npm notes, versus ~40 minutes of serial per-note reads).
//
// The cohort is enumerated by NOTE TYPE, not by title prefix. That is the whole
// point: a prefix filter silently drops notes whose titles kept the pre-0.22.0
// colon form and notes carrying no prefix at all, so a prefix-enumerated sweep
// reports a clean bill of health over a denominator it quietly shrank. Typing
// is what the schema actually asserts, so it cannot drift from the note.
//
// Emits:
//   cohort.txt      one note identifier per line (the denominator)
//   schema.ndjson   per note: which schema fields are present + `version` values
//   enumerate.json  counts, duplicate identifiers, field-presence histogram
//
// Usage: node enumerate.mjs <noteType> <outDir> <runDate> [validateJson]
//   runDate: the `date -u +%F` the calling step printed, stamped into
//   enumerate.json. Supplied rather than computed so this stays a pure function
//   of its inputs (no `new Date()`), and so a later step can tell THIS run's
//   artefacts from a previous run's — which a content hash of the cohort cannot
//   do, since it detects a different cohort but never an older one.
//   validateJson: reuse an existing schema-validate dump instead of re-running.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const [noteType, outDir, runDate, validateJsonPath] = process.argv.slice(2)
if (!noteType || !outDir || !runDate) {
  throw new Error('Usage: node enumerate.mjs <noteType> <outDir> <runDate> [validateJson]')
}

const raw = validateJsonPath
  ? readFileSync(validateJsonPath, 'utf8')
  : execFileSync('bm', ['tool', 'schema-validate', noteType], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })

/**
 * The shape `bm tool schema-validate` returns. Declared because `JSON.parse`
 * yields `any`, and an `any` here propagated to 31 unchecked expressions —
 * every field name below is an external contract worth stating once.
 *
 * @typedef ValidateField
 * @property {string} [field_name]
 * @property {string} [status]
 * @property {unknown[]} [values]
 */

/**
 * @typedef ValidateResult
 * @property {string} [note_identifier]
 * @property {ValidateField[]} [field_results]
 */

/**
 * @typedef ValidateDoc
 * @property {ValidateResult[]} [results]
 * @property {number} [total_notes]
 * @property {number} [total_entities]
 */

const doc = /** @type {ValidateDoc} */ (JSON.parse(raw))
const results = Array.isArray(doc.results) ? doc.results : []

/** @type {Map<string, { fields: string[], versionValues: string[], seen: number }>} */
const byId = new Map()

for (const r of results) {
  const id = String(r.note_identifier)
  /** @type {string[]} */
  const present = []
  /** @type {string[]} */
  let versionValues = []
  for (const f of r.field_results ?? []) {
    if (f.status !== 'present') continue
    present.push(String(f.field_name))
    if (f.field_name === 'version') versionValues = (f.values ?? []).map(String)
  }
  const prev = byId.get(id)
  if (prev) {
    // Same identifier returned twice by schema-validate. total_entities counts
    // both, so an unreconciled denominator would be inflated by the duplicates.
    prev.seen += 1
    prev.fields = [...new Set([...prev.fields, ...present])]
    if (!prev.versionValues.length) prev.versionValues = versionValues
  } else {
    byId.set(id, { fields: present, versionValues, seen: 1 })
  }
}

const ids = [...byId.keys()].sort()
const duplicates = ids.filter(id => (byId.get(id)?.seen ?? 0) > 1)

writeFileSync(`${outDir}/cohort.txt`, ids.join('\n') + '\n')
writeFileSync(
  `${outDir}/schema.ndjson`,
  ids.map(id => {
    const v = byId.get(id)
    return JSON.stringify({ id, fields: v?.fields ?? [], versionValues: v?.versionValues ?? [], seen: v?.seen ?? 1 })
  }).join('\n') + '\n'
)

/** @type {Record<string, number>} */
const fieldHistogram = {}
for (const v of byId.values()) for (const f of v.fields) fieldHistogram[f] = (fieldHistogram[f] ?? 0) + 1

const summary = {
  noteType,
  runDate: runDate ?? null,
  reportedTotalNotes: doc.total_notes ?? null,
  reportedTotalEntities: doc.total_entities ?? null,
  resultRows: results.length,
  uniqueIdentifiers: ids.length,
  duplicateIdentifiers: duplicates,
  fieldHistogram,
}
writeFileSync(`${outDir}/enumerate.json`, JSON.stringify(summary, null, 2) + '\n')
process.stdout.write(JSON.stringify(summary) + '\n')
