/**
 * Throttle-aware JSON fetching for the npm-facing sweep drivers.
 *
 * Extracted because two drivers now talk to npm infrastructure with identical
 * throttle semantics — `registry-shard.mjs` (registry.npmjs.org) and
 * `downloads-batch.mjs` (api.npmjs.org). That is the opposite of the `pool()`
 * helper those files also share, which is deliberately left duplicated: pool's
 * callers are diverging (one drives local `bm` reads, one drives HTTP), while
 * these two are the same problem.
 *
 * The 2026-08-05 sweep lost weekly downloads on 462 of the 512 eligible rows to HTTP 429 and
 * scored every one of them as genuinely unpopular. Two things were wrong: four
 * shard processes opened 32 uncoordinated sockets with no cross-process budget,
 * and the retry policy was `sleep(500 * attempt)` twice, ignoring `Retry-After`
 * entirely. This file fixes the second; running downloads once over the merged
 * cohort fixes the first.
 */

/** A hostile or mistaken `Retry-After: 3600` must not hang a sweep. */
export const MAX_RETRY_AFTER_MS = 30_000
/** Ceiling for the exponential arm, independent of the server's advice. */
export const MAX_BACKOFF_MS = 20_000
const BASE_BACKOFF_MS = 500

/**
 * Parse an HTTP `Retry-After` header. RFC 9110 allows BOTH forms and npm has
 * been observed sending each, so handling only delta-seconds silently discards
 * the server's advice on the date form.
 *
 * @param {string | null | undefined} value raw header value
 * @param {number} nowMs current time, passed in so this stays pure
 * @returns {number | null} milliseconds to wait, or null if absent/unparseable
 */
export function parseRetryAfter (value, nowMs) {
  if (value == null) return null
  const raw = String(value).trim()
  if (raw === '') return null

  // delta-seconds: a non-negative integer count of seconds.
  if (/^\d+$/.test(raw)) return Math.min(Number(raw) * 1000, MAX_RETRY_AFTER_MS)

  // HTTP-date: an absolute instant, which may already be in the past.
  const at = Date.parse(raw)
  if (Number.isNaN(at)) return null
  return Math.min(Math.max(0, at - nowMs), MAX_RETRY_AFTER_MS)
}

/**
 * How long to wait before retry `attempt` (1-based).
 *
 * Jitter is applied in BOTH arms, including when the server named a time: N
 * workers throttled by the same response would otherwise wake in lockstep and
 * reproduce the burst that got them throttled.
 *
 * @param {number} attempt 1 for the first retry
 * @param {number | null} retryAfterMs parsed `Retry-After`, if the server sent one
 * @param {number} random a value in [0, 1)
 * @returns {number} milliseconds
 */
export function backoffDelay (attempt, retryAfterMs, random) {
  if (retryAfterMs != null) {
    // Honour the server's number, then spread the wake-ups across a tenth of it.
    return Math.round(retryAfterMs * (1 + (random * 0.1)))
  }
  // Doubling by left shift rather than `**`: the shared eslint config forbids
  // ES2016 exponentiation, and nothing else in lib/ uses it. `attempt` is
  // clamped first so the shift cannot overflow into a negative.
  const doublings = Math.min(Math.max(attempt - 1, 0), 20)
  const exponential = Math.min(BASE_BACKOFF_MS * (1 << doublings), MAX_BACKOFF_MS)
  // Full jitter over the lower half: never faster than 50% of the nominal wait.
  return Math.round(exponential * (0.5 + (random * 0.5)))
}

/**
 * @typedef JsonFetchOk
 * @property {true} ok
 * @property {unknown} json
 */

/**
 * @typedef JsonFetchFail
 * @property {false} ok
 * @property {string} reason
 * @property {number} [status]
 */

/**
 * @typedef FetcherDeps
 * @property {typeof globalThis.fetch} [fetchImpl]
 * @property {(ms: number) => Promise<void>} [sleep]
 * @property {() => number} [now]
 * @property {() => number} [random]
 * @property {number} [timeoutMs]
 * @property {number} [retries] attempts AFTER the first
 */

/**
 * Build a size-capped, throttle-aware JSON fetcher.
 *
 * Dependencies are injected so `scripts/check-http-json.mjs` can exercise the
 * retry policy against a scripted fake instead of a live registry — the policy
 * that was wrong here shipped precisely because it could only be observed in a
 * 21-minute run.
 *
 * @param {FetcherDeps} [deps]
 * @returns {(url: string, budget: number) => Promise<JsonFetchOk | JsonFetchFail>}
 */
export function createJsonFetcher (deps = {}) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch
  const sleep = deps.sleep ?? (ms => new Promise(resolve => { setTimeout(resolve, ms) }))
  const now = deps.now ?? (() => Date.now())
  const random = deps.random ?? (() => Math.random())
  const timeoutMs = deps.timeoutMs ?? 45_000
  const retries = deps.retries ?? 4

  return async function fetchJsonCapped (url, budget) {
    /** @type {JsonFetchFail} */
    let last = { ok: false, reason: 'unattempted' }
    /** Carried between iterations: only a throttle/5xx response sets it. */
    let lastRetryAfterMs = /** @type {number | null} */ (null)

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(backoffDelay(attempt, lastRetryAfterMs, random()))

      let res
      try {
        res = await fetchImpl(url, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (err) {
        last = { ok: false, reason: `network: ${String(err && /** @type {Error} */ (err).message).slice(0, 120)}` }
        lastRetryAfterMs = null
        continue
      }

      // 404 is an authoritative answer, not a failure — never retry it.
      if (res.status === 404) return { ok: false, reason: 'not-found', status: 404 }

      if (res.status === 429 || res.status >= 500) {
        lastRetryAfterMs = parseRetryAfter(res.headers?.get?.('retry-after'), now())
        // The attempt count rides along in the reason: "asked once" and "asked
        // five times and was refused every time" are different findings, and the
        // old format collapsed them into one `http-429`.
        last = { ok: false, reason: `http-${res.status}/${attempt + 1}`, status: res.status }
        continue
      }
      if (!res.ok) return { ok: false, reason: `http-${res.status}`, status: res.status }

      const reader = res.body?.getReader()
      if (!reader) return { ok: false, reason: 'no-body' }
      /** @type {Uint8Array[]} */
      const chunks = []
      let total = 0
      let streamError = null
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          total += value.length
          if (total > budget) {
            await reader.cancel()
            return { ok: false, reason: 'too-large' }
          }
          chunks.push(value)
        }
      } catch (err) {
        // A reset connection mid-stream is common on the largest packuments; it
        // is retryable, and must not reject out of the caller's pool.
        streamError = String(err && /** @type {Error} */ (err).message).slice(0, 120)
      }
      if (streamError) {
        last = { ok: false, reason: `stream: ${streamError}` }
        lastRetryAfterMs = null
        continue
      }
      try {
        return { ok: true, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) }
      } catch (err) {
        return { ok: false, reason: `parse: ${String(err && /** @type {Error} */ (err).message).slice(0, 120)}` }
      }
    }
    return last
  }
}
