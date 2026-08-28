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
 * The `pool()` helper those two files also share is deliberately NOT extracted:
 * their retry policies are about to diverge on purpose (the registry needs
 * `Retry-After` and backoff, `bm` reads do not), so a shared concurrency helper
 * would be an abstraction over two things that are becoming less alike.
 */

import { readFileSync, writeFileSync } from 'node:fs'

/**
 * @typedef NdjsonRead
 * @property {Map<string, Record<string, unknown>>} map rows by `id`, first wins
 * @property {string[]} duplicates ids seen more than once, in encounter order
 * @property {number} malformed lines that were not parseable JSON
 * @property {number} rows lines that parsed
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
  /** @type {Map<string, Record<string, unknown>>} */
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
    /** @type {Record<string, unknown>} */
    let row
    try {
      row = JSON.parse(line)
    } catch {
      malformed++
      continue
    }
    rows++
    const id = String(row.id)
    if (map.has(id)) duplicates.push(id)
    else map.set(id, row)
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
 * @param {string} path
 * @param {unknown[]} rows
 * @returns {void}
 */
export function writeNdjson (path, rows) {
  writeFileSync(path, rows.length === 0 ? '' : rows.map(r => JSON.stringify(r)).join('\n') + '\n')
}
