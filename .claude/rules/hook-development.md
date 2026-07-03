---
paths:
  - "hooks/**"
---

# Hook development rules

Loads when editing anything under `hooks/`. The root `CLAUDE.md` keeps only a
one-line index of the five hooks; the full detail and the hook-authoring
conventions live here.

## Hook inventory (full detail)

- **PostToolUse** (`write_note`/`edit_note` matcher) — Command hook that emits `additionalContext` instructing the main session to call `schema_validate` on the written note. Skips schema definition notes (`/schema/` permalinks). Also runs `hooks/fourth-wall-check.mjs` against the note's content (`tool_input.content`) — a Node entrypoint calling `detectFourthWallViolations` (`lib/fourth-wall-rules.mjs`) — and folds any hits into the *same* `additionalContext` JSON object (never a second object). Schema-permalink notes stay silently exempt from this too. Always degrades to no violations on empty/malformed input or an internal error — never blocks the write, never a non-zero exit.
- **PostToolUse** (`Edit`/`Write` matcher) — Detects shell-script formatting drift via `shfmt -d`, emits the diff in `additionalContext`, then auto-fixes with `shfmt -w`. Reminds to sync BM when editing schema files.
- **PostToolUseFailure** (`write_note`/`edit_note`/`schema_validate`/`schema_diff`/`schema_infer` matcher) — Command hook that pattern-matches BM write-tool errors into five categories (server-unavailable, note-not-found, invalid-argument, permission-error, unknown) and emits `additionalContext` with recovery guidance.
- **SessionStart** (`session-start.sh`, matcher `""`) — Emits a single `additionalContext` JSON object with knowledge graph guidance, skill suggestions (`/knowledge-prime`, `/knowledge-ask`, `/knowledge-gaps`, `/schema-evolve`, and the explicit-only `/knowledge-garden`/`/knowledge-maintain`), and conditional graph-audit cycle reminders on every 4th sprint. It reads `source` from stdin and, on `source=compact`, appends a condensed graph-recovery block (the graph guidance can fall out of the window when context is summarized). This recovery payload was migrated here from a former `PostCompact` hook: `PreCompact`/`PostCompact` `additionalContext` never reaches the resumed, tool-capable agent (Claude Code docs — those events are observability-only / fire pre-compaction), so `SessionStart` `source=compact` is the only slot that injects post-compaction context. Adopted from vp-beads' v0.17.0 migration (bd `vp-claude-1oah`); the bead's SessionStart security-signal half was intentionally dropped — vp-knowledge has no Dependabot-style alert analog. On non-compact sources it also invokes `tip-fragment.sh` (a **separate** script, called via command substitution as `$(dirname "${BASH_SOURCE[0]}")/tip-fragment.sh "$source"` — `${CLAUDE_PLUGIN_ROOT}` substitutes only inside `hooks.json`'s own command string, not inside a script body) to surface one learning-nudge tip per day from `~/.claude/references/claude-code-nudge-tips.txt` (synced by the `/nudge-sync` skill). Every failure mode inside it — missing/empty tips file, exhausted ring buffer, `awk` unavailable — degrades to empty output, never an error; throttle + anti-repeat state lives in one merged file at `$HOME/.local/state/vp-knowledge/nudge-state` (path overridable via `VP_KNOWLEDGE_STATE_DIR` for tests), and `VP_KNOWLEDGE_DISABLE_NUDGE=1` is a global kill-switch checked first.
- **PreToolUse** (`Bash` matcher) — Blocks Python and Node.js script execution inside the knowledge-gardener agent via `permissionDecision: "deny"`, enforcing read-only discipline. Main session and other agents are unaffected.

## Hook conventions

Hooks use `${CLAUDE_PLUGIN_ROOT}` for portable paths. All hooks are `type: "command"` and emit `additionalContext` from a JSON object on stdout — `type: "prompt"` hooks spawn Haiku without MCP access, so they cannot call MCP tools (RETRO-02). All hooks are defined in `hooks/hooks.json`. Hook scripts assume CWD = project root (consistent with vp-beads convention). Each hook must emit exactly one JSON object on stdout — Claude Code reads only the first object and silently drops the rest. `${CLAUDE_PLUGIN_ROOT}` is Claude-side string substitution, not a shell env var — it works in `hooks.json` command fields, skill `SKILL.md` content, `.mcp.json`, `.lsp.json`, and `plugin.json`, but **does NOT work in agent `.md` files** (agents see the literal string). For script paths inside agents, use CWD or a path relative to project root.

## Hook additionalContext pattern

SessionStart `additionalContext` should suggest existing skills (e.g., "suggest running `/knowledge-prime`") rather than duplicating skill workflow steps inline. Keeps hooks lightweight (~1 sentence) and avoids drift between hook instructions and skill definitions.

## See also

- Hooks are integration-tested by `check-hooks.mjs` (one JSON object per hook) → `scripts-and-validation.md`.
