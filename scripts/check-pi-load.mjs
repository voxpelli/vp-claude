// Offline load-smoke for the Pi harness. Validates the shared skills/ tree
// against Pi's OWN loader (`loadSkillsFromDir`) and confirms the extension
// factory imports without throwing — no running agent, no model, no global
// ~/.pi state. This is the CI-portable core of the manual `pi install`
// verification: it needs only the pi package (a devDependency), so it runs
// anywhere `npm run check` runs.
//
// A LIVE check (like check-plugin-load-paths): it exercises the real tree, not
// synthetic fixtures — the parsing logic under test is Pi's, already tested
// upstream; what we assert is that OUR tree satisfies it.

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadSkillsFromDir } from '@earendil-works/pi-coding-agent'

import { createCheckHarness } from '../lib/check-harness.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { check, done } = createCheckHarness()

// ── 1. Skills load via Pi's own parser ──────────────────────────────────────

const skillsDir = join(ROOT, 'skills')
const { diagnostics, skills } = loadSkillsFromDir({ dir: skillsDir, source: 'vp-knowledge' })

// On-disk SKILL.md count — Pi must discover exactly this many. A skill that
// fails to parse is silently dropped by the loader, so a mismatch means a
// broken skill (self-consistent invariant, not a hardcoded count — survives
// the Wave 3 16→14 merge).
let onDisk = 0
try {
  onDisk = readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(skillsDir, e.name, 'SKILL.md')))
    .length
} catch (err) {
  console.log(`    could not read skills/: ${err instanceof Error ? err.message : String(err)}`)
}

check(`Pi discovers every on-disk skill (${skills.length}/${onDisk})`, skills.length === onDisk && onDisk > 0)
check('every skill parses a non-empty name', skills.every((s) => typeof s.name === 'string' && s.name.length > 0))
check('every skill parses a non-empty description', skills.every((s) => typeof s.description === 'string' && s.description.trim().length > 0))

// Pi's loader emits diagnostics (types: "warning" | "error" | "collision").
// Fail on error AND collision — a collision means two skills resolved to the
// same name and one is silently NOT loaded, which is exactly the kind of
// coverage gap this smoke test exists to catch. Only genuine `warning`s (e.g.
// an over-length description, a known Wave 2 fix) stay warn-only, matching the
// skills.sh portability posture.
const FAILING_DIAG_TYPES = new Set(['error', 'collision'])
const diags = diagnostics ?? []
// One-pass partition (ES2024 Map.groupBy): error|collision fail, the rest warn.
const byBucket = Map.groupBy(diags, (d) => (FAILING_DIAG_TYPES.has(d.type) ? 'fail' : 'warn'))
const errorDiags = byBucket.get('fail') ?? []
const warnDiags = byBucket.get('warn') ?? []
check(`no error/collision skill diagnostics (${errorDiags.length})`, errorDiags.length === 0)
for (const d of errorDiags) console.log(`    FAIL   ${d.path}: ${d.message} [${d.type}]`)
for (const d of warnDiags) console.log(`    warn   ${d.path}: ${d.message}`)

// ── 2. Extension factory imports cleanly ─────────────────────────────────────

let factoryOk = false
try {
  const mod = await import(new URL('../extensions/index.js', import.meta.url).href)
  factoryOk = typeof mod.default === 'function'
} catch (err) {
  console.log(`    extension import threw: ${err instanceof Error ? err.message : String(err)}`)
}
check('extensions/index.js exports a default factory function', factoryOk)

done()
