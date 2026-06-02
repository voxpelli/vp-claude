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

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'

// Built once at module scope (unified processors are stateless parse pipelines).
const mdProcessor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml'])

/**
 * Collect scannable text from a markdown document — `text` and `inlineCode`
 * node values — while skipping `code` (fenced/indented blocks at any backtick
 * depth) and `yaml` frontmatter.
 * @param {string} content - markdown source
 * @returns {string[]} text + inline-code values found outside fenced blocks
 */
export function collectScannableText (content) {
  const tree = mdProcessor.parse(content)
  /** @type {string[]} */
  const segments = []
  /** @param {any} node */
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
