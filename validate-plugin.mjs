import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'

import yaml from 'js-yaml'

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
    return undefined
  }
}

/**
 * @param {string} content
 * @returns {Record<string, unknown> | undefined}
 */
function extractFrontmatter (content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return undefined
  try {
    const parsed = yaml.load(match[1])
    return typeof parsed === 'object' && parsed !== null
      ? /** @type {Record<string, unknown>} */ (parsed)
      : undefined
  } catch {
    return undefined
  }
}

const VALID_HOOK_TYPES = new Set(['prompt', 'command', 'agent', 'http'])

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
 * @param {string} file
 * @param {string} content
 * @param {string[]} declaredTools
 * @param {string} fieldName
 */
function auditToolReferences (file, content, declaredTools, fieldName) {
  // Strip YAML frontmatter to avoid matching the allowlist itself
  const prose = content.replace(/^---\n[\s\S]*?\n---/, '')
  const toolSet = new Set(declaredTools)
  // Match mcp__<server>__<tool> patterns in prose
  const refs = prose.matchAll(/mcp__[a-zA-Z0-9_-]+__[a-zA-Z0-9_-]+/g)
  const seen = new Set()
  for (const match of refs) {
    const tool = match[0]
    if (!seen.has(tool) && !toolSet.has(tool)) {
      seen.add(tool)
      error(file, `Tool "${tool}" referenced in prose but missing from ${fieldName}`)
    }
  }
}

/**
 * @param {unknown} hooksData
 * @returns {Array<{event: string, matcher: string, hookTypes: string[]}>}
 */
function hookSignature (hooksData) {
  if (!hooksData || typeof hooksData !== 'object' || !('hooks' in hooksData)) return []
  const hooks = /** @type {Record<string, unknown>} */ (/** @type {Record<string, unknown>} */ (hooksData).hooks)
  return Object.entries(hooks).flatMap(([event, entries]) => {
    if (!Array.isArray(entries)) return []
    return entries.map((entry) => {
      const e = /** @type {Record<string, unknown>} */ (entry)
      const hookTypes = Array.isArray(e.hooks)
        ? e.hooks.map((hook) => String(/** @type {Record<string, unknown>} */ (hook).type ?? ''))
        : []
      return {
        event,
        matcher: String(e.matcher ?? ''),
        hookTypes,
      }
    })
  })
}

/**
 * @param {string} filePath
 * @param {Record<string, unknown>} hooksObj
 */
function validateHooksObject (filePath, hooksObj) {
  if (!hooksObj.hooks || typeof hooksObj.hooks !== 'object') {
    error(filePath, 'Missing top-level "hooks" object')
    return
  }
  const hooks = /** @type {Record<string, unknown>} */ (hooksObj.hooks)
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) {
      error(filePath, `hooks.${event} must be an array`)
      continue
    }
    for (const entry of entries) {
      const e = /** @type {Record<string, unknown>} */ (entry)
      if (typeof e.matcher !== 'string') {
        error(filePath, `hooks.${event}: entry missing "matcher" (string)`)
      }
      if (!Array.isArray(e.hooks)) {
        error(filePath, `hooks.${event}: entry missing "hooks" (array)`)
        continue
      }
      for (const hook of e.hooks) {
        const hk = /** @type {Record<string, unknown>} */ (hook)
        if (!VALID_HOOK_TYPES.has(hk.type)) {
          error(filePath, `hooks.${event}: hook type must be one of ${[...VALID_HOOK_TYPES].join(', ')}, got "${String(hk.type)}"`)
        }
        if (hk.type === 'prompt') {
          warn(filePath, `hooks.${event}: type "prompt" hooks spawn Haiku without MCP access — consider "command" with additionalContext instead (see RETRO-02)`)
        }
        if (typeof hk.timeout !== 'number') {
          error(filePath, `hooks.${event}: hook missing "timeout" (number)`)
        }
        if (hk.type === 'command' && typeof hk.command === 'string') {
          const resolved = hk.command
            .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, ROOT)
            .replace(/\$\{PLUGIN_ROOT\}/g, ROOT)
          const parts = resolved.split(/\s+/)
          const scriptPath = parts.find((p) => p.startsWith('/') || p.startsWith('./'))
          if (scriptPath && !existsSync(scriptPath)) {
            error(filePath, `hooks.${event}: referenced file does not exist: ${hk.command}`)
          }
        }
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
  if ('hooks' in p && typeof p.hooks !== 'string' && typeof p.hooks !== 'object') {
    error(pluginPath, `hooks must be a string path or inline object, got ${typeof p.hooks}`)
  }
  if (typeof p.hooks === 'string') {
    const resolvedHooksPath = join(ROOT, p.hooks)
    if (!existsSync(resolvedHooksPath)) {
      error(pluginPath, `hooks path does not exist: ${String(p.hooks)}`)
    }
  }
}

// --- marketplace.json (optional) ---

const marketplacePath = join(ROOT, '.claude-plugin', 'marketplace.json')
if (existsSync(marketplacePath)) {
  const marketplace = await readJson(marketplacePath)

  // Version consistency: local ./ entry must match plugin.json version
  if (marketplace !== undefined && plugin !== undefined) {
    const m = /** @type {Record<string, unknown>} */ (marketplace)
    const pluginVersion = /** @type {Record<string, unknown>} */ (plugin).version
    const entries = Array.isArray(m.plugins) ? m.plugins : []
    for (const entry of entries) {
      const e = /** @type {Record<string, unknown>} */ (entry)
      if (e.source === './') {
        if (e.version !== pluginVersion) {
          error(
            marketplacePath,
            `Local "./" entry version "${String(e.version)}" does not match plugin.json version "${String(pluginVersion)}"`,
          )
        }
      }
    }
  }
}

// --- hooks.json (optional) ---

const hooksPath = join(ROOT, 'hooks', 'hooks.json')
const rootHooksPath = join(ROOT, 'hooks.json')
const hooksData = existsSync(hooksPath) ? await readJson(hooksPath) : undefined
const rootHooksData = existsSync(rootHooksPath) ? await readJson(rootHooksPath) : undefined

if (hooksData !== undefined) {
  validateHooksObject(hooksPath, /** @type {Record<string, unknown>} */ (hooksData))
}
if (rootHooksData !== undefined) {
  validateHooksObject(rootHooksPath, /** @type {Record<string, unknown>} */ (rootHooksData))
}

if (hooksData !== undefined && rootHooksData === undefined) {
  warn(rootHooksPath, 'Missing root hooks.json compatibility shim — Copilot installs may skip helper-script hooks under hooks/')
}

if (hooksData !== undefined && rootHooksData !== undefined) {
  const nestedSignature = JSON.stringify(hookSignature(hooksData))
  const rootSignature = JSON.stringify(hookSignature(rootHooksData))
  if (nestedSignature !== rootSignature) {
    error(rootHooksPath, 'Root hooks.json and hooks/hooks.json differ in event/matcher/type coverage — keep the compatibility shim aligned')
  }
}

// --- Skills ---

const skillFiles = (await readdir(join(ROOT, 'skills'), { recursive: true }))
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
  'license',
  'compatibility',
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
  if ('allowed-tools' in fm && !Array.isArray(fm['allowed-tools'])) {
    error(file, 'allowed-tools must be an array')
  }
  if ('user-invocable' in fm && typeof fm['user-invocable'] !== 'boolean') {
    error(file, `user-invocable must be a boolean, got ${typeof fm['user-invocable']}`)
  }
  if ('argument-hint' in fm && typeof fm['argument-hint'] !== 'string') {
    error(file, `argument-hint must be a string, got ${typeof fm['argument-hint']}`)
  }
  if ('license' in fm && typeof fm.license !== 'string') {
    error(file, `license must be a string, got ${typeof fm.license}`)
  }
  if ('compatibility' in fm) {
    const compat = fm.compatibility
    if (typeof compat !== 'string' && !(Array.isArray(compat) && compat.length > 0 && compat.every((c) => typeof c === 'string'))) {
      error(file, 'compatibility must be a non-empty string or array of strings')
    }
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
  for (const match of content.matchAll(/subagent_type\s*=\s*["']([a-zA-Z0-9_-]+)["']/g)) {
    const agentName = match[1]
    if (!existsSync(join(ROOT, 'agents', `${agentName}.md`))) {
      error(file, `Phantom subagent reference: "${agentName}" — no file at agents/${agentName}.md`)
    }
  }
}

// --- Agents (optional) ---

const agentsDir = join(ROOT, 'agents')
if (existsSync(agentsDir)) {
  const agentFiles = (await readdir(agentsDir))
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
