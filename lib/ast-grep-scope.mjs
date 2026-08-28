/**
 * The single definition of which trees the bespoke `.ast-grep/rules/` lint
 * covers.
 *
 * It exists because the scope was stated twice — once in
 * `scripts/check-ast-grep.mjs`'s argument array and once in `package.json`'s
 * `fix:ast-grep` script — with nothing coupling them. A directory added to one
 * and not the other gives a `check` that reports findings `fix` cannot repair,
 * or worse, a `fix` that rewrites files `check` never inspected. Same
 * drift-guard shape as `lib/cohort-table-contract.mjs`.
 */

/**
 * Excluded from the scan: the `scripts/check-*.mjs` self-tests deliberately
 * make unguarded sync fs calls (fail-fast is their job) and plant syntactic
 * violations as fixtures.
 */
export const AST_GREP_EXCLUDE_GLOB = '!scripts/check-*.mjs'

/** Trees scanned, in the order both commands pass them. */
export const AST_GREP_TARGETS = /** @type {const} */ ([
  'lib/',
  'scripts/',
  'extensions/',
  '.claude/workflows/stale-npm-triage/',
])

/**
 * The exact `fix:ast-grep` command implied by the scope above. Compared against
 * `package.json` by `scripts/check-ast-grep.mjs` so the two cannot drift.
 *
 * @returns {string}
 */
export function buildFixCommand () {
  return `ast-grep scan --update-all --globs '${AST_GREP_EXCLUDE_GLOB}' ${AST_GREP_TARGETS.join(' ')}`
}
