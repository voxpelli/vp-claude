// Runs the `.ast-grep/rules/` structural lint suite over the trees named in
// `lib/ast-grep-scope.mjs`, and first verifies that `package.json`'s
// `fix:ast-grep` covers exactly the same ones.
//
// The scope used to be written out twice with nothing coupling the copies. A
// directory added to one and not the other gives a `check` reporting findings
// `fix` cannot repair, or a `fix` rewriting files `check` never inspected —
// so the mismatch is an error here, before the scan runs.
//
// Test/check scripts (`scripts/check-*.mjs`) are excluded: their unguarded sync
// fs calls are intentional fail-fast and they plant syntactic violations as
// fixtures. In CI, ast-grep's native `--format github` emits `::error`/
// `::warning` workflow-command annotations directly, matching the CI
// visibility validate-plugin.mjs already gives its own warn()/error() calls
// (see .claude/rules/scripts-and-validation.md) — no reimplementation of
// GitHub's escaping rules needed. Locally, the default rich diagnostic view
// (source preview, no raw workflow-command syntax) is kept.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { AST_GREP_EXCLUDE_GLOB, AST_GREP_TARGETS, buildFixCommand } from '../lib/ast-grep-scope.mjs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const actualFix = pkg.scripts?.['fix:ast-grep']
const expectedFix = buildFixCommand()

if (actualFix !== expectedFix) {
  process.stderr.write(
    'SCOPE DRIFT: package.json\'s `fix:ast-grep` does not match lib/ast-grep-scope.mjs.\n' +
    `  package.json: ${String(actualFix)}\n` +
    `  expected:     ${expectedFix}\n` +
    'Change lib/ast-grep-scope.mjs, then copy the expected command into package.json.\n'
  )
  process.exit(1)
}

const inCi = Boolean(process.env.GITHUB_ACTIONS)
const formatArgs = inCi ? ['--format', 'github'] : []

const result = spawnSync('ast-grep', [
  'scan',
  ...formatArgs,
  '--globs', AST_GREP_EXCLUDE_GLOB,
  ...AST_GREP_TARGETS,
], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
