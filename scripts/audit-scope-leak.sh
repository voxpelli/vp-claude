#!/bin/bash
set -euo pipefail

# Detect project-specific content leaked into cross-project BM knowledge base.
# Uses grep for regex patterns that BM's search_notes (FTS/semantic) cannot express.
# Output: NDJSON {"file","line","pattern","text"} — one object per finding.
# Usage: audit-scope-leak.sh <bm-root>

BM_ROOT="${1:?Usage: audit-scope-leak.sh <bm-root>}"

# Resolve tilde if present (bash 3.2 doesn't expand ~ in variables)
BM_ROOT=$(eval echo "$BM_ROOT")

if [[ ! -d "$BM_ROOT" ]]; then
	echo "Error: directory does not exist: $BM_ROOT" >&2
	exit 1
fi

# emit_finding FILE LINENO PATTERN TEXT
emit_finding() {
	jq -n \
		--arg file "$1" \
		--argjson line "$2" \
		--arg pattern "$3" \
		--arg text "$4" \
		'{file:$file, line:$line, pattern:$pattern, text:$text}'
}

# exclude lines that are markdown links, code fence markers, or inside schema/
should_skip() {
	local file="$1" text="$2"
	# Skip schema definition notes
	case "$file" in */schema/*) return 0 ;; esac
	# Skip markdown link targets: [text](https://...)
	case "$text" in *'](http'*) return 0 ;; esac
	# Skip code fence markers
	case "$text" in '```'*) return 0 ;; esac
	return 1
}

# Known-good env vars to exclude from Pass 3
KNOWN_GOOD="NODE_ENV|GITHUB_TOKEN|GITHUB_ACTIONS|ANTHROPIC_API_KEY|CLAUDE_PLUGIN_ROOT|CLAUDE_PROJECT_DIR|BASIC_MEMORY|HOME|PATH|SHELL|USER|TERM|LANG|EDITOR|VISUAL|TMPDIR|XDG_|NPM_|CC_|CI$"

# Pass 1: Relative paths with 3+ segments and a file extension
grep -rn -E '[a-z][a-z0-9_-]+/[a-z][a-z0-9_-]+/[a-z][a-z0-9_.-]+\.[a-z]{2,4}' \
	--include='*.md' "$BM_ROOT" 2>/dev/null |
	while IFS=: read -r filepath lineno linetext; do
		rel="${filepath#"$BM_ROOT"/}"
		if should_skip "$rel" "$linetext"; then continue; fi
		emit_finding "$rel" "$lineno" "relative-path" "$linetext"
	done || true

# Pass 2: Absolute paths
grep -rn -e '/Users/' -e '/home/' -e '/var/www' -e '/srv/' \
	--include='*.md' "$BM_ROOT" 2>/dev/null |
	while IFS=: read -r filepath lineno linetext; do
		rel="${filepath#"$BM_ROOT"/}"
		if should_skip "$rel" "$linetext"; then continue; fi
		emit_finding "$rel" "$lineno" "absolute-path" "$linetext"
	done || true

# Pass 3: Project-specific env vars (long ALL_CAPS, not in known-good list)
grep -rn -E '[^a-z][A-Z][A-Z0-9_]{7,}' \
	--include='*.md' "$BM_ROOT" 2>/dev/null |
	grep -v -E "$KNOWN_GOOD" |
	while IFS=: read -r filepath lineno linetext; do
		rel="${filepath#"$BM_ROOT"/}"
		if should_skip "$rel" "$linetext"; then continue; fi
		emit_finding "$rel" "$lineno" "project-env-var" "$linetext"
	done || true
