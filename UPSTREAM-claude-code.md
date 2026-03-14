## Feature Requests

_No entries yet._

## Bugs

- **Prompt hooks can't call MCP tools** (2026-03-14) [degraded] — Prompt hooks (`type: "prompt"`) spawn a separate Haiku instance with no MCP tool access. Any prompt hook that references MCP tools (e.g., `mcp__basic-memory__edit_note`) is silently non-functional — it runs without error but can't execute the tools. This isn't documented in the hook type reference; the workaround is to use `type: "command"` with `additionalContext` to inject instructions into the main session which retains full MCP access. Cost us 10 versions of silent PreCompact failure (v0.1.0–v0.10.1).
