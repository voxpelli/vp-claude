#!/bin/bash
set -euo pipefail

# spec: skills/intel/references/ecosystem-npm.md
#
# Fetch upstream facts for a list of npm package names from the registry's
# abbreviated packument (Accept: application/vnd.npm.install-v1+json — ~10x
# smaller than the full document). Reads package names from stdin (one per
# line), emits NDJSON per name to stdout. Scoped names (@scope/pkg) work
# unencoded in the registry path.
#
# This script NEVER touches ~/basic-memory/ — that is the caller's concern.
# The calling agent resolves each note's real package name (frontmatter
# packages[0]) via the BM MCP tools and pipes just the package names here.
#
# Output fields per line (same contract as fetch-brew-upstream.sh):
#   name              package name (matches input)
#   upstream_version  .["dist-tags"].latest ("" when not-in-api)
#   homepage          always "" (abbreviated packument omits it)
#   deprecated        bool — true if the latest version carries a .deprecated string
#   disabled          always false (npm has no disabled concept)
#   tier              always "1"
#   days_stale        days since .modified (whole-doc last-modified — a weaker
#                     age proxy than a per-release date; documented in the plan)
#   upstream_state    ok | deprecated | not-in-api | api-unavailable
#
# Usage:
#   printf '%s\n' fastify @fastify/postgres | bash fetch-npm-upstream.sh

command -v jq >/dev/null 2>&1 || {
	echo "Error: jq is required" >&2
	exit 1
}
command -v curl >/dev/null 2>&1 || {
	echo "Error: curl is required" >&2
	exit 1
}

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT

emit() {
	local d="${6:-null}"
	[[ -z "$d" ]] && d="null"
	jq -cn \
		--arg name "$1" \
		--arg up_v "$2" \
		--arg home "$3" \
		--argjson dep "$4" \
		--argjson dis "$5" \
		--arg tier "$7" \
		--argjson days "$d" \
		--arg upstream_state "$8" \
		'{name:$name, upstream_version:$up_v, homepage:$home, deprecated:$dep, disabled:$dis, tier:$tier, days_stale:$days, upstream_state:$upstream_state}'
}

# Days since an ISO 8601 UTC timestamp. Normalizes to the strict
# %Y-%m-%dT%H:%M:%SZ form both parsers require, in this order: (1) strip a
# trailing numeric offset like +02:00, (2) strip a trailing Z, (3) strip
# fractional seconds (the registry's .modified carries them, e.g.
# 2026-04-14T12:07:12.426Z), (4) re-append Z. NOTE: step (1) treats the
# wall-clock value as UTC rather than CONVERTING it — only safe because this
# registry emits Z-suffixed UTC; a real non-Z offset would skew the result by
# the offset amount. A colon-less offset (+0200) or otherwise unparseable input
# degrades to null (age-unknown), never a wrong number.
days_since() {
	local iso epoch now_epoch
	iso="$1"
	iso="${iso%[+-][0-9][0-9]:[0-9][0-9]}"
	iso="${iso%Z}"
	iso="${iso%.*}"
	iso="${iso}Z"
	epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$iso" "+%s" 2>/dev/null ||
		date -u -d "$iso" "+%s" 2>/dev/null || echo "")
	if [[ -z "$epoch" ]]; then
		echo "null"
		return
	fi
	now_epoch=$(date -u "+%s")
	echo $(((now_epoch - epoch) / 86400))
}

while IFS= read -r name; do
	[[ -z "$name" ]] && continue
	name="${name#"${name%%[![:space:]]*}"}"
	name="${name%"${name##*[![:space:]]}"}"
	[[ -z "$name" ]] && continue

	# Capture body + HTTP status separately so 404 (unpublished) and 5xx/network
	# (transient) take different paths — a bare `-f` would collapse them.
	http_code=$(curl -s -o "$BODY" -w "%{http_code}" \
		-H "Accept: application/vnd.npm.install-v1+json" \
		--max-time 20 "https://registry.npmjs.org/$name" 2>/dev/null) || http_code="000"

	if [[ "$http_code" == "404" ]]; then
		emit "$name" "" "" false false "" "" "not-in-api"
		continue
	fi
	if [[ "$http_code" != "200" ]] || ! jq empty "$BODY" >/dev/null 2>&1; then
		emit "$name" "" "" false false "" "" "api-unavailable"
		continue
	fi

	latest=$(jq -r '.["dist-tags"].latest // ""' "$BODY")
	if [[ -z "$latest" ]]; then
		emit "$name" "" "" false false "" "" "api-unavailable"
		continue
	fi
	modified=$(jq -r '.modified // ""' "$BODY")
	deprecated_msg=$(jq -r --arg v "$latest" '.versions[$v].deprecated // ""' "$BODY")

	days="null"
	[[ -n "$modified" ]] && days=$(days_since "$modified")

	if [[ -n "$deprecated_msg" ]]; then
		emit "$name" "$latest" "" true false "$days" "1" "deprecated"
		continue
	fi

	emit "$name" "$latest" "" false false "$days" "1" "ok"
done
