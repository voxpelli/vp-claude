/**
 * Port agent frontmatter from Claude Code format to the pi-subagents superset
 * format. Reads a canonical `agents/<name>.md` and emits the pi-targeted
 * frontmatter block (the body is ported by hand — see the note
 * `claude-code-pi-agent-file-interop`).
 *
 * Mechanical mapping (the part that IS automatable):
 *   - `mcp__<server>__<tool>` → `mcp` (the pi-mcp-adapter proxy; the only
 *     reliable name across directTools configs — per-server directTools
 *     subsets vary, the proxy is always present)
 *   - `Bash` → `bash`, `Read` → `read`, `Grep` → `grep`, `Edit` → `edit`,
 *     `Write` → `write`, `Glob` → `find, ls` (pi has no Glob)
 *   - `Skill` → dropped (pi loads skills via `read`, not a Skill tool)
 *   - `Agent(...)` / `Task(...)` → dropped (orchestration, not a pi tool)
 *   - `skills`, `color`, `effort`, `permissionMode`, `mcpServers`, `hooks`,
 *     `memory`, `background`, `isolation`, `initialPrompt` → dropped
 *     (pi-subagents loaders read only name/description/tools/model/thinkingLevel)
 *   - `model: inherit` → omitted (breaks pi; falls back to default with a warning)
 *   - adds `thinking: high` + `thinkingLevel: high` + `max_turns: 20`
 *     (the superset fields for the three pi-subagents flavors)
 *
 * Usage: `node scripts/port-agent-frontmatter.mjs <agents/name.md>`
 * Prints the pi frontmatter block to stdout.
 */

import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

/** @type {Record<string, string[]>} */
const TOOL_MAP = {
  Bash: ['bash'],
  Read: ['read'],
  Grep: ['grep'],
  Edit: ['edit'],
  Write: ['write'],
  Glob: ['find', 'ls'],
  Skill: [],
  Agent: [],
  Task: [],
  WebFetch: [],
  WebSearch: [],
  TodoWrite: [],
  NotebookEdit: [],
  PowerShell: [],
  ToolSearch: [],
  EnterPlanMode: [],
  ExitPlanMode: [],
  AskUserQuestion: [],
  EndConversation: [],
  ScheduleWakeup: [],
  TaskOutput: [],
  WaitForMcpServers: [],
  Workflow: [],
  EnterWorktree: [],
  ExitWorktree: [],
  Monitor: [],
  TaskStop: [],
  SendMessage: [],
  Artifact: [],
  ListAgents: [],
  TaskCreate: [],
  TaskGet: [],
  TaskList: [],
  TaskUpdate: [],
  CronCreate: [],
  CronDelete: [],
  CronList: [],
}

/**
 * Map a single CC tool entry to pi tool names.
 *
 * @param {string} tool
 * @returns {string[]}
 */
function mapTool (tool) {
  const trimmed = tool.trim()
  if (trimmed.startsWith('mcp__')) return ['mcp']
  const base = trimmed.split('(')[0]?.trim() ?? ''
  return TOOL_MAP[base] ?? []
}

/**
 * Parse the frontmatter block from a markdown file.
 *
 * @param {string} content
 * @returns {{ frontmatter: Record<string, unknown>, body: string } | null}
 */
export function parseFrontmatter (content) {
  if (!content.startsWith('---')) return null
  const end = content.indexOf('\n---', 3)
  if (end === -1) return null
  const block = content.slice(4, end)
  const body = content.slice(end + 4).trim()
  /** @type {Record<string, unknown>} */
  const frontmatter = {}
  let currentKey = null
  /** @type {string[]} */
  let currentList = []
  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (currentKey !== null && /^-\s+/.test(trimmed)) {
      currentList.push(trimmed.replace(/^-\s+/, '').trim())
      continue
    }
    if (currentKey !== null) {
      frontmatter[currentKey] = currentList
      currentKey = null
      currentList = []
    }
    // `(?:\s(.*))?` not `(.*)`: the bare `tools:` case needs the colon to be
    // optionally-final, but accepting ANY colon-then-non-space also matched a
    // wrapped line like `https://example.com` as key `https`, which would flush
    // a pending list and truncate it. Narrower fixes the bug without that.
    const m = /^([\w-]+):(?:\s(.*))?$/.exec(trimmed)
    if (m) {
      const key = m[1] ?? ''
      const value = (m[2] ?? '').trim()
      if (value === '') {
        currentKey = key
        currentList = []
      } else {
        frontmatter[key] = value
      }
    }
  }
  if (currentKey !== null) frontmatter[currentKey] = currentList
  return { frontmatter, body }
}

/**
 * Build the pi-subagents superset frontmatter from a parsed CC frontmatter.
 *
 * @param {Record<string, unknown>} fm
 * @returns {string}
 */
export function buildPiFrontmatter (fm) {
  const name = typeof fm.name === 'string' ? fm.name : ''
  const description = typeof fm.description === 'string' ? fm.description : ''

  /** @type {string[]} */
  const tools = []
  const rawTools = fm.tools
  if (Array.isArray(rawTools)) {
    for (const t of rawTools) {
      if (typeof t !== 'string') continue
      for (const mapped of mapTool(t)) {
        if (!tools.includes(mapped)) tools.push(mapped)
      }
    }
  } else if (typeof rawTools === 'string') {
    for (const t of rawTools.split(',')) {
      for (const mapped of mapTool(t)) {
        if (!tools.includes(mapped)) tools.push(mapped)
      }
    }
  }

  const lines = ['---', `name: ${name}`, `description: ${description}`]
  if (tools.length > 0) lines.push(`tools: ${tools.join(', ')}`)
  // model is deliberately OMITTED: the pi agents always run with the current
  // session model (switchable via Ctrl+P / /scoped-models), never a pinned one.
  // `model: inherit` would break pi (falls back to default with a warning), and
  // a concrete string (e.g. sonnet) pins the agent against the user's live
  // model selection.
  lines.push('thinking: high', 'thinkingLevel: high', 'max_turns: 20', '---')
  return lines.join('\n')
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function portAgentFrontmatter (filePath) {
  const content = readFileSync(filePath, 'utf8')
  const parsed = parseFrontmatter(content)
  if (!parsed) throw new Error(`No frontmatter in ${filePath}`)
  return buildPiFrontmatter(parsed.frontmatter)
}

// CLI entry
// `import.meta.url` percent-encodes; `process.argv[1]` does not, so the naive
// `file://${argv[1]}` comparison is false for any path containing a space —
// and this file would then exit 0 having run nothing. For check:agent-parity
// that is a green gate that performed no comparison.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: node scripts/port-agent-frontmatter.mjs <agents/name.md>')
    process.exit(1)
  }
  console.log(portAgentFrontmatter(filePath))
}
