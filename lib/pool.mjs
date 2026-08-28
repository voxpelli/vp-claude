/**
 * Bounded worker pool for the sweep drivers.
 *
 * `lib/ndjson.mjs`'s header declined to extract this, predicting the retry
 * policies would diverge: "the registry needs `Retry-After` and backoff, `bm`
 * reads do not, so a shared concurrency helper would be an abstraction over two
 * things that are becoming less alike."
 *
 * They did not diverge. `Retry-After` and backoff went into `lib/http-json.mjs`
 * instead, one layer below, and the two `pool()` copies stayed identical --
 * down to the wording of their own rationale comments. A third copy of the same
 * loop then appeared inlined in `downloads-batch.mjs`, which a grep for `pool`
 * does not find because it is not a named function.
 *
 * `docs/design/stale-npm-triage-2026-08-05.md` records the revival trigger as
 * "a third driver, or a bug fixed in one pool and not the other". The third
 * driver exists, so this is that deferred decision coming due rather than a
 * speculative tidy-up.
 *
 * The only real difference between the copies was what happens to a rejected
 * item, which is why `onError` is a parameter rather than a policy baked in
 * here: the two shards turn a rejection into a result ROW so the shard's
 * completed work survives one bad item, while the downloads pass records it in
 * a Map and has no row to return.
 */

/**
 * Run `fn` over `items` with at most `limit` in flight, preserving input order
 * in the returned array.
 *
 * The concurrency cap is the load-bearing parameter. Each `bm` call is its own
 * OS process, so an unbounded fan-out over a 580-note cohort would spawn 580 of
 * them. This is the PER-SHARD slice of a global cap of `shards × concurrency`,
 * enforced by the caller, not here.
 *
 * A rejected item is passed to `onError` and its return value takes that slot,
 * so one bad item cannot discard the work already done. Nothing is rethrown:
 * `onError` is required precisely so a caller has to say what a failure means
 * rather than inheriting a silent drop.
 *
 * @template TItem
 * @template TResult
 * @param {TItem[]} items
 * @param {number} limit
 * @param {(item: TItem) => Promise<TResult>} fn
 * @param {(item: TItem, err: unknown) => TResult} onError
 * @returns {Promise<TResult[]>}
 */
export async function pool (items, limit, fn, onError) {
  /** @type {TResult[]} */
  const results = Array.from({ length: items.length })
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      // Hoisted and guarded for `noUncheckedIndexedAccess`. The guard is
      // unreachable — `i < items.length` by the loop condition — but expressing
      // that to the checker with a cast would also hide a real hole if the
      // bounds ever changed.
      const item = items[i]
      if (item === undefined) continue
      try {
        results[i] = await fn(item)
      } catch (err) {
        results[i] = onError(item, err)
      }
    }
  }))
  return results
}

/**
 * The message an `unknown` rejection carries, truncated for a report column.
 *
 * Both shards wrote this expression by hand in their catch blocks with
 * different truncation lengths (200 and 80), which is the kind of difference
 * that looks deliberate and is not.
 *
 * @param {unknown} err
 * @param {number} [max]
 * @returns {string}
 */
export function errorMessage (err, max = 200) {
  return String(err && /** @type {Error} */ (err).message).slice(0, max)
}
