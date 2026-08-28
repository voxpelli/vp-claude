/**
 * Port a canonical Claude Code agent to the pi-targeted set (agents-pi/).
 *
 * Generates the pi-subagents superset frontmatter (via port-agent-frontmatter)
 * and applies the mechanical body adaptations:
 *   - `Bash("…")` → `bash("…")` (pi's tool is lowercase)
 *   - `Glob(pattern="…")` → `find . -name "…"` (pi has no Glob)
 *   - `Read("./…")` → `read("./…")`, `Grep("…")` → `grep("…")`
 *   - `mcp__<server>__<tool>` → `<mcpjsonkey>_<tool>` (flattened direct name;
 *     the header note covers the mcp-proxy fallback for non-direct tools)
 *   - `Skill(skill: "…")` → `read the "…" skill` (pi loads skills via read)
 *   - `CLAUDE.md` → `AGENTS.md` (pi's project-context file)
 *   - `permissions.allow` / `settings.json` CC references → pi equivalents
 *
 * The body port is mechanical-only; per-agent judgment fixes are applied by
 * hand after this script runs (see the note `claude-code-pi-agent-file-interop`).
 *
 * Usage: `node scripts/port-agent-to-pi.mjs <agents/name.md>`
 * Writes `agents-pi/<name>.md`.
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { flattenMcpToolName, parseMcpToolName } from '../extensions/mcp-mapping.js'
import { portAgentFrontmatter } from './port-agent-frontmatter.mjs'

/**
 * Claude MCP server SEGMENT → the key a Pi host registers that server under.
 *
 * Only genuine aliases belong here — cases where the two names really differ.
 * Every other server passes through verbatim, because `pi-mcp-adapter` keeps
 * the server name unchanged (hyphens included) under its default `"server"`
 * prefix mode.
 *
 * This table used to map `basic-memory`→`basic_memory`, `socket-mcp`→`socket_mcp`
 * and `hyper-mcp`→`hyper_mcp`, hardcoding the disproven hyphen-to-underscore
 * rule as data, and it also listed a dozen identity entries naming one
 * machine's MCP roster. Both are gone: the rule lives in `flattenMcpToolName`
 * alone, and an identity entry was never anything but noise.
 *
 * @type {Record<string, string>}
 */
const MCP_SERVER_ALIASES = {
  plugin_context7_context7: 'context7',
  claude_ai_Context7: 'context7',
}

/**
 * Flatten a Claude MCP tool reference to the pi direct-tool name, applying any
 * genuine server alias first.
 *
 * The join itself is delegated to `flattenMcpToolName` rather than repeated
 * here. A second implementation is how this file came to carry the disproven
 * hyphen-to-underscore rule for a week after the first one was corrected.
 *
 * @param {string} claudeName
 * @returns {string}
 */
function flattenMcpName (claudeName) {
  const parsed = parseMcpToolName(claudeName)
  if (!parsed) return claudeName
  const server = MCP_SERVER_ALIASES[parsed.server] ?? parsed.server
  return flattenMcpToolName(`mcp__${server}__${parsed.tool}`) ?? claudeName
}

/**
 * Apply the mechanical body adaptations.
 *
 * @param {string} body
 * @returns {string}
 */
export function adaptBody (body) {
  let out = body

  // Tool-call syntax: Bash( → bash(, Read( → read(, Grep( → grep(, Edit( → edit(, Write( → write(
  out = out.replaceAll(/\bBash\(/g, 'bash(')
  out = out.replaceAll(/\bRead\(/g, 'read(')
  out = out.replaceAll(/\bGrep\(/g, 'grep(')
  out = out.replaceAll(/\bEdit\(/g, 'edit(')
  out = out.replaceAll(/\bWrite\(/g, 'write(')

  // Glob(pattern="X") → find . -name "X" (pi has no Glob tool)
  out = out.replaceAll(/Glob\(pattern="([^"]+)"\)/g, 'find . -name "$1"')

  // MCP tool references → flattened direct names
  out = out.replaceAll(/mcp__[\w-]+__[\w-]+/g, (m) => flattenMcpName(m))

  // Skill(skill: "X", …) → read the "X" skill (pi loads skills via read)
  out = out.replaceAll(/Skill\(skill:\s*"([^"]+)"[^)]*\)/g, 'read the "$1" skill')

  // CLAUDE.md → AGENTS.md (pi's project-context file)
  out = out.replaceAll('CLAUDE.md', 'AGENTS.md')

  // CC-specific permission references → pi equivalents
  out = out.replaceAll('permissions.allow', 'tool allowlists')
  out = out.replaceAll('.claude/settings.json', '~/.pi/agent/settings.json')

  return out
}

/**
 * The pi-compatibility header note prepended to each ported body.
 *
 * @returns {string}
 */
export function buildPiHeader () {
  return [
    '## Pi compatibility',
    '',
    'This agent runs under pi-subagents. Tool conventions differ from Claude Code:',
    '- MCP tools are called via the `mcp` proxy — `mcp({ server: "<mcp.json key>", tool: "<tool>", args: "<JSON string>" })`. Prefer it: it works on every host. A host that opts a server into `directTools` also exposes flattened direct names, but their exact spelling is host-specific — use one ONLY if it appears verbatim in your own tool list, never a name you derived. An unrecognised tool name is dropped silently, not refused.',
    '- The shell tool is lowercase `bash`; there is no `Glob` tool — use `find`/`ls` via `bash`.',
    '- Skills are loaded by reading their SKILL.md with `read`, not via a `Skill` tool.',
    '- Project context comes from `AGENTS.md` (pi) or `CLAUDE.md` (Claude Code) — read whichever exists.',
    '',
  ].join('\n')
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function portAgentToPi (filePath) {
  const content = readFileSync(filePath, 'utf8')
  const frontmatter = portAgentFrontmatter(filePath)
  const bodyStart = content.indexOf('\n---', 3)
  const body = bodyStart === -1 ? '' : content.slice(bodyStart + 4).trim()
  const adapted = adaptBody(body)
  // `portedFrom` = sha256 of the canonical BODY (not the whole file — the
  // frontmatter differs by design). The parity guard recomputes this hash and
  // fails when the canonical changed since the port. Unknown to pi-subagents
  // loaders (they read only name/description/tools/model/thinkingLevel).
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 16)
  // Insert `portedFrom` before the CLOSING `---` (the last delimiter of the
  // frontmatter block), not the opening one.
  const fmWithMarker = frontmatter.replace(/\n---$/, `\nportedFrom: ${hash}\n---`)
  return `${fmWithMarker}\n\n${buildPiHeader()}${adapted}\n`
}

// CLI entry
// `import.meta.url` percent-encodes; `process.argv[1]` does not, so the naive
// `file://${argv[1]}` comparison is false for any path containing a space —
// and this file would then exit 0 having run nothing. For check:agent-parity
// that is a green gate that performed no comparison.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: node scripts/port-agent-to-pi.mjs <agents/name.md>')
    process.exit(1)
  }
  const name = basename(filePath, '.md')
  const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'agents-pi')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `${name}.md`)
  writeFileSync(outPath, portAgentToPi(filePath))
  console.log(`Wrote ${outPath}`)
}
