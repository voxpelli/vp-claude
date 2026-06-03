// Shared mdast helper for markdown-scanning checks. Parsing to an AST lets a
// check separate scannable prose (`text` + `inlineCode` nodes) from fenced code
// blocks (`code`) and frontmatter (`yaml`).
//
// Why inline code IS collected (not skipped): in this plugin's skills/agents a
// tool reference is conventionally written as a backtick span — `mcp__x__y` is
// the canonical USE form, so it must stay visible to auditToolReferences or the
// check would miss the common "backticked-but-undeclared tool" phantom. The win
// over the regex fence-masking it replaces is therefore robust FENCE handling:
// it correctly skips fenced examples at any backtick depth (tilde ~~~ fences and
// the 4-backtick-outer / 3-backtick-inner nesting this repo's note templates
// require — see MEMORY.md), which the `replace(/```…```/g)` regex leaked. The
// rare backtick-MENTION false positive (documenting an excluded tool inline) is
// unchanged — still handled by rephrasing.
//
// BOUNDARY: only checks scanning PLUGIN-SOURCE markdown for a prose-vs-fenced
// distinction should use this. Checks whose target lives INSIDE fenced example
// blocks (the staleness drift-bucket headings in lib/staleness-contract.mjs)
// MUST stay line-regex — an AST sees those as opaque `code` and would pass
// vacuously. See that file's header for the worked counter-example.

import remarkFrontmatter from 'remark-frontmatter'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

// Built once at module scope (unified processors are stateless parse pipelines).
const mdProcessor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml'])

/**
 * Collect scannable text from a markdown document — `text` and `inlineCode`
 * node values — while skipping `code` (fenced/indented blocks at any backtick
 * depth) and `yaml` frontmatter.
 *
 * @param {string} content - markdown source
 * @returns {string[]} text + inline-code values found outside fenced blocks
 */
export function collectScannableText (content) {
  const tree = mdProcessor.parse(content)
  /** @type {string[]} */
  const segments = []
  /** @param {import('mdast').Nodes} node */
  function walk (node) {
    if (node.type === 'code' || node.type === 'yaml') return
    if (node.type === 'text' || node.type === 'inlineCode') {
      segments.push(node.value)
      return
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child)
    }
  }
  walk(tree)
  return segments
}

/**
 * Recursively collect text + inline-code from an mdast node (a heading's children, etc.).
 *
 * @param {import('mdast').Nodes} node
 * @returns {string}
 */
function inlineText (node) {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if (Array.isArray(node.children)) return node.children.map((child) => inlineText(child)).join('')
  return ''
}

/**
 * Collect markdown headings as { depth, text } via the AST, so a "heading" inside a
 * fenced code block (an opaque `code` node) is correctly ignored. This is why
 * release-counts uses it instead of a multiline `^#{2,4}` regex: CLAUDE.md is
 * fence-heavy, and a future `### Skills (99)` inside a code example would otherwise
 * false-match a count heading.
 *
 * @param {string} content - markdown source
 * @returns {{ depth: 1|2|3|4|5|6, text: string }[]}
 */
export function collectHeadings (content) {
  const tree = mdProcessor.parse(content)
  /** @type {{ depth: 1|2|3|4|5|6, text: string }[]} */
  const headings = []
  /** @param {import('mdast').Nodes} node */
  function walk (node) {
    if (node.type === 'code' || node.type === 'yaml') return
    if (node.type === 'heading') {
      headings.push({ depth: node.depth, text: inlineText(node) })
      return
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child)
    }
  }
  walk(tree)
  return headings
}
