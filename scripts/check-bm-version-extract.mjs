/**
 * Fixture self-test for the S2 version extractor (`lib/bm-version-extract.mjs`).
 *
 * Proves the 6-pattern, priority-ordered extraction actually holds — including
 * the adversarially-corrected regression cases from Sprint 33 (a strict-label
 * table-row guard, a semver-range example that must not be grabbed from prose,
 * and a channel-mismatch table row that must not shadow a fresher observation)
 * — so a future edit to the gardener/staleness-detection prose can be checked
 * against committed fixtures rather than trusted. Wired into `npm run check` as
 * `check:bm-version-extract`.
 */

import { extractBmVersion, PATTERN_SIGNATURES } from '../lib/bm-version-extract.mjs'
import { createCheckHarness } from '../lib/check-harness.mjs'

const { getCounts, record } = createCheckHarness()

/**
 * Richer form of `check-harness.mjs`'s `check(name, cond)`: a custom
 * structural equality over `{ version, pattern, isRange }`, silent on pass.
 * Built on the shared harness's `record()` so the pass/fail bookkeeping
 * stays centralized.
 *
 * `isRange` in `expected` is optional — most fixtures aren't about the
 * range-pin signal and omit it, in which case `actual.isRange` is not
 * checked. Fixtures that ARE about Pattern 3's `[version-range]` behavior
 * pass it explicitly.
 *
 * @param {string} name
 * @param {{ version: string | null, pattern: number | null, isRange: boolean }} actual
 * @param {{ version: string | null, pattern: number | null, isRange?: boolean }} expected
 */
function check (name, actual, expected) {
  const isRangeOk = !('isRange' in expected) || actual.isRange === expected.isRange
  const cond = actual.version === expected.version && actual.pattern === expected.pattern && isRangeOk
  if (!cond) {
    console.error(`  FAIL  ${name}  (got: ${JSON.stringify(actual)}, want: ${JSON.stringify(expected)})`)
  }
  record(cond)
}

// --- Pattern 1: inline header pipe ---
check('pattern 1: Homepage pipe with leading v',
  extractBmVersion('Homepage: [ripgrep](https://github.com/BurntSushi/ripgrep) | v1.39.0 | MIT', 'brew-ripgrep'),
  { version: '1.39.0', pattern: 1 })

check('pattern 1: Homepage pipe without leading v',
  extractBmVersion('Homepage: [foo](https://example.com) | 1.2.3 | MIT', 'brew-foo'),
  { version: '1.2.3', pattern: 1 })

check('pattern 1 outranks pattern 2 (table row present but header pipe wins)',
  extractBmVersion('Homepage: [foo](url) | v2.0.0 | MIT\n\n| Version | 1.0.0 |\n', 'brew-foo'),
  { version: '2.0.0', pattern: 1 })

check('pattern 1 anchor is specific: a bare "| vX |" line without "Homepage:" does not match pattern 1',
  extractBmVersion('Some other line | v1.2.3 | trailing\n\n## Observations\n\n- [version] 9.9.9\n', 'npm-foo'),
  { version: '9.9.9', pattern: 3 })

// --- Pattern 1 regression (Sprint 33 gate finding): the header-pipe label
//     alternation was hardcoded to "Homepage:" only, so every non-brew/cask
//     ecosystem's differently-labeled header pipe was silently unparseable —
//     verify each real label this repo's own note templates use ---
check('pattern 1 regression: vscode "Publisher:" header pipe now matches (was completely unparseable)',
  extractBmVersion('Publisher: [esbenp](https://open-vsx.org/user/esbenp) | v10.4.0 | MIT', 'vscode-esbenp.prettier-vscode'),
  { version: '10.4.0', pattern: 1 })

check('pattern 1 regression: npm/crate/go/composer/pypi/gem "GitHub:" header pipe matches',
  extractBmVersion('GitHub: [fastify/fastify](https://github.com/fastify/fastify) | v5.8.5 | MIT', 'npm-fastify'),
  { version: '5.8.5', pattern: 1 })

check('pattern 1 regression: action "Runs:" header pipe matches',
  extractBmVersion('Runs: node20 | v4.2.2 | MIT', 'action-actions-checkout'),
  { version: '4.2.2', pattern: 1 })

check('pattern 1 regression: gh "Source:" header pipe matches',
  extractBmVersion('Source: [github.com/meiji163/gh-notify](https://github.com/meiji163/gh-notify) | v1.6.0 | Shell (bash) | MIT', 'gh-meiji163-gh-notify'),
  { version: '1.6.0', pattern: 1 })

check('pattern 1 regression: plugin/skill "Homepage / repo:" header pipe matches',
  extractBmVersion('Homepage / repo: [github.com/foo/bar](https://github.com/foo/bar) | v2.1.0 | MIT | by foo', 'plugin-foo-bar'),
  { version: '2.1.0', pattern: 1 })

check('pattern 1 regression: an unlisted label ("License:") with the same pipe shape does NOT match — the alternation is a closed set, not "any label"',
  extractBmVersion('License: MIT | v9.9.9 | permissive\n\n## Observations\n\n- [version] 1.0.0\n', 'npm-foo'),
  { version: '1.0.0', pattern: 3 })

// --- Pattern 2: `| Version | <value> |` table row ---
check('pattern 2: bare table row',
  extractBmVersion('| Version | 0.26.1 |', 'npm-foo'),
  { version: '0.26.1', pattern: 2 })

check('pattern 2: table row inside a full markdown table (separator row skipped)',
  extractBmVersion('| Field | Value |\n|-------|-------|\n| Version | 0.26.1 |\n', 'npm-foo'),
  { version: '0.26.1', pattern: 2 })

check('pattern 2: label match is case-insensitive',
  extractBmVersion('| VERSION | 7.7.7 |', 'npm-foo'),
  { version: '7.7.7', pattern: 2 })

check('pattern 2 outranks pattern 3 (observation present but table row wins)',
  extractBmVersion('| Version | 0.26.1 |\n\n## Observations\n\n- [version] 9.9.9\n', 'npm-foo'),
  { version: '0.26.1', pattern: 2 })

// --- Pattern 2 regression: strict label guard (yaml false-positive case) ---
check('yaml false-positive regression: "| Spec Version | 1.1 |" is NOT selected — falls through to the [version] observation',
  extractBmVersion(
    '---\ntitle: npm-yaml\ntype: npm_package\n---\n\n| Spec Version | 1.1 |\n\n## Observations\n\n- [version] 2.7.0\n',
    'npm-yaml'
  ),
  { version: '2.7.0', pattern: 3 })

// --- Pattern 2 regression: channel-mismatch table row does not shadow the observation ---
check('channel-mismatch regression: "| Legacy Version | 0.9.0 |" is NOT selected — [version] observation wins',
  extractBmVersion('| Legacy Version | 0.9.0 |\n\n## Observations\n\n- [version] 1.2.0\n', 'brew-foo'),
  { version: '1.2.0', pattern: 3 })

// --- Pattern 3: [version] / [version-range] observation ---
check('pattern 3: plain [version] observation is not flagged as a range',
  extractBmVersion('## Observations\n\n- [version] 5.8.5\n', 'npm-foo'),
  { version: '5.8.5', pattern: 3, isRange: false })

check('pattern 3: [version] observation with trailing prose keeps only the leading token',
  extractBmVersion('## Observations\n\n- [version] 5.8.5 (stable)\n', 'npm-foo'),
  { version: '5.8.5', pattern: 3, isRange: false })

check('pattern 3: [version-range] strips a leading caret AND is flagged isRange — the resolved token is informational only, callers must exclude it from bucketing rather than treat it as a concrete pin',
  extractBmVersion('## Observations\n\n- [version-range] ^9.0.0\n', 'npm-foo'),
  { version: '9.0.0', pattern: 3, isRange: true })

check('pattern 3: [version-range] with no leading operator is still flagged isRange (the observation label decides, not the presence of an operator)',
  extractBmVersion('## Observations\n\n- [version-range] 9.0.0 - 9.5.0\n', 'npm-foo'),
  { version: '9.0.0', pattern: 3, isRange: true })

check('pattern 3 outranks pattern 4 (frontmatter version present but observation wins)',
  extractBmVersion('---\ntitle: foo\nversion: 3.3.3\n---\n\n## Observations\n\n- [version] 4.4.4\n', 'npm-foo'),
  { version: '4.4.4', pattern: 3 })

// --- Pattern 3 regression: semver-range example must not be grabbed from prose,
//     but via [version-range] it correctly yields the first concrete token ---
check('semver-range regression: ">=2.5.0 || 5.0.0 - 7.2.3" in body PROSE is not grabbed by any pattern',
  extractBmVersion('This package supports version ranges like >=2.5.0 || 5.0.0 - 7.2.3 in its peerDependencies.', 'npm-foo'),
  { version: null, pattern: null })

check('semver-range regression: the same range via [version-range] yields 2.5.0, flagged isRange',
  extractBmVersion('## Observations\n\n- [version-range] >=2.5.0 || 5.0.0 - 7.2.3\n', 'npm-foo'),
  { version: '2.5.0', pattern: 3, isRange: true })

// --- Pattern 4: frontmatter `version:` field ---
check('pattern 4: bare frontmatter version',
  extractBmVersion('---\ntitle: foo\nversion: 12.4.0\n---\n\nbody text\n', 'npm-foo'),
  { version: '12.4.0', pattern: 4 })

check('pattern 4: quoted frontmatter version',
  extractBmVersion('---\ntitle: foo\nversion: "8.8.8"\n---\n\nbody text\n', 'npm-foo'),
  { version: '8.8.8', pattern: 4 })

check('pattern 4 outranks pattern 5 (Release Highlights present but frontmatter wins)',
  extractBmVersion('---\nversion: 12.4.0\n---\n\n## Release Highlights\n- **v99.0.0** (…)\n', 'npm-foo'),
  { version: '12.4.0', pattern: 4 })

check('pattern 4 is scoped to the frontmatter block: a "version:" mention in body prose is not matched',
  extractBmVersion('---\ntitle: foo\n---\n\nSome text about version: 3.3.3 mentioned casually.\n', 'npm-foo'),
  { version: null, pattern: null })

// --- Pattern 5: Release Highlights / Version History newest entry ---
check('pattern 5: highest semver wins, not the first bullet (bold form)',
  extractBmVersion(
    '## Release Highlights\n- **v5.8.5** (2026-05-01) — feature bump\n- **v5.2.0** (2026-01-01) — patch\n- **v5.9.0** (2026-06-01) — breaking change\n',
    'npm-foo'
  ),
  { version: '5.9.0', pattern: 5 })

check('pattern 5: Version History heading, linked form',
  extractBmVersion('## Version History\n- [v2.1.0](url) — fix\n- [v2.5.0](url) — feature\n', 'npm-foo'),
  { version: '2.5.0', pattern: 5 })

check('pattern 5 outranks pattern 6 (prose-fallback shape present but Release Highlights wins)',
  extractBmVersion(
    '## Release Highlights\n- **v3.0.0** (2026-01-01) — desc\n\n- **Version**: 9.9.9 (registry)\n',
    'npm-foo'
  ),
  { version: '3.0.0', pattern: 5 })

// --- Pattern 6: registry/prose fallback ---
check('pattern 6: "- **Version**: X" bullet form',
  extractBmVersion('- **Version**: 0.11.13 (registry lookup)\n', 'npm-foo'),
  { version: '0.11.13', pattern: 6 })

check('pattern 6: "Current: vX" form',
  extractBmVersion('Current: v3.2.4 (as of today)\n', 'npm-foo'),
  { version: '3.2.4', pattern: 6 })

// --- Pattern 6 regression: embedded mid-sentence prose must not be grabbed
//     (Sprint 33 gate finding — Pattern 6's two sub-regexes were unanchored,
//     so they matched anywhere in the note body, not just on their own line) ---
check('pattern 6 regression: "- **Version**:" embedded mid-sentence (not its own line) does not match',
  extractBmVersion('The README example shows a line like foo - **Version**: 1.2.3 in the docs, for illustration only.', 'npm-foo'),
  { version: null, pattern: null })

check('pattern 6 regression: "Current:" embedded mid-sentence (not its own line) does not match',
  extractBmVersion('See also: Current: v9.9.9 was mentioned once in an old blog post about the project.', 'npm-foo'),
  { version: null, pattern: null })

check('pattern 6 regression: "Current:" inside narrative changelog prose under a Release Highlights heading does not match',
  extractBmVersion(
    '## Release Highlights\n- Upstream blog post says the current stable release, Current: v9.9.9, fixes a regression.\n',
    'npm-foo'
  ),
  { version: null, pattern: null })

// --- Pattern 6 regression: fenced code blocks must be excised before ANY
//     pattern runs (Sprint 33 gate finding — none of the 6 patterns were
//     fence-aware, so a coincidental version-looking line inside a
//     `## Common Usage`-style fenced example was wrongly extracted) ---
check('fence regression: a "- **Version**:" line inside a fenced code block is NOT extracted',
  extractBmVersion('```markdown\n- **Version**: 9.9.9 (example only)\n```', 'npm-foo'),
  { version: null, pattern: null })

check('fence regression: a real Pattern 6 line OUTSIDE the fence still matches once the fenced example is excised',
  extractBmVersion(
    '```markdown\n- **Version**: 9.9.9 (example only)\n```\n\n- **Version**: 1.2.3 (registry lookup)\n',
    'npm-foo'
  ),
  { version: '1.2.3', pattern: 6 })

check('fence regression: a nested 4-backtick-outer/3-backtick-inner fenced example does not leak its inner content',
  extractBmVersion('````markdown\n```\n- **Version**: 9.9.9\n```\n````\n', 'npm-foo'),
  { version: null, pattern: null })

check('fence regression: a tilde-fenced example does not leak its content',
  extractBmVersion('~~~markdown\n- **Version**: 9.9.9 (example only)\n~~~\n', 'npm-foo'),
  { version: null, pattern: null })

check('fence regression: frontmatter (Pattern 4) is untouched by fence-stripping even when the note also has a fenced example',
  extractBmVersion(
    '---\ntitle: foo\nversion: 12.4.0\n---\n\n```markdown\n- **Version**: 9.9.9 (example only)\n```\n',
    'npm-foo'
  ),
  { version: '12.4.0', pattern: 4 })

check('fence regression: a [version] observation (Pattern 3) outside a fence still wins over fenced prose',
  extractBmVersion(
    '```markdown\n- **Version**: 9.9.9 (example only)\n```\n\n## Observations\n\n- [version] 5.8.5\n',
    'npm-foo'
  ),
  { version: '5.8.5', pattern: 3 })

// --- No match: unparseable ---
check('unparseable: no pattern matches',
  extractBmVersion('Just some prose about the tool with no structured version info at all.', 'npm-foo'),
  { version: null, pattern: null })

check('unparseable: empty content',
  extractBmVersion('', 'npm-foo'),
  { version: null, pattern: null })

// --- Full priority-order sweep: all 6 patterns present, pattern 1 wins ---
check('priority-order sweep: all 6 patterns present in one note, pattern 1 wins',
  extractBmVersion(
    [
      '---',
      'title: npm-foo',
      'version: 4.0.0',
      '---',
      '',
      'Homepage: [foo](https://example.com) | v1.0.0 | MIT',
      '',
      '| Version | 2.0.0 |',
      '',
      '## Observations',
      '',
      '- [version] 3.0.0',
      '',
      '## Release Highlights',
      '- **v5.0.0** (2026-01-01) — desc',
      '',
      '- **Version**: 6.0.0 (registry)',
      '',
    ].join('\n'),
    'npm-foo'
  ),
  { version: '1.0.0', pattern: 1 })

// --- vp-claude-9q7e regression: npm_package notes try Pattern 3 before
//     Pattern 1 (the misparse-shield actually fires); every other note type
//     keeps the original 1-first order unchanged ---
check('9q7e fix: an npm_package-typed note with both a header pipe and a [version] observation reads the observation (Pattern 3), not the pipe',
  extractBmVersion(
    '---\ntitle: npm-yaml\ntype: npm_package\n---\n\nGitHub: [eemeli/yaml](https://github.com/eemeli/yaml) | v1.1 | ISC\n\n## Observations\n\n- [version] 2.7.0\n',
    'npm-yaml'
  ),
  { version: '2.7.0', pattern: 3 })

check('9q7e scope guard: a non-npm note (type: crate_package) with the same both-slots shape still reads the header pipe (Pattern 1) — override is npm-only',
  extractBmVersion(
    '---\ntitle: crate-foo\ntype: crate_package\n---\n\nGitHub: [foo/foo](https://github.com/foo/foo) | v1.0.0 | MIT\n\n## Observations\n\n- [version] 2.0.0\n',
    'crate-foo'
  ),
  { version: '1.0.0', pattern: 1 })

check('9q7e scope guard: a note with no type: field at all (legacy/untyped) still reads the header pipe (Pattern 1) — same as pre-fix behavior',
  extractBmVersion(
    '---\ntitle: npm-foo\n---\n\nGitHub: [foo/foo](https://github.com/foo/foo) | v1.0.0 | MIT\n\n## Observations\n\n- [version] 2.0.0\n',
    'npm-foo'
  ),
  { version: '1.0.0', pattern: 1 })

check('9q7e: an npm_package note with only the header pipe (no [version] observation) still falls through to Pattern 1 correctly',
  extractBmVersion(
    '---\ntitle: npm-foo\ntype: npm_package\n---\n\nGitHub: [foo/foo](https://github.com/foo/foo) | v1.0.0 | MIT\n',
    'npm-foo'
  ),
  { version: '1.0.0', pattern: 1 })

check('9q7e: full priority-order sweep on an npm_package note now yields pattern 3, not pattern 1',
  extractBmVersion(
    [
      '---',
      'title: npm-foo',
      'type: npm_package',
      'version: 4.0.0',
      '---',
      '',
      'GitHub: [foo/foo](https://github.com/foo/foo) | v1.0.0 | MIT',
      '',
      '| Version | 2.0.0 |',
      '',
      '## Observations',
      '',
      '- [version] 3.0.0',
      '',
      '## Release Highlights',
      '- **v5.0.0** (2026-01-01) — desc',
      '',
      '- **Version**: 6.0.0 (registry)',
      '',
    ].join('\n'),
    'npm-foo'
  ),
  { version: '3.0.0', pattern: 3 })

console.log(`${getCounts().passed}/${getCounts().passed + getCounts().failed} passed`)

if (PATTERN_SIGNATURES.length !== 6 || PATTERN_SIGNATURES.some((p, i) => p.id !== i + 1)) {
  console.error('  FAIL  PATTERN_SIGNATURES must list exactly 6 entries with ids 1..6 in order')
  record(false)
}

console.log(`PATTERN_SIGNATURES: ${PATTERN_SIGNATURES.length} entries`)

if (getCounts().failed > 0) process.exit(1)
