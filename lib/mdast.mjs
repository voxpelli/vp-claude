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
//
// `findUnclosedFence` below is the one export in this module that deliberately
// does NOT use the AST — see its own doc comment for why an unclosed fence is
// structurally invisible to remark/micromark (CommonMark auto-closes at EOF,
// so there is no parse error to key on).

import remarkFrontmatter from 'remark-frontmatter'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

/** @import { Nodes } from 'mdast' */

// Built once at module scope (unified processors are stateless parse pipelines).
const mdProcessor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml'])

// `collectScannableText` and `collectHeadings` share one shape: skip
// `code`/`yaml` subtrees, collect a match, otherwise keep descending. That
// shape is exactly what `unist-util-visit` walks for free — no manual
// `'children' in node` recursion needed, since the library already visits
// every descendant and the visitor's own typed union narrows `node` per
// branch. `inlineText` reuses the same visitor for a different question (an
// unconditional text-content join over one node's subtree, no skip
// conditions) rather than being forced into the skip-shape above.
//
// `findUnclosedFence` below stays hand-rolled, deliberately NOT visitor-based
// — see its own doc comment for why an unclosed fence is structurally
// invisible to the AST in the first place (there's no tree to visit).

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
  visit(tree, (node) => {
    if (node.type === 'code' || node.type === 'yaml') return SKIP
    if (node.type === 'text' || node.type === 'inlineCode') {
      segments.push(node.value)
    }
  })
  return segments
}

/**
 * Recursively collect text + inline-code from an mdast node (a heading's children, etc.).
 *
 * @param {Nodes} node
 * @returns {string}
 */
function inlineText (node) {
  let text = ''
  visit(node, (child) => {
    if (child.type === 'text' || child.type === 'inlineCode') text += child.value
  })
  return text
}

// Matches a fence-opener/closer candidate line: up to 3 leading spaces (past
// that is an indented code block, not a fence, per CommonMark), then a run of
// 3+ backticks or 3+ tildes. Captures just the marker run.
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/

/**
 * Detect an unclosed fenced code block by hand-matching fence open/close
 * lines — the structural counterpart to `collectScannableText`'s AST walk.
 * remark/micromark do NOT surface this as a parse error: CommonMark defines
 * an unclosed fence as implicitly closed at end-of-document, so the AST alone
 * can't tell "properly closed" from "swallowed the rest of the file" (see
 * collectScannableText's own doc comment on why `code`/`yaml` nodes are
 * skipped wholesale). This walks raw lines instead: a fence CLOSES only when
 * a later marker line uses the SAME character and is AT LEAST as long as the
 * opener; a shorter or different-character marker line found while a fence is
 * open is literal content — neither a close nor a new nested open. That rule
 * is what makes 4-backtick-outer / 3-backtick-inner nesting (this repo's
 * note-template convention) round-trip without a false positive: the inner
 * 3-backtick lines are too short to close the 4-backtick opener.
 *
 * KNOWN TRADEOFF — two blind spots, both currently latent (not triggered by
 * any real file in this repo), disclosed rather than fixed:
 *   1. `FENCE_LINE` anchors `^ {0,3}`, per CommonMark's own indented-code-vs-
 *      fence boundary. A fence indented 4+ spaces (e.g. nested inside a list
 *      item) is therefore invisible to this detector — neither the opener
 *      nor any would-be closer at that indentation matches, so an unclosed
 *      fence at 4+ space indentation silently passes.
 *   2. A closing fence line that carries a trailing info string (e.g. a
 *      three-backtick line reading "ruby" used as a close, not an open) is
 *      counted here as a valid close. CommonMark actually forbids info
 *      strings on closing fences and treats such a line as fence CONTENT
 *      instead (the fence stays open). In the contrived case of a genuinely
 *      unclosed fence followed by such a line, this detector would wrongly
 *      report "closed."
 * Both are rare/contrived enough that fixing them isn't worth the added
 * complexity here — this comment exists so a future reader doesn't have to
 * rediscover them.
 *
 * @param {string} content - markdown source (frontmatter is harmless to
 *   include — it's delimited by `---`, never backtick/tilde runs)
 * @returns {{ line: number, marker: string } | null} the still-open fence's
 *   1-based starting line number and marker text, or null if every fence closes
 */
export function findUnclosedFence (content) {
  /** @type {{ line: number, marker: string } | null} */
  let open = null
  const lines = content.split('\n')
  for (const [index, line] of lines.entries()) {
    if (line === undefined) continue
    const match = FENCE_LINE.exec(line)
    if (!match) continue
    const marker = match[1]
    if (marker === undefined) continue
    if (open === null) {
      open = { line: index + 1, marker }
    } else if (marker[0] === open.marker[0] && marker.length >= open.marker.length) {
      open = null
    }
    // else: shorter/mismatched marker while a fence is open — literal
    // content inside the open fence, not a close and not a new nested open.
  }
  return open
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
  visit(tree, (node) => {
    if (node.type === 'code' || node.type === 'yaml') return SKIP
    if (node.type === 'heading') {
      headings.push({ depth: node.depth, text: inlineText(node) })
      return SKIP
    }
  })
  return headings
}
