#!/bin/bash
set -euo pipefail

# spec: skills/package-intel/references/ecosystem-crates.md
#
# Fetch upstream facts for a list of Rust crate names from the crates.io API.
# Reads crate names from stdin (one per line), emits NDJSON per name to stdout.
#
# This script NEVER touches ~/basic-memory/ — that is the caller's concern.
# The calling agent resolves each note's crate name (strip the leading
# `crate-` prefix) via the BM MCP tools and pipes just the names here.
#
# crates.io requires a descriptive User-Agent (403s without one) and asks
# clients to rate-limit; we sleep 1s between calls.
#
# Output fields per line (same contract as fetch-brew-upstream.sh):
#   name              crate name (matches input)
#   upstream_version  .crate.max_stable_version (prerelease-safe; "" when not-in-api)
#   homepage          .crate.homepage ("" when absent)
#   deprecated        always false (crates.io has no deprecation flag)
#   disabled          always false
#   tier              always "1"
#   days_stale        days since the max_stable_version's .created_at
#   upstream_state    ok | not-in-api | api-unavailable
#                     (not-in-api covers BOTH a 404 and a prerelease-only crate
#                     — 200 with no max_stable_version; see that branch below)
#
# Usage:
#   printf '%s\n' serde tokio | bash fetch-crate-upstream.sh

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
# fractional seconds (crates.io carries microseconds, e.g.
# 2025-09-27T16:51:35.265429Z), (4) re-append Z. NOTE: step (1) treats the
# wall-clock value as UTC rather than CONVERTING it — only safe because
# crates.io emits Z-suffixed UTC; a real non-Z offset would skew the result by
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

first=1
while IFS= read -r name; do
	[[ -z "$name" ]] && continue
	name="${name#"${name%%[![:space:]]*}"}"
	name="${name%"${name##*[![:space:]]}"}"
	[[ -z "$name" ]] && continue

	# Rate-limit: sleep between calls, never before the first or after the last.
	if [[ "$first" -eq 0 ]]; then
		sleep 1
	fi
	first=0

	http_code=$(curl -s -o "$BODY" -w "%{http_code}" \
		-H "User-Agent: vp-knowledge/stale" \
		--max-time 20 "https://crates.io/api/v1/crates/$name" 2>/dev/null) || http_code="000"

	if [[ "$http_code" == "404" ]]; then
		emit "$name" "" "" false false "" "" "not-in-api"
		continue
	fi
	if [[ "$http_code" != "200" ]] || ! jq empty "$BODY" >/dev/null 2>&1; then
		emit "$name" "" "" false false "" "" "api-unavailable"
		continue
	fi

	max_stable=$(jq -r '.crate.max_stable_version // ""' "$BODY")
	if [[ -z "$max_stable" ]]; then
		# 200 + valid JSON but no stable release (prerelease-only crate). This
		# is a permanent, terminal condition — NOT a transient fetch failure —
		# so route to not-in-api (drift-skipped), not api-unavailable (retryable).
		emit "$name" "" "" false false "" "" "not-in-api"
		continue
	fi
	homepage=$(jq -r '.crate.homepage // ""' "$BODY")
	# `(.versions // [])` guards a 200 payload that carries max_stable_version
	# but lacks (or nulls) the .versions array — bare `.versions[]` iteration
	# over null is a jq error (exit 5) that, under `set -e`, aborts the whole
	# batch mid-stream, silently dropping every remaining crate with no sentinel
	# line. With the guard, a missing array degrades to empty `created`
	# (age-unknown) and the crate still emits a clean `ok` verdict.
	created=$(jq -r --arg v "$max_stable" 'first((.versions // [])[] | select(.num == $v) | .created_at) // ""' "$BODY")

	days="null"
	[[ -n "$created" ]] && days=$(days_since "$created")

	emit "$name" "$max_stable" "$homepage" false false "$days" "1" "ok"
done
