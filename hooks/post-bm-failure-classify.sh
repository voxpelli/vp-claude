#!/bin/bash
set -euo pipefail

# PostToolUseFailure hook for Basic Memory tools — classify the failure and
# emit additionalContext with recovery guidance (converted from prompt hook;
# see RETRO-02 for why prompt hooks can't classify failures reliably).

INPUT=$(cat)

# Error text may live in different fields depending on the failure type
ERROR=$(echo "$INPUT" | jq -r '.error // .tool_error // .tool_result // empty' 2>/dev/null || true)

if [[ -z "$ERROR" ]]; then
	exit 0
fi

if echo "$ERROR" | grep -qi "connection refused\|timeout\|unavailable\|ECONNREFUSED"; then
	MSG="[server-unavailable] Basic Memory MCP server is not responding. Check that it is running and retry."
elif echo "$ERROR" | grep -qi "not found\|does not exist\|no note\|no such"; then
	MSG="[note-not-found] Note identifier was not found. Use write_note to create it, or check the identifier spelling with search_notes."
elif echo "$ERROR" | grep -qi "invalid\|missing.*field\|malformed\|validation error\|too long\|too short"; then
	MSG="[invalid-argument] A required field is missing or malformed. Check the identifier format and required frontmatter fields."
elif echo "$ERROR" | grep -qi "permission\|denied\|forbidden"; then
	MSG="[permission-error] Access was denied. Check Basic Memory MCP server configuration."
else
	MSG="[unknown-error] Basic Memory tool failed: ${ERROR:0:200}"
fi

jq -n --arg msg "$MSG" \
	'{additionalContext: ($msg + " Do not retry automatically.")}'
