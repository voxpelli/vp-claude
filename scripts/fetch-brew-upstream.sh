#!/bin/bash
set -euo pipefail

# Fetch upstream facts for a list of Homebrew formula names from the central
# formulae.brew.sh API. Reads formula names from stdin (one per line), emits
# NDJSON per name to stdout. Optionally enriches GitHub-hosted formulae with
# release timing via `gh release list`, falling back to the newest git tag's
# commit date when the formula tags releases but never cuts a GitHub Release
# (e.g. brew:sem — stable at a version with a matching git tag, but
# `gh release list` tops out at an older published Release).
#
# This script NEVER touches ~/basic-memory/ — that is the caller's concern.
# The calling agent should fetch BM-side data (recorded versions, etc.) via
# the BM MCP tools and pipe just the formula names here.
#
# Output fields per line:
#   name              formula name
#   upstream_version  .versions.stable from API ("" when not-in-api)
#   homepage          .homepage from API ("" when not-in-api)
#   deprecated        bool — true if formulae.brew.sh marks the formula deprecated
#   disabled          bool — true if formulae.brew.sh marks the formula disabled
#   tier              "1" (API-only) | "2" (with gh release/tag timing)
#   days_stale        integer days since latest GH release or tag | null
#   days_stale_source "release" | "tag" | null — provenance of days_stale;
#                     "tag" means the release list was empty and the date
#                     came from the newest git tag's commit instead
#   upstream_state            ok | deprecated | disabled | not-in-api | api-unavailable
#
# Note: this script does NOT classify drift — that comparison happens in the
# caller, which knows the BM-recorded version. The upstream_state enum here describes
# the *upstream fact*, not the drift relation.
#
# Usage:
#   printf '%s\n' bat deno ripgrep | bash fetch-brew-upstream.sh
#   echo "ast-grep" | bash fetch-brew-upstream.sh

command -v jq >/dev/null 2>&1 || {
	echo "Error: jq is required" >&2
	exit 1
}
command -v curl >/dev/null 2>&1 || {
	echo "Error: curl is required" >&2
	exit 1
}

HAS_GH=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
	HAS_GH=1
fi

API_CACHE=$(mktemp)
INDEX=$(mktemp)
trap 'rm -f "$API_CACHE" "$INDEX"' EXIT

if ! curl -fsSL --max-time 30 https://formulae.brew.sh/api/formula.json -o "$API_CACHE" 2>/dev/null; then
	jq -cn '{name:"", upstream_version:"", homepage:"", deprecated:false, disabled:false, tier:"", days_stale:null, days_stale_source:null, upstream_state:"api-unavailable"}'
	exit 0
fi

# Defensive: validate the downloaded payload is valid JSON before building the
# index. Without this check, a CDN returning malformed JSON (200 status, bad
# body) would silently produce an empty index, making every formula look like
# `not-in-api` — which the gardener then mislabels as "Not in registry" for the whole
# vault. Emit the api-unavailable sentinel and exit so callers see a clean
# error path instead.
if ! jq empty "$API_CACHE" >/dev/null 2>&1; then
	jq -cn '{name:"", upstream_version:"", homepage:"", deprecated:false, disabled:false, tier:"", days_stale:null, days_stale_source:null, upstream_state:"api-unavailable"}'
	exit 0
fi

# One-shot index: name -> {stable, homepage, deprecated, disabled}. Per-name
# lookups against the index are O(1) instead of O(formulae) — there are ~6000
# formulae in the API blob, so this matters.
jq 'map({name, stable: .versions.stable, homepage, deprecated, disabled}) | INDEX(.name)' \
	"$API_CACHE" >"$INDEX"

emit() {
	local d="${6:-null}"
	if [[ -z "$d" ]]; then
		d="null"
	fi
	jq -cn \
		--arg name "$1" \
		--arg up_v "$2" \
		--arg home "$3" \
		--argjson dep "$4" \
		--argjson dis "$5" \
		--arg tier "$7" \
		--argjson days "$d" \
		--arg upstream_state "$8" \
		--arg days_stale_source "${9:-}" \
		'{name:$name, upstream_version:$up_v, homepage:$home, deprecated:$dep, disabled:$dis, tier:$tier, days_stale:$days, days_stale_source: (if $days_stale_source == "" then null else $days_stale_source end), upstream_state:$upstream_state}'
}

# Days since an ISO 8601 timestamp. Tries BSD date (macOS) first, then GNU date.
days_since() {
	local iso="$1"
	local epoch now_epoch
	epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$iso" "+%s" 2>/dev/null ||
		date -u -d "$iso" "+%s" 2>/dev/null || echo "")
	if [[ -z "$epoch" ]]; then
		echo "null"
		return
	fi
	now_epoch=$(date -u "+%s")
	echo $(((now_epoch - epoch) / 86400))
}

# Read names from stdin, one per line. Empty stdin -> no output (graceful no-op).
while IFS= read -r name; do
	# Skip blank lines
	[[ -z "$name" ]] && continue
	# Trim whitespace
	name="${name#"${name%%[![:space:]]*}"}"
	name="${name%"${name##*[![:space:]]}"}"
	[[ -z "$name" ]] && continue

	formula_json=$(jq -c --arg n "$name" '.[$n] // empty' "$INDEX")

	if [[ -z "$formula_json" ]]; then
		emit "$name" "" "" false false "" "" "not-in-api"
		continue
	fi

	upstream_version=$(echo "$formula_json" | jq -r '.stable // ""')
	homepage=$(echo "$formula_json" | jq -r '.homepage // ""')
	deprecated=$(echo "$formula_json" | jq -r '.deprecated')
	disabled=$(echo "$formula_json" | jq -r '.disabled')

	if [[ "$disabled" == "true" ]]; then
		emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "" "1" "disabled"
		continue
	fi

	if [[ "$deprecated" == "true" ]]; then
		emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "" "1" "deprecated"
		continue
	fi

	# Tier 2: opportunistic GitHub release-timing enrichment for github.com
	# homepages. We always run this for non-deprecated/non-disabled formulae
	# with a GitHub homepage; the caller decides whether days_stale is
	# meaningful based on its own version comparison.
	tier="1"
	days="null"
	days_stale_source=""
	if [[ "$HAS_GH" -eq 1 ]] && [[ "$homepage" =~ ^https://github\.com/([^/]+)/([^/]+) ]]; then
		owner="${BASH_REMATCH[1]}"
		repo="${BASH_REMATCH[2]%.git}"
		published=$(gh release list --repo "$owner/$repo" --limit 1 \
			--json publishedAt -q '.[0].publishedAt' 2>/dev/null || echo "")
		if [[ -n "$published" && "$published" != "null" ]]; then
			days=$(days_since "$published")
			if [[ "$days" != "null" ]]; then
				tier="2"
				days_stale_source="release"
			fi
		fi

		# Fallback: some formulae tag a release upstream but never cut a
		# GitHub Release (e.g. brew:sem — stable at a version with a
		# matching git tag, but `gh release list` tops out at an older
		# published Release). When the release list yields nothing, use
		# the newest git tag's commit date instead. Prefer a tag matching
		# upstream_version exactly (with or without a leading "v"), since
		# `/tags` is not semver- or date-sorted; fall back to the tags
		# API's first entry as a best-effort timestamp otherwise.
		if [[ "$tier" == "1" ]]; then
			tags_json=$(gh api "repos/$owner/$repo/tags" 2>/dev/null || echo "")
			if [[ -n "$tags_json" ]]; then
				tag_sha=$(echo "$tags_json" | jq -r --arg v "$upstream_version" '
					(map(select(.name == $v or .name == ("v" + $v))) | .[0]) as $exact
					| (($exact // .[0]) | .commit.sha) // empty
				')
				if [[ -n "$tag_sha" ]]; then
					tag_date=$(gh api "repos/$owner/$repo/commits/$tag_sha" \
						--jq '.commit.committer.date' 2>/dev/null || echo "")
					if [[ -n "$tag_date" && "$tag_date" != "null" ]]; then
						days=$(days_since "$tag_date")
						if [[ "$days" != "null" ]]; then
							tier="2"
							days_stale_source="tag"
						fi
					fi
				fi
			fi
		fi
	fi

	emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "$days" "$tier" "ok" "$days_stale_source"
done
