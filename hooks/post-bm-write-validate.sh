#!/bin/bash
set -euo pipefail

# PostToolUse hook for write_note|edit_note — emit additionalContext so the
# main Claude session calls schema_validate (prompt hooks can't call MCP tools;
# see RETRO-02 and UPSTREAM-claude-code.md for the PreCompact precedent).

INPUT=$(cat)

# tool_result may be an object with a permalink field, or a JSON-encoded string
PERMALINK=$(echo "$INPUT" | jq -r '.tool_result.permalink // empty' 2>/dev/null || true)

if [[ -z "$PERMALINK" ]]; then
	# Try parsing tool_result as a JSON string (double-encoded)
	RAW=$(echo "$INPUT" | jq -r '.tool_result // empty' 2>/dev/null || true)
	if [[ -n "$RAW" ]]; then
		PERMALINK=$(echo "$RAW" | jq -r '.permalink // empty' 2>/dev/null || true)
	fi
fi

# No permalink — nothing to validate
if [[ -z "$PERMALINK" ]]; then
	exit 0
fi

# Schema definition notes don't validate against themselves
if [[ "$PERMALINK" == */schema/* ]]; then
	exit 0
fi

cat <<EOF
{"additionalContext": "A note was just written/edited (permalink: ${PERMALINK}). Call mcp__basic-memory__schema_validate with that identifier. If validation reports errors, surface them. If the note type has no schema or validation passes, do nothing."}
EOF
