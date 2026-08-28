/**
 * Interpretation of api.npmjs.org download-count responses.
 *
 * Extracted from `downloads-batch.mjs` because that driver is a top-level-await
 * script: its response handling was unreachable from a fixture, so the endpoint's
 * two response SHAPES could only ever be exercised by a live sweep — which is how
 * the bug below survived being written down and still not noticed.
 *
 * The endpoint has one URL and two shapes:
 *
 *   /downloads/point/last-week/a,b,c  ->  { "a": {...}, "b": null, "c": {...} }
 *   /downloads/point/last-week/a      ->  { downloads: N, start, end, package: "a" }
 *
 * The second is returned for a request naming exactly ONE package — including a
 * bulk chunk that happens to have one name left over. `plain.length % 128 === 1`
 * is not a rare case to wave at: it is one cohort size away at all times, and
 * Phase 8's data pass moved the remainder.
 *
 * Read as a keyed map, the unwrapped shape has no key matching the requested
 * name, so the row used to be filed `downloads-not-returned` — "we asked and npm
 * didn't answer" — when npm had in fact answered with a number. `interpretBulk`
 * now detects the shape rather than assuming the count.
 */

/**
 * @typedef DownloadsResult
 * @property {number | null} weeklyDownloads
 * @property {string} downloadsState
 */

/** The endpoint's documented ceiling for a comma-separated bulk request. */
export const BATCH_SIZE = 128

/**
 * Split a list into fixed-size chunks, preserving order.
 *
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
export function chunkNames (items, size) {
  if (!(size > 0)) throw new RangeError(`chunk size must be positive, got ${size}`)
  /** @type {T[][]} */
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Whether a parsed response is the UNWRAPPED single-package shape rather than a
 * keyed map.
 *
 * Both conditions are required, and the pair is what makes this safe against a
 * package literally named `package` or `downloads`: in the keyed shape every
 * value is an object or `null`, so `downloads` can never be a number there,
 * and `package` can never be a string.
 *
 * @param {unknown} json
 * @returns {boolean}
 */
export function isUnwrappedResponse (json) {
  if (json == null || typeof json !== 'object') return false
  const doc = /** @type {Record<string, unknown>} */ (json)
  return typeof doc['package'] === 'string' && typeof doc['downloads'] === 'number'
}

/**
 * Interpret a single-package response body (`{downloads, start, end, package}`).
 *
 * @param {unknown} json
 * @returns {DownloadsResult}
 */
export function interpretSingle (json) {
  const count = /** @type {Record<string, unknown> | null | undefined} */ (json)?.['downloads']
  return typeof count === 'number'
    ? { weeklyDownloads: count, downloadsState: 'ok' }
    : { weeklyDownloads: null, downloadsState: 'downloads-missing' }
}

/**
 * Interpret a bulk response against the names that were actually requested.
 *
 * Keyed by requested name, never by what came back: a response carrying an extra
 * key nobody asked for must not enter the results, and a requested name with no
 * key must still produce a row saying so.
 *
 * @param {string[]} names the names sent in this request, in order
 * @param {unknown} json parsed response body
 * @returns {Map<string, DownloadsResult>}
 */
export function interpretBulk (names, json) {
  /** @type {Map<string, DownloadsResult>} */
  const out = new Map()

  // A one-name request gets the unwrapped shape back. Detect it by SHAPE and
  // corroborate with the count — a multi-name request answering in the
  // unwrapped shape would be a contract change, not a case to guess at, so it
  // falls through to the keyed reading and reports `downloads-not-returned`
  // rather than silently attributing one number to many names.
  const single = names[0]
  if (names.length === 1 && single !== undefined && isUnwrappedResponse(json)) {
    out.set(single, interpretSingle(json))
    return out
  }

  const doc = /** @type {Record<string, unknown>} */ (json ?? {})
  for (const name of names) {
    if (!(name in doc)) {
      // Asked, and the key came back absent — distinct from `null` (asked, and
      // the registry has nothing) and from a transport failure.
      out.set(name, { weeklyDownloads: null, downloadsState: 'downloads-not-returned' })
      continue
    }
    const entry = doc[name]
    if (entry == null) {
      // An unknown package is `null`, NOT `{"downloads": 0}`. Keeping these
      // apart is why an unpublished package does not read as one nobody wants.
      out.set(name, { weeklyDownloads: null, downloadsState: 'downloads-none-reported' })
      continue
    }
    const count = /** @type {Record<string, unknown>} */ (entry)['downloads']
    out.set(name, typeof count === 'number'
      ? { weeklyDownloads: count, downloadsState: 'ok' }
      : { weeklyDownloads: null, downloadsState: 'downloads-missing' })
  }
  return out
}
