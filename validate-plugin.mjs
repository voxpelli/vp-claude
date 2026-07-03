import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import yaml from 'js-yaml'
import remarkFrontmatter from 'remark-frontmatter'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import {
  guardedArrayIncludes, isKeyWithType, isObject, isObjectWithKey, isStringArray, isType,
} from '@voxpelli/typed-utils'

import { collectScannableText, findUnclosedFence } from './lib/mdast.mjs'
import { buildCanonicalRelationVerbs, checkRelationVocabDrift } from './lib/schema-vocab.mjs'
import { checkStalenessConsume, checkStalenessEmit } from './lib/staleness-contract.mjs'

const ROOT = new URL('.', import.meta.url).pathname.replace(/\/$/, '')

/** @type {string[]} */
const errors = []
/** @type {{ file: string, message: string }[]} */
const warnings = []

/**
 * @param {string} file
 * @param {string} message
 */
function error (file, message) {
  errors.push(`${relative(ROOT, file)}: ${message}`)
}

/**
 * @param {string} file
 * @param {string} message
 */
function warn (file, message) {
  warnings.push({ file: relative(ROOT, file), message })
}

/**
 * Escape a value for GitHub Actions workflow-command syntax (the `::warning
 * file=...,line=...::message` format the runner parses off stdout into a
 * PR-visible annotation). Per GitHub's documented escaping rules: `%`, CR,
 * and LF must always be escaped; `:` and `,` must additionally be escaped
 * inside property values (e.g. `file=`), never inside the message itself.
 * https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 *
 * @param {string} value
 * @param {boolean} isProperty
 * @returns {string}
 */
function escapeWorkflowCommandValue (value, isProperty) {
  let escaped = value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
  if (isProperty) {
    escaped = escaped.replaceAll(':', '%3A').replaceAll(',', '%2C')
  }
  return escaped
}

/**
 * @param {string} filePath
 * @returns {Promise<unknown>}
 */
async function readJson (filePath) {
  const raw = await readFile(filePath, 'utf8')
  try {
    return JSON.parse(raw)
  } catch {
    error(filePath, 'Invalid JSON')
  }
}

/**
 * @param {string} content
 * @returns {Record<string, unknown> | undefined}
 */
function extractFrontmatter (content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match || match[1] === undefined) return
  try {
    const parsed = yaml.load(match[1])
    return isObject(parsed) ? parsed : undefined
  } catch {}
}

/** @typedef {'prompt' | 'command' | 'agent' | 'http'} HookType */
/** @type {Set<HookType>} */
const VALID_HOOK_TYPES = new Set(/** @type {const} */ (['prompt', 'command', 'agent', 'http']))

// Known Claude Code hook event names. A typo'd event key passes structural
// validation but silently never fires — warn() (not error()) because the upstream
// set grows; an unknown key is a strong typo signal, not proof of breakage.
// NOTE: 'PostToolBatch' is SPECULATIVE — not a confirmed/documented Claude Code
// hook event as of this writing, and unused by this plugin's own hooks.json.
// Kept in the allowlist (rather than removed) only so a future real hook under
// that name doesn't spuriously warn(); do not cite it elsewhere as a verified
// event without re-checking upstream docs first.
const VALID_HOOK_EVENTS = new Set([
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PostToolBatch',
  'UserPromptSubmit', 'UserPromptExpansion',
  'Stop', 'StopFailure', 'Notification', 'MessageDisplay',
  'SessionStart', 'SessionEnd', 'Setup',
  'SubagentStart', 'SubagentStop', 'TeammateIdle',
  'TaskCreated', 'TaskCompleted',
  'PermissionRequest', 'PermissionDenied',
  'InstructionsLoaded', 'ConfigChange', 'CwdChanged', 'FileChanged',
  'WorktreeCreate', 'WorktreeRemove',
  'PreCompact', 'PostCompact',
  'Elicitation', 'ElicitationResult',
])

/** @typedef {'blue' | 'cyan' | 'green' | 'yellow' | 'magenta' | 'red'} AgentColor */
/** @type {Set<AgentColor>} */
const VALID_AGENT_COLORS = new Set(/** @type {const} */ (['blue', 'cyan', 'green', 'yellow', 'magenta', 'red']))

/** @typedef {'inherit' | 'sonnet' | 'opus' | 'haiku'} AgentModel */
/** @type {Set<AgentModel>} */
const VALID_AGENT_MODELS = new Set(/** @type {const} */ (['inherit', 'sonnet', 'opus', 'haiku']))

/** @typedef {'low' | 'medium' | 'high' | 'max'} AgentEffort */
/** @type {Set<AgentEffort>} */
const VALID_AGENT_EFFORTS = new Set(/** @type {const} */ (['low', 'medium', 'high', 'max']))

const KNOWN_MCP_PREFIXES = [
  'mcp__basic-memory__',
  'mcp__deepwiki__',
  'mcp__plugin_context7_context7__',
  'mcp__tavily__',
  'mcp__raindrop__',
  'mcp__readwise__',
  'mcp__socket-mcp__',
  'mcp__homebrew__',
]

// Built-in Claude Code tool names this plugin's skills/agents can reference in
// workflow prose. AskUserQuestion is deliberately excluded: skill-development.md
// documents it as NEVER declared in allowed-tools (declaring it auto-approves
// the interaction, bypassing the UI prompt — anthropics/claude-code#29547) yet
// still referenced by name in prose — including it here would be a permanent,
// unfixable false positive.
const KNOWN_BUILTIN_TOOLS = new Set([
  'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
  'Bash', 'BashOutput', 'KillShell',
  'Glob', 'Grep', 'WebFetch', 'WebSearch',
  'Agent', 'Task', 'Skill', 'TodoWrite',
  'ExitPlanMode', 'SlashCommand', 'Artifact',
  'TaskCreate', 'TaskGet', 'TaskList', 'TaskOutput',
])

// A tool named in prose to explain why a skill deliberately does NOT use it
// (a design-decision mention), not to invoke it. This is grammatically
// indistinguishable from a genuine use by any local rule — e.g. nudge-sync's
// "`Write` creates missing..." (real use, declared) and nudge-adoption's
// "`Glob` caps its returned file list..." (historical non-use, undeclared) are
// both third-person descriptions of the tool. Key: "<path from repo root>:<Tool>".
const BUILTIN_MENTION_EXCEPTIONS = new Set([
  // Discusses a former Glob-based working-set design this skill deliberately
  // does NOT use (see the skill's own "Gather evidence" step for why).
  'skills/nudge-adoption/SKILL.md:Glob',
])

// Tracks which BUILTIN_MENTION_EXCEPTIONS keys were actually matched
// (auditToolReferences' allowlist .has() check returned true) during the REAL
// scan of skills/agents below. A key that never gets consumed is stale — the
// file was renamed or the mention removed — and would otherwise sit silently
// dead forever (bd vp-claude-n27j). Populated by auditToolReferences() as a
// side effect; module-level self-tests below also call auditToolReferences()
// with the real allowlisted key to exercise the suppression path, so this set
// is deliberately `.clear()`-ed right before the real skill-scan loop starts
// (see the comment at that call site) — otherwise self-test pollution would
// mark the entry "consumed" before the real scan ever runs, permanently
// masking genuine staleness.
/** @type {Set<string>} */
const consumedBuiltinMentionExceptions = new Set()

/**
 * Pure comparison: which allowlist keys were never consumed during a scan.
 * No file I/O, no error()/warn() side effects — directly unit-testable (see
 * the self-test below) without needing to route synthetic content back
 * through auditToolReferences (which would pollute the real consumed-set).
 *
 * @param {Set<string>} allowlist
 * @param {Set<string>} consumed
 * @returns {string[]} allowlist keys not present in consumed, allowlist order
 */
function findStaleExceptions (allowlist, consumed) {
  return [...allowlist].filter((key) => !consumed.has(key))
}

// Self-test: findStaleExceptions must report a key that was never consumed
// and stay silent on a key that was. Synthetic sets only — does NOT call
// auditToolReferences, so it cannot pollute consumedBuiltinMentionExceptions.
{
  const usedKey = 'skills/example/SKILL.md:Read'
  const staleKey = 'skills/example/SKILL.md:Bash'
  const fixtureAllowlist = new Set([usedKey, staleKey])
  const fixtureConsumed = new Set([usedKey])
  const stale = findStaleExceptions(fixtureAllowlist, fixtureConsumed)
  if (!stale.includes(staleKey)) {
    error(join(ROOT, '<self-test>'), 'findStaleExceptions self-test failed: did not report a never-consumed allowlist key as stale')
  }
  if (stale.includes(usedKey)) {
    error(join(ROOT, '<self-test>'), 'findStaleExceptions self-test failed: incorrectly reported a consumed allowlist key as stale')
  }
}

/**
 * @param {string} file
 * @param {string[]} tools
 */
function validateMcpPrefixes (file, tools) {
  for (const tool of tools) {
    if (tool.startsWith('mcp__') && !KNOWN_MCP_PREFIXES.some((p) => tool.startsWith(p))) {
      error(file, `Unknown MCP prefix in tool: ${tool}`)
    }
  }
}

/**
 * Extract every `mcp__<server>__<tool>` token from a file's scannable text
 * (prose + inline-code; fenced blocks and frontmatter excluded — via
 * lib/mdast.mjs's collectScannableText, same walk auditToolReferences uses).
 * Skills/agents validate their mcp__ tokens against a *declared* tools array
 * (validateMcpPrefixes above, fed from frontmatter); reference files
 * (skills/<name>/references/<file>.md) have no such frontmatter to declare against —
 * for those the extracted token set itself IS what gets checked against
 * KNOWN_MCP_PREFIXES. Pure — no file I/O — directly unit-testable (see the
 * self-test below).
 *
 * @param {string} content
 * @returns {string[]} unique mcp__ tokens, first-seen order
 */
function extractMcpTokens (content) {
  const seen = new Set()
  /** @type {string[]} */
  const found = []
  for (const text of collectScannableText(content)) {
    for (const match of text.matchAll(/mcp__[\w-]+__[\w-]+/g)) {
      const token = match[0]
      if (!seen.has(token)) {
        seen.add(token)
        found.push(token)
      }
    }
  }
  return found
}

// Self-test: extractMcpTokens must find a scannable-text token and ignore one
// buried inside a fenced code block (matching the same fence-vs-prose
// convention collectScannableText already enforces elsewhere in this file).
// Synthetic fixtures only, mirroring the self-test convention above.
{
  const proseFixture = 'Call `mcp__basic-memory__search_notes` for this step.'
  const proseFound = extractMcpTokens(proseFixture)
  if (!proseFound.includes('mcp__basic-memory__search_notes')) {
    error(join(ROOT, '<self-test>'), 'extractMcpTokens self-test failed: a real prose mcp__ token was not detected')
  }

  const fencedFixture = [
    'Prose before.',
    '',
    '```',
    'mcp__totally-hypothetical__example(query="x")',
    '```',
  ].join('\n')
  const fencedFound = extractMcpTokens(fencedFixture)
  if (fencedFound.includes('mcp__totally-hypothetical__example')) {
    error(join(ROOT, '<self-test>'), 'extractMcpTokens self-test failed: a fenced-block mcp__ token was incorrectly counted as scannable')
  }
}

// Self-test: the reference-file scan path (extractMcpTokens feeding
// validateMcpPrefixes, with no declared-tools array — the exact wiring used
// for skills/*/references/*.md below) must fail on a deliberately-planted
// unknown mcp__ prefix in prose, and stay clean on a known one. Synthetic
// content only (bd vp-claude-26c AC: "prove with a self-test fixture...
// synthetic content, not a real file mutation"). Unwinds afterward like the
// other error()/warn()-exercising self-tests in this file.
{
  const selfTestFile = join(ROOT, '<self-test-reference-mcp-prefix>')
  const errorsSnapshot = errors.length
  /** @type {string[]} */
  const failures = []

  const badPrefixContent = 'See `mcp__bogus-server__do_thing` for details.'
  validateMcpPrefixes(selfTestFile, extractMcpTokens(badPrefixContent))
  if (errors.length !== errorsSnapshot + 1) {
    failures.push('a planted unknown mcp__ prefix in reference-file-style content did not produce exactly one error')
  }
  errors.length = errorsSnapshot

  const goodPrefixContent = 'See `mcp__basic-memory__search_notes` for details.'
  validateMcpPrefixes(selfTestFile, extractMcpTokens(goodPrefixContent))
  if (errors.length !== errorsSnapshot) {
    failures.push('a known mcp__ prefix in reference-file-style content was incorrectly flagged')
  }
  errors.length = errorsSnapshot

  for (const message of failures) {
    error(join(ROOT, '<self-test>'), `reference-file mcp-prefix self-test failed: ${message}`)
  }
}

// Local remark processor for extracting ONLY inline-code (`backtick`) spans.
// lib/mdast.mjs's collectScannableText deliberately merges `text` + `inlineCode`
// into one flat array — fine for the mcp__ check, where the token itself is
// unambiguous regardless of whether it sits in prose or a code span. Bare
// built-in tool names (Read, Bash, Agent, ...) are ordinary English words, so
// this check needs the stronger "code span" signal this plugin's own convention
// already uses for genuine tool references (see skill-development.md's tool
// list hygiene) — scanning plain prose too would flag ordinary sentences like
// "Read the file first."
const inlineCodeProcessor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml'])

/**
 * @param {string} content
 * @returns {string[]} inline-code span values, outside fenced blocks + frontmatter
 */
function collectInlineCodeSpans (content) {
  const tree = inlineCodeProcessor.parse(content)
  /** @type {string[]} */
  const spans = []
  /** @param {import('mdast').Nodes} node */
  function walk (node) {
    if (node.type === 'code' || node.type === 'yaml') return
    if (node.type === 'inlineCode') {
      spans.push(node.value)
      return
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) walk(child)
    }
  }
  walk(tree)
  return spans
}

/**
 * Find bare built-in tool names (in backtick code spans, e.g. `Read` or
 * `Glob(pattern=...)` call syntax) that are missing from the declared tools
 * list. Pure — no file I/O, no error()/warn() side effects — so it is directly
 * unit-testable (see the self-test below).
 *
 * @param {string} content
 * @param {string[]} declaredTools
 * @returns {string[]} unique undeclared built-in tool names, first-seen order
 */
function findUndeclaredBuiltinTools (content, declaredTools) {
  const toolSet = new Set(declaredTools)
  const seen = new Set()
  /** @type {string[]} */
  const found = []
  for (const span of collectInlineCodeSpans(content)) {
    const match = span.trim().match(/^([A-Z][A-Za-z]*)(?:\(|$)/)
    if (!match) continue
    const tool = match[1]
    if (tool === undefined) continue
    if (KNOWN_BUILTIN_TOOLS.has(tool) && !toolSet.has(tool) && !seen.has(tool)) {
      seen.add(tool)
      found.push(tool)
    }
  }
  return found
}

/**
 * Audit tool references in prose against declared tools list.
 *
 * @param {string} file
 * @param {string} content
 * @param {string[]} declaredTools
 * @param {string} fieldName
 */
function auditToolReferences (file, content, declaredTools, fieldName) {
  // Collect scannable text via mdast (lib/mdast.mjs): prose + inline backtick
  // spans (a backticked `mcp__x__y` is a real use here), minus fenced code
  // blocks at any depth and YAML frontmatter. Robust where the prior regex
  // fence-masking leaked — tilde fences and 4-backtick-nested fences.
  const toolSet = new Set(declaredTools)
  const seen = new Set()
  // Guard against a silent vacuous pass BEFORE trusting collectScannableText:
  // an unclosed fence makes remark absorb the rest of the file into one
  // opaque `code` node (CommonMark auto-closes at EOF — not a parse error),
  // so collectScannableText would quietly return too little and any tool
  // tokens swallowed past the unclosed fence go unchecked. Structural, not
  // AST-based (see findUnclosedFence's doc comment in lib/mdast.mjs) — this
  // supersedes the old segments===0 heuristic, which only caught a fence
  // opening BEFORE all prose; this also catches the realistic
  // prose-then-unclosed-fence case the old guard passed vacuously. Test the
  // frontmatter-STRIPPED body: frontmatter is delimited by `---`, never
  // backtick/tilde runs, so stripping it is just noise reduction here.
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '')
  const unclosedFence = findUnclosedFence(body)
  if (unclosedFence) {
    error(file, `${fieldName}: unclosed code fence starting at line ${unclosedFence.line} ("${unclosedFence.marker}") — content after it may be silently unscanned for tool references; fix the markdown`)
    return
  }
  const segments = collectScannableText(content)
  for (const text of segments) {
    for (const match of text.matchAll(/mcp__[\w-]+__[\w-]+/g)) {
      const tool = match[0]
      if (!seen.has(tool) && !toolSet.has(tool)) {
        seen.add(tool)
        error(file, `Tool "${tool}" referenced in prose but missing from ${fieldName}`)
      }
    }
  }
  // Bare built-in tool names — see findUndeclaredBuiltinTools' doc comment for
  // why this needs a separate inline-code-only pass instead of reusing `segments`.
  // warn() (not error()), unlike the mcp__ check above: a bare tool name in a
  // backtick span is an ordinary English word, and this codebase's own prose
  // can genuinely mention a tool to explain why it is NOT used (e.g. "an
  // earlier version used `Glob` to build a working set" — nudge-adoption,
  // exempted below) — grammatically indistinguishable from real use by any
  // local rule. A hard error() here would make legitimate "why we don't use X"
  // documentation break CI. See scripts-and-validation.md for the house
  // error()-vs-warn() convention this follows.
  const relFile = relative(ROOT, file)
  for (const tool of findUndeclaredBuiltinTools(content, declaredTools)) {
    const exceptionKey = `${relFile}:${tool}`
    if (BUILTIN_MENTION_EXCEPTIONS.has(exceptionKey)) {
      consumedBuiltinMentionExceptions.add(exceptionKey)
      continue
    }
    warn(file, `Built-in tool "${tool}" referenced in prose but missing from ${fieldName} — verify this is a real reference, not just a documentation mention`)
  }
}

/**
 * Extract `subagent_type="X"` references from scannable text only — prose +
 * inline-code spans, via `collectScannableText` (fenced code blocks and
 * frontmatter excluded). Matches the house convention already used for the
 * mcp__ tool audit and the bare-built-in-tool audit above: a fenced code
 * block is treated as an illustrative example, not a real call-site, so a
 * future skill can show hypothetical `subagent_type` syntax in a fenced
 * snippet without tripping the phantom-subagent check below. KNOWN TRADEOFF:
 * this repo's two current real "how to delegate" call-sites
 * (knowledge-garden, knowledge-maintain SKILL.md) are themselves written as
 * unlabeled fenced blocks, so — like any fenced content — they are no longer
 * scanned by this specific check; a typo'd subagent_type inside one of those
 * blocks would no longer be caught here. Pure — no file I/O — so it is
 * directly unit-testable (see the self-test below).
 *
 * @param {string} content
 * @returns {string[]} unique referenced agent names, first-seen order
 */
function extractSubagentTypeRefs (content) {
  const seen = new Set()
  /** @type {string[]} */
  const found = []
  const scannableText = collectScannableText(content).join('\n')
  for (const match of scannableText.matchAll(/subagent_type\s*=\s*["']([\w-]+)["']/g)) {
    const agentName = match[1]
    if (agentName !== undefined && !seen.has(agentName)) {
      seen.add(agentName)
      found.push(agentName)
    }
  }
  return found
}

// Self-test: extractSubagentTypeRefs must ignore a fenced example and still
// find a prose/inline-code reference — the split bd vp-claude-o6dk closes.
// Synthetic fixtures only, mirroring the self-test convention above.
{
  const fencedFixture = [
    'Some prose before.',
    '',
    '```',
    'Agent(subagent_type="totally-hypothetical-agent")',
    '```',
  ].join('\n')
  const fencedFound = extractSubagentTypeRefs(fencedFixture)
  if (fencedFound.includes('totally-hypothetical-agent')) {
    error(join(ROOT, '<self-test>'), 'extractSubagentTypeRefs self-test failed: a fenced example was incorrectly counted as a real subagent_type reference')
  }

  const proseFixture = 'Delegate with subagent_type="knowledge-gardener" inline.'
  const proseFound = extractSubagentTypeRefs(proseFixture)
  if (!proseFound.includes('knowledge-gardener')) {
    error(join(ROOT, '<self-test>'), 'extractSubagentTypeRefs self-test failed: a real prose subagent_type reference was not detected')
  }
}

// Self-test: findUndeclaredBuiltinTools must fire on a planted violation and
// stay silent on a fixture where every referenced tool is declared. Guards the
// detector itself against silently regressing to a no-op — the exact failure
// mode this check exists to close (a skill called a built-in tool in prose
// without declaring it, and `npm run check:plugin` passed silently). Uses
// synthetic fixture strings only, never real plugin files, so it can assert
// "fires on X" without depending on — or polluting — the real report above.
{
  const violationFixture = 'Use the `Read` tool to check the manifest.'
  const violationFound = findUndeclaredBuiltinTools(violationFixture, [])
  if (!violationFound.includes('Read')) {
    error(join(ROOT, '<self-test>'), 'findUndeclaredBuiltinTools self-test failed: did not detect the planted undeclared "Read" reference')
  }
  const cleanFixture = 'Use the `Read` tool to check the manifest, then call `mcp__basic-memory__search_notes`.'
  const cleanFound = findUndeclaredBuiltinTools(cleanFixture, ['Read'])
  if (cleanFound.length > 0) {
    error(join(ROOT, '<self-test>'), `findUndeclaredBuiltinTools self-test failed: false positive(s) on a fixture where every tool is declared: ${cleanFound.join(', ')}`)
  }
}

// Self-test: auditToolReferences must route a genuine undeclared bare
// built-in tool mention to warn() (not error()) — the split the module-level
// comment above documents — and must fully suppress a BUILTIN_MENTION_EXCEPTIONS
// allowlisted mention (no warn, no error at all). findUndeclaredBuiltinTools'
// own self-test above only proves the pure detector fires; this proves the
// detected name actually reaches the right severity bucket through
// auditToolReferences, and that the allowlist match logic works. Uses
// synthetic file paths + content (the real allowlisted key, reused rather
// than duplicated, since exercising the real entry is exactly the point) and
// unwinds every warnings/errors entry it adds afterward so this synthetic
// exercise never leaks into the real report below.
{
  const selfTestFile = join(ROOT, '<self-test-audit-tool-references>')
  const warningsSnapshot = warnings.length
  const errorsSnapshot = errors.length
  /** @type {string[]} */
  const failures = []

  // (a) genuine undeclared mention → exactly one warning, zero errors
  auditToolReferences(selfTestFile, 'Use the `Bash` tool to run the command.', [], 'allowed-tools')
  if (warnings.length !== warningsSnapshot + 1) {
    failures.push('a genuine undeclared built-in tool mention did not produce exactly one warning')
  }
  if (errors.length !== errorsSnapshot) {
    failures.push('a bare built-in tool mention incorrectly escalated to error()')
  }
  warnings.length = warningsSnapshot
  errors.length = errorsSnapshot

  // (b) allowlisted mention (BUILTIN_MENTION_EXCEPTIONS) → fully suppressed
  const [exceptionKey] = BUILTIN_MENTION_EXCEPTIONS
  if (exceptionKey) {
    const sepIndex = exceptionKey.lastIndexOf(':')
    const exceptionRelPath = exceptionKey.slice(0, sepIndex)
    const exceptionTool = exceptionKey.slice(sepIndex + 1)
    auditToolReferences(join(ROOT, exceptionRelPath), `Use the \`${exceptionTool}\` tool for X.`, [], 'allowed-tools')
    if (warnings.length !== warningsSnapshot || errors.length !== errorsSnapshot) {
      failures.push(`allowlisted mention "${exceptionKey}" was not fully suppressed`)
    }
    warnings.length = warningsSnapshot
    errors.length = errorsSnapshot
  } else {
    failures.push('BUILTIN_MENTION_EXCEPTIONS is empty — cannot exercise the allowlist-suppression path')
  }

  for (const message of failures) {
    error(join(ROOT, '<self-test>'), `auditToolReferences self-test failed: ${message}`)
  }
}

// Self-test: findUnclosedFence must detect a fence left open AFTER prose (the
// realistic case the old segments===0 heuristic passed vacuously — see
// bd vp-claude-zcam) and must round-trip balanced 4-backtick-outer /
// 3-backtick-inner nesting and a balanced tilde fence without a false
// positive. Synthetic fixtures only, mirroring the self-test convention above.
{
  const proseThenUnclosed = [
    'Some prose before the fence.',
    '',
    '```',
    'mcp__basic-memory__search_notes(query="x")',
  ].join('\n')
  if (!findUnclosedFence(proseThenUnclosed)) {
    error(join(ROOT, '<self-test>'), 'findUnclosedFence self-test failed: did not detect a fence left open after prose (the prose-then-unclosed-fence case)')
  }

  const nestedClosed = [
    '````markdown',
    '```',
    'mcp__raindrop__find_bookmarks(collection_ids=[-1])',
    '```',
    '````',
  ].join('\n')
  if (findUnclosedFence(nestedClosed)) {
    error(join(ROOT, '<self-test>'), 'findUnclosedFence self-test failed: false positive on balanced 4-backtick-outer/3-backtick-inner nesting')
  }

  const tildeClosed = ['~~~', 'content', '~~~'].join('\n')
  if (findUnclosedFence(tildeClosed)) {
    error(join(ROOT, '<self-test>'), 'findUnclosedFence self-test failed: false positive on a balanced tilde fence')
  }
}

// Self-test: auditToolReferences must route an unclosed fence to error() (not
// silently pass) and must NOT false-positive on the real note-template
// nesting shape even when it wraps an mcp__ token — the exact real-corpus
// shape raindrop-triage/SKILL.md uses. Unwinds afterward like the self-tests
// above.
{
  const selfTestFile = join(ROOT, '<self-test-fence-balance>')
  const warningsSnapshot = warnings.length
  const errorsSnapshot = errors.length
  /** @type {string[]} */
  const failures = []

  const unclosedContent = [
    'Prose that mentions `mcp__basic-memory__search_notes` first.',
    '',
    '```',
    'unclosed fence content',
  ].join('\n')
  auditToolReferences(selfTestFile, unclosedContent, ['mcp__basic-memory__search_notes'], 'allowed-tools')
  if (errors.length !== errorsSnapshot + 1) {
    failures.push('an unclosed fence after prose did not produce exactly one error')
  }
  errors.length = errorsSnapshot
  warnings.length = warningsSnapshot

  const nestedClosedContent = [
    '````markdown',
    '```',
    'mcp__basic-memory__search_notes(query="x")',
    '```',
    '````',
  ].join('\n')
  auditToolReferences(selfTestFile, nestedClosedContent, [], 'allowed-tools')
  if (errors.length !== errorsSnapshot) {
    failures.push('a balanced 4-backtick/3-backtick nested fence was incorrectly flagged as unclosed')
  }
  errors.length = errorsSnapshot
  warnings.length = warningsSnapshot

  for (const message of failures) {
    error(join(ROOT, '<self-test>'), `auditToolReferences fence-balance self-test failed: ${message}`)
  }
}

// --- plugin.json ---

const pluginPath = join(ROOT, '.claude-plugin', 'plugin.json')
const plugin = await readJson(pluginPath)
if (plugin !== undefined) {
  for (const field of ['name', 'version', 'description']) {
    if (!isObjectWithKey(plugin, field)) {
      error(pluginPath, `Missing required field: ${field}`)
    }
  }
}

// --- marketplace.json (optional) ---

const marketplacePath = join(ROOT, '.claude-plugin', 'marketplace.json')
if (existsSync(marketplacePath)) {
  const marketplace = await readJson(marketplacePath)

  // Shape validation + version consistency, sharing one marketplace-defined guard.
  if (marketplace !== undefined) {
    for (const field of ['name', 'owner', 'plugins']) {
      if (!isObjectWithKey(marketplace, field)) error(marketplacePath, `Missing required field: ${field}`)
    }
    if (isObjectWithKey(marketplace, 'plugins') && !isType(marketplace.plugins, 'array')) {
      error(marketplacePath, '"plugins" must be an array')
    }
    const entries = isKeyWithType(marketplace, 'plugins', 'array') ? marketplace.plugins : []
    for (const entry of entries) {
      const entryName = isKeyWithType(entry, 'name', 'string') ? entry.name : '?'
      for (const field of ['name', 'source', 'description']) {
        if (!isObjectWithKey(entry, field)) error(marketplacePath, `Plugin entry "${entryName}" missing required field: ${field}`)
      }
    }
    // Version consistency: a local "./" entry must match plugin.json version.
    if (plugin !== undefined) {
      const pluginVersion = isObjectWithKey(plugin, 'version') ? plugin.version : undefined
      for (const entry of entries) {
        const entrySource = isObjectWithKey(entry, 'source') ? entry.source : undefined
        const entryVersion = isObjectWithKey(entry, 'version') ? entry.version : undefined
        if (entrySource === './' && entryVersion !== pluginVersion) {
          error(
            marketplacePath,
            `Local "./" entry version "${String(entryVersion)}" does not match plugin.json version "${String(pluginVersion)}"`
          )
        }
      }
    }
  }
}

// --- hooks.json (optional) ---

const hooksPath = join(ROOT, 'hooks', 'hooks.json')
if (existsSync(hooksPath)) {
  const hooksData = await readJson(hooksPath)
  if (hooksData !== undefined) {
    if (!isObjectWithKey(hooksData, 'hooks') || !isObject(hooksData.hooks)) {
      error(hooksPath, 'Missing top-level "hooks" object')
    } else {
      const { hooks } = hooksData
      for (const [event, entries] of Object.entries(hooks)) {
        if (!VALID_HOOK_EVENTS.has(event)) {
          warn(hooksPath, `Unknown hook event "${event}" — typo? A hook under an unrecognized event silently never fires. Known events: ${[...VALID_HOOK_EVENTS].join(', ')}`)
        }
        if (!Array.isArray(entries)) {
          error(hooksPath, `hooks.${event} must be an array`)
          continue
        }
        for (const entry of entries) {
          if (!isKeyWithType(entry, 'matcher', 'string')) {
            error(hooksPath, `hooks.${event}: entry missing "matcher" (string)`)
          }
          if (!isKeyWithType(entry, 'hooks', 'array')) {
            error(hooksPath, `hooks.${event}: entry missing "hooks" (array)`)
            continue
          }
          for (const hook of entry.hooks) {
            const hookType = isObjectWithKey(hook, 'type') ? hook.type : undefined
            if (!guardedArrayIncludes(VALID_HOOK_TYPES, hookType)) {
              error(hooksPath, `hooks.${event}: hook type must be one of ${[...VALID_HOOK_TYPES].join(', ')}, got "${String(hookType)}"`)
            }
            if (hookType === 'prompt') {
              warn(hooksPath, `hooks.${event}: type "prompt" hooks spawn Haiku without MCP access — consider "command" with additionalContext instead (see RETRO-02)`)
            }
            if (!isKeyWithType(hook, 'timeout', 'number')) {
              error(hooksPath, `hooks.${event}: hook missing "timeout" (number)`)
            }
            // Validate command hook paths
            if (hookType === 'command' && isKeyWithType(hook, 'command', 'string')) {
              // eslint-disable-next-line no-template-curly-in-string -- literal placeholder text being substituted, not a template literal
              const resolved = hook.command.replaceAll('${CLAUDE_PLUGIN_ROOT}', ROOT)
              // Extract the file path from the command (after "bash " or similar)
              const parts = resolved.split(/\s+/)
              const scriptPath = parts.find((p) => p.startsWith('/') || p.startsWith('./'))
              if (scriptPath && !existsSync(scriptPath)) {
                error(hooksPath, `hooks.${event}: referenced file does not exist: ${hook.command}`)
              }
            }
          }
        }
      }
    }
  }
}

// --- Skills ---

const skillEntries = await readdir(join(ROOT, 'skills'), { recursive: true })
const skillFiles = skillEntries
  .filter((f) => f.endsWith('SKILL.md'))
  .map((f) => join(ROOT, 'skills', f))

const SKILL_REQUIRED = ['name', 'description', 'user-invocable', 'allowed-tools']

const SKILL_KNOWN_FIELDS = new Set([
  ...SKILL_REQUIRED,
  'argument-hint',
  'paths',
  'effort',
  'maxTurns',
  'context',
  'hooks',
  'shell',
  'disallowedTools',
  'agent',
  'disable-model-invocation',
  'model',
  'skills',
])

// Wipe any consumed-exception keys the module-level self-tests above
// recorded as a side effect of exercising auditToolReferences() with
// synthetic content that reuses the real allowlisted key. Every self-test
// runs before this point; the real skill/agent scan below is the only source
// of truth for whether an allowlist entry is actually still live.
consumedBuiltinMentionExceptions.clear()

for (const file of skillFiles) {
  const content = await readFile(file, 'utf8')
  const fm = extractFrontmatter(content)
  if (!fm) {
    error(file, 'Missing or invalid YAML frontmatter')
    continue
  }
  for (const field of SKILL_REQUIRED) {
    if (!(field in fm)) {
      error(file, `Missing required frontmatter field: ${field}`)
    }
  }
  // Warn on unknown frontmatter fields (catches typos)
  for (const field of Object.keys(fm)) {
    if (!SKILL_KNOWN_FIELDS.has(field)) {
      warn(file, `Unknown skill frontmatter field: "${field}" — typo?`)
    }
  }
  // Claude Code truncates very long descriptions when routing — warn before the
  // tail (e.g. flag mechanics) is at risk. The confirmed hard cap is 1536 chars
  // (combined description+when_to_use in the skill listing — see
  // code.claude.com/docs/en/skills and anthropics/skills#881). Warn at 1500,
  // below the cap rather than at it, so there's early-warning margin before a
  // future edit actually gets truncated. Current longest description
  // (tool-intel, ~1.1k) is comfortably under either number.
  if (typeof fm.description === 'string' && fm.description.length > 1500) {
    warn(file, `description is ${fm.description.length} chars — Claude Code may truncate it for routing; move capability detail into the body`)
  }
  if (isObjectWithKey(fm, 'allowed-tools') && !isType(fm['allowed-tools'], 'array')) {
    error(file, 'allowed-tools must be an array')
  }
  if (isObjectWithKey(fm, 'user-invocable') && !isType(fm['user-invocable'], 'boolean')) {
    error(file, `user-invocable must be a boolean, got ${typeof fm['user-invocable']}`)
  }
  if (isObjectWithKey(fm, 'argument-hint') && !isType(fm['argument-hint'], 'string')) {
    error(file, `argument-hint must be a string, got ${typeof fm['argument-hint']}`)
  }
  if (isObjectWithKey(fm, 'paths') && !isType(fm.paths, 'array')) {
    error(file, 'paths must be an array of glob strings')
  }
  if (isObjectWithKey(fm, 'effort') && !guardedArrayIncludes(VALID_AGENT_EFFORTS, fm.effort)) {
    error(file, `Invalid skill effort "${String(fm.effort)}", must be one of: ${[...VALID_AGENT_EFFORTS].join(', ')}`)
  }
  if (isObjectWithKey(fm, 'maxTurns') && (!isType(fm.maxTurns, 'number') || fm.maxTurns < 1)) {
    error(file, `maxTurns must be a positive integer, got ${String(fm.maxTurns)}`)
  }
  if (isObjectWithKey(fm, 'context') && fm.context !== 'fork') {
    error(file, `context must be "fork" if present, got "${String(fm.context)}"`)
  }
  if (isKeyWithType(fm, 'allowed-tools', 'array') && isStringArray(fm['allowed-tools'])) {
    validateMcpPrefixes(file, fm['allowed-tools'])
    auditToolReferences(file, content, fm['allowed-tools'], 'allowed-tools')
  }
  // Validate Agent(subagent_type="X") references resolve to an actual agent file.
  // Skills that delegate to a subagent (e.g. /knowledge-garden) silently no-op
  // at runtime if the agent name is a typo or was renamed — mirror the agent→skill
  // phantom-reference check for the skill→agent direction. Scanned via
  // extractSubagentTypeRefs (scannable text only — see its doc comment for the
  // fenced-example tradeoff this implies).
  for (const agentName of extractSubagentTypeRefs(content)) {
    if (!existsSync(join(ROOT, 'agents', `${agentName}.md`))) {
      error(file, `Phantom subagent reference: "${agentName}" — no file at agents/${agentName}.md`)
    }
  }
}

// --- Skill reference files (skills/*/references/*.md) ---
//
// These are included prose fragments (no standalone frontmatter, no
// allowed-tools declaration of their own), so they cannot go through the
// full SKILL.md battery above — running auditToolReferences() against them
// would compare prose mentions against a declared-tools list that doesn't
// exist for this file type. Scoped to the two checks that are meaningful
// without a declared-tools array: an unknown mcp__ prefix, and a phantom
// subagent_type reference. bd vp-claude-26c.

/**
 * Audit one skill reference file. Guarded by the same findUnclosedFence()
 * check auditToolReferences() uses and for the same reason: an unclosed
 * fence makes remark absorb the rest of the file into one opaque `code`
 * node, so collectScannableText() (which extractMcpTokens/
 * extractSubagentTypeRefs both call under the hood) would quietly return
 * too little and any mcp__/subagent_type tokens swallowed past the
 * unclosed fence go unchecked — exactly the vacuous-pass failure mode
 * auditToolReferences() already guards against for SKILL.md/agent files.
 *
 * @param {string} file
 * @param {string} content
 */
function auditReferenceFile (file, content) {
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '')
  const unclosedFence = findUnclosedFence(body)
  if (unclosedFence) {
    error(file, `reference file: unclosed code fence starting at line ${unclosedFence.line} ("${unclosedFence.marker}") — content after it may be silently unscanned for tool references; fix the markdown`)
    return
  }
  validateMcpPrefixes(file, extractMcpTokens(content))
  for (const agentName of extractSubagentTypeRefs(content)) {
    if (!existsSync(join(ROOT, 'agents', `${agentName}.md`))) {
      error(file, `Phantom subagent reference: "${agentName}" — no file at agents/${agentName}.md`)
    }
  }
}

// Self-test: auditReferenceFile must route an unclosed fence to error() (not
// silently pass) — mirroring the auditToolReferences fence-balance self-test
// above, but for the reference-file scan path (no declared-tools array).
// Reproduces the reviewer-confirmed failure mode: an unclosed fence followed
// by a bad mcp__ prefix in prose used to yield zero errors; must now yield
// exactly one. Synthetic fixture only, unwound afterward.
{
  const selfTestFile = join(ROOT, '<self-test-reference-file-fence-balance>')
  const errorsSnapshot = errors.length
  /** @type {string[]} */
  const failures = []

  const unclosedWithBadPrefix = [
    'Prose before the fence.',
    '',
    '```',
    'unclosed fence content',
    '',
    'mcp__bogus-server__do_thing',
  ].join('\n')
  auditReferenceFile(selfTestFile, unclosedWithBadPrefix)
  if (errors.length !== errorsSnapshot + 1) {
    failures.push('an unclosed fence hiding a bad mcp__ prefix did not produce exactly one error')
  }
  errors.length = errorsSnapshot

  for (const message of failures) {
    error(join(ROOT, '<self-test>'), `auditReferenceFile fence-balance self-test failed: ${message}`)
  }
}

const referenceFiles = skillEntries
  .filter((f) => f.includes('references/') && f.endsWith('.md'))
  .map((f) => join(ROOT, 'skills', f))

for (const file of referenceFiles) {
  const content = await readFile(file, 'utf8')
  auditReferenceFile(file, content)
}

// --- Agents (optional) ---

const agentsDir = join(ROOT, 'agents')
if (existsSync(agentsDir)) {
  const agentEntries = await readdir(agentsDir)
  const agentFiles = agentEntries
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(agentsDir, f))

  const AGENT_REQUIRED = ['name', 'description', 'model', 'color', 'tools']

  for (const file of agentFiles) {
    const content = await readFile(file, 'utf8')
    const fm = extractFrontmatter(content)
    if (!fm) {
      error(file, 'Missing or invalid YAML frontmatter')
      continue
    }
    for (const field of AGENT_REQUIRED) {
      if (!(field in fm)) {
        error(file, `Missing required frontmatter field: ${field}`)
      }
    }
    if (isObjectWithKey(fm, 'tools') && !isType(fm.tools, 'array')) {
      error(file, 'tools must be an array')
    }
    if (isKeyWithType(fm, 'tools', 'array') && isStringArray(fm.tools)) {
      validateMcpPrefixes(file, fm.tools)
      auditToolReferences(file, content, fm.tools, 'tools')
    }
    if (isObjectWithKey(fm, 'color') && !guardedArrayIncludes(VALID_AGENT_COLORS, fm.color)) {
      error(file, `Invalid agent color "${String(fm.color)}", must be one of: ${[...VALID_AGENT_COLORS].join(', ')}`)
    }
    if (isObjectWithKey(fm, 'model') && !guardedArrayIncludes(VALID_AGENT_MODELS, fm.model)) {
      error(file, `Invalid agent model "${String(fm.model)}", must be one of: ${[...VALID_AGENT_MODELS].join(', ')}`)
    }
    if (isObjectWithKey(fm, 'effort') && !guardedArrayIncludes(VALID_AGENT_EFFORTS, fm.effort)) {
      error(file, `Invalid agent effort "${String(fm.effort)}", must be one of: ${[...VALID_AGENT_EFFORTS].join(', ')}`)
    }
    if (isObjectWithKey(fm, 'skills') && !isType(fm.skills, 'array')) {
      error(file, 'skills must be an array')
    }

    // Gardener read-only invariant
    if (file.endsWith('knowledge-gardener.md') && isKeyWithType(fm, 'tools', 'array') && isStringArray(fm.tools)) {
      const forbidden = ['write_note', 'edit_note', 'delete_note']
      for (const tool of fm.tools) {
        if (forbidden.some((f) => tool.includes(f))) {
          error(file, `Read-only agent must not have write tool: ${tool}`)
        }
      }
    }

    // Validate agent skills references resolve to actual skill files
    if (isKeyWithType(fm, 'skills', 'array') && isStringArray(fm.skills)) {
      for (const skillName of fm.skills) {
        const skillPath = join(ROOT, 'skills', skillName, 'SKILL.md')
        if (!existsSync(skillPath)) {
          error(file, `Phantom skill reference: "${skillName}" — no file at skills/${skillName}/SKILL.md`)
        }
      }
    }
  }
}

// --- BUILTIN_MENTION_EXCEPTIONS staleness (consumed-key enforcement) ---
//
// By this point every skill and agent file has gone through
// auditToolReferences(), which records each allowlist key it actually
// matched into consumedBuiltinMentionExceptions. Any key in the allowlist
// that was never matched is dead — warn() (staleness-class finding, not a
// hard failure) so it surfaces without blocking CI. bd vp-claude-n27j.

for (const staleKey of findStaleExceptions(BUILTIN_MENTION_EXCEPTIONS, consumedBuiltinMentionExceptions)) {
  warn(join(ROOT, 'validate-plugin.mjs'), `BUILTIN_MENTION_EXCEPTIONS entry "${staleKey}" was never matched during this scan — the file may have been renamed or the mention removed; consider removing this allowlist entry`)
}

// --- Staleness drift bucket contract (emit ↔ consume) ---
//
// The version-drift detection feature is a cross-file string contract: the
// knowledge-gardener and the /knowledge-gaps staleness reference EMIT report
// sections whose `#### <bucket>` sub-headings the knowledge-maintainer
// Section 3b text-searches to route auto-fixes. If either side drifts (a
// renamed bucket, a typo), the maintainer silently fails to act. The contract
// logic lives in ./lib/staleness-contract.mjs (pure, unit-tested by
// scripts/check-staleness-contract.mjs); here we apply it to the real files
// and attribute any violations. The ">=1 bucket matched" guard makes a future
// refactor that hides the headings fail loudly instead of passing empty.

const gardenerStalenessPath = join(ROOT, 'agents', 'knowledge-gardener.md')
const stalenessEmitFiles = [
  gardenerStalenessPath,
  join(ROOT, 'skills', 'knowledge-gaps', 'references', 'staleness-detection.md'),
]
let stalenessBucketsSeen = 0
for (const file of stalenessEmitFiles) {
  if (!existsSync(file)) continue
  const { bucketCount, errors: emitErrors } = checkStalenessEmit(await readFile(file, 'utf8'))
  for (const message of emitErrors) error(file, message)
  stalenessBucketsSeen += bucketCount
}
const maintainerPath = join(ROOT, 'agents', 'knowledge-maintainer.md')
if (existsSync(maintainerPath)) {
  const { errors: consumeErrors } = checkStalenessConsume(await readFile(maintainerPath, 'utf8'))
  for (const message of consumeErrors) error(maintainerPath, message)
}
if (stalenessBucketsSeen === 0) {
  error(gardenerStalenessPath, 'Staleness contract check matched zero canonical bucket headings across emit files — the heading regex or fences likely changed; refusing to pass vacuously')
}

// --- Relation-vocabulary drift (Relation Vocabulary prose ↔ picoschema) ---
//
// The CI-automation piece of a 3-bead relation-verb-lint workstream
// (vp-claude-fwnq.4; see lib/schema-vocab.mjs for the full rationale and the
// scope boundary vs. vp-claude-7cq's interactive /schema-evolve
// reconciliation, which owns the well-formed-but-undeclared-verb class).
// Builds the canonical Note-typed relation-verb set as a GLOBAL UNION across
// every schemas/*.md file, then checks each file's own `## Relation
// Vocabulary` prose section for a malformed surface variant (space instead
// of underscore, trailing colon) of a verb that IS canonical somewhere in
// the corpus — the exact historical bug class fixed in v0.29.1.

const schemasDir = join(ROOT, 'schemas')
if (existsSync(schemasDir)) {
  const schemaEntries = await readdir(schemasDir)
  const schemaFiles = schemaEntries
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(schemasDir, f))
  const schemaContents = await Promise.all(schemaFiles.map((f) => readFile(f, 'utf8')))
  const canonicalRelationVerbs = buildCanonicalRelationVerbs(schemaContents)
  if (canonicalRelationVerbs.size === 0) {
    error(schemasDir, 'Relation-vocabulary drift check found zero canonical Note-typed picoschema fields across schemas/*.md — the extraction regex or the schema block markers likely changed; refusing to pass vacuously')
  } else {
    let relationVocabCandidatesChecked = 0
    for (const [file, content] of schemaFiles.map((f, i) => /** @type {[string, string]} */ ([f, schemaContents[i] ?? '']))) {
      const { checked, errors: relationVocabErrors } = checkRelationVocabDrift(content, canonicalRelationVerbs)
      relationVocabCandidatesChecked += checked
      for (const message of relationVocabErrors) error(file, message)
    }
    if (relationVocabCandidatesChecked === 0) {
      error(schemasDir, 'Relation-vocabulary drift check found a non-empty canonical verb set but zero `## Relation Vocabulary` bullet candidates across every schemas/*.md file — the heading marker or bullet-extraction regex likely changed; refusing to pass vacuously')
    }
  }
}

// --- CLAUDE.md size guard ---
// Claude Code warns ("Large CLAUDE.md will impact performance") and degrades
// instruction adherence once CLAUDE.md passes ~40k characters loaded at session
// start. Fail CI 1k below that so a regression is caught here, not at the user's
// prompt. Deep, file-type-specific reference is kept off the always-loaded budget
// in path-scoped .claude/rules/*.md instead — see
// .claude/rules/scripts-and-validation.md. Measure with String.length (UTF-16
// code units == char count for the BMP glyphs used here), matching how Claude
// Code counts — not byte length, which would over-count multibyte UTF-8.
const CLAUDE_MD_CHAR_LIMIT = 39_000
const claudeMdPath = join(ROOT, 'CLAUDE.md')
if (existsSync(claudeMdPath)) {
  const claudeMd = await readFile(claudeMdPath, 'utf8')
  const chars = claudeMd.length
  if (chars >= CLAUDE_MD_CHAR_LIMIT) {
    error(claudeMdPath, `${chars} chars ≥ ${CLAUDE_MD_CHAR_LIMIT} limit — Claude Code warns past ~40k. Move bulk reference into path-scoped .claude/rules/*.md (loads on demand, off the session-start budget) rather than inlining it here.`)
  }
}

// --- Report ---

if (warnings.length > 0) {
  console.warn('Plugin validation warnings:\n')
  for (const { file, message } of warnings) {
    console.warn(`  ⚠ ${file}: ${message}`)
  }
  console.warn('')

  // Additive CI-visible surface: under GitHub Actions, also emit the
  // standard `::warning::` workflow-command annotation for each warning —
  // the runner parses this straight off stdout into a PR-visible check
  // annotation, no workflow-file change needed. Plain-console output above
  // is unchanged and still runs unconditionally (local/non-CI runs never
  // see this block). No line number is tracked at any warn() call site, so
  // every annotation uses the file-only form; add `,line=<N>` once a call
  // site starts tracking one. See scripts-and-validation.md.
  if (process.env.GITHUB_ACTIONS) {
    for (const { file, message } of warnings) {
      console.warn(`::warning file=${escapeWorkflowCommandValue(file, true)}::${escapeWorkflowCommandValue(message, false)}`)
    }
  }
}

if (errors.length > 0) {
  console.error('Plugin validation failed:\n')
  for (const e of errors) {
    console.error(`  - ${e}`)
  }
  console.error(`\n${errors.length} error(s) found.`)
  process.exit(1)
} else {
  console.log('Plugin validation passed.')
}
