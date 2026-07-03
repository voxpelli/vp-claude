import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import yaml from 'js-yaml'
import remarkFrontmatter from 'remark-frontmatter'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import { collectScannableText } from './lib/mdast.mjs'
import { checkStalenessConsume, checkStalenessEmit } from './lib/staleness-contract.mjs'

const ROOT = new URL('.', import.meta.url).pathname.replace(/\/$/, '')

/**
 * A plugin entry in marketplace.json — accessed across two loops (shape/required
 * fields, then version consistency). Fields are optional because the validator's
 * job is to flag when they're missing/wrong.
 *
 * @typedef {{ name?: unknown, source?: unknown, version?: unknown, description?: unknown }} MarketplaceEntry
 */

/**
 * A single hook handler inside a hooks.json event entry — type/timeout/command
 * interact across several branches below.
 *
 * @typedef {{ type?: unknown, timeout?: unknown, command?: unknown }} HookConfig
 */

/** @type {string[]} */
const errors = []
/** @type {string[]} */
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
  warnings.push(`${relative(ROOT, file)}: ${message}`)
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
    return typeof parsed === 'object' && parsed !== null
      ? /** @type {Record<string, unknown>} */ (parsed)
      : undefined
  } catch {}
}

/**
 * Generic membership guard: narrows `value` to the set's element type `T` in the
 * truthy branch, so a `!isMember(SET, x)` check leaves `x` widened to `T` on the
 * valid path. Lets the VALID_* sets double as runtime validators AND type narrowers.
 *
 * @template T
 * @param {ReadonlySet<T>} set
 * @param {unknown} value
 * @returns {value is T}
 */
const isMember = (set, value) => set.has(/** @type {T} */ (value))

/** @typedef {'prompt' | 'command' | 'agent' | 'http'} HookType */
/** @type {ReadonlySet<HookType>} */
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
/** @type {ReadonlySet<AgentColor>} */
const VALID_AGENT_COLORS = new Set(/** @type {const} */ (['blue', 'cyan', 'green', 'yellow', 'magenta', 'red']))

/** @typedef {'inherit' | 'sonnet' | 'opus' | 'haiku'} AgentModel */
/** @type {ReadonlySet<AgentModel>} */
const VALID_AGENT_MODELS = new Set(/** @type {const} */ (['inherit', 'sonnet', 'opus', 'haiku']))

/** @typedef {'low' | 'medium' | 'high' | 'max'} AgentEffort */
/** @type {ReadonlySet<AgentEffort>} */
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

// Smoke-test pattern for the unclosed-fence vacuous-pass guard below — mirrors
// the mcp__ token test but for bare built-in tool names.
const BARE_BUILTIN_TOOL_PATTERN = new RegExp('`(?:' + [...KNOWN_BUILTIN_TOOLS].join('|') + ')[`(]')

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
  const segments = collectScannableText(content)
  // Guard against a silent vacuous pass: an unclosed fence makes remark absorb the
  // rest of the file into one opaque `code` node, so collectScannableText returns []
  // even for a file full of tool refs (and remark --frail does NOT flag unclosed
  // fences). If the AST saw nothing but the raw bytes carry a tool token, fail loudly.
  // Test the frontmatter-STRIPPED body: a frontmatter-only mcp__ reference (in the
  // `allowed-tools` list) plus an all-fenced/empty body must not false-fire here.
  // NOTE: this only catches a fence opening BEFORE all prose (segments===0); the
  // realistic prose-then-unclosed-fence case needs a structural fence-balance check
  // (beaded) — a per-token "raw must be in segments" cross-check is infeasible
  // because legitimate CLOSED fenced examples are also raw-but-not-collected.
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '')
  if (segments.length === 0 && (/mcp__[\w-]+__[\w-]+/.test(body) || BARE_BUILTIN_TOOL_PATTERN.test(body))) {
    error(file, `${fieldName}: no scannable prose but the body has mcp__ or built-in-tool tokens — likely an unclosed code fence; fix the markdown`)
    return
  }
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
    if (BUILTIN_MENTION_EXCEPTIONS.has(`${relFile}:${tool}`)) continue
    warn(file, `Built-in tool "${tool}" referenced in prose but missing from ${fieldName} — verify this is a real reference, not just a documentation mention`)
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

// --- plugin.json ---

const pluginPath = join(ROOT, '.claude-plugin', 'plugin.json')
const plugin = await readJson(pluginPath)
if (plugin !== undefined) {
  const p = /** @type {Record<string, unknown>} */ (plugin)
  for (const field of ['name', 'version', 'description']) {
    if (!(field in p)) {
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
    const m = /** @type {Record<string, unknown>} */ (marketplace)
    for (const field of ['name', 'owner', 'plugins']) {
      if (!(field in m)) error(marketplacePath, `Missing required field: ${field}`)
    }
    if ('plugins' in m && !Array.isArray(m.plugins)) {
      error(marketplacePath, '"plugins" must be an array')
    }
    const entries = Array.isArray(m.plugins) ? m.plugins : []
    for (const entry of entries) {
      const e = /** @type {MarketplaceEntry} */ (entry)
      for (const field of ['name', 'source', 'description']) {
        if (!(field in e)) error(marketplacePath, `Plugin entry "${String(e.name ?? '?')}" missing required field: ${field}`)
      }
    }
    // Version consistency: a local "./" entry must match plugin.json version.
    if (plugin !== undefined) {
      const pluginVersion = /** @type {Record<string, unknown>} */ (plugin).version
      for (const entry of entries) {
        const e = /** @type {MarketplaceEntry} */ (entry)
        if (e.source === './' && e.version !== pluginVersion) {
          error(
            marketplacePath,
            `Local "./" entry version "${String(e.version)}" does not match plugin.json version "${String(pluginVersion)}"`
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
    const h = /** @type {Record<string, unknown>} */ (hooksData)
    if (!h.hooks || typeof h.hooks !== 'object') {
      error(hooksPath, 'Missing top-level "hooks" object')
    } else {
      // eslint-disable-next-line prefer-destructuring -- a type-cast assignment reads clearer than destructuring + a separate cast
      const hooks = /** @type {Record<string, unknown>} */ (h.hooks)
      for (const [event, entries] of Object.entries(hooks)) {
        if (!VALID_HOOK_EVENTS.has(event)) {
          warn(hooksPath, `Unknown hook event "${event}" — typo? A hook under an unrecognized event silently never fires. Known events: ${[...VALID_HOOK_EVENTS].join(', ')}`)
        }
        if (!Array.isArray(entries)) {
          error(hooksPath, `hooks.${event} must be an array`)
          continue
        }
        for (const entry of entries) {
          const e = /** @type {Record<string, unknown>} */ (entry)
          if (typeof e.matcher !== 'string') {
            error(hooksPath, `hooks.${event}: entry missing "matcher" (string)`)
          }
          if (!Array.isArray(e.hooks)) {
            error(hooksPath, `hooks.${event}: entry missing "hooks" (array)`)
            continue
          }
          for (const hook of e.hooks) {
            const hk = /** @type {HookConfig} */ (hook)
            if (!isMember(VALID_HOOK_TYPES, hk.type)) {
              error(hooksPath, `hooks.${event}: hook type must be one of ${[...VALID_HOOK_TYPES].join(', ')}, got "${String(hk.type)}"`)
            }
            if (hk.type === 'prompt') {
              warn(hooksPath, `hooks.${event}: type "prompt" hooks spawn Haiku without MCP access — consider "command" with additionalContext instead (see RETRO-02)`)
            }
            if (typeof hk.timeout !== 'number') {
              error(hooksPath, `hooks.${event}: hook missing "timeout" (number)`)
            }
            // Validate command hook paths
            if (hk.type === 'command' && typeof hk.command === 'string') {
              // eslint-disable-next-line no-template-curly-in-string -- literal placeholder text being substituted, not a template literal
              const resolved = hk.command.replaceAll('${CLAUDE_PLUGIN_ROOT}', ROOT)
              // Extract the file path from the command (after "bash " or similar)
              const parts = resolved.split(/\s+/)
              const scriptPath = parts.find((p) => p.startsWith('/') || p.startsWith('./'))
              if (scriptPath && !existsSync(scriptPath)) {
                error(hooksPath, `hooks.${event}: referenced file does not exist: ${hk.command}`)
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
  // tail (e.g. flag mechanics) is at risk. Threshold sits above the current
  // legitimately-detailed descriptions (tool-intel, the longest, is ~1.1k); the
  // exact CC truncation limit is unconfirmed (bd vp-claude — tune down if found lower).
  if (typeof fm.description === 'string' && fm.description.length > 1400) {
    warn(file, `description is ${fm.description.length} chars — Claude Code may truncate it for routing; move capability detail into the body`)
  }
  if ('allowed-tools' in fm && !Array.isArray(fm['allowed-tools'])) {
    error(file, 'allowed-tools must be an array')
  }
  if ('user-invocable' in fm && typeof fm['user-invocable'] !== 'boolean') {
    error(file, `user-invocable must be a boolean, got ${typeof fm['user-invocable']}`)
  }
  if ('argument-hint' in fm && typeof fm['argument-hint'] !== 'string') {
    error(file, `argument-hint must be a string, got ${typeof fm['argument-hint']}`)
  }
  if ('paths' in fm && !Array.isArray(fm.paths)) {
    error(file, 'paths must be an array of glob strings')
  }
  if ('effort' in fm && !isMember(VALID_AGENT_EFFORTS, fm.effort)) {
    error(file, `Invalid skill effort "${String(fm.effort)}", must be one of: ${[...VALID_AGENT_EFFORTS].join(', ')}`)
  }
  if ('maxTurns' in fm && (typeof fm.maxTurns !== 'number' || fm.maxTurns < 1)) {
    error(file, `maxTurns must be a positive integer, got ${String(fm.maxTurns)}`)
  }
  if ('context' in fm && fm.context !== 'fork') {
    error(file, `context must be "fork" if present, got "${String(fm.context)}"`)
  }
  if (Array.isArray(fm['allowed-tools'])) {
    validateMcpPrefixes(file, /** @type {string[]} */ (fm['allowed-tools']))
    auditToolReferences(file, content, /** @type {string[]} */ (fm['allowed-tools']), 'allowed-tools')
  }
  // Validate Agent(subagent_type="X") references resolve to an actual agent file.
  // Skills that delegate to a subagent (e.g. /knowledge-garden) silently no-op
  // at runtime if the agent name is a typo or was renamed — mirror the agent→skill
  // phantom-reference check for the skill→agent direction.
  for (const match of content.matchAll(/subagent_type\s*=\s*["']([\w-]+)["']/g)) {
    const agentName = match[1]
    if (!existsSync(join(ROOT, 'agents', `${agentName}.md`))) {
      error(file, `Phantom subagent reference: "${agentName}" — no file at agents/${agentName}.md`)
    }
  }
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
    if ('tools' in fm && !Array.isArray(fm.tools)) {
      error(file, 'tools must be an array')
    }
    if (Array.isArray(fm.tools)) {
      validateMcpPrefixes(file, /** @type {string[]} */ (fm.tools))
      auditToolReferences(file, content, /** @type {string[]} */ (fm.tools), 'tools')
    }
    if ('color' in fm && !isMember(VALID_AGENT_COLORS, fm.color)) {
      error(file, `Invalid agent color "${String(fm.color)}", must be one of: ${[...VALID_AGENT_COLORS].join(', ')}`)
    }
    if ('model' in fm && !isMember(VALID_AGENT_MODELS, fm.model)) {
      error(file, `Invalid agent model "${String(fm.model)}", must be one of: ${[...VALID_AGENT_MODELS].join(', ')}`)
    }
    if ('effort' in fm && !isMember(VALID_AGENT_EFFORTS, fm.effort)) {
      error(file, `Invalid agent effort "${String(fm.effort)}", must be one of: ${[...VALID_AGENT_EFFORTS].join(', ')}`)
    }
    if ('skills' in fm && !Array.isArray(fm.skills)) {
      error(file, 'skills must be an array')
    }

    // Gardener read-only invariant
    if (file.endsWith('knowledge-gardener.md') && Array.isArray(fm.tools)) {
      const forbidden = ['write_note', 'edit_note', 'delete_note']
      for (const tool of /** @type {string[]} */ (fm.tools)) {
        if (forbidden.some((f) => tool.includes(f))) {
          error(file, `Read-only agent must not have write tool: ${tool}`)
        }
      }
    }

    // Validate agent skills references resolve to actual skill files
    if ('skills' in fm && Array.isArray(fm.skills)) {
      for (const skillName of /** @type {string[]} */ (fm.skills)) {
        const skillPath = join(ROOT, 'skills', skillName, 'SKILL.md')
        if (!existsSync(skillPath)) {
          error(file, `Phantom skill reference: "${skillName}" — no file at skills/${skillName}/SKILL.md`)
        }
      }
    }
  }
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
  for (const w of warnings) {
    console.warn(`  ⚠ ${w}`)
  }
  console.warn('')
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
