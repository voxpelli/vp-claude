import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  copyFileSync, existsSync, mkdirSync, readdirSync,
} from 'node:fs'

import { getValueOfKeyWithType } from '@voxpelli/typed-utils'

import { MCP_MAPPINGS, VP_KNOWLEDGE_SKILL_NAMES } from './mcp-mapping.js'

/** @typedef {import('@earendil-works/pi-coding-agent').ExtensionAPI} ExtensionAPI */
/** @typedef {import('@earendil-works/pi-coding-agent').ExtensionContext} ExtensionContext */

/** @typedef {{ id: string, name: string, match: string }} FourthWallViolation */

/* ── Constants ─────────────────────────────────────────────────────────── */

const FOURTH_WALL_MODULE = 'fourth-wall-rules.mjs'

const AGENTS_DIR = join(homedir(), '.pi', 'agent', 'agents')

const AGENT_PROFILES = [
  'knowledge-gardener.md',
  'knowledge-maintainer.md',
  'knowledge-primer.md',
  'raindrop-gardener.md',
]

/**
 * Resolve the extension's install directory at runtime.
 * Used to locate bundled agents/ relative to this module.
 *
 * @returns {string}
 */
function resolveExtensionDir () {
  return dirname(fileURLToPath(import.meta.url))
}

/**
 * Find the agents source directory.
 * Tries sibling `agents/` (npm/local dev) then grandparent `agents/` (git clone).
 *
 * @returns {string | undefined}
 */
function findAgentsSourceDir () {
  /** @type {string | undefined} */
  let extDir
  try {
    extDir = resolveExtensionDir()
  } catch {
    return
  }
  const candidates = [
    join(extDir, '..', 'agents'),
    join(extDir, '..', '..', 'agents'),
  ]
  for (const dir of candidates) {
    // eslint-disable-next-line n/no-sync
    if (existsSync(dir)) return dir
  }
}

/**
 * Find the fourth-wall rules module.
 * Tries sibling `lib/` (npm) then grandparent `lib/` (git clone).
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
  const candidates = [
    join(extDir, '..', 'lib', FOURTH_WALL_MODULE),
    join(extDir, '..', '..', 'lib', FOURTH_WALL_MODULE),
  ]
  for (const p of candidates) {
    // eslint-disable-next-line n/no-sync
    if (existsSync(p)) return p
  }
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
  const lines = [
    '## MCP Tool Name Mapping (Pi Compatibility)',
    '',
    'The skills you are using reference MCP tools with Claude-style names (`mcp__<server>__<tool>`).',
    'On this Pi host, the same tools are available under their direct-tool names.',
    'When a skill instructs you to call an `mcp__*` tool, use the matching direct tool name below:',
    '',
    '| Skill reference | Pi direct tool |',
    '|---|---|',
  ]

  for (const m of MCP_MAPPINGS) {
    const desc = m.description ? ` (${m.description})` : ''
    lines.push(`| \`${m.claudeName}\` | \`${m.piName}\`${desc} |`)
  }

  lines.push('', 'Pass the same flat parameter object to the direct tool that the skill shows for the `mcp__*` form.', '', 'If a direct tool is unavailable, its MCP server may not have `directTools: true` configured.', '')

  return lines.join('\n')
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
    const count = readdirSync(cwd).filter((f) => /^RETRO-.*\.md$/.test(f)).length
    if (count > 0) {
      const mod = count % 4
      if (mod === 3) {
        return `Graph-audit reminder: Sprint ${count + 1} will be a graph-audit sprint. When running /retrospective next time, run the knowledge-gardener agent (read-only audit) then knowledge-maintainer (auto-fix) for full graph health: schema validation, stale-note detection, drift check, and orphan audit.`
      } else if (mod === 0) {
        return `Graph-audit sprint: Sprint ${count + 1} — run knowledge-gardener (audit) then knowledge-maintainer (fix) alongside /retrospective for full graph health: schema validation, stale-note detection, drift detection, and orphan check.`
      }
    }
  } catch {
    // ignore — no audit reminder if counting fails
  }
  return ''
}

/**
 * @returns {void}
 */
export function installAgentProfiles () {
  const sourceDir = findAgentsSourceDir()
  if (!sourceDir) return

  try {
    // eslint-disable-next-line n/no-sync
    if (!existsSync(AGENTS_DIR)) {
      // eslint-disable-next-line n/no-sync
      mkdirSync(AGENTS_DIR, { recursive: true })
    }
  } catch {
    return
  }
  for (const file of AGENT_PROFILES) {
    const src = join(sourceDir, file)
    const dest = join(AGENTS_DIR, file)
    // eslint-disable-next-line n/no-sync
    if (existsSync(src) && !existsSync(dest)) {
      try {
        // eslint-disable-next-line n/no-sync
        copyFileSync(src, dest)
      } catch {
        // silent — agent install is best-effort
      }
    }
  }
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

    // Install agent profiles only on fresh startup (not on compact/reload)
    if (event.reason === 'startup') {
      try {
        installAgentProfiles()
      } catch {
        // silent — agent profile install is best-effort; never abort
        // session_start guidance (graph guidance, audit reminders, recovery)
      }
    }

    // Build guidance messages
    /** @type {string[]} */
    const parts = [buildGraphGuidance()]

    const auditReminder = buildAuditReminder(projectRoot)
    if (auditReminder) {
      parts.push(auditReminder)
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
          display: true,
        },
        { triggerTurn: false, deliverAs: 'nextTurn' }
      )
    }
  })

  /* ── session_compact: post-compaction recovery ─────────────────────────── */

  pi.on('session_compact', async (_event, _ctx) => {
    pi.sendMessage(
      {
        customType: 'vp-knowledge-context',
        content: 'Post-compaction recovery: the Basic Memory knowledge graph is still available. If the ongoing task touches packages, tools, or the graph, recall context with `basic_memory_recent_activity(timeframe="7d")` or `/knowledge-prime`, and answer topic questions with `/knowledge-ask`. Research skills remain available — /package-intel (npm/crate/go/composer/pypi/gem), /tool-intel (brew/cask/action/docker/vscode/gh/plugin/skill), /knowledge-gaps (coverage; --stale drift; --global installed plugin/skill coverage). Schema edits dual-sync to schemas/*.md; never edit ~/basic-memory files directly — always use the basic_memory_* tools.',
        display: true,
      },
      { triggerTurn: false, deliverAs: 'nextTurn' }
    )
  })

  /* ── session_shutdown: idempotent cleanup ────────────────────────────── */

  pi.on('session_shutdown', async (_event, _ctx) => {
    // No long-lived resources to clean up yet.
    // Registered per pi docs recommendation for future-proofing.
  })

  /* ── tool_result: consolidated handler ─────────────────────────────────── */

  pi.on('tool_result', async (event, ctx) => {
    const { toolName } = event

    // ── Branch 1: BM write/edit + file edit quality checks ────────────────
    const isBmWrite =
      toolName === 'basic_memory_write_note' ||
      toolName === 'basic_memory_edit_note' ||
      toolName === 'mcp__basic-memory__write_note' ||
      toolName === 'mcp__basic-memory__edit_note'

    const isFileEdit = toolName === 'edit' || toolName === 'write'

    if (isBmWrite || isFileEdit) {
      /** @type {{ content?: Array<{ type: 'text', text: string }> }} */
      const patches = {}

      // --- BM write: fourth-wall check + schema_validate reminder ---
      if (isBmWrite) {
        const noteContent = getValueOfKeyWithType(event.input, 'content', 'string') ?? ''
        if (noteContent) {
          try {
            const modPath = findFourthWallModule()
            if (modPath) {
              const { detectFourthWallViolations } = await import(modPath)
              /** @type {FourthWallViolation[]} */
              const violations = detectFourthWallViolations(noteContent)
              if (violations.length > 0) {
                const text = `Fourth-wall check flagged ${violations.length} potential violation(s): ${violations.map((v) => `[${v.id}] ${v.name} (matched: "${v.match}")`).join('; ')}. Review against the vp-note-quality checklist before finalizing.`
                patches.content = [{ type: 'text', text }]
              }
            }
          } catch {
            // silent fail — fourth-wall check is advisory
          }
        }

        // schema_validate reminder
        const permalink = getValueOfKeyWithType(event.details, 'permalink', 'string') ?? ''
        if (permalink) {
          const text = `A note was just written/edited (permalink: ${permalink}). Call basic_memory_schema_validate with that identifier. If validation reports errors, surface them. If the note type has no schema or validation passes, do nothing.`
          if (patches.content) {
            patches.content.push({ type: 'text', text })
          } else {
            patches.content = [{ type: 'text', text }]
          }
        }
      }

      // --- File edit: shfmt drift detect + schema-sync reminder ---
      if (isFileEdit) {
        const path = getValueOfKeyWithType(event.input, 'path', 'string') ?? ''
        if (path.endsWith('.sh')) {
          try {
            // eslint-disable-next-line n/no-sync
            execFileSync('shfmt', ['-d', path], { cwd: ctx.cwd, timeout: 5000 })
          } catch {
            const text = `shfmt reports formatting drift in ${path}. Run \`shfmt -w "${path}"\` to fix.`
            if (patches.content) {
              patches.content.push({ type: 'text', text })
            } else {
              patches.content = [{ type: 'text', text }]
            }
          }
        }

        // schema-sync reminder for schema files
        if (path.startsWith('schemas/') || path.includes('/schemas/')) {
          const text = `Schema file edited: ${path}. Remember to dual-sync — edit the corresponding BM schema note (basic_memory_edit_note) and the local schema file in the same session. /schema-evolve <type> automates this.`
          if (patches.content) {
            patches.content.push({ type: 'text', text })
          } else {
            patches.content = [{ type: 'text', text }]
          }
        }
      }

      if (patches.content) {
        return patches
      }
    }

    // ── Branch 2: BM error classification ─────────────────────────────────
    const isBmTool =
      toolName === 'basic_memory_write_note' ||
      toolName === 'basic_memory_edit_note' ||
      toolName === 'basic_memory_schema_validate' ||
      toolName === 'basic_memory_schema_diff' ||
      toolName === 'basic_memory_schema_infer' ||
      toolName === 'mcp__basic-memory__write_note' ||
      toolName === 'mcp__basic-memory__edit_note' ||
      toolName === 'mcp__basic-memory__schema_validate' ||
      toolName === 'mcp__basic-memory__schema_diff' ||
      toolName === 'mcp__basic-memory__schema_infer'

    if (isBmTool && event.isError && event.content) {
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
}
