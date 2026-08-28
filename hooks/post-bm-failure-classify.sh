#!/bin/bash
set -euo pipefail

# PostToolUseFailure hook for Basic Memory tools — classify the failure and
# emit additionalContext with recovery guidance (converted from prompt hook;
# see RETRO-02 for why prompt hooks can't classify failures reliably).

INPUT=$(cat)

# Error text may live in different fields depending on the failure type
ERROR=$(echo "$INPUT" | jq -r '.error // .tool_error // empty' 2>/dev/null || true)

if [[ -z "$ERROR" ]]; then
	exit 0
fi

# Heuristic pattern matching against BM error messages. If BM changes error
# text formatting, these patterns may need adjustment.
#
# THE PATTERNS AND THE BRANCH ORDER MUST MATCH `classifyBmError` in
# extensions/index.js — same policy, once per host, and `check:host-parity`
# compares them over a corpus of 27 error strings. They used to agree on 10:
# this side had no `unauthorized` and no `ETIMEDOUT`, that side was
# case-sensitive, had no `connection refused` or `unavailable` arm at all, and
# checked its branches in a different order. The category NAMES differ by
# design (this host's taxonomy predates the other's) and the check maps them.
if echo "$ERROR" | grep -qi "connection refused\|timeout\|unavailable\|ECONNREFUSED\|ETIMEDOUT"; then
	MSG="[server-unavailable] Basic Memory MCP server is not responding. Check that it is running and retry."
elif echo "$ERROR" | grep -qi "not found\|does not exist\|no note\|no such"; then
	MSG="[note-not-found] Note identifier was not found. Use write_note to create it, or check the identifier spelling with search_notes."
elif echo "$ERROR" | grep -qi "invalid\|missing.*field\|malformed\|validation *error\|schema validation\|too long\|too short"; then
	MSG="[invalid-argument] A required field is missing or malformed. Check the identifier format and required frontmatter fields."
elif echo "$ERROR" | grep -qi "permission\|denied\|unauthorized\|forbidden"; then
	MSG="[permission-error] Access was denied. Check Basic Memory MCP server configuration."
elif echo "$ERROR" | grep -qi "already exists\|duplicate\|conflict"; then
	MSG="[note-conflict] A note with this identifier already exists. Read the existing note first, then decide whether to update it or use a different name."
else
	MSG="[unknown-error] Basic Memory tool failed: ${ERROR:0:200}"
fi

jq -n --arg msg "$MSG" \
	'{additionalContext: ($msg + " Do not retry automatically.")}'
