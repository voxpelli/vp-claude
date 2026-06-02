// CLI for knowledge-gaps Step 7c: read the user-global install manifests and emit
// one NDJSON record per installed plugin / skill-bundle. Pure resolution lives in
// lib/installed-plugins.mjs; this does file I/O only. Reads NO stdin.
//
// Invoked by the skill as: node ${CLAUDE_PLUGIN_ROOT}/scripts/list-installed-plugins.mjs
// Root overridable for testing via argv[2] or $VPK_HOME (default $HOME): it reads
// <root>/.claude/plugins/* and <root>/.agents/.skill-lock.json. A missing manifest is
// skipped silently (a record-less population is normal on a fresh machine / CI host);
// the skill treats empty/partial output as "couldn't check that population".

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveInstalledPlugins, resolveInstalledSkills } from '../lib/installed-plugins.mjs'

const root = process.argv[2] || process.env.VPK_HOME || homedir()

/** @param {string} p @returns {string|null} */
function readOrNull (p) {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/** @type {import('../lib/installed-plugins.mjs').InstalledRecord[]} */
const records = []

const installedPlugins = readOrNull(join(root, '.claude/plugins/installed_plugins.json'))
const knownMarketplaces = readOrNull(join(root, '.claude/plugins/known_marketplaces.json'))
if (installedPlugins && knownMarketplaces) {
  // Pre-read each referenced marketplace's marketplace.json so the resolver stays pure.
  /** @type {Map<string, string>} */
  const mpContents = new Map()
  try {
    const known = JSON.parse(knownMarketplaces)
    for (const [name, info] of Object.entries(known)) {
      const loc = /** @type {any} */ (info)?.installLocation
      if (typeof loc !== 'string') continue
      const c = readOrNull(join(loc, '.claude-plugin/marketplace.json'))
      if (c) mpContents.set(name, c)
    }
    records.push(...resolveInstalledPlugins(installedPlugins, knownMarketplaces, mpContents))
  } catch (err) {
    process.stderr.write(`list-installed-plugins: could not parse plugin manifests: ${/** @type {Error} */ (err).message}\n`)
  }
}

const skillLock = readOrNull(join(root, '.agents/.skill-lock.json'))
if (skillLock) {
  try {
    records.push(...resolveInstalledSkills(skillLock))
  } catch (err) {
    process.stderr.write(`list-installed-plugins: could not parse skill lockfile: ${/** @type {Error} */ (err).message}\n`)
  }
}

for (const r of records) process.stdout.write(JSON.stringify(r) + '\n')
