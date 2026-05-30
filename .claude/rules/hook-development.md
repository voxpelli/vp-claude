---
paths:
  - "hooks/**"
---

# Hook development rules

Loads when editing anything under `hooks/`. The root `CLAUDE.md` keeps only a
one-line index of the five hooks; the full detail and the hook-authoring
conventions live here.

## Hook inventory (full detail)

- **PostToolUse** (`write_note`/`edit_note` matcher) — Command hook that emits `additionalContext` instructing the main session to call `schema_validate` on the written note. Skips schema definition notes (`/schema/` permalinks).
- **PostToolUse** (`Edit`/`Write` matcher) — Detects shell-script formatting drift via `shfmt -d`, emits the diff in `additionalContext`, then auto-fixes with `shfmt -w`. Reminds to sync BM when editing schema files.
- **PostToolUseFailure** (`write_note`/`edit_note`/`schema_validate`/`schema_diff`/`schema_infer` matcher) — Command hook that pattern-matches BM write-tool errors into five categories (server-unavailable, note-not-found, invalid-argument, permission-error, unknown) and emits `additionalContext` with recovery guidance.
- **SessionStart** — Emits a single `additionalContext` JSON object with knowledge graph guidance, skill suggestions (`/knowledge-prime`, `/knowledge-ask`, `/knowledge-gaps`, `/schema-evolve`, and the explicit-only `/knowledge-garden`/`/knowledge-maintain`), and conditional graph-audit cycle reminders on every 4th sprint.
- **PreToolUse** (`Bash` matcher) — Blocks Python and Node.js script execution inside the knowledge-gardener agent via `permissionDecision: "deny"`, enforcing read-only discipline. Main session and other agents are unaffected.

## Hook conventions

Hooks use `${CLAUDE_PLUGIN_ROOT}` for portable paths. All hooks are `type: "command"` and emit `additionalContext` from a JSON object on stdout — `type: "prompt"` hooks spawn Haiku without MCP access, so they cannot call MCP tools (RETRO-02). All hooks are defined in `hooks/hooks.json`. Hook scripts assume CWD = project root (consistent with vp-beads convention). Each hook must emit exactly one JSON object on stdout — Claude Code reads only the first object and silently drops the rest. `${CLAUDE_PLUGIN_ROOT}` is Claude-side string substitution, not a shell env var — it works in `hooks.json` command fields, skill `SKILL.md` content, `.mcp.json`, `.lsp.json`, and `plugin.json`, but **does NOT work in agent `.md` files** (agents see the literal string). For script paths inside agents, use CWD or a path relative to project root.

## Hook additionalContext pattern

SessionStart `additionalContext` should suggest existing skills (e.g., "suggest running `/knowledge-prime`") rather than duplicating skill workflow steps inline. Keeps hooks lightweight (~1 sentence) and avoids drift between hook instructions and skill definitions.

## See also

- Hooks are integration-tested by `check-hooks.mjs` (one JSON object per hook) → `scripts-and-validation.md`.
