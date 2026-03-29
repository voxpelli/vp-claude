#!/bin/bash
set -euo pipefail

# PreToolUse hook — blocks Python/Node.js script execution in Bash tool calls.
# The knowledge-gardener must use jq for JSON processing or reason about
# MCP results directly in context, not generate ad-hoc scripts.

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

if [[ -z "$CMD" ]]; then
	exit 0
fi

# Block commands that invoke Python or Node.js as the primary executable.
if echo "$CMD" | grep -qE '^\s*python[0-9.]*\s|^\s*node\s+-[ec]\s'; then
	jq -cn '{
    "decision": "block",
    "reason": "Python/Node scripts are blocked. Use jq via Bash for JSON processing, or reason about MCP results directly in context. Example: bm project info main --json | jq .statistics.isolated_entities"
  }'
fi
