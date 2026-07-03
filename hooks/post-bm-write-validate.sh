#!/bin/bash
set -euo pipefail

# PostToolUse hook for write_note|edit_note — emit additionalContext so the
# main Claude session calls schema_validate. We use type:"command" with
# additionalContext because type:"prompt" hooks spawn Haiku without MCP access
# (RETRO-02 and UPSTREAM-claude-code.md document this constraint).
#
# Also runs the note text just written through fourth-wall-check.mjs (the
# runtime consumer for lib/fourth-wall-rules.mjs's deterministic `detect`
# patterns) and folds any hits into the SAME additionalContext object — every
# hook in this repo emits exactly one JSON object, so this must never become
# a second jq -n call.

HOOK_DIR=$(dirname "${BASH_SOURCE[0]}")

INPUT=$(cat)

# Try tool_response first (per docs), fall back to tool_result for robustness
PERMALINK=$(echo "$INPUT" | jq -r '.tool_response.permalink // .tool_result.permalink // empty' 2>/dev/null || true)

if [[ -z "$PERMALINK" ]]; then
	# Try parsing tool_result as a JSON string (double-encoded)
	RAW=$(echo "$INPUT" | jq -r '.tool_response // .tool_result // empty' 2>/dev/null || true)
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

# The note text this call wrote: write_note's tool_input.content is the full
# note body; edit_note's tool_input.content is the fragment passed to that
# operation (append/find_replace/etc.) — either way it's the text this call
# just introduced, which is exactly what a write-time guard should scan.
NOTE_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty' 2>/dev/null || true)

FOURTH_WALL_JSON='{"violations":[]}'
if [[ -n "$NOTE_CONTENT" ]]; then
	FOURTH_WALL_JSON=$(printf '%s' "$NOTE_CONTENT" | node "$HOOK_DIR/fourth-wall-check.mjs" 2>/dev/null || true)
	if [[ -z "$FOURTH_WALL_JSON" ]]; then
		FOURTH_WALL_JSON='{"violations":[]}'
	fi
fi

FOURTH_WALL_MSG=$(echo "$FOURTH_WALL_JSON" | jq -r '
	if (.violations // []) | length > 0 then
		" Fourth-wall check flagged " + (.violations | length | tostring) + " potential violation(s): " +
		([.violations[] | ("[" + .id + "] " + .name + " (matched: \"" + .match + "\")")] | join("; ")) +
		". Review against the vp-note-quality checklist before finalizing."
	else
		""
	end
' 2>/dev/null || true)

jq -n --arg p "$PERMALINK" --arg fw "$FOURTH_WALL_MSG" \
	'{additionalContext: ("A note was just written/edited (permalink: " + $p + "). Call mcp__basic-memory__schema_validate with that identifier. If validation reports errors, surface them. If the note type has no schema or validation passes, do nothing." + $fw)}'
