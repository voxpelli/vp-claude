#!/usr/bin/env node

// Build script: assembles the publishable pi-package from the repo root.
//
// The repo root is a Claude Code plugin; this script copies the shared
// resources (skills, agents, lib, schemas, selected scripts, LICENSE) into
// the pi-package directory so that all ${CLAUDE_PLUGIN_ROOT} paths in skills
// resolve correctly in the published npm tarball.
//
// Replaces the prepublishOnly shell one-liner with a cross-platform,
// testable Node.js script. Run via `npm run build` or automatically via
// `prepublishOnly`.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(pkgDir, '..')

// Directories copied in full from the repo root.
const fullDirs = ['skills', 'agents', 'lib', 'schemas']

// Scripts copied selectively — only the ones skills reference at runtime.
// CI-only check-*.mjs and audit-*.sh scripts are excluded.
const selectedScripts = [
  'list-installed-plugins.mjs',
  'fetch-brew-upstream.sh',
  'fetch-cask-upstream.sh',
  'fetch-crate-upstream.sh',
  'fetch-npm-upstream.sh',
  'fetch-plugin-upstream.sh',
  'fetch-vscode-upstream.sh',
]

// ── Clean ────────────────────────────────────────────────────────────────

for (const dir of [...fullDirs, 'scripts']) {
  rmSync(join(pkgDir, dir), { recursive: true, force: true })
}
rmSync(join(pkgDir, 'LICENSE'), { force: true })

// ── Copy full directories ────────────────────────────────────────────────

for (const dir of fullDirs) {
  cpSync(join(repoRoot, dir), join(pkgDir, dir), { recursive: true })
}

// ── Copy selected scripts ────────────────────────────────────────────────

mkdirSync(join(pkgDir, 'scripts'), { recursive: true })
for (const file of selectedScripts) {
  cpSync(join(repoRoot, 'scripts', file), join(pkgDir, 'scripts', file))
}

// ── Copy LICENSE ─────────────────────────────────────────────────────────

cpSync(join(repoRoot, 'LICENSE'), join(pkgDir, 'LICENSE'))

// ── Validate ─────────────────────────────────────────────────────────────

const required = [
  'extensions/index.js',
  'extensions/mcp-mapping.js',
  'lib/fourth-wall-rules.mjs',
  'lib/installed-plugins.mjs',
  'lib/bm-version-extract.mjs',
  'lib/version-distance.mjs',
  'scripts/list-installed-plugins.mjs',
  'schemas/npm_package.md',
  'skills/knowledge-prime/SKILL.md',
  'skills/schema-evolve/SKILL.md',
  'agents/knowledge-gardener.md',
  'LICENSE',
]
const missing = required.filter((f) => !existsSync(join(pkgDir, f)))
if (missing.length > 0) {
  console.error('Build validation failed — missing files:\n  ' + missing.join('\n  '))
  process.exit(1)
}

const skillCount = readdirSync(join(pkgDir, 'skills')).filter((d) =>
  existsSync(join(pkgDir, 'skills', d, 'SKILL.md'))
).length

console.log(`Build complete: ${skillCount} skills, ${fullDirs.length} dirs + scripts/ (selected) + LICENSE`)