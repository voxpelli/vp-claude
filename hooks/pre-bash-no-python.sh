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

# Block commands that invoke Python or Node.js anywhere in the pipeline.
# Matches: python3, python3.12, /usr/bin/python3, env python3, bash -c "python3",
# echo ... | python3, cmd ; python3, cmd && python3
if echo "$CMD" | grep -qiwE 'python[0-9.]*|node'; then
	jq -cn '{
    "decision": "block",
    "reason": "Python/Node scripts are blocked. Use jq via Bash for JSON processing, or reason about MCP results directly in context. Example: bm project info main --json | jq .statistics.isolated_entities"
  }'
fi
