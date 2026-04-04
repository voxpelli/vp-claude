#!/bin/bash
set -euo pipefail

# PostToolUse hook for Edit|Write — auto-format shell scripts and remind
# about schema sync. Receives hook input JSON on stdin.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

if [[ -z "$FILE_PATH" ]]; then
	exit 0
fi

PLUGIN_ROOT="${1:-${CLAUDE_PLUGIN_ROOT:-}}"

# PLUGIN_ROOT is required for path matching — exit silently if unset
# (happens outside plugin runtime, e.g. direct script testing)
if [[ -z "$PLUGIN_ROOT" ]]; then
	exit 0
fi

# Auto-format shell scripts under hooks/
if [[ "$FILE_PATH" == "${PLUGIN_ROOT}/hooks/"*.sh ]] || [[ "$FILE_PATH" == "${PLUGIN_ROOT}/scripts/"*.sh ]]; then
	if command -v shfmt >/dev/null 2>&1; then
		shfmt -w "$FILE_PATH" 2>/dev/null || true
	fi
fi

# Remind to sync BM when editing schema files
if [[ "$FILE_PATH" == "${PLUGIN_ROOT}/schemas/"*.md ]]; then
	BASENAME=$(basename "$FILE_PATH" .md)
	# Remind to dual-sync schema changes (CLAUDE.md convention: schemas/ and BM must stay in sync)
	echo "{\"additionalContext\": \"Schema file edited: ${BASENAME}. Remember to also update the corresponding Basic Memory schema note via edit_note (identifier: main/schema/${BASENAME}), or use /schema-evolve for automated dual-sync.\"}"
fi
