import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import yaml from 'js-yaml'

import { collectScannableText } from './lib/mdast.mjs'
import { checkStalenessConsume, checkStalenessEmit } from './lib/staleness-contract.mjs'

const ROOT = new URL('.', import.meta.url).pathname.replace(/\/$/, '')

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
  if (!match) return
  try {
    const parsed = yaml.load(match[1])
    return typeof parsed === 'object' && parsed !== null
      ? /** @type {Record<string, unknown>} */ (parsed)
      : undefined
  } catch {}
}

const VALID_HOOK_TYPES = new Set(['prompt', 'command', 'agent', 'http'])

// Known Claude Code hook event names. A typo'd event key passes structural
// validation but silently never fires — warn() (not error()) because the upstream
// set grows; an unknown key is a strong typo signal, not proof of breakage.
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

const VALID_AGENT_COLORS = new Set(['blue', 'cyan', 'green', 'yellow', 'magenta', 'red'])

const VALID_AGENT_MODELS = new Set(['inherit', 'sonnet', 'opus', 'haiku'])

const VALID_AGENT_EFFORTS = new Set(['low', 'medium', 'high', 'max'])

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
  if (segments.length === 0 && /mcp__[\w-]+__[\w-]+/.test(body)) {
    error(file, `${fieldName}: no scannable prose but the body has mcp__ tokens — likely an unclosed code fence; fix the markdown`)
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
      const e = /** @type {Record<string, unknown>} */ (entry)
      for (const field of ['name', 'source', 'description']) {
        if (!(field in e)) error(marketplacePath, `Plugin entry "${String(e.name ?? '?')}" missing required field: ${field}`)
      }
    }
    // Version consistency: a local "./" entry must match plugin.json version.
    if (plugin !== undefined) {
      const pluginVersion = /** @type {Record<string, unknown>} */ (plugin).version
      for (const entry of entries) {
        const e = /** @type {Record<string, unknown>} */ (entry)
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
            const hk = /** @type {Record<string, unknown>} */ (hook)
            if (!VALID_HOOK_TYPES.has(hk.type)) {
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
  if ('effort' in fm && !VALID_AGENT_EFFORTS.has(fm.effort)) {
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
    if ('color' in fm && !VALID_AGENT_COLORS.has(fm.color)) {
      error(file, `Invalid agent color "${String(fm.color)}", must be one of: ${[...VALID_AGENT_COLORS].join(', ')}`)
    }
    if ('model' in fm && !VALID_AGENT_MODELS.has(fm.model)) {
      error(file, `Invalid agent model "${String(fm.model)}", must be one of: ${[...VALID_AGENT_MODELS].join(', ')}`)
    }
    if ('effort' in fm && !VALID_AGENT_EFFORTS.has(fm.effort)) {
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

const stalenessEmitFiles = [
  join(ROOT, 'agents', 'knowledge-gardener.md'),
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
  error(stalenessEmitFiles[0], 'Staleness contract check matched zero canonical bucket headings across emit files — the heading regex or fences likely changed; refusing to pass vacuously')
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
