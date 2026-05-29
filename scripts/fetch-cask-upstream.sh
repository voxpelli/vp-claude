#!/bin/bash
set -euo pipefail

# spec: skills/tool-intel/references/ecosystem-cask.md
#
# Fetch upstream facts for a list of Homebrew *cask* tokens from the central
# formulae.brew.sh cask API. Reads bare cask tokens from stdin (one per line),
# emits NDJSON per token to stdout. Sibling of fetch-brew-upstream.sh but for
# casks; the bulk cask.json blob is fetched once and indexed by .token.
#
# This script NEVER touches ~/basic-memory/ — that is the caller's concern.
# The calling agent fetches BM-side data (recorded versions) via the BM MCP
# tools and pipes just the bare cask tokens here (the `cask-` prefix stripped).
#
# Output fields per line (same contract as fetch-brew-upstream.sh):
#   name              cask token
#   upstream_version  leading comma-segment of .version ("" when not-in-api)
#   homepage          .homepage from API ("" when not-in-api)
#   deprecated        bool — true if the cask is marked deprecated
#   disabled          bool — true if the cask is marked disabled
#   tier              always "1" (no gh-release timing for casks)
#   days_stale        always null (cask API carries no release date)
#   upstream_state    ok | deprecated | disabled | not-in-api | api-unavailable
#
# Cask-specific handling:
#   - Versions are comma-mangled (`3.5.1,4.0`, `3.39.5,hash,rev`). Only the
#     leading segment is the comparable version; a change confined to the
#     suffix is NOT drift. We emit `upstream_version` = leading segment.
#   - 2128 casks carry the literal version `"latest"` (genuinely versionless);
#     they route to not-in-api so drift is skipped rather than fabricated.
#   - `auto_updates==true` casks (1817 of them) still carry a canonical
#     `.version` worth checking — they are NOT excluded.
#
# Usage:
#   printf '%s\n' warp ngrok | bash fetch-cask-upstream.sh

command -v jq >/dev/null 2>&1 || {
	echo "Error: jq is required" >&2
	exit 1
}
command -v curl >/dev/null 2>&1 || {
	echo "Error: curl is required" >&2
	exit 1
}

API_CACHE=$(mktemp)
INDEX=$(mktemp)
trap 'rm -f "$API_CACHE" "$INDEX"' EXIT

if ! curl -fsSL --max-time 60 https://formulae.brew.sh/api/cask.json -o "$API_CACHE" 2>/dev/null; then
	jq -cn '{name:"", upstream_version:"", homepage:"", deprecated:false, disabled:false, tier:"", days_stale:null, upstream_state:"api-unavailable"}'
	exit 0
fi

# Defensive: a 200 response with a malformed body would otherwise produce an
# empty index, making every cask look like not-in-api. Emit the sentinel and
# exit so callers see a clean error path instead.
if ! jq empty "$API_CACHE" >/dev/null 2>&1; then
	jq -cn '{name:"", upstream_version:"", homepage:"", deprecated:false, disabled:false, tier:"", days_stale:null, upstream_state:"api-unavailable"}'
	exit 0
fi

# One-shot index: token -> {version, homepage, deprecated, disabled}. There are
# ~7000 casks in the blob, so an O(1) lookup per token matters.
jq 'map({token, version, homepage, deprecated, disabled}) | INDEX(.token)' \
	"$API_CACHE" >"$INDEX"

emit() {
	jq -cn \
		--arg name "$1" \
		--arg up_v "$2" \
		--arg home "$3" \
		--argjson dep "$4" \
		--argjson dis "$5" \
		--arg tier "$6" \
		--arg upstream_state "$7" \
		'{name:$name, upstream_version:$up_v, homepage:$home, deprecated:$dep, disabled:$dis, tier:$tier, days_stale:null, upstream_state:$upstream_state}'
}

# Read tokens from stdin, one per line. Empty stdin -> no output.
while IFS= read -r name; do
	[[ -z "$name" ]] && continue
	# Trim surrounding whitespace
	name="${name#"${name%%[![:space:]]*}"}"
	name="${name%"${name##*[![:space:]]}"}"
	[[ -z "$name" ]] && continue

	cask_json=$(jq -c --arg n "$name" '.[$n] // empty' "$INDEX")

	if [[ -z "$cask_json" ]]; then
		emit "$name" "" "" false false "" "not-in-api"
		continue
	fi

	version=$(echo "$cask_json" | jq -r '.version // ""')
	homepage=$(echo "$cask_json" | jq -r '.homepage // ""')
	deprecated=$(echo "$cask_json" | jq -r '.deprecated // false')
	disabled=$(echo "$cask_json" | jq -r '.disabled // false')

	# Comma-normalize the comparable version: leading segment only (a JSON
	# "latest" — NOT the Ruby DSL `:latest` — or a comma-only/empty value has
	# no comparable version → "").
	if [[ "$version" == "latest" || -z "$version" ]]; then
		upstream_version=""
	else
		upstream_version="${version%%,*}"
	fi

	# Deprecation/disable is independent of version comparability — check it
	# FIRST (mirrors the brew template's ordering) so that a deprecated or
	# disabled cask whose version is "latest" still routes to Archive
	# candidates, not to Not in registry.
	if [[ "$disabled" == "true" ]]; then
		emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "1" "disabled"
		continue
	fi

	if [[ "$deprecated" == "true" ]]; then
		emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "1" "deprecated"
		continue
	fi

	# Not deprecated/disabled: an empty comparable version (versionless
	# "latest" or comma-only) has nothing to compare → not-in-api, rather than
	# emit "ok" with an empty upstream_version.
	if [[ -z "$upstream_version" ]]; then
		emit "$name" "" "" false false "" "not-in-api"
		continue
	fi

	emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "1" "ok"
done
