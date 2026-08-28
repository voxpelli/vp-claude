// registry-shard.mjs — resolve one shard of npm package names against the
// public registry and emit the upstream facts the drift bucketing needs.
//
// Reads the scan shard directly rather than a pre-filtered name list: deriving
// the names here removes a `jq` step, an intermediate file, and a whole
// `<noteId>\t<npmName>` format contract from the calling prompt, and lets the
// script report how many scan rows it deliberately skipped.
//
// Two endpoints, cheapest-first, because the obvious single fetch does not
// scale: the full packument is 15,513,951 B for `typescript` and 8,622,358 B
// even abbreviated (measured 2026-08-05), so fetching it per package for a
// 580-note cohort is not viable.
//   1. /<name>/latest        (~4 KB, always)  -> version + deprecated
//   2. /<name>               (size-guarded)   -> .time[version], release date
//
// Weekly downloads USED to be a third fetch here, and that was the single
// largest defect in the 2026-08-05 report: four shards × concurrency 8 meant 32
// uncoordinated sockets against api.npmjs.org, 462 of the 512 eligible rows lost to HTTP 429,
// and every one of them scored as genuinely unpopular. It now lives in
// `downloads-batch.mjs`, which runs once over the merged cohort and can use the
// 128-name bulk endpoint. Per-request backoff could not have fixed a limit hit
// by four processes with no shared budget.
// Step 2 MUST be the full document: the abbreviated form
// (`accept: application/vnd.npm.install-v1+json`) omits `.time` entirely, so it
// cannot supply a per-version release date under any budget — which is why this
// differs from `scripts/fetch-npm-upstream.sh`, which does use the short form.
//
// KNOWN BIAS, reported rather than hidden: step 2 is abandoned above
// `MAX_DOC_BYTES`, yielding a null release date. Packument size tracks release
// count, which tracks popularity — so the date drops out preferentially on the
// most widely-used packages, exactly the rows a staleness ranking cares most
// about. `dateState` records the reason per row so the report can say so.
//
// 404 (absent from the registry) and a transport failure are kept DISTINCT all
// the way through. Collapsing them is what previously mis-bucketed a reachable
// package as unpublished. A 429 or 5xx is retried before being called a
// failure, because an unretried throttle silently REMOVES drifted notes from
// the ranked table and files them under "could not assess".
//
// Usage: node registry-shard.mjs <scan.ndjson> <out.ndjson> [concurrency]

import { createJsonFetcher } from '../../../lib/http-json.mjs'
import { readNdjson, writeNdjson } from '../../../lib/ndjson.mjs'
import { errorMessage, pool } from '../../../lib/pool.mjs'

const [scanPath, outPath, concurrencyRaw] = process.argv.slice(2)
if (!scanPath || !outPath) {
  throw new Error('Usage: node registry-shard.mjs <scan.ndjson> <out.ndjson> [concurrency]')
}
const CONCURRENCY = Math.max(1, Number.parseInt(concurrencyRaw ?? '8', 10) || 8)

const REGISTRY = 'https://registry.npmjs.org'
/** A single manifest. Named so it is not `Infinity`. */
const SMALL_BUDGET = 5_000_000
/** The packument cap. Above this the release date is abandoned, never guessed. */
const MAX_DOC_BYTES = 2_000_000

// Retry policy, `Retry-After` handling and jitter live in lib/http-json.mjs,
// shared with downloads-batch.mjs and fixture-tested there against a scripted
// fake — the old inline `sleep(500 * attempt)` twice could only be observed in
// a live 21-minute run, which is how it shipped ignoring `Retry-After` entirely.
const fetchJsonCapped = createJsonFetcher({ timeoutMs: 45_000, retries: 4 })

// Was a bare `JSON.parse` per line: one truncated line in the scan shard threw
// and killed this entire shard, while rank.mjs — reading the same format —
// counted it and carried on. lib/ndjson.mjs is now the single answer, and the
// count is reported rather than absorbed.
const { malformed: malformedScanLines, map: scanRows } = readNdjson(scanPath)

/** @type {{ id: string, name: string }[]} */
const rowsIn = []
let skipped = 0
for (const row of scanRows.values()) {
  if (row.status === 'ok' && typeof row.npmName === 'string' && row.npmName) rowsIn.push({ id: String(row.id), name: row.npmName })
  else skipped++
}

/**
 * @param {{ id: string, name: string }} row
 * @returns {Promise<import('../../../lib/ndjson.mjs').NdjsonRow & import('../../../lib/npm-triage.mjs').RegistryRow>}
 */
async function resolveOne (row) {
  const enc = row.name.split('/').map(seg => encodeURIComponent(seg)).join('/')

  const latest = await fetchJsonCapped(`${REGISTRY}/${enc}/latest`, SMALL_BUDGET)
  if (!latest.ok) {
    return {
      id: row.id,
      name: row.name,
      // 404 means the registry authoritatively has no such package; anything
      // else means we simply could not ask. These drive different buckets.
      upstreamState: latest.status === 404 ? 'not-in-registry' : 'api-unavailable',
      detail: latest.reason,
    }
  }

  const manifest = /** @type {Record<string, unknown>} */ (latest.json)
  const version = typeof manifest?.version === 'string' ? manifest.version : null
  const deprecated = manifest?.deprecated != null

  let releaseDate = null
  let dateState = 'ok'
  const doc = await fetchJsonCapped(`${REGISTRY}/${enc}`, MAX_DOC_BYTES)
  if (doc.ok) {
    const time = /** @type {Record<string, unknown> | undefined} */ (/** @type {Record<string, unknown>} */ (doc.json)?.time)
    const stamp = version && time ? time[version] : null
    if (typeof stamp === 'string') releaseDate = stamp
    else dateState = 'date-missing'
  } else {
    dateState = doc.reason === 'too-large' ? 'date-unavailable-large-doc' : `date-unavailable:${doc.reason}`
  }

  return {
    id: row.id,
    name: row.name,
    upstreamState: deprecated ? 'deprecated' : 'ok',
    upstreamVersion: version,
    releaseDate,
    dateState,
  }
}

const out = await pool(rowsIn, CONCURRENCY, resolveOne, (item, err) => ({
  id: item.id,
  name: item.name,
  upstreamState: 'api-unavailable',
  detail: errorMessage(err),
}))
writeNdjson(outPath, out)

/** @type {Record<string, number>} */
const counts = {}
for (const r of out) {
  const k = String(r.upstreamState)
  counts[k] = (counts[k] ?? 0) + 1
}
process.stdout.write(JSON.stringify({
  shard: scanPath,
  requested: rowsIn.length,
  written: out.length,
  skippedScanRows: skipped,
  // Surfaced, not absorbed: a non-zero count means the scan shard feeding this
  // one was written truncated, so `requested` is short by that much.
  malformedScanLines,
  counts,
}) + '\n')
