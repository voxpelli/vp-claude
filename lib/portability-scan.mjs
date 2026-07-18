// Portability classifier for `${CLAUDE_PLUGIN_ROOT}/...` references in skill
// prose. Complements lib/plugin-load-paths.mjs WITHOUT duplicating it: that
// module + check-plugin-load-paths.mjs answer "does this path resolve on disk?"
// (a Claude-plugin-install property — the whole plugin tree is present). This
// module answers a DIFFERENT question: "would this reference survive a
// standalone skills.sh single-skill install, where only one skill's own
// directory ships?" A `${CLAUDE_PLUGIN_ROOT}/skills/<other>/...` ref resolves
// fine on disk in the full plugin yet dangles under skills.sh when <other> is
// not installed — the portability hazard the triple-harness goal cares about.
//
// Three kinds, by the referenced path's first segment relative to the owning
// skill:
//   - same-skill : `skills/<owner>/...` — resolves under a Claude PLUGIN
//     install (${CLAUDE_PLUGIN_ROOT} is defined) but BREAKS under a standalone
//     skills.sh single-skill install (the variable is undefined there). The fix
//     is a bare `references/...` path, which resolves against the skill's own
//     dir in both harnesses; this scrub is deferred to Wave 3's skill
//     re-extraction, so the same-skill count is the outstanding portability debt.
//   - cross-skill: `skills/<other>/...` — a dependency on a sibling skill;
//     breaks a standalone single-skill install of <owner>.
//   - tooling    : anything not under `skills/` (`lib/`, `scripts/`, ...) —
//     plugin runtime tooling absent from any skills.sh install; the accepted
//     resolution is "skills.sh-degraded, documented", not a rewrite.
//
// Pure classification only. The live glob (warn-only) + fixture self-test live
// in the calling check script, mirroring lib/plugin-load-paths.mjs.

import { extractPluginLoadPaths } from './plugin-load-paths.mjs'

/**
 * Derive the owning skill name from a `skills/**` file path. Tolerant of both
 * absolute (`/repo/skills/foo/SKILL.md`) and repo-relative (`skills/foo/refs/x.md`)
 * forms, and of `SKILL.md` vs `references/*.md` locations within the skill.
 *
 * @param {string} skillFilePath
 * @returns {string | null} the skill name, or null if the path is not under `skills/<name>/`
 */
export function owningSkill (skillFilePath) {
  const match = skillFilePath.replaceAll('\\', '/').match(/(?:^|\/)skills\/([^/]+)\//)
  return match?.[1] ?? null
}

/**
 * Extract the skill-name segment from a `${CLAUDE_PLUGIN_ROOT}`-relative path
 * (`skills/<name>/...` or a bare `skills/<name>`), or null when the path is not
 * under `skills/`. The single source of truth for the skill-segment match, so
 * `classifyPluginRootPath` (kind) and `scanPortability` (targetSkill) can never
 * disagree.
 *
 * @param {string} relativePath
 * @returns {string | null}
 */
function skillSegment (relativePath) {
  return relativePath.match(/^skills\/([^/]+)(?:\/|$)/)?.[1] ?? null
}

/** @typedef {'same-skill' | 'cross-skill' | 'tooling'} PortabilityKind */

/**
 * Classify a `${CLAUDE_PLUGIN_ROOT}`-relative path (e.g. `skills/foo/refs/bar.md`
 * or `scripts/x.mjs`) from the perspective of a given owning skill. A path
 * outside `skills/` is always `tooling`; a `skills/<name>/...` path is
 * `same-skill` iff `<name> === owner`, else `cross-skill`. A null owner (the
 * referring file is not itself a skill) makes every skill target `cross-skill`
 * — there is no owning skill for it to match.
 *
 * @param {string | null} owner - owning skill name, or null when the referring file is not a skill file
 * @param {string} relativePath - the path portion after the token, leading slash stripped
 * @returns {PortabilityKind}
 */
export function classifyPluginRootPath (owner, relativePath) {
  const target = skillSegment(relativePath)
  if (!target) return 'tooling'
  return target === owner ? 'same-skill' : 'cross-skill'
}

/**
 * @typedef PortabilityRef
 * @property {string} raw - the full `${CLAUDE_PLUGIN_ROOT}/...` token as extracted
 * @property {string} relativePath - the path portion after the token, leading slash stripped
 * @property {PortabilityKind} kind
 * @property {string | null} targetSkill - the referenced skill name for skill paths, else null
 */

/**
 * Scan one skill markdown file for `${CLAUDE_PLUGIN_ROOT}` references and
 * classify each by portability impact for a standalone skills.sh single-skill
 * install.
 *
 * @param {string} skillFilePath - path used only to derive the owning skill (never read)
 * @param {string} content - markdown source
 * @returns {PortabilityRef[]}
 */
export function scanPortability (skillFilePath, content) {
  const owner = owningSkill(skillFilePath)
  /** @type {PortabilityRef[]} */
  const refs = []
  // Template placeholders (extractPluginLoadPaths flags p.isTemplate for a
  // `<placeholder>` segment) are deliberately NOT skipped here: a placeholder
  // only ever occupies a later path segment (e.g. `.../ecosystem-<ecosystem>.md`),
  // so the skill-name segment is always literal and classification is unaffected.
  // (This differs from plugin-load-paths' consumer, which skips templates because
  // it resolves the full path on disk — a portability CLASS doesn't need to.)
  for (const p of extractPluginLoadPaths(content)) {
    refs.push({
      raw: p.raw,
      relativePath: p.relativePath,
      kind: classifyPluginRootPath(owner, p.relativePath),
      targetSkill: skillSegment(p.relativePath),
    })
  }
  return refs
}
