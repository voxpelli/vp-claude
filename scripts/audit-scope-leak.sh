#!/bin/bash
set -euo pipefail

# Detect project-specific content leaked into cross-project BM knowledge base.
# Uses grep for regex patterns that BM's search_notes (FTS/semantic) cannot express.
# Output: NDJSON {"file","line","pattern","text"} — one object per finding.
# Usage: audit-scope-leak.sh <bm-root>

command -v jq >/dev/null 2>&1 || {
	echo "Error: jq is required" >&2
	exit 1
}

BM_ROOT="${1:?Usage: audit-scope-leak.sh <bm-root>}"

# Safe tilde expansion without eval (no injection risk)
BM_ROOT="${BM_ROOT/#\~/$HOME}"

if [[ ! -d "$BM_ROOT" ]]; then
	echo "Error: directory does not exist: $BM_ROOT" >&2
	exit 1
fi

# emit_finding FILE LINENO PATTERN TEXT
emit_finding() {
	jq -cn \
		--arg file "$1" \
		--argjson line "$2" \
		--arg pattern "$3" \
		--arg text "$4" \
		'{file:$file, line:$line, pattern:$pattern, text:$text}'
}

# Process grep output into NDJSON findings
process_findings() {
	local pattern="$1"
	while IFS= read -r grepline; do
		filepath="${grepline%%:*}"
		rest="${grepline#*:}"
		lineno="${rest%%:*}"
		linetext="${rest#*:}"
		emit_finding "${filepath#"$BM_ROOT"/}" "$lineno" "$pattern" "$linetext"
	done || true
}

# Known-good env vars to exclude from Pass 3
KNOWN_GOOD="NODE_ENV|GITHUB_TOKEN|GITHUB_ACTIONS|ANTHROPIC_API_KEY|CLAUDE_PLUGIN_ROOT|CLAUDE_PROJECT_DIR|BASIC_MEMORY|HOME|PATH|SHELL|USER|TERM|LANG|EDITOR|VISUAL|TMPDIR|XDG_|NPM_|CC_|CI$"

# Pass 1: Relative paths with 3+ segments and a file extension
grep -rn -E '[a-z][a-z0-9_-]+/[a-z][a-z0-9_-]+/[a-z][a-z0-9_.-]+\.[a-z]{2,4}' \
	--include='*.md' --exclude-dir=schema "$BM_ROOT" 2>/dev/null |
	grep -v -E ']\(https?://|^```' |
	process_findings "relative-path"

# Pass 2: Absolute paths
grep -rn -e '/Users/' -e '/home/' -e '/var/www' -e '/srv/' \
	--include='*.md' --exclude-dir=schema "$BM_ROOT" 2>/dev/null |
	grep -v -E ']\(https?://|^```' |
	process_findings "absolute-path"

# Pass 3: Project-specific env vars (long ALL_CAPS, not in known-good list)
grep -rn -E '(^|[^a-zA-Z])[A-Z][A-Z0-9_]{7,}' \
	--include='*.md' --exclude-dir=schema "$BM_ROOT" 2>/dev/null |
	grep -v -E "$KNOWN_GOOD" |
	grep -v -E ']\(https?://|^```' |
	process_findings "project-env-var"
