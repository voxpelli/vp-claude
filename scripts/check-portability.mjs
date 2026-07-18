// Live check + regression test for the portability classifier
// (lib/portability-scan.mjs). Mirrors check-plugin-load-paths.mjs, but for an
// ORTHOGONAL property: not "does this ${CLAUDE_PLUGIN_ROOT} path resolve on
// disk" (that check already exists) but "would this reference survive a
// standalone skills.sh single-skill install". Two parts:
//   (1) live-glob skills/**/*.md, classify every ${CLAUDE_PLUGIN_ROOT} ref, and
//       REPORT the cross-skill + tooling refs — warn-only, never failing CI,
//       because those refs are intentional/accepted (a cross-skill ref can only
//       be removed by merging skills, a Wave-3 change; a tooling ref is an
//       accepted skills.sh-degradation). The value is visibility + a regression
//       signal: a NEW cross-skill ref shows up here.
//   (2) fixture-test the pure classifier (hard, via createCheckHarness) so the
//       three-way classification is proven correct.
// Wired into `npm run check` via run-p check:*.
//
// A stricter future variant could assert the cross-skill ref SET matches a
// documented accepted baseline (fail on any NEW cross-skill dependency) — the
// house "make drift fail CI" pattern. Deliberately NOT done yet: the accepted
// set only stabilizes after D5 scrubs same-skill refs, so baking a baseline in
// now would encode a to-be-changed number.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCheckHarness } from '../lib/check-harness.mjs'
import { PLUGIN_ROOT_TOKEN } from '../lib/plugin-load-paths.mjs'
import { classifyPluginRootPath, owningSkill, scanPortability } from '../lib/portability-scan.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { check, done } = createCheckHarness()

// --- live scan (warn-only) ---

console.log(`\nportability: skills/**/*.md ${PLUGIN_ROOT_TOKEN} refs classified for standalone skills.sh install`)

const skillEntries = await readdir(join(ROOT, 'skills'), { recursive: true })
const skillMdFiles = skillEntries
  .filter((f) => f.endsWith('.md'))
  .map((f) => join(ROOT, 'skills', f))

let sameSkill = 0
/** @type {{ file: string, ref: import('../lib/portability-scan.mjs').PortabilityRef }[]} */
const crossSkill = []
/** @type {{ file: string, ref: import('../lib/portability-scan.mjs').PortabilityRef }[]} */
const tooling = []

for (const file of skillMdFiles) {
  const content = await readFile(file, 'utf8')
  for (const ref of scanPortability(relative(ROOT, file), content)) {
    if (ref.kind === 'same-skill') sameSkill++
    else if (ref.kind === 'cross-skill') crossSkill.push({ file, ref })
    else tooling.push({ file, ref })
  }
}

console.log(`  scanned ${skillMdFiles.length} files: ${sameSkill} same-skill, ${crossSkill.length} cross-skill, ${tooling.length} tooling`)
if (sameSkill > 0) {
  console.log(`  ⚠ same-skill (${sameSkill}): fixable portability debt — these break under a standalone skills.sh`)
  console.log(`               install (${PLUGIN_ROOT_TOKEN} undefined); convertible to a bare references/... path. Deferred to Wave 3.`)
}
for (const { file, ref } of crossSkill) {
  console.log(`  ⚠ cross-skill  ${relative(ROOT, file)} → ${ref.raw} (skill "${ref.targetSkill}" absent from a standalone install of the referrer)`)
}
for (const { file, ref } of tooling) {
  console.log(`  ⚠ tooling      ${relative(ROOT, file)} → ${ref.raw} (plugin runtime, absent from any skills.sh install)`)
}
console.log('  (warn-only: cross-skill/tooling are accepted trade-offs; same-skill is deferred debt — not CI failures)')

// --- fixture self-test (hard) ---

console.log('\nportability: fixture self-test')

check('owningSkill: derives owner from a SKILL.md path', owningSkill('skills/tool-intel/SKILL.md') === 'tool-intel')
check('owningSkill: derives owner from a references/ path', owningSkill('skills/tool-intel/references/ecosystem-brew.md') === 'tool-intel')
check('owningSkill: tolerant of an absolute path', owningSkill('/repo/skills/package-intel/SKILL.md') === 'package-intel')
check('owningSkill: null for a non-skill file', owningSkill('lib/portability-scan.mjs') === null)

check('classify: same-skill when target matches owner', classifyPluginRootPath('tool-intel', 'skills/tool-intel/references/x.md') === 'same-skill')
check('classify: cross-skill when target differs', classifyPluginRootPath('tool-intel', 'skills/package-intel/references/x.md') === 'cross-skill')
check('classify: tooling for a lib/ path', classifyPluginRootPath('tool-intel', 'lib/mdast.mjs') === 'tooling')
check('classify: tooling for a scripts/ path', classifyPluginRootPath('knowledge-gaps', 'scripts/list-installed-plugins.mjs') === 'tooling')
check('classify: cross-skill when owner is null (no owner ⇒ every skill target is external)', classifyPluginRootPath(null, 'skills/tool-intel/references/x.md') === 'cross-skill')
check('classify: tolerant of a bare skills/<name> path with no trailing slash', classifyPluginRootPath('tool-intel', 'skills/tool-intel') === 'same-skill')

const mixedFixture = [
  `Self ref: \`${PLUGIN_ROOT_TOKEN}/skills/tool-intel/references/upgrade-haul.md\`.`,
  `Sibling ref: \`${PLUGIN_ROOT_TOKEN}/skills/package-intel/references/upgrade-haul.md\`.`,
  `Tool ref: \`${PLUGIN_ROOT_TOKEN}/scripts/list-installed-plugins.mjs\`.`,
].join('\n\n')
const scanned = scanPortability('skills/tool-intel/SKILL.md', mixedFixture)
check('scan: extracts all three refs', scanned.length === 3)
check('scan: classifies same/cross/tooling correctly', scanned.map((r) => r.kind).join(',') === 'same-skill,cross-skill,tooling')
check('scan: records the cross-skill target name', scanned.find((r) => r.kind === 'cross-skill')?.targetSkill === 'package-intel')

const noRefFixture = 'This skill has no plugin-root references at all.'
check('scan: a file with no refs yields nothing', scanPortability('skills/tool-intel/SKILL.md', noRefFixture).length === 0)

// Guard against a vacuous live pass: the real corpus must contain at least one
// classifiable ref, else the live loop above proved nothing.
check('corpus sanity: the live scan classified at least one real ref', sameSkill + crossSkill.length + tooling.length > 0)

done()
