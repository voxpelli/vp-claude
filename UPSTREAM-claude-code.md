## Feature Requests

_No entries yet._

## Bugs

- **Prompt hooks can't call MCP tools** (2026-03-14) \[degraded\] — Prompt hooks (`type: "prompt"`) spawn a separate Haiku instance with no MCP tool access. Any prompt hook that references MCP tools (e.g., `mcp__basic-memory__edit_note`) is silently non-functional — it runs without error but can't execute the tools. This isn't documented in the hook type reference; the workaround is to use `type: "command"` with `additionalContext` to inject instructions into the main session which retains full MCP access. Cost us 10 versions of silent PreCompact failure (v0.1.0–v0.10.1).

- **Hook stdout reads only first JSON object** (2026-03-28) \[degraded\] — When a command hook script emits multiple JSON objects on stdout (e.g. separate `cat <<'EOF'` blocks for `systemMessage` and `additionalContext`), Claude Code parses only the first object and silently drops the rest. This is documented but non-obvious. Workaround: merge all output into a single JSON object using `jq -n`. Cost us silent loss of priming suggestion + audit reminder in session-start.sh since v0.15.0.

- **PostToolUseFailure shows misleading "hook stopped continuation" label** (2026-03-28) \[cosmetic\] — When a PostToolUseFailure prompt hook fires, the Claude Code framework wraps the output with a "hook stopped continuation" label in the TUI. This is misleading — the hook didn't stop anything, the tool itself failed before the hook ran. Cannot fix from plugin side. Tracked: claude-code#27886, #18427, #17088.
