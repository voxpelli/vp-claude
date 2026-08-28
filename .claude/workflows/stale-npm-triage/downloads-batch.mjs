// downloads-batch.mjs — weekly download counts for the whole cohort, in ONE
// process, after the registry shards have merged.
//
// This used to happen inside `registry-shard.mjs`, one request per package. The
// 2026-08-05 sweep therefore opened 4 shards × concurrency 8 = 32 uncoordinated
// sockets against api.npmjs.org and lost 462 of the 512 eligible rows to HTTP 429 — on a hard
// alphabetical boundary, because the shards were split round-robin and all four
// hit the wall at once. Every one of those rows was then scored as genuinely
// unpopular, which is what made the ranking noise.
//
// Per-request backoff cannot fix a limit hit that way; there is no cross-process
// budget to back off within. Batching can, but only from a process that sees the
// whole cohort — hence a separate step rather than a fix inside the shard.
//
// The endpoint takes up to 128 comma-separated names:
//   /downloads/point/last-week/a,b,c  ->  { "a": {...}, "b": null, "c": {...} }
// with two contract details that both matter (verified live 2026-08-05):
//   * an unknown package is `null`, NOT `{"downloads": 0}` — distinguishable,
//     and it must stay distinguishable or an unpublished package reads as a
//     package nobody wants;
//   * SCOPED names are refused outright —
//     {"error":"scoped packages are not currently supported in bulk lookups"} —
//     so they go one at a time, which is where the throttle risk still lives.
//     For this cohort that is 176 of 523 names; batching removes the other 347.
//
// Usage: node downloads-batch.mjs <registry.ndjson> <out.ndjson> [concurrency]

import { createJsonFetcher } from '../../../lib/http-json.mjs'
import { readNdjson, writeNdjson } from '../../../lib/ndjson.mjs'
import { errorMessage, pool } from '../../../lib/pool.mjs'
import {
  BATCH_SIZE, chunkNames, interpretBulk, interpretSingle,
} from '../../../lib/npm-downloads.mjs'

const [registryPath, outPath, concurrencyRaw] = process.argv.slice(2)
if (!registryPath || !outPath) {
  throw new Error('Usage: node downloads-batch.mjs <registry.ndjson> <out.ndjson> [concurrency]')
}
// Deliberately low. The scoped residual is the part that gets throttled, and
// this step is no longer competing with three sibling processes.
const CONCURRENCY = Math.max(1, Number.parseInt(concurrencyRaw ?? '3', 10) || 3)

const DOWNLOADS = 'https://api.npmjs.org/downloads/point/last-week'
/** A counts object is a few hundred bytes; a 128-name batch a few tens of KB. */
const SMALL_BUDGET = 5_000_000

const fetchJson = createJsonFetcher({ timeoutMs: 45_000, retries: 4 })

const { malformed: malformedRegistryLines, map: registryRows } = readNdjson(registryPath)

/** @type {{ id: string, name: string }[]} */
const wanted = []
for (const row of registryRows.values()) {
  // Only rows the registry actually answered for: asking about a name that is
  // not in the registry wastes a slot and returns null either way.
  const answered = row.upstreamState === 'ok' || row.upstreamState === 'deprecated'
  if (answered && typeof row.name === 'string' && row.name) {
    wanted.push({ id: String(row.id), name: row.name })
  }
}

const scoped = wanted.filter(r => r.name.startsWith('@'))
const plain = wanted.filter(r => !r.name.startsWith('@'))

/** @type {Map<string, { weeklyDownloads: number | null, downloadsState: string }>} */
const byName = new Map()

// ── Bulk: every unscoped name, 128 at a time, sequentially ──────────────────
// Sequential on purpose. Three requests cover 347 packages; there is nothing to
// parallelise and every concurrent socket here is a step back toward the burst
// that caused the original failure.
//
// Response interpretation lives in `lib/npm-downloads.mjs`, under fixture test —
// including the one-name chunk, whose response comes back in a different SHAPE
// and used to be misread as an unanswered request.
let bulkRequests = 0
for (const batch of chunkNames(plain, BATCH_SIZE)) {
  const names = batch.map(r => r.name)
  bulkRequests++
  const res = await fetchJson(`${DOWNLOADS}/${names.join(',')}`, SMALL_BUDGET)
  if (!res.ok) {
    // The whole batch failed together; say so per name rather than letting 128
    // packages silently read as unpopular.
    for (const name of names) byName.set(name, { weeklyDownloads: null, downloadsState: `downloads-unavailable:${res.reason}` })
    continue
  }
  for (const [name, result] of interpretBulk(names, res.json)) byName.set(name, result)
}

// ── Scoped residual: one request each, bounded concurrency ──────────────────
/**
 * @param {{ id: string, name: string }} row
 * @returns {Promise<void>}
 */
async function resolveScoped (row) {
  const enc = row.name.split('/').map(seg => encodeURIComponent(seg)).join('/')
  const res = await fetchJson(`${DOWNLOADS}/${enc}`, SMALL_BUDGET)
  if (!res.ok) {
    byName.set(row.name, {
      weeklyDownloads: null,
      downloadsState: res.status === 404 ? 'downloads-none-reported' : `downloads-unavailable:${res.reason}`,
    })
    return
  }
  byName.set(row.name, interpretSingle(res.json))
}

// The third copy of the bounded-worker loop, and the one a grep for `pool`
// never found because it was never a named function. It differs from the two
// shards only in what a rejection means here: there is no row to return, so the
// failure is recorded in `byName` and the pool's own result array is discarded.
await pool(scoped, CONCURRENCY, resolveScoped, (item, err) => {
  byName.set(item.name, {
    weeklyDownloads: null,
    downloadsState: `downloads-unavailable:threw:${errorMessage(err, 80)}`,
  })
})

// ── Emit one row per wanted package, keyed by note id for the rank join ─────
const out = wanted.map(r => ({
  id: r.id,
  name: r.name,
  // A name we asked about but never recorded an answer for is its own state.
  // Defaulting it to null downloads would be the exact false-unpopular this
  // whole step exists to remove.
  ...(byName.get(r.name) ?? { weeklyDownloads: null, downloadsState: 'downloads-unresolved' }),
}))
writeNdjson(outPath, out)

/** @type {Record<string, number>} */
const counts = {}
for (const r of out) counts[r.downloadsState] = (counts[r.downloadsState] ?? 0) + 1

process.stdout.write(JSON.stringify({
  registryRows: registryRows.size,
  wanted: wanted.length,
  bulkNames: plain.length,
  bulkRequests,
  scopedNames: scoped.length,
  written: out.length,
  malformedRegistryLines,
  okRate: out.length ? Number((out.filter(r => r.downloadsState === 'ok').length / out.length).toFixed(4)) : 0,
  counts,
}) + '\n')
