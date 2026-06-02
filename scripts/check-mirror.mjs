// Live + fixture check for the mirror-block contract (lib/mirror-contract.mjs).
// Walks skills/ and agents/ for `<!-- mirror:start <id> -->` blocks and asserts
// every mirror group is byte-identical across its files. Mirrors the
// check-staleness-contract precedent: a drift guard proven to catch drift.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { extractMirrorBlocks, compareMirrorGroups } from '../lib/mirror-contract.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

/**
 * @param {string} name
 * @param {boolean} cond
 */
function check (name, cond) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}`)
  }
}

/**
 * @param {string} dir
 * @returns {string[]} absolute .md paths under dir (recursive)
 */
function walkMd (dir) {
  /** @type {string[]} */
  const out = []
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name)
    if (d.isDirectory()) out.push(...walkMd(p))
    else if (d.name.endsWith('.md')) out.push(p)
  }
  return out
}

console.log('\nmirror: live blocks (skills/ + agents/)')
/** @type {{ file: string, id: string, text: string }[]} */
const collected = []
for (const file of [...walkMd(join(ROOT, 'skills')), ...walkMd(join(ROOT, 'agents'))]) {
  for (const [id, text] of extractMirrorBlocks(readFileSync(file, 'utf8'))) {
    collected.push({ file: relative(ROOT, file), id, text })
  }
}
const liveErrors = compareMirrorGroups(collected)
for (const e of liveErrors) console.log(`    ${e}`)
const groupIds = new Set(collected.map((c) => c.id))
console.log(`  found ${collected.length} mirror block(s) across ${groupIds.size} group(s): ${[...groupIds].join(', ') || '(none)'}`)
check('all mirror groups are byte-identical across their files', liveErrors.length === 0)
check('at least one mirror group is defined', groupIds.size >= 1)

console.log('\nmirror: fixture self-test')
const BLOCK = '<!-- mirror:start g -->\nhello\nworld\n<!-- mirror:end g -->'
const SAME = '...preamble...\n<!-- mirror:start g -->\nhello\nworld\n<!-- mirror:end g -->\n...tail...'
const DIFF = '<!-- mirror:start g -->\nhello\nXORLD\n<!-- mirror:end g -->'
check('extracts the block text between markers', extractMirrorBlocks(BLOCK).get('g') === 'hello\nworld')
check('ignores surrounding preamble/tail', extractMirrorBlocks(SAME).get('g') === 'hello\nworld')
const t1 = extractMirrorBlocks(BLOCK).get('g') ?? ''
const t2 = extractMirrorBlocks(SAME).get('g') ?? ''
const t3 = extractMirrorBlocks(DIFF).get('g') ?? ''
check('identical members → no error', compareMirrorGroups([{ file: 'a', id: 'g', text: t1 }, { file: 'b', id: 'g', text: t2 }]).length === 0)
check('divergent members → error', compareMirrorGroups([{ file: 'a', id: 'g', text: t1 }, { file: 'c', id: 'g', text: t3 }]).some((e) => e.includes('diverged')))
check('lonely group (1 member) → error', compareMirrorGroups([{ file: 'a', id: 'g', text: t1 }]).some((e) => e.includes('only 1')))

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
