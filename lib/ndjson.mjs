/**
 * NDJSON read/write for the sweep drivers.
 *
 * Extracted because the copies had DIVERGED, not merely duplicated. `rank.mjs`
 * counted a malformed line and carried on — a truncated shard write has to be
 * loud, and silently skipping it would shrink coverage while every count still
 * looked self-consistent. `registry-shard.mjs` called bare `JSON.parse`, so the
 * same truncated write killed the whole shard instead. One correct
 * implementation, under fixture test, removes the choice.
 *
 * This header used to add that the `pool()` helper those files also share was
 * deliberately NOT extracted, because "their retry policies are about to
 * diverge on purpose". They did not. `Retry-After` and backoff went into
 * `lib/http-json.mjs` one layer below, the two copies stayed identical, and a
 * third appeared inlined in `downloads-batch.mjs`. It now lives in
 * `lib/pool.mjs` — the prediction is kept here rather than deleted, because a
 * wrong forecast about which code will diverge is worth remembering.
 */

import { readFileSync, writeFileSync } from 'node:fs'

/**
 * A row this module can actually read back: a JSON object carrying a string
 * `id`, which is the key everything downstream joins on.
 *
 * The writer took `unknown[]`, so `[null]` was a legal call — and reading that
 * file threw uncaught, killing the shard, which is the exact failure this
 * module was extracted to prevent. Requiring `id` on the way IN is the
 * one-word version of that fix.
 *
 * @typedef {Record<string, unknown> & { id: string }} NdjsonRow
 */

/**
 * @typedef NdjsonRead
 * @property {Map<string, NdjsonRow>} map rows by `id`, first wins
 * @property {string[]} duplicates ids seen more than once, in encounter order
 * @property {number} malformed lines that did not yield a usable row
 * @property {number} rows usable rows
 */

/**
 * Read an NDJSON file keyed by each row's `id`.
 *
 * A missing file is an empty result, not a throw — the caller decides whether
 * absence is a failure, and several of them legitimately tolerate it. A
 * malformed LINE is different: it is counted and reported, never dropped
 * silently, because it means an upstream write was truncated.
 *
 * @param {string} path
 * @returns {NdjsonRead}
 */
export function readNdjson (path) {
  /** @type {Map<string, NdjsonRow>} */
  const map = new Map()
  /** @type {string[]} */
  const duplicates = []
  let malformed = 0
  let rows = 0

  /** @type {string} */
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return { map, duplicates, malformed, rows }
  }

  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    /** @type {unknown} */
    let parsed
    try {
      parsed = JSON.parse(line)
    } catch {
      malformed++
      continue
    }
    // A line can parse as JSON and still not be a row. `null`, an array and a
    // bare number all satisfy JSON.parse; `String(row.id)` on the first of them
    // threw, killing the shard — the crash this module exists to prevent,
    // reachable through a writer that accepted `unknown[]`.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      malformed++
      continue
    }
    const row = /** @type {Record<string, unknown>} */ (parsed)
    // A row with no `id` used to key itself under the STRING "undefined", so it
    // counted as valid, and a second such row was then dropped as a duplicate
    // while `malformed` stayed 0 — every count reconciled around missing data.
    // `malformed` already means "loud", so that is where these belong.
    if (typeof row.id !== 'string' || row.id === '') {
      malformed++
      continue
    }
    rows++
    const { id } = row
    if (map.has(id)) duplicates.push(id)
    else map.set(id, /** @type {NdjsonRow} */ (row))
  }
  return { map, duplicates, malformed, rows }
}

/**
 * Write rows as NDJSON, one JSON document per line, with a trailing newline.
 *
 * The trailing newline is the convention `readNdjson` and every `wc -l` in the
 * orchestrator's prompts assume; it was previously re-stated by hand at three
 * call sites.
 *
 * `readNdjson` tolerates its absence, so only `wc -l` can tell — which is why
 * `check:ndjson` asserts it on the raw bytes rather than through a round trip.
 *
 * NO rows means an EMPTY file, not a lone newline: the orchestrator compares
 * shard line counts, and `wc -l` reads a lone newline as one line while
 * `readNdjson` reads it as zero rows. Both readers must agree.
 *
 * `NdjsonRow[]`, not `unknown[]`: the loose signature accepted `[null]`, and
 * reading that file back threw uncaught and killed the shard — the failure this
 * module's own header criticises `registry-shard.mjs` for. Stopping it at the
 * writer costs one word and removes the reader's need to be heroic.
 *
 * @param {string} path
 * @param {NdjsonRow[]} rows
 * @returns {void}
 */
export function writeNdjson (path, rows) {
  writeFileSync(path, rows.length === 0 ? '' : rows.map(r => JSON.stringify(r)).join('\n') + '\n')
}
