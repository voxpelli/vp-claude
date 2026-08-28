// Enumerate every note in a Basic Memory project as NDJSON on stdout.
//
// Invoked as: node ${CLAUDE_PLUGIN_ROOT}/scripts/list-notes.mjs [--project <name>]
//
// This is the corpus side of the link-integrity pipeline. `buildTitleIndex` in
// lib/link-resolution.mjs needs every note's title AND permalink to match a
// dangling link against, and nothing else in the repo produces that list — the
// measurements the pipeline's design was chosen on were gathered by hand in a
// scratchpad, which is exactly the kind of unreproducible step this script
// exists to remove.
//
// I/O only. Argv construction, envelope validation, the paging loop, row
// shaping and the completeness verdict all live in lib/bm-search.mjs and are
// fixture-tested by scripts/check-bm-search.mjs.
//
// Note the row count is NOT the note count: the search index returns duplicate
// rows for the same entity (2,304 rows for 1,926 distinct notes, measured
// 2026-07-29 — a known upstream sync defect). Deduplication happens in the
// consumer, on `entityId`, so that the drop is reported rather than hidden.

import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import {
  assessCompleteness,
  createDuplicateFilter,
  createPageFetcher,
  enumeratePages,
  toNoteRow,
} from '../lib/bm-search.mjs'

const execFileAsync = promisify(execFile)

/**
 * Read `--project <name>` out of an argv tail.
 *
 * @param {string[]} argv Arguments after the script path.
 * @returns {string} Project name; `main` when unspecified.
 */
export function parseProject (argv) {
  const flag = argv.indexOf('--project')
  if (flag === -1) return 'main'
  const value = argv[flag + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error('list-notes: --project needs a project name, e.g. `--project main`')
  }
  return value
}

/**
 * Enumerate the project's notes, writing NDJSON to stdout.
 *
 * @param {string} project Basic Memory project name.
 * @returns {Promise<number>} Process exit code.
 */
async function run (project) {
  let emitted = 0
  let unparseable = 0
  const duplicates = createDuplicateFilter(/** @type {(n: {entityId: number}) => number} */ (note) => note.entityId)

  const stats = await enumeratePages({
    fetchPage: createPageFetcher(execFileAsync, { project, entityType: 'entity' }),
    onRow (row) {
      const note = toNoteRow(row)
      if (!note) {
        unparseable++
        return
      }
      if (duplicates.isDuplicate(note)) return
      process.stdout.write(JSON.stringify({ _record: 'note', ...note }) + '\n')
      emitted++
    },
  })

  const verdict = assessCompleteness({ ...stats, unparseable })

  // The sentinel carries `_record` on BOTH arms. A discriminant present on only
  // one of them is a type error the consumer eventually "fixes" with `any`, and
  // then nothing distinguishes a complete run from a truncated one — truncation
  // leaves syntactically perfect NDJSON that is simply missing rows.
  process.stdout.write(JSON.stringify({
    _record: 'summary',
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
    process.stderr.write(`list-notes: ${problem}\n`)
  }
  if (verdict.empty) {
    process.stderr.write(
      'list-notes: the project reported zero notes. That is an EMPTY graph, not a clean one — ' +
      'the project exists (--project verified it), it simply has no notes.\n'
    )
  }
  process.stderr.write(
    `list-notes: emitted ${emitted} of ${stats.scanned} rows scanned across ${stats.pages} page(s); ` +
    `server reported ${stats.total}; dropped ${duplicates.dropped()} duplicate row(s)\n`
  )

  return verdict.complete ? 0 : 1
}

// Guard the entrypoint: this module talks to the graph on load otherwise, and
// an accidental import would fire a full enumeration as a side effect.
const invokedPath = process.argv[1]
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await run(parseProject(process.argv.slice(2)))
}
