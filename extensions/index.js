import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { getValueOfKeyWithType } from '@voxpelli/typed-utils'

import { loadConfig } from './config.js'
import { flattenMcpToolName, VP_KNOWLEDGE_SKILL_NAMES } from './mcp-mapping.js'
import { registerUpdateAgentsCommand } from './update-agents-command.js'
import {
  findAgentsSourceDir, formatSyncErrors, getAgentsDir, syncAgentProfiles,
} from './agent-sync.js'

/** @typedef {import('@earendil-works/pi-coding-agent').ExtensionAPI} ExtensionAPI */
/** @typedef {import('@earendil-works/pi-coding-agent').ExtensionContext} ExtensionContext */

/** @typedef {{ id: string, name: string, match: string }} FourthWallViolation */

/* ── Constants ─────────────────────────────────────────────────────────── */

const FOURTH_WALL_MODULE = 'fourth-wall-rules.mjs'

/**
 * Module-local latch for startup maintenance (agent sync). Pi fires
 * `session_start` for every session including programmatic spawns, but
 * agent sync targets the global `~/.pi/agent/agents/` dir whose source
 * can't change mid-process — re-running just recomputes identical hashes.
 * `/vpk-sync` and `/reload` are the explicit re-sync paths.
 */
let startupMaintenanceDone = false

/** Test reset — wired into test setup. */
export function __resetStartupMaintenance () {
  startupMaintenanceDone = false
}

/**
 * Resolve the extension's install directory at runtime.
 *
 * @returns {string}
 */
function resolveExtensionDir () {
  return dirname(fileURLToPath(import.meta.url))
}

/**
 * Find the fourth-wall rules module.
 *
 * Single-root hybrid: the extension lives at the repo-root `extensions/`, so
 * the shared `lib/` is always the sibling `../lib` — both in local dev and in
 * a `pi install git:` whole-tree clone. (Previously probed a second grandparent
 * path for the old pi-package build layout, now dissolved.)
 *
 * @returns {string | undefined}
 */
function findFourthWallModule () {
  /** @type {string | undefined} */
  let extDir
  try {
    extDir = resolveExtensionDir()
  } catch {
    return
  }
  const modulePath = join(extDir, '..', 'lib', FOURTH_WALL_MODULE)
  // eslint-disable-next-line n/no-sync
  return existsSync(modulePath) ? modulePath : undefined
}

/* ── Exported helpers (testable) ───────────────────────────────────────── */

/**
 * @param {Array<{ name: string }> | undefined} skills
 * @returns {boolean}
 */
export function hasVpKnowledgeSkill (skills = []) {
  return skills.some((s) => VP_KNOWLEDGE_SKILL_NAMES.has(s.name))
}

/**
 * @returns {string}
 */
export function buildMappingGuidance () {
  // The directTools examples are computed through flattenMcpToolName so that
  // documented output can never drift from the rule the model is told to apply.
  const directExamples = [
    'mcp__basic-memory__write_note',
    'mcp__socket-mcp__depscore',
  ]

  return [
    '## MCP Tool Names (Pi Compatibility)',
    '',
    'The skills you are using reference MCP tools with Claude-style names (`mcp__<server>__<tool>`).',
    'Pi has no native MCP; a shim such as pi-mcp-adapter exposes them. On the shim\'s DEFAULT config',
    '(`directTools:false`) there are NO flattened tool names — every MCP tool is reachable ONLY through a',
    'single `mcp` proxy tool. This is the primary path. Call it as:',
    '',
    '    mcp({ server: "<server>", tool: "<tool>", args: "<JSON string of the params>" })',
    '',
    '- `server` is the key from the user\'s `~/.pi/agent/mcp.json`, NOT the Claude `mcp__` prefix. For a',
    '  Claude name `mcp__<server>__<tool>` the `<server>` segment is usually the mcp.json key verbatim',
    '  (e.g. `basic-memory`, `socket-mcp`). EXCEPTION: context7 is `mcp__plugin_context7_context7__…` in',
    '  Claude but is conventionally keyed `context7` in mcp.json — use `context7`, not the prefixed form.',
    '- `tool` is the segment after the server, unchanged (hyphens preserved, e.g. `resolve-library-id`).',
    '- `args` is a JSON STRING — stringify the parameter object the skill shows; do not pass a raw object.',
    '',
    'Examples (Claude name → proxy call):',
    '- `mcp__basic-memory__write_note` → `mcp({ server: "basic-memory", tool: "write_note", args: "{…}" })`',
    '- `mcp__plugin_context7_context7__resolve-library-id` → `mcp({ server: "context7", tool: "resolve-library-id", args: "{…}" })`',
    '',
    'If the host sets `directTools:true`, each tool ALSO appears as a flattened direct name (drop `mcp__`,',
    'server hyphens→`_`, tool unchanged) callable with the plain parameter object:',
    ...directExamples.map((claudeName) => `- \`${claudeName}\` → \`${flattenMcpToolName(claudeName)}\``),
    'Only call a flat name if it is actually in your available tool list; otherwise use the `mcp` proxy above.',
  ].join('\n')
}

/**
 * @returns {string}
 */
export function buildGraphGuidance () {
  const lines = [
    'Knowledge graph context: Use `basic_memory_list_directory(dir_name="/", depth=1)` and `basic_memory_recent_activity(timeframe="7d")` early in the session if the task involves the knowledge graph or packages.',
    'The /package-intel and /knowledge-gaps skills are available for multi-ecosystem package research (npm, Rust crates, Go modules, PHP Composer, Python PyPI, Ruby gems). Use prefixed invocations: /package-intel crate:serde, /package-intel pypi:requests, /package-intel go:github.com/gin-gonic/gin, /package-intel composer:vendor/pkg, /package-intel gem:rails. No prefix defaults to npm.',
    'The /tool-intel skill researches developer environment and CI/CD tooling: brew:<name> (Homebrew formulae), cask:<name> (Homebrew casks), action:<owner>/<repo> (GitHub Actions), docker:<image> (Docker images), vscode:<publisher>.<ext> (VSCode extensions), gh:<owner>/<repo> (GitHub CLI extensions), plugin:<owner>/<repo> (Claude Code plugins), skill:<owner>/<repo> (skills.sh agent-skill bundles).',
    'Use /knowledge-gaps to audit both package and tool manifest coverage. Use /schema-evolve <type> to detect schema drift, propose frequency-driven field changes, and dual-sync BM notes with local schema files.',
    'At session start, if the task involves understanding project dependencies, tools, or the knowledge graph, suggest running /knowledge-prime to load a context brief with documented packages, coverage gaps, and key gotchas. For topic-specific questions about a package, tool, or concept already in the graph, suggest /knowledge-ask. For comprehensive gap analysis, suggest /knowledge-gaps. For scoped note health, /knowledge-garden audits one or more named notes and /knowledge-maintain applies fixes inline — both are explicit /commands.',
  ]
  return lines.join('\n\n')
}

/**
 * @param {string} cwd
 * @returns {string}
 */
export function buildAuditReminder (cwd) {
  try {
    // eslint-disable-next-line n/no-sync
    const count = readdirSync(cwd, { withFileTypes: true })
      .filter((e) => e.isFile() && /^RETRO-.*\.md$/.test(e.name)).length
    // Audit every 4th sprint: sprint N is an audit sprint iff N % 4 === 0.
    // `count` = completed sprints (RETRO files), so the sprint about to start is
    // `upcoming`. Fire the do-it-now message when the upcoming sprint IS an audit
    // sprint, and a heads-up when the one after it is. (The prior code fired the
    // do-it-now on the sprint AFTER an audit — an off-by-one.)
    const upcoming = count + 1
    if (upcoming % 4 === 0) {
      return `Graph-audit sprint: Sprint ${upcoming} is a graph-audit sprint — run knowledge-gardener (audit) then knowledge-maintainer (fix) alongside /retrospective for full graph health: schema validation, stale-note detection, drift detection, and orphan check.`
    }
    if ((upcoming + 1) % 4 === 0) {
      return `Graph-audit reminder: Sprint ${upcoming + 1} will be a graph-audit sprint. When running /retrospective next time, run the knowledge-gardener agent (read-only audit) then knowledge-maintainer (auto-fix) for full graph health: schema validation, stale-note detection, drift check, and orphan audit.`
    }
  } catch {
    // ignore — no audit reminder if counting fails
  }
  return ''
}

/**
 * Classify a Basic Memory error message into a recovery category.
 *
 * @param {string} errorText
 * @returns {string}
 */
export function classifyBmError (errorText) {
  if (errorText.includes('schema validation failed') || errorText.includes('ValidationError')) {
    return 'schema-violation'
  }
  if (errorText.includes('tool not found') || errorText.includes('unknown tool') || errorText.includes('does not exist') || errorText.includes('No such file')) {
    return 'missing-target'
  }
  if (errorText.includes('already exists') || errorText.includes('duplicate') || errorText.includes('conflict')) {
    return 'conflict'
  }
  if (errorText.includes('permission') || errorText.includes('denied') || errorText.includes('unauthorized')) {
    return 'permission'
  }
  if (errorText.includes('timeout') || errorText.includes('ETIMEDOUT') || errorText.includes('ECONNREFUSED')) {
    return 'transient'
  }
  return 'unknown'
}

/** @type {Record<string, string>} */
const RECOVERY_MESSAGES = {
  'schema-violation': 'Fix the note structure to match the schema, then retry. Use schema_validate to preview errors.',
  'missing-target': 'The note or directory may have been moved/deleted. Search for it or create it fresh.',
  'tool-missing': 'The tool name may be incorrect. Verify the direct tool name in the MCP mapping table and retry.',
  conflict: 'A note with this identifier already exists. Read the existing note first, then decide whether to update or use a different name.',
  permission: 'Check file permissions in ~/basic-memory or the MCP server config. You may need to restart the basic-memory MCP server.',
  'transient': 'The MCP server may be restarting or overloaded. Wait a moment and retry the same call.',
  unknown: 'Review the error message and retry. If it persists, consider restarting the basic-memory MCP server.',
}

/**
 * Basic Memory tools whose write-time output gets quality checks (fourth-wall +
 * schema_validate reminder), and the broader set whose errors get recovery
 * classification. Bare tool names (no server prefix) so they match across all
 * three call shapes that normalizeBmToolCall collapses.
 */
const BM_WRITE_TOOLS = new Set(['write_note', 'edit_note'])
const BM_TOOLS = new Set([
  'write_note', 'edit_note', 'schema_validate', 'schema_diff', 'schema_infer',
  'read_note', 'search_notes', 'recent_activity', 'list_directory', 'build_context',
])

/**
 * Parse a JSON string into a plain object, or `{}` for anything that is not a
 * JSON object (malformed, array, primitive, null). Used for the proxy path,
 * where the params arrive as a JSON string.
 *
 * @param {string} raw
 * @returns {Record<string, unknown>}
 */
function parseJsonObject (raw) {
  try {
    /** @type {unknown} */
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return /** @type {Record<string, unknown>} */ (parsed)
    }
  } catch { /* malformed args — treat as no params */ }
  return {}
}

/**
 * Normalize a tool_result event to the Basic Memory tool it represents plus that
 * tool's input params, across the three shapes a BM call arrives as on Pi:
 *   - flat direct name (`directTools:true`): toolName `basic_memory_write_note`, params = event.input
 *   - Claude-style verbatim (some shims):    toolName `mcp__basic-memory__write_note`, params = event.input
 *   - `mcp` proxy (default pi-mcp-adapter):  toolName `mcp`; real tool in event.input.tool,
 *                                            params in the JSON-STRING event.input.args
 * Returns `{ tool, params }` with a bare BM tool name, or null when not a BM
 * call. The `basic_memory_` / `mcp__basic-memory__` prefixes are flattenMcpToolName's
 * output / the Claude form for the fixed `basic-memory` server.
 *
 * @param {{ toolName?: string, input?: unknown }} event
 * @returns {{ tool: string, params: Record<string, unknown> } | null}
 */
export function normalizeBmToolCall (event) {
  const toolName = event.toolName ?? ''

  // Proxy path: toolName is the literal 'mcp'; the real call is inside input.
  if (toolName === 'mcp') {
    const server = getValueOfKeyWithType(event.input, 'server', 'string')
    const tool = getValueOfKeyWithType(event.input, 'tool', 'string')
    if (server !== 'basic-memory' || !tool) return null
    const rawArgs = getValueOfKeyWithType(event.input, 'args', 'string') ?? ''
    return { tool, params: parseJsonObject(rawArgs) }
  }

  // Direct paths: flat name or Claude-style verbatim.
  /** @type {string | null} */
  let bare = null
  if (toolName.startsWith('basic_memory_')) {
    bare = toolName.slice('basic_memory_'.length)
  } else if (toolName.startsWith('mcp__basic-memory__')) {
    bare = toolName.slice('mcp__basic-memory__'.length)
  }
  if (!bare) return null
  const params = (typeof event.input === 'object' && event.input !== null)
    ? /** @type {Record<string, unknown>} */ (event.input)
    : {}
  return { tool: bare, params }
}

/* ── Extension Factory ─────────────────────────────────────────────────── */

/**
 * @param {ExtensionAPI} pi
 * @returns {void}
 */
export default function vpKnowledgePiExtension (pi) {
  /* ── before_agent_start: inject mapping guidance ─────────────────────── */

  pi.on('before_agent_start', async (event, _ctx) => {
    const skills = event.systemPromptOptions?.skills
    if (!hasVpKnowledgeSkill(skills)) return

    const guidance = buildMappingGuidance()
    return {
      systemPrompt: (event.systemPrompt ?? '') + '\n\n' + guidance,
    }
  })

  /* ── session_start: graph guidance + agent profiles ─────────────────── */

  pi.on('session_start', async (event, ctx) => {
    const projectRoot = ctx.cwd
    const config = loadConfig()

    // Startup maintenance runs once per process load — see startupMaintenanceDone doc
    if (event.reason === 'startup' && !startupMaintenanceDone) {
      startupMaintenanceDone = true
      if (config.agents.autoSync) {
        const sourceDir = findAgentsSourceDir()
        if (sourceDir) {
          try {
            const result = syncAgentProfiles(sourceDir, getAgentsDir())
            // Errors get an UNCONDITIONAL sink: syncAgentProfiles never throws
            // (it collects mkdir/copy/read failures into result.errors), so a
            // headless session with no ctx.ui must not drop them silently.
            if (result.errors.length > 0) {
              process.stderr.write(`[vp-knowledge] agent sync: ${formatSyncErrors(result)} — edit agents/, not the installed copies\n`)
            }
            if (ctx.hasUI) {
              if (result.added.length > 0) {
                ctx.ui.notify(`Copied ${result.added.length} agent profile(s) to ~/.pi/agent/agents/`, 'info')
              }
              if (result.updated.length > 0) {
                ctx.ui.notify(`Updated ${result.updated.length} agent profile(s)`, 'info')
              }
              if (result.errors.length > 0) {
                ctx.ui.notify(`Agent sync: ${formatSyncErrors(result)}`, 'warning')
              }
            }
          } catch (err) {
            // best-effort, but not silent: surface the failure without crashing the session
            process.stderr.write(`[vp-knowledge] agent sync skipped: ${err instanceof Error ? err.message : String(err)}\n`)
          }
        }
      }
    }

    // Build guidance messages
    /** @type {string[]} */
    const parts = [buildGraphGuidance()]

    if (config.guidance.auditReminders) {
      const auditReminder = buildAuditReminder(projectRoot)
      if (auditReminder) {
        parts.push(auditReminder)
      }
    }

    // On reload, append recovery note
    if (event.reason === 'reload') {
      parts.push(
        'Session reloaded: the Basic Memory knowledge graph is still available. If the ongoing task touches packages, tools, or the graph, recall context with `basic_memory_recent_activity(timeframe="7d")` or `/knowledge-prime`, and answer topic questions with `/knowledge-ask`. Research skills remain available — /package-intel (npm/crate/go/composer/pypi/gem), /tool-intel (brew/cask/action/docker/vscode/gh/plugin/skill), /knowledge-gaps (coverage; --stale drift; --global installed plugin/skill coverage). Schema edits dual-sync to schemas/*.md; never edit ~/basic-memory files directly — always use the basic_memory_* tools.'
      )
    }

    const message = parts.join('\n\n')
    if (message.trim()) {
      pi.sendMessage(
        {
          customType: 'vp-knowledge-context',
          content: message,
          display: false,
        },
        { triggerTurn: false, deliverAs: 'nextTurn' }
      )
    }
  })

  /* ── session_compact: post-compaction recovery ─────────────────────────── */

  pi.on('session_compact', async (_event, _ctx) => {
    try {
      pi.sendMessage(
        {
          customType: 'vp-knowledge-context',
          content: 'Post-compaction recovery: the Basic Memory knowledge graph is still available. If the ongoing task touches packages, tools, or the graph, recall context with `basic_memory_recent_activity(timeframe="7d")` or `/knowledge-prime`, and answer topic questions with `/knowledge-ask`. Research skills remain available — /package-intel (npm/crate/go/composer/pypi/gem), /tool-intel (brew/cask/action/docker/vscode/gh/plugin/skill), /knowledge-gaps (coverage; --stale drift; --global installed plugin/skill coverage). Schema edits dual-sync to schemas/*.md; never edit ~/basic-memory files directly — always use the basic_memory_* tools.',
          display: false,
        },
        { triggerTurn: false, deliverAs: 'nextTurn' }
      )
    } catch (err) {
      // Auto-compaction races session disposal: pi-core may invalidate the
      // extension runner while session_compact is still emitting, so `pi`
      // becomes a stale proxy. Bail silently — the replacement session's
      // session_start re-runs all guidance injection anyway.
      if (err instanceof Error && /stale after session replacement/.test(err.message)) return
      throw err
    }
  })

  /* ── session_tree: branch navigation ─────────────────────────────────── */

  pi.on('session_tree', async (_event, _ctx) => {
    // Branch navigation occurred. State reconstruction happens here if needed.
    // Currently no-op: all state is file-based (config) or rebuilt per-event.
  })

  /* ── session_shutdown: idempotent cleanup ────────────────────────────── */

  pi.on('session_shutdown', async (_event, _ctx) => {
    // Reserved for future session-scoped cleanup.
    // startupMaintenanceDone is NOT reset here — module re-evaluation on /reload
    // handles that naturally, and other session reasons (new/resume/fork) don't
    // trigger the startup sync path anyway.
  })

  /* ── tool_result: consolidated handler ─────────────────────────────────── */

  pi.on('tool_result', async (event, ctx) => {
    // Respect user cancellation (Escape pressed during turn)
    if (ctx.signal?.aborted) return

    // Normalize across the direct-name, Claude-verbatim, and `mcp` proxy shapes
    // so these checks fire on the DEFAULT Pi config, where every BM call arrives
    // as toolName 'mcp' — they were previously dead on that path.
    const bm = normalizeBmToolCall(event)
    if (!bm) return

    const config = loadConfig()

    // ── Branch 1: BM write quality checks ───────────────────────────────
    if (BM_WRITE_TOOLS.has(bm.tool)) {
      /** @type {{ content?: Array<{ type: 'text', text: string }> }} */
      const patches = {}

      // `content` is an input param: from the parsed JSON args on the proxy path,
      // from event.input on the direct paths — normalizeBmToolCall unifies both.
      const noteContent = typeof bm.params.content === 'string' ? bm.params.content : ''
      if (noteContent && config.qualityChecks.fourthWall) {
        try {
          const modPath = findFourthWallModule()
          if (modPath) {
            const mod = /** @type {{ detectFourthWallViolations: (content: string) => Array<{ id: string, name: string, match: string }> }} */ (await import(pathToFileURL(modPath).href))
            /** @type {FourthWallViolation[]} */
            const violations = mod.detectFourthWallViolations(noteContent)
            if (violations.length > 0) {
              const text = `Fourth-wall check flagged ${violations.length} potential violation(s): ${violations.map((v) => `[${v.id}] ${v.name} (matched: "${v.match}")`).join('; ')}. Review against the vp-note-quality checklist before finalizing.`
              patches.content = [{ type: 'text', text }]
            }
          }
        } catch (err) {
          // advisory, but not silent: surface the failure without blocking the write
          process.stderr.write(`[vp-knowledge] fourth-wall check skipped: ${err instanceof Error ? err.message : String(err)}\n`)
        }
      }

      // schema_validate reminder (skip schema definition notes). permalink is a
      // RESULT field (event.details); on the proxy path the host may not surface
      // it, in which case the reminder simply does not fire — the fourth-wall
      // check above still runs from the input content.
      const permalink = getValueOfKeyWithType(event.details, 'permalink', 'string') ?? ''
      if (permalink && config.qualityChecks.schemaValidate && !permalink.includes('/schema/')) {
        const text = `A note was just written/edited (permalink: ${permalink}). Call basic_memory_schema_validate with that identifier. If validation reports errors, surface them. If the note type has no schema or validation passes, do nothing.`
        if (patches.content) {
          patches.content.push({ type: 'text', text })
        } else {
          patches.content = [{ type: 'text', text }]
        }
      }

      if (patches.content) {
        return patches
      }
    }

    // ── Branch 2: BM error classification (incl. the read family) ─────────
    if (BM_TOOLS.has(bm.tool) && event.isError && event.content) {
      const errorText = event.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n')

      let category = classifyBmError(errorText)

      // Override: if the error is about an unknown tool name itself, it's tool-missing
      if (errorText.includes('tool not found') || errorText.includes('unknown tool')) {
        category = 'tool-missing'
      }

      const text = `Basic Memory tool error (category: ${category}): ${RECOVERY_MESSAGES[category] ?? RECOVERY_MESSAGES.unknown}`
      return {
        content: [...event.content, { type: 'text', text }],
      }
    }
  })

  /* ── Commands ──────────────────────────────────────────────────────────── */

  registerUpdateAgentsCommand(pi)
}
