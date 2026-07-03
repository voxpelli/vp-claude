// Live check + regression test for the plugin-load-paths extractor
// (lib/plugin-load-paths.mjs). Mirrors check-release-counts.mjs: (1) live-globs
// every skills/**/*.md file, extracts `${CLAUDE_PLUGIN_ROOT}/...` paths, and
// asserts each non-template path resolves on disk relative to the repo root;
// (2) fixture-tests the pure extractor so the guard is proven to catch a
// dangling path and to correctly skip a template `<placeholder>` path. Wired
// into `npm run check` via run-p check:*.

import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCheckHarness } from '../lib/check-harness.mjs'
import { extractPluginLoadPaths, PLUGIN_ROOT_TOKEN } from '../lib/plugin-load-paths.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { check, done } = createCheckHarness()

// --- live check ---

console.log(`\nplugin-load-paths: skills/**/*.md ${PLUGIN_ROOT_TOKEN} paths resolve on disk`)

const skillEntries = await readdir(join(ROOT, 'skills'), { recursive: true })
const skillMdFiles = skillEntries
  .filter((f) => f.endsWith('.md'))
  .map((f) => join(ROOT, 'skills', f))

/** @type {{ file: string, path: import('../lib/plugin-load-paths.mjs').PluginLoadPath }[]} */
const dangling = []
let checkedCount = 0
let templateCount = 0

for (const file of skillMdFiles) {
  const content = await readFile(file, 'utf8')
  for (const p of extractPluginLoadPaths(content)) {
    if (p.isTemplate) {
      templateCount++
      continue
    }
    checkedCount++
    if (!existsSync(join(ROOT, p.relativePath))) {
      dangling.push({ file, path: p })
    }
  }
}

console.log(`  scanned ${skillMdFiles.length} files: ${checkedCount} literal paths checked, ${templateCount} template placeholders skipped`)
for (const { file, path } of dangling) {
  console.log(`    ${file.replace(`${ROOT}/`, '')}: dangling path ${path.raw}`)
}
check(`every referenced ${PLUGIN_ROOT_TOKEN} path resolves on disk`, dangling.length === 0)
check('at least one path was actually checked (guard against a vacuous pass)', checkedCount > 0)

// --- fixture self-test ---

console.log('\nplugin-load-paths: fixture self-test')

const REAL_PATH = 'skills/plugin-load-paths-check-fixture.md'
check('sanity: fixture-referenced real file does not itself exist on disk (would be a false pass)', !existsSync(join(ROOT, REAL_PATH)))

const realFileFixture = `See \`${PLUGIN_ROOT_TOKEN}/lib/mdast.mjs\` for the AST helper.`
const realExtracted = extractPluginLoadPaths(realFileFixture)
const [realPath] = realExtracted
check('extracts a real path', realExtracted.length === 1 && realPath?.relativePath === 'lib/mdast.mjs')
check('a real, existing path resolves on disk', realPath != null && existsSync(join(ROOT, realPath.relativePath)))

const danglingFixture = `See \`${PLUGIN_ROOT_TOKEN}/skills/does-not-exist/references/ghost.md\` for details.`
const danglingExtracted = extractPluginLoadPaths(danglingFixture)
const [danglingPath] = danglingExtracted
check('extracts a dangling path', danglingExtracted.length === 1 && danglingPath?.relativePath === 'skills/does-not-exist/references/ghost.md')
check('a dangling path does NOT resolve on disk (guard actually catches drift)', danglingPath != null && !existsSync(join(ROOT, danglingPath.relativePath)))

const templateFixture = `See \`${PLUGIN_ROOT_TOKEN}/skills/tool-intel/references/ecosystem-<ecosystem>.md\` for the full template.`
const templateExtracted = extractPluginLoadPaths(templateFixture)
const [templatePath] = templateExtracted
check('extracts a template path and flags it isTemplate', templateExtracted.length === 1 && templatePath?.isTemplate === true)

const fencedFixture = '```\nBash: node ' + PLUGIN_ROOT_TOKEN + '/scripts/list-installed-plugins.mjs\n```\n'
check('a path inside a fenced code block is NOT extracted (mdast skips code nodes)', extractPluginLoadPaths(fencedFixture).length === 0)

const noMentionFixture = 'This file has no plugin-root paths at all.'
check(`content with no ${PLUGIN_ROOT_TOKEN} mention extracts nothing`, extractPluginLoadPaths(noMentionFixture).length === 0)

const sentenceFixture = `Read \`${PLUGIN_ROOT_TOKEN}/lib/mdast.mjs\`. It handles fences.`
const sentenceExtracted = extractPluginLoadPaths(sentenceFixture)
const [sentencePath] = sentenceExtracted
check('backtick-delimited path is unaffected by trailing prose', sentenceExtracted.length === 1 && sentencePath?.relativePath === 'lib/mdast.mjs')

// Unlike the backtick-delimited fixture above, a BARE (non-backticked) mention
// puts the path and the trailing sentence punctuation in the *same* mdast
// `text` segment — this is the case that actually exercises
// TRAILING_PUNCTUATION_RE in lib/plugin-load-paths.mjs. The backtick-delimited
// fixture would still pass even if that regex were deleted entirely, because
// collectScannableText already splits inline-code spans from the prose that
// follows the closing backtick.
const bareMentionFixture = `See ${PLUGIN_ROOT_TOKEN}/lib/mdast.mjs. It handles fences.`
const bareMentionExtracted = extractPluginLoadPaths(bareMentionFixture)
const [bareMentionPath] = bareMentionExtracted
check('bare (non-backticked) mention strips a trailing sentence period', bareMentionExtracted.length === 1 && bareMentionPath?.relativePath === 'lib/mdast.mjs')

const multiFixture = `\`${PLUGIN_ROOT_TOKEN}/lib/mdast.mjs\` and \`${PLUGIN_ROOT_TOKEN}/lib/release-counts.mjs\` are both pure.`
check('extracts multiple distinct paths from one document', extractPluginLoadPaths(multiFixture).length === 2)

// Sanity: verify this fixture file confirms the live glob loop itself proved
// something (i.e. the real repo has at least one skills/**/*.md file
// referencing ${CLAUDE_PLUGIN_ROOT} — otherwise the live section above would
// pass vacuously with checkedCount === 0, already asserted, but double-check
// the fixture reasoning holds against the actual corpus).
const liveContent = readFileSync(join(ROOT, 'skills/package-intel/SKILL.md'), 'utf8')
check('a known real skill file extracts at least one path (corpus sanity)', extractPluginLoadPaths(liveContent).length > 0)

done()
