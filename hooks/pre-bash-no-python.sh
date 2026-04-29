#!/bin/bash
set -euo pipefail

# PreToolUse hook — blocks Python/Node.js script execution in Bash tool calls
# ONLY inside the knowledge-gardener agent. The main session and all other
# agents are unaffected (agent_type is absent outside subagents).

INPUT=$(cat)

# Only enforce inside the knowledge-gardener agent — exit silently for
# main session (no agent_type) and all other agents.
AGENT=$(echo "$INPUT" | jq -r '.agent_type // empty' 2>/dev/null || true)
if [[ "$AGENT" != "knowledge-gardener" ]]; then
	exit 0
fi

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

if [[ -z "$CMD" ]]; then
	exit 0
fi

# Block commands that invoke Python or Node.js anywhere in the pipeline.
# Matches: python3, python3.12, /usr/bin/python3, env python3, bash -c "python3",
# echo ... | python3, cmd ; python3, cmd && python3
# Does NOT match: node_modules, nodemon (anchored to avoid false positives)
if echo "$CMD" | grep -qiE '(^|[/; |&"'"'"'])python[0-9.]*($|[; |&"'"'"' ])|(^|[/; |&"'"'"'])node($|[; |&"'"'"' ])'; then
	jq -n '{
    "hookSpecificOutput": {
      "permissionDecision": "deny",
      "reason": "Python/Node scripts are blocked in knowledge-gardener to preserve read-only discipline. Use jq via Bash for JSON processing, or use MCP tool calls directly."
    }
  }'
fi
