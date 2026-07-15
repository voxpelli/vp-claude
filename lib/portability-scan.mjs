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
//   - same-skill : `skills/<owner>/...` — portable within the skill's own
//     install, though still authored against ${CLAUDE_PLUGIN_ROOT} (a
//     skill-relative rewrite is the modernization D5 applies; not a blocker).
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
  const skillMatch = relativePath.match(/^skills\/([^/]+)(?:\/|$)/)
  if (!skillMatch?.[1]) return 'tooling'
  return skillMatch[1] === owner ? 'same-skill' : 'cross-skill'
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
  for (const p of extractPluginLoadPaths(content)) {
    const skillMatch = p.relativePath.match(/^skills\/([^/]+)(?:\/|$)/)
    refs.push({
      raw: p.raw,
      relativePath: p.relativePath,
      kind: classifyPluginRootPath(owner, p.relativePath),
      targetSkill: skillMatch?.[1] ?? null,
    })
  }
  return refs
}
