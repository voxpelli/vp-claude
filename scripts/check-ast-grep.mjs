// Runs the `.ast-grep/rules/` structural lint suite over `lib/` and
// `scripts/`. In CI, ast-grep's native `--format github` emits `::error`/
// `::warning` workflow-command annotations directly, matching the CI
// visibility validate-plugin.mjs already gives its own warn()/error() calls
// (see .claude/rules/scripts-and-validation.md) — no reimplementation of
// GitHub's escaping rules needed. Locally, the default rich diagnostic view
// (source preview, no raw workflow-command syntax) is kept.

import { spawnSync } from 'node:child_process'

const inCi = Boolean(process.env.GITHUB_ACTIONS)
const formatArgs = inCi ? ['--format', 'github'] : []

const result = spawnSync('ast-grep', ['scan', ...formatArgs, 'lib/', 'scripts/'], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
