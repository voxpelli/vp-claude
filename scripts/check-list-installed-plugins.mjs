// Fixture self-test for lib/installed-plugins.mjs — proves the owner/repo resolution
// branches (the drift-prone business logic Step 7c delegates to the script). Inline
// JSON strings (no fixture dirs), like check-fourthwall. Wired into `npm run check`.

import {
  resolveInstalledPlugins,
  resolveInstalledSkills,
} from '../lib/installed-plugins.mjs'

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

console.log('\ninstalled-plugins: source-shape resolution')

// One installed plugin per source shape + the version:"unknown" majority case.
const INSTALLED = JSON.stringify({
  version: 2,
  plugins: {
    'vp-knowledge@vp-plugins': [{ version: '0.31.2', installedAt: '2026-03-09T00:00:00Z' }],
    'vp-beads@vp-plugins': [{ version: '0.15.0', installedAt: '2026-03-10T00:00:00Z' }],
    'impeccable@impeccable': [{ version: 'unknown', installedAt: '2026-04-01T00:00:00Z' }],
    'agent-sdk-dev@claude-plugins-official': [{ version: 'unknown', installedAt: '2026-02-01T00:00:00Z' }],
    'api-security@claude-plugins-official': [{ version: 'unknown', installedAt: '2026-05-01T00:00:00Z' }],
    'widgets@claude-plugins-official': [{ version: 'unknown', installedAt: '2026-05-15T00:00:00Z' }],
    'widgets@homonym-mkt': [{ version: 'unknown', installedAt: '2026-05-20T00:00:00Z' }], // dedicated-repo acme/widgets homonym of the git-subdir namesake
    'barewidget@slashless-mkt': [{ version: 'unknown', installedAt: '2026-05-21T00:00:00Z' }], // local-string, slash-less marketplace repo
    'acme@casemkt': [{ version: 'unknown', installedAt: '2026-05-22T00:00:00Z' }], // local-string, repo Acme/Acme vs name acme (case mismatch)
    'ghost@vanished-marketplace': [{ version: 'unknown', installedAt: '2026-01-01T00:00:00Z' }],
  },
})
const KNOWN = JSON.stringify({
  'vp-plugins': { source: { source: 'github', repo: 'voxpelli/vp-claude' }, installLocation: '/x/vp-plugins' },
  impeccable: { source: { source: 'github', repo: 'pbakaus/impeccable' }, installLocation: '/x/impeccable' },
  'claude-plugins-official': { source: { source: 'github', repo: 'anthropics/claude-plugins-official' }, installLocation: '/x/official' },
  'homonym-mkt': { source: { source: 'github', repo: 'acme/widgets' }, installLocation: '/x/homonym' },
  'slashless-mkt': { source: { source: 'github', repo: 'noslash' }, installLocation: '/x/slashless' }, // slash-less repo (malformed) -> local-string shape guard rejects
  casemkt: { source: { source: 'github', repo: 'Acme/Acme' }, installLocation: '/x/case' },
  // 'vanished-marketplace' deliberately absent -> ghost plugin is unresolved.
})
const MP = new Map([
  ['vp-plugins', JSON.stringify({
    plugins: [
      { name: 'vp-knowledge', source: './' }, // local string -> marketplace repo + #name
      { name: 'vp-beads', source: { source: 'github', repo: 'voxpelli/claude-beads' } }, // dedicated repo
    ],
  })],
  ['impeccable', JSON.stringify({ plugins: [{ name: 'impeccable', source: './plugin' }] })], // local subpath string
  ['claude-plugins-official', JSON.stringify({
    plugins: [
      { name: 'agent-sdk-dev', source: './plugins/agent-sdk-dev' }, // local nested subpath
      { name: 'api-security', source: { source: 'git-subdir', url: 'https://github.com/42Crunch-AI/claude-plugins.git', path: 'plugins/api-security' } },
      { name: 'widgets', source: { source: 'git-subdir', url: 'https://github.com/acme/widgets.git', path: 'plugins/widgets' } }, // git-subdir namesake (repo last segment == name) — must RETAIN #name
    ],
  })],
  // Dedicated-repo plugin at the SAME acme/widgets as the git-subdir namesake above:
  // proves the two stay DISTINCT (plugin:acme/widgets#widgets vs plugin:acme/widgets),
  // i.e. the git-subdir revert prevents the multi-plugin-repo conflation bug.
  ['homonym-mkt', JSON.stringify({ plugins: [{ name: 'widgets', source: { source: 'github', repo: 'acme/widgets' } }] })],
  ['slashless-mkt', JSON.stringify({ plugins: [{ name: 'barewidget', source: './' }] })], // local string + slash-less KNOWN repo -> shape guard
  ['casemkt', JSON.stringify({ plugins: [{ name: 'acme', source: './' }] })], // local string, repo Acme/Acme vs name acme
])

const plugins = resolveInstalledPlugins(INSTALLED, KNOWN, MP)
const find = (key) => plugins.find((p) => p.identifier === key || p.title === key)

check('local "./" source -> marketplace repo + #name (non-namesake keeps suffix)', !!find('plugin:voxpelli/vp-claude#vp-knowledge'))
check('local "./" title normalizes : / # -> -', !!find('plugin-voxpelli-vp-claude-vp-knowledge'))
check('github source -> dedicated repo, no #name', plugins.some((p) => p.identifier === 'plugin:voxpelli/claude-beads' && p.sourceResolved))
check('local "./plugin" (string, not "./") resolves (the impeccable bug case)', !!find('plugin:pbakaus/impeccable'))
check('local-string namesake (repo==name) -> #name collapsed (impeccable)', plugins.some((p) => p.identifier === 'plugin:pbakaus/impeccable') && !plugins.some((p) => p.identifier === 'plugin:pbakaus/impeccable#impeccable'))
check('namesake collapse title == dedicated-repo form', !!find('plugin-pbakaus-impeccable') && !find('plugin-pbakaus-impeccable-impeccable'))
check('local "./plugins/x" nested subpath resolves', !!find('plugin:anthropics/claude-plugins-official#agent-sdk-dev'))
check('git-subdir source -> owner/repo from url + #name (non-namesake keeps suffix)', !!find('plugin:42Crunch-AI/claude-plugins#api-security'))
check('git-subdir namesake (repo==name) -> #name RETAINED, never collapsed (widgets)', !!find('plugin:acme/widgets#widgets'))
check('git-subdir namesake vs dedicated-repo homonym -> two DISTINCT records (no conflation)', plugins.some((p) => p.identifier === 'plugin:acme/widgets#widgets') && plugins.some((p) => p.identifier === 'plugin:acme/widgets'))
check('local-string slash-less repo -> falls through to sourceResolved:false (shape guard)', plugins.some((p) => p.identifier === 'plugin:barewidget@slashless-mkt' && p.sourceResolved === false))
check('local-string case-mismatch (Acme/Acme vs acme) -> #name kept, no collapse', !!find('plugin:Acme/Acme#acme'))
check('unresolved (marketplace absent) -> name@marketplace fallback, sourceResolved:false', plugins.some((p) => p.identifier === 'plugin:ghost@vanished-marketplace' && p.sourceResolved === false))
check('version:"unknown" entries still resolve (majority live case)', !!find('plugin:pbakaus/impeccable'))
check('installedAt carried through', find('plugin:voxpelli/vp-claude#vp-knowledge')?.installedAt === '2026-03-09T00:00:00Z')
check('plugins carry empty members[]', plugins.every((p) => Array.isArray(p.members) && p.members.length === 0))

console.log('\ninstalled-plugins: skill grouping by source')

const LOCK = JSON.stringify({
  version: 3,
  skills: {
    'memory-research': { source: 'basicmachines-co/basic-memory-skills', installedAt: '2026-02-20T00:00:00Z' },
    'memory-notes': { source: 'basicmachines-co/basic-memory-skills', installedAt: '2026-03-01T00:00:00Z' },
    'find-skills': { source: 'vercel-labs/skills', installedAt: '2026-02-20T00:00:00Z' },
    'hand-copied': { installedAt: '2026-01-01T00:00:00Z' }, // no source -> name-only
  },
})
const skills = resolveInstalledSkills(LOCK)
const bm = skills.find((s) => s.identifier === 'skill:basicmachines-co/basic-memory-skills')

check('many dirs sharing a source collapse to ONE record', skills.filter((s) => s.identifier === 'skill:basicmachines-co/basic-memory-skills').length === 1)
check('grouped record lists all member dirs', !!bm && bm.members.includes('memory-research') && bm.members.includes('memory-notes'))
check('grouped installedAt is the most recent member', bm?.installedAt === '2026-03-01T00:00:00Z')
check('single-skill source resolves', skills.some((s) => s.identifier === 'skill:vercel-labs/skills'))
check('skill title normalizes -> skill-<owner>-<repo>', skills.some((s) => s.title === 'skill-basicmachines-co-basic-memory-skills'))
check('source-less dir -> name-only, sourceResolved:false', skills.some((s) => s.identifier === 'skill:hand-copied' && s.sourceResolved === false))

console.log(`\n${passed}/${passed + failed} passed`)
if (failed > 0) process.exit(1)
