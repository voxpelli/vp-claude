# vp-knowledge-pi

Pi overlay for [vp-knowledge](https://github.com/voxpelli/vp-claude) — Basic Memory knowledge-graph skills, session hooks, and guidance injection.

## What This Is

This directory is a **Pi package** (npm workspace) for the `vp-knowledge` knowledge-graph toolkit. It lives inside the same repository so both platforms share a single source of truth:

- `../skills/` — skills, shared verbatim with Claude Code
- `../agents/` — agent profiles, shared verbatim
- `../schemas/` — Basic Memory schema definitions, shared verbatim
- `./extensions/` — Pi-specific event handlers (guidance injection, quality hooks)
- `./prompts/` — Pi-specific prompt templates

### npm Workspace

The repo is an npm workspace (root `package.json` declares `"workspaces": ["pi-package"]`). Install all dependencies from the root:

```bash
npm install
```

Publish the pi-package to npm via CI (release-please). `prepublishOnly` copies `../skills/` and `../agents/` into the tarball so npm installs are self-contained. Git installs resolve paths via the repo root.

## Install

### Prerequisites

1. **Pi coding agent** — `npm install -g @earendil-works/pi-coding-agent`
2. **pi-mcp-adapter** — `pi install npm:pi-mcp-adapter`
3. **Sub-agent support** (optional) — `pi install npm:@tintinweb/pi-subagents`

### Step 1: Enable direct MCP tools

Edit `~/.pi/agent/mcp.json` and add `"directTools": true` to each server you use with vp-knowledge:

```json
{
  "mcpServers": {
    "basic-memory": { "type": "stdio", "command": "basic-memory", "args": ["mcp"], "directTools": true },
    "deepwiki": { "type": "http", "url": "https://mcp.deepwiki.com/mcp", "directTools": true },
    "tavily": { "type": "http", "url": "...", "directTools": true },
    "raindrop": { "type": "http", "url": "...", "directTools": true },
    "readwise": { "type": "http", "url": "...", "directTools": true }
  }
}
```

Restart Pi after editing.

### Step 2: Install the package

```bash
pi install git:github.com/voxpelli/vp-claude
```

This loads the shared `../skills/`, `../agents/`, and `../schemas/` from the repo root, plus the Pi-specific extension in `./extensions/`.

### Step 3: Verify

In a Pi session:

```
/skill:package-intel npm:express
```

The skill should load and execute using direct MCP tools.

## How It Works

### Guidance-First Tool Mapping

Claude Code skills reference MCP tools with names like `mcp__basic-memory__write_note`. Pi-mcp-adapter exposes the same tools directly as `basic_memory_write_note`.

Instead of registering 20+ alias tools, this extension injects a **concise mapping table** into the system prompt when vp-knowledge skills are active. The model translates skill instructions to direct tool calls automatically.

If a specific tool proves unreliable via guidance alone, the extension can register up to 5 critical-path aliases as a fallback.

### Session Hooks

| Event | Behavior |
|---|---|
| `session_start` | Graph guidance + audit reminders. Agent profiles copied to `~/.pi/agent/agents/` if missing. |
| `session_compact` | Post-compaction recovery guidance. |
| `before_agent_start` | MCP name mapping guidance injected when vp-knowledge skills are active. |
| `tool_result` (BM write/edit) | Fourth-wall check + `schema_validate` reminder. |
| `tool_result` (BM error) | Five-category error classification + recovery guidance. |
| `tool_result` (file write/edit) | `shfmt` drift detect + schema-sync reminder. |

## Standalone Skills Install

The shared `skills/` directory follows the [Agent Skills standard](https://agentskills.io). Individual skills can be installed via [skills.sh](https://skills.sh):

```bash
npx skills add voxpelli/vp-claude@package-intel
```

For the full bundle, use the Pi package install above.

## Future: md-wiki-vec Integration

When [`@voxpelli/md-wiki-vec`](https://github.com/voxpelli/md-wiki-vec) is ready, add its MCP server to `~/.pi/agent/mcp.json`:

```json
{
  "md-wiki-vec": { "type": "stdio", "command": "mdwv-mcp", "directTools": true }
}
```

Its tools (`mdwv_search`, `mdwv_get_context`, etc.) appear automatically — no package rebuild needed.

## License

MIT. See [../LICENSE](../LICENSE).
