// Enumerate relations in the Basic Memory graph and emit one NDJSON record per
// edge. By default only UNRESOLVED edges (dangling wiki-links); with `--all`,
// every edge, each tagged `resolved`.
//
// Invoked as:
//   node ${CLAUDE_PLUGIN_ROOT}/scripts/list-unresolved-links.mjs [--project <name>] [--all]
//
// Why enumeration rather than one search per suspected target: `search-notes
// --entity-type relation` returns every relation row, and an unresolved one
// simply OMITS `to_entity` (verified 2026-07-29 — the key is absent, not null).
// That makes "which links dangle" a filter over a full listing rather than a
// judgement call, at ~16 paged calls for the whole graph.
//
// `--all` exists for the prose-verb spurious detector, which must see resolved
// edges too: a relation verb that is actually a fragment of prose can land on a
// real note and then looks perfectly healthy in the relation index. Those edges
// need deleting, not repairing, so they are a separate report — which is why
// this is an explicit mode rather than a widened default. A consumer that asked
// for dangling links must never silently receive the whole graph.
//
// This pass CANNOT tell you whether a link was written inside `## Relations`.
// The relation row carries no section provenance, so `sectionProvenance` is
// deliberately NOT emitted here — scripts/read-link-context.mjs adds it, and
// classifyEdge throws without it. See that script for why the split matters.
//
// I/O only: argv construction, envelope validation, paging, row shaping and the
// completeness verdict live in lib/bm-search.mjs; slug extraction lives in
// lib/link-resolution.mjs. Both are fixture-tested under scripts/check-*.mjs.

import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { extractTargetSlug } from '../lib/link-resolution.mjs'
import {
  assessCompleteness,
  createDuplicateFilter,
  createPageFetcher,
  enumeratePages,
  toRelationRow,
} from '../lib/bm-search.mjs'

const execFileAsync = promisify(execFile)

/**
 * @typedef CliOptions
 * @property {string} project Basic Memory project name.
 * @property {boolean} all Whether to emit resolved edges as well.
 */

/**
 * Parse the argv tail.
 *
 * @param {string[]} argv Arguments after the script path.
 * @returns {CliOptions} Parsed options.
 */
export function parseArgs (argv) {
  let project = 'main'
  let all = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--all') {
      all = true
    } else if (arg === '--project') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        throw new Error('list-unresolved-links: --project needs a project name, e.g. `--project main`')
      }
      project = value
      i++
    } else if (arg !== undefined) {
      throw new Error(`list-unresolved-links: unrecognised argument "${arg}" (expected --project <name> or --all)`)
    }
  }
  return { project, all }
}

/**
 * Enumerate the project's relations, writing NDJSON to stdout.
 *
 * @param {CliOptions} options Parsed CLI options.
 * @returns {Promise<number>} Process exit code.
 */
async function run ({ all, project }) {
  let emitted = 0
  let unparseable = 0
  const duplicates = createDuplicateFilter(/** @type {(e: {relationId: number}) => number} */ (edge) => edge.relationId)

  const stats = await enumeratePages({
    fetchPage: createPageFetcher(execFileAsync, { project, entityType: 'relation' }),
    onRow (row) {
      const edge = toRelationRow(row)
      if (!edge) {
        unparseable++
        process.stderr.write('list-unresolved-links: a relation row was missing a required field and was dropped\n')
        return
      }

      if (duplicates.isDuplicate(edge)) return

      const resolved = edge.toEntity !== null
      if (resolved && !all) return

      const targetSlug = extractTargetSlug(edge)
      if (targetSlug === null) {
        unparseable++
        process.stderr.write(
          'list-unresolved-links: could not recover a target from relation permalink ' +
          `(relation_id=${edge.relationId}): ${edge.permalink}\n`
        )
        return
      }

      process.stdout.write(JSON.stringify({
        _record: 'edge',
        fromEntity: edge.fromEntity,
        relationType: edge.relationType,
        targetSlug,
        relationId: edge.relationId,
        resolved,
      }) + '\n')
      emitted++
    },
  })

  const verdict = assessCompleteness({ ...stats, unparseable })

  // `_record` on BOTH arms — see the equivalent note in list-notes.mjs. `mode`
  // is what tells a consumer which population it received; without it, `--all`
  // output is indistinguishable from a graph where every link dangles.
  process.stdout.write(JSON.stringify({
    _record: 'summary',
    mode: all ? 'all' : 'unresolved',
    complete: verdict.complete,
    empty: verdict.empty,
    emitted,
    scanned: stats.scanned,
    total: stats.total,
    pages: stats.pages,
    duplicatesDropped: duplicates.dropped(),
    unparseable,
    problems: verdict.problems,
  }) + '\n')

  for (const problem of verdict.problems) {
    process.stderr.write(`list-unresolved-links: ${problem}\n`)
  }
  if (verdict.empty) {
    process.stderr.write(
      'list-unresolved-links: the project reported zero relations. That is an EMPTY graph, not a clean one — ' +
      'the project exists (--project verified it), it simply has no relations.\n'
    )
  }
  process.stderr.write(
    `list-unresolved-links: emitted ${emitted} ${all ? 'edges (all)' : 'unresolved edges'} ` +
    `of ${stats.scanned} relations scanned across ${stats.pages} page(s); server reported ${stats.total}; ` +
    `dropped ${duplicates.dropped()} duplicate row(s)\n`
  )

  return verdict.complete ? 0 : 1
}

// Guard the entrypoint: this module talks to the graph on load otherwise, and
// an accidental import would fire a full enumeration as a side effect.
const invokedPath = process.argv[1]
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await run(parseArgs(process.argv.slice(2)))
}
