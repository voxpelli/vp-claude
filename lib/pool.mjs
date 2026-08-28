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
  // `limit < 1` spawned ZERO workers: `Math.min(limit, n)` is 0, `Promise.all([])`
  // resolves at once, and the pre-sized array came back full of holes typed as
  // `TResult[]`. `fn` never ran, `onError` never ran, nothing threw — the silent
  // clean-looking failure this module is meant to prevent. All three callers
  // clamp with `Math.max(1, …)`; the extraction took the loop and left the
  // precondition behind, and the docblock's own argument for existing is that a
  // fourth caller is expected. `done(minChecks)` refuses `< 1` for this reason;
  // so does this.
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`pool: limit must be a positive integer, got ${String(limit)}`)
  }
  /** @type {TResult[]} */
  const results = Array.from({ length: items.length })
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      // Hoisted for `noUncheckedIndexedAccess`. This comment used to claim the
      // guard was unreachable "by the loop condition". It is not: `TItem` is
      // unconstrained, so `undefined` is a legal item, and `pool([1, undefined,
      // 3], …)` skips the middle slot silently and leaves a hole that is not a
      // `TResult`. No current caller passes one, which is why it never bit — but
      // the confident wording is what stopped anyone checking.
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
 * The original expression was a cast that LIES about an `unknown` — and that
 * cast is what made `String(undefined)` type-check, so a thrown string or a
 * plain object came back as the literal text `"undefined"`, discarding the only
 * information the rejection carried, into a column a human reads. This is the
 * idiom `extensions/index.js` already used correctly; the extraction had
 * canonicalised the wrong one.
 *
 * `max` is REQUIRED, with no default. An earlier version of this comment called
 * the shards' 200 and the downloads pass's 80 "the kind of difference that looks
 * deliberate and is not". That had it backwards: `downloads-batch.mjs` puts the
 * truncated text inside `downloadsState`, which is a CARDINALITY KEY
 * (`counts[r.downloadsState]`), so every distinct message becomes its own
 * summary bucket — while the shards' `error`/`detail` are diagnostic-only and
 * their counters key on the bounded `status`/`upstreamState` enums instead.
 * The difference is real, and requiring the argument makes each call site state
 * which case it is rather than inherit a number nobody chose.
 *
 * @param {unknown} err
 * @param {number} max - bound; short where the text feeds a cardinality key
 * @returns {string}
 */
export function errorMessage (err, max) {
  const message = err instanceof Error ? err.message : String(err)
  return message.slice(0, max)
}
