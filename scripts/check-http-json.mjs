/**
 * Fixture self-test for `lib/http-json.mjs`. Wired into `npm run check` as
 * `check:http-json`.
 *
 * The retry policy this replaces — `sleep(500 * attempt)` twice, `Retry-After`
 * ignored — lost weekly downloads on 462 of the 512 eligible rows in the 2026-08-05 sweep,
 * and every one of those rows was then scored as genuinely unpopular. It shipped
 * because the only way to observe it was a live 21-minute run. The fetcher takes
 * injected `fetch`/`sleep`/`now`/`random`, so the policy is exercised here
 * against a scripted fake instead.
 */

import { createCheckHarness } from '../lib/check-harness.mjs'
import {
  backoffDelay, createJsonFetcher, MAX_RETRY_AFTER_MS, parseRetryAfter,
} from '../lib/http-json.mjs'

const { checkEqual: check, done } = createCheckHarness()

const NOW = Date.parse('2026-08-05T12:00:00Z')

// --- parseRetryAfter: BOTH RFC 9110 forms, because npm sends each ---
check('delta-seconds', parseRetryAfter('5', NOW), 5000)
check('delta-seconds zero is a real answer, not absence', parseRetryAfter('0', NOW), 0)
check('an HTTP-date is honoured, not discarded',
  parseRetryAfter('Wed, 05 Aug 2026 12:00:10 GMT', NOW), 10_000)
check('an HTTP-date already in the past clamps to 0, never negative',
  parseRetryAfter('Wed, 05 Aug 2026 11:59:00 GMT', NOW), 0)
check('absent header → null', parseRetryAfter(null, NOW), null)
check('empty header → null', parseRetryAfter('   ', NOW), null)
check('unparseable header → null, not NaN', parseRetryAfter('soon', NOW), null)
// A hostile or mistaken value must not hang the sweep.
check('a huge delta-seconds is capped', parseRetryAfter('3600', NOW), MAX_RETRY_AFTER_MS)
check('a far-future HTTP-date is capped',
  parseRetryAfter('Wed, 05 Aug 2026 23:00:00 GMT', NOW), MAX_RETRY_AFTER_MS)

// --- backoffDelay: exponential when unadvised, server-led when advised ---
check('first retry, no advice, minimum jitter', backoffDelay(1, null, 0), 250)
check('first retry, no advice, maximum jitter', backoffDelay(1, null, 0.999), 500)
check('backoff grows exponentially', backoffDelay(4, null, 0), 2000)
check('...and is capped', backoffDelay(20, null, 0), 10_000)

// The two ends of the doubling clamp. Neither is reachable from the default
// fetcher (`attempt` runs 1..retries), but `retries` is injectable and
// `backoffDelay` is exported, so both are reachable through the public API.
//
// Plant-and-revert found this gap: deleting the clamp entirely left all 33
// fixtures green, because the "…and is capped" case above uses attempt=20,
// where clamped and unclamped agree. JS `<<` takes its shift count mod 32, so
// the unclamped failures are `1 << -1` → a NEGATIVE delay, and `1 << 33` →
// `1 << 1`, a plausible-looking 250 ms that would hammer the registry at nearly
// full speed with nothing visibly wrong.
check('attempt 0 floors at zero doublings, never a negative delay',
  backoffDelay(0, null, 0), 250)
check('a large attempt stays at the ceiling — the shift must not wrap',
  backoffDelay(33, null, 0), 10_000)
check('server advice is honoured over the exponential arm', backoffDelay(1, 7000, 0), 7000)
// Jitter applies even when the server named a time: N workers throttled by the
// same response would otherwise wake in lockstep and reproduce the burst.
check('...but still jittered so workers do not wake in lockstep',
  backoffDelay(1, 7000, 0.999) > 7000, true)
check('server advice of 0 is respected as 0', backoffDelay(3, 0, 0.5), 0)

// --- the fetcher's retry policy, against a scripted fake ---

/**
 * @param {{ status: number, body?: unknown, retryAfter?: string }[]} script
 * @returns {{ fetchImpl: typeof globalThis.fetch, calls: string[], slept: number[] }}
 */
function fake (script) {
  /** @type {string[]} */
  const calls = []
  /** @type {number[]} */
  const slept = []
  let i = 0
  /** @type {any} */
  const fetchImpl = async (/** @type {string} */ url) => {
    calls.push(url)
    const step = script[Math.min(i++, script.length - 1)]
    const payload = new TextEncoder().encode(JSON.stringify(step?.body ?? {}))
    let sent = false
    return {
      status: step?.status ?? 200,
      ok: (step?.status ?? 200) < 400,
      headers: { get: (/** @type {string} */ h) => (h.toLowerCase() === 'retry-after' ? (step?.retryAfter ?? null) : null) },
      body: {
        getReader: () => ({
          read: async () => {
            if (sent) return { done: true }
            sent = true
            return { done: false, value: payload }
          },
          cancel: async () => {},
        }),
      },
    }
  }
  return { fetchImpl, calls, slept }
}

/**
 * @param {{ status: number, body?: unknown, retryAfter?: string }[]} script
 * @param {number} [retries]
 * @returns {{ fetchJson: (url: string, budget: number) => Promise<any>, fetchImpl: typeof globalThis.fetch, calls: string[], slept: number[] }}
 */
function fetcherOver (script, retries = 4) {
  const f = fake(script)
  const fetchJson = createJsonFetcher({
    fetchImpl: f.fetchImpl,
    sleep: async ms => { f.slept.push(ms) },
    now: () => NOW,
    random: () => 0,
    retries,
  })
  return { fetchJson, ...f }
}

const okRun = fetcherOver([{ status: 200, body: { downloads: 42 } }])
const okResult = await okRun.fetchJson('u', 1e6)
check('a 200 returns the parsed body', okResult.json.downloads, 42)
check('...on the first attempt', okRun.calls.length, 1)
check('...with no sleeping', okRun.slept.length, 0)

const notFound = fetcherOver([{ status: 404 }])
const notFoundResult = await notFound.fetchJson('u', 1e6)
check('a 404 is authoritative and never retried', notFound.calls.length, 1)
check('...reported as not-found', notFoundResult.reason, 'not-found')

const throttled = fetcherOver([{ status: 429, retryAfter: '2' }, { status: 429, retryAfter: '2' }, { status: 200, body: { downloads: 7 } }])
const throttledResult = await throttled.fetchJson('u', 1e6)
check('a throttle is retried until it succeeds', throttledResult.json.downloads, 7)
check('...taking three attempts', throttled.calls.length, 3)
check('...and honouring Retry-After both times', throttled.slept.join(','), '2000,2000')

const exhausted = fetcherOver([{ status: 429 }])
const exhaustedResult = await exhausted.fetchJson('u', 1e6)
check('exhausting retries reports failure', exhaustedResult.ok, false)
check('...after 1 + retries attempts', exhausted.calls.length, 5)
// "Asked once" and "asked five times and was refused every time" are different
// findings; the old `http-429` collapsed them into one string.
check('...with the attempt count in the reason', exhaustedResult.reason, 'http-429/5')
check('...and the status preserved for the caller to bucket on', exhaustedResult.status, 429)

const serverError = fetcherOver([{ status: 503 }, { status: 200, body: { ok: 1 } }])
await serverError.fetchJson('u', 1e6)
check('a 5xx is retried too', serverError.calls.length, 2)

const clientError = fetcherOver([{ status: 400 }])
const clientErrorResult = await clientError.fetchJson('u', 1e6)
check('a non-throttle 4xx is NOT retried', clientError.calls.length, 1)
check('...and reports the status verbatim', clientErrorResult.reason, 'http-400')

const tooBig = fetcherOver([{ status: 200, body: { pad: 'x'.repeat(500) } }])
const tooBigResult = await tooBig.fetchJson('u', 10)
check('a response over budget is abandoned, not parsed', tooBigResult.reason, 'too-large')

const retriesOff = fetcherOver([{ status: 429 }], 0)
await retriesOff.fetchJson('u', 1e6)
check('retries:0 means exactly one attempt', retriesOff.calls.length, 1)

done()
