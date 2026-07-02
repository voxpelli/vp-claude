// Cross-load-path extractor — finds every `${CLAUDE_PLUGIN_ROOT}/...` path
// referenced as a BARE inline-code string in skill prose (e.g. "Read
// `${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/upgrade-haul.md`").
// These are invisible to remark-validate-links (not real link nodes) and to
// validate-plugin.mjs's ${CLAUDE_PLUGIN_ROOT} resolution (hook commands only)
// — so a moved/renamed shared reference file rots silently with nothing
// failing. Mirrors lib/release-counts.mjs: pure extraction here, live
// existsSync assertion + fixture self-test in the calling check script.
//
// Reuses lib/mdast.mjs's collectScannableText for the same reason
// release-counts uses collectHeadings: an AST walk correctly skips fenced
// code blocks (any backtick depth) and frontmatter, where a naive
// full-document regex would false-match a path mentioned inside a fenced
// example (e.g. the `Bash: node ${CLAUDE_PLUGIN_ROOT}/scripts/...` example in
// knowledge-gaps/SKILL.md, which documents CLI invocation, not a doc
// cross-reference to verify).

import { collectScannableText } from './mdast.mjs'

// Exported so callers (the check script's live scan + fixtures) can build
// `${CLAUDE_PLUGIN_ROOT}/...` sample text via real template substitution
// instead of embedding the literal `${CLAUDE_PLUGIN_ROOT}` text in a plain
// string, which trips eslint's no-template-curly-in-string rule.
// eslint-disable-next-line no-template-curly-in-string -- literal token being matched, not a template literal
export const PLUGIN_ROOT_TOKEN = '${CLAUDE_PLUGIN_ROOT}'

// Path chars after the token, stopped at whitespace and the delimiters that
// commonly close a path mention in this project's prose (backtick, quote,
// paren, comma, semicolon) — inline-code segments never contain these
// mid-path since mdast already strips the surrounding backtick delimiters.
const PATH_RE = /\$\{CLAUDE_PLUGIN_ROOT\}(\/[^\s`'"(),;]+)/g

// Sentence/markup punctuation that can trail a path when it appears in plain
// prose text (not inline code) rather than being cleanly delimited by mdast —
// e.g. a sentence-final period right after ".md" with no backtick between.
const TRAILING_PUNCTUATION_RE = /[.,:;)\]}*]+$/

/**
 * @typedef PluginLoadPath
 * @property {string} raw - the full `${CLAUDE_PLUGIN_ROOT}/...` token as extracted
 * @property {string} relativePath - the path portion after the token, leading slash stripped (e.g. "skills/foo/references/bar.md")
 * @property {boolean} isTemplate - true when the path contains a `<placeholder>` segment (e.g. `ecosystem-<ecosystem>.md`) — not a literal path to resolve
 */

/**
 * Extract every `${CLAUDE_PLUGIN_ROOT}/...` path referenced in a markdown
 * document's scannable prose. Skips fenced code blocks and frontmatter (via
 * collectScannableText) and skips template placeholders (a path segment
 * containing `<...>`, e.g. `references/note-template-<ecosystem>.md`) by
 * flagging them `isTemplate: true` rather than dropping them silently — the
 * caller decides whether to report or ignore.
 *
 * @param {string} content - markdown source
 * @returns {PluginLoadPath[]}
 */
export function extractPluginLoadPaths (content) {
  /** @type {PluginLoadPath[]} */
  const found = []
  for (const segment of collectScannableText(content)) {
    if (!segment.includes(PLUGIN_ROOT_TOKEN)) continue
    for (const match of segment.matchAll(PATH_RE)) {
      const pathPart = match[1].replace(TRAILING_PUNCTUATION_RE, '')
      if (!pathPart) continue
      found.push({
        raw: `${PLUGIN_ROOT_TOKEN}${pathPart}`,
        relativePath: pathPart.replace(/^\//, ''),
        isTemplate: /[<>]/.test(pathPart),
      })
    }
  }
  return found
}
