# Running vp-knowledge on Pi

vp-knowledge is a single-root hybrid: the same `skills/` tree and the
`extensions/` factory serve Claude Code, the Pi coding agent, and skills.sh. This
doc covers the Pi side — installing the extension, wiring MCP, and the guidance it
injects. Claude's loader reads `.claude-plugin/` and ignores `package.json`
entirely, so nothing here affects the Claude install.

## Install

Pi reads the root `package.json` `pi` key (`{ "extensions": ["./extensions"],
"skills": ["./skills"] }`).

```sh
# The plugin itself (extension + the shared skills tree)
pi install <path-or-git-url-of-this-repo>

# MCP support — Pi ships no native MCP by design; a shim provides it.
pi install npm:pi-mcp-adapter
```

## Wire MCP (`~/.pi/agent/mcp.json`)

Configure the MCP servers the skills use (at minimum `basic-memory`). The server
KEY you choose is what the injected guidance and the proxy `server` argument
reference — see "What the extension injects" below.

```jsonc
{
  "mcpServers": {
    "basic-memory": { "command": "basic-memory", "args": ["mcp"] },
    // context7 is optional; the key here ("context7") is the proxy server name —
    // NOT Claude's "plugin_context7_context7". Adjust the command to your install.
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }
  }
}
```

### Recommended: `directTools: true`

`pi-mcp-adapter` defaults to `directTools: false`, which exposes every MCP tool
ONLY through a single `mcp` proxy tool. The skills still work — the injected
guidance leads with the proxy — but flattened direct-tool names (e.g.
`basic_memory_write_note`) do not exist in that mode. Setting `directTools: true`
additionally registers those direct names. After changing it, run `/mcp reconnect`
to warm the tool cache.

### Caveats

- **`toolPrefix`**: leave it at the default `"server"`. `toolPrefix: "short"` drops
  the server segment from flattened names, diverging from the mapping the injected
  guidance documents.
- **`socket-mcp`**: only `depscore` is used; no special configuration needed.

## What the extension injects

When a session has any vp-knowledge skill active, the extension injects MCP mapping
guidance: it leads with the `mcp` proxy call shape —
`mcp({ server, tool, args: "<JSON string>" })` (the DEFAULT, `directTools:false`
path) — and also documents the `directTools:true` flattened form (drop `mcp__`,
server hyphens→`_`, tool unchanged). On `session_start` it injects
knowledge-graph context. On Basic Memory writes it runs write-time quality checks
(fourth-wall + `schema_validate` reminders), whether the write arrived via the
proxy or a direct name.

## Verifying

Boot offline to load extensions + skills without a model call:

```sh
PI_OFFLINE=1 pi     # loads resources, then stops before the model call
```

`npm run check:pi-load` validates the skills tree against Pi's own loader and the
extension-factory import — offline, no running agent, CI-portable.

### Live MCP acceptance check (needs an API key)

The automated checks cannot exercise a real MCP round-trip. To confirm the Pi
story end to end, configure `basic-memory` in two variants and trigger a skill
that reaches it (e.g. `/knowledge-prime` or `/knowledge-ask`):

1. **Default (`directTools:false`)** — confirm BM is reached via
   `mcp({ tool: "read_note", … })` and that the write-time quality checks fire.
2. **`directTools:true` + `/mcp reconnect`** — confirm `basic_memory_read_note`
   appears as a direct tool.

A failure signature is `unknown tool`. Run `/nudge-sync` to confirm the nudge-pair
guidance works too (they call `mcp__basic-memory__read_note`).
