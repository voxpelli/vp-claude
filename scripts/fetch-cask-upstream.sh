#!/bin/bash
set -euo pipefail

# spec: skills/intel/references/ecosystem-cask.md
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
#   tier              "1" (API-only) | "2" (with a tap-bump commit date)
#   days_stale        integer days since the tap-bump commit | null
#   days_stale_source "tap-bump" | null — provenance of days_stale (single
#                     source today; the field exists for shape parity with
#                     fetch-brew-upstream.sh's "release"|"tag" split)
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
# Tier 2 (opportunistic — days_stale semantic differs from brew's Tier 2):
#   brew's Tier 2 reads the *vendor's* GitHub release/tag date (the upstream
#   project's own clock). Cask has no equivalent — casks aren't hosted at a
#   single vendor repo — so Tier 2 here instead reads the *tap's* bump-commit
#   date from Homebrew/homebrew-cask's own history: when a maintainer/bot
#   merged the version bump, not when the vendor shipped it. That's a
#   TAP-clock date, not a vendor-clock date. This distinction is immaterial
#   for this audit specifically: the source of truth this whole `--stale`
#   flow compares against is formulae.brew.sh itself (regenerated from the
#   tap on a ~15-min cron), so "how long has the tap known about the current
#   version" is exactly the right clock for >30-day drift bucketing, just a
#   few minutes-to-hours offset from the vendor's own release timestamp.
#
#   OPPORTUNISTIC ONLY — never a hard requirement. Runs uniformly for every
#   "ok" row (mirrors fetch-brew-upstream.sh: the caller decides whether
#   days_stale is meaningful once it knows which rows are actually drifted).
#   Known no-match classes that must degrade to days_stale: null (the
#   existing bucket, not a failure):
#     - the bump predates the 2023-08 path-sharding change or the 2024-05
#       fonts migration — path-filtered commit history doesn't follow file
#       renames, and this hits exactly the stalest (longest-drifted) casks
#     - the cask was renamed (old_tokens) — history under the current token
#       won't show the original bump
#     - no gh / not authed / API error / no matching commit headline
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

HAS_GH=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
	HAS_GH=1
fi

API_CACHE=$(mktemp)
INDEX=$(mktemp)
trap 'rm -f "$API_CACHE" "$INDEX"' EXIT

if ! curl -fsSL --max-time 60 https://formulae.brew.sh/api/cask.json -o "$API_CACHE" 2>/dev/null; then
	jq -cn '{name:"", upstream_version:"", homepage:"", deprecated:false, disabled:false, tier:"", days_stale:null, days_stale_source:null, upstream_state:"api-unavailable"}'
	exit 0
fi

# Defensive: a 200 response with a malformed body would otherwise produce an
# empty index, making every cask look like not-in-api. Emit the sentinel and
# exit so callers see a clean error path instead.
if ! jq empty "$API_CACHE" >/dev/null 2>&1; then
	jq -cn '{name:"", upstream_version:"", homepage:"", deprecated:false, disabled:false, tier:"", days_stale:null, days_stale_source:null, upstream_state:"api-unavailable"}'
	exit 0
fi

# Defensive: a syntactically-valid-but-EMPTY array (e.g. a CDN edge serving a
# truncated/placeholder response, or an outage that still returns `[]` with a
# 200) passes the `jq empty` check above yet would silently build an empty
# index — every token then reads as not-in-api, indistinguishable from a real
# "not published" verdict. Guard on a non-zero count, not just syntax.
if [[ "$(jq 'length' "$API_CACHE" 2>/dev/null || echo 0)" -eq 0 ]]; then
	jq -cn '{name:"", upstream_version:"", homepage:"", deprecated:false, disabled:false, tier:"", days_stale:null, days_stale_source:null, upstream_state:"api-unavailable"}'
	exit 0
fi

# One-shot index: token -> {version, homepage, deprecated, disabled}. There are
# ~7000 casks in the blob, so an O(1) lookup per token matters.
jq 'map({token, version, homepage, deprecated, disabled}) | INDEX(.token)' \
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

# homebrew-cask tap-repo shard path for a cask token, current (post 2023-08 /
# post 2024-05) layout. Non-font casks shard on the token's own first
# character (`Casks/<char>/<token>.rb`). Fonts additionally nest under a
# `font/` directory, sharded on the first character AFTER the `font-` prefix
# (`Casks/font/font-<char>/<token>.rb`) — verified against the live
# Homebrew/homebrew-cask tree (e.g. `Casks/d/docker-desktop.rb`,
# `Casks/font/font-i/font-inter.rb`). A cask bumped before either migration,
# or since renamed, won't be found by a path-filtered commit search under the
# CURRENT path — an expected no-match (see the Tier 2 comment above), not a
# bug in this function.
shard_path() {
	local token="$1"
	if [[ "$token" == font-* ]]; then
		local rest="${token#font-}"
		echo "Casks/font/font-${rest:0:1}/${token}.rb"
	else
		echo "Casks/${token:0:1}/${token}.rb"
	fi
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
		emit "$name" "" "" false false "" "" "not-in-api"
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
		emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "" "1" "disabled"
		continue
	fi

	if [[ "$deprecated" == "true" ]]; then
		emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "" "1" "deprecated"
		continue
	fi

	# Not deprecated/disabled: an empty comparable version (versionless
	# "latest" or comma-only) has nothing to compare → not-in-api, rather than
	# emit "ok" with an empty upstream_version.
	if [[ -z "$upstream_version" ]]; then
		emit "$name" "" "" false false "" "" "not-in-api"
		continue
	fi

	# Tier 2: opportunistic tap-bump-date enrichment (see header comment for
	# the tap-clock vs vendor-clock semantic and the no-match classes). Any
	# failure at any point — no gh, API error, no matching commit — degrades
	# to tier "1" / days_stale null; it never aborts this row or the cohort.
	tier="1"
	days="null"
	days_stale_source=""
	if [[ "$HAS_GH" -eq 1 ]]; then
		shard="$(shard_path "$name")"
		commits_json=$(gh api "repos/Homebrew/homebrew-cask/commits?path=${shard}&per_page=15" 2>/dev/null || echo "")
		if [[ -n "$commits_json" ]] && echo "$commits_json" | jq empty >/dev/null 2>&1; then
			# Bump messages log only the LEADING comma-segment of the version
			# (e.g. "docker-desktop 4.80.0" for a cask version
			# "4.80.0,232116"), so match against $upstream_version (already
			# comma-stripped above), not the raw API value. Match the commit
			# HEADLINE only (first line of the message) to avoid false
			# positives from unrelated body text.
			#
			# The headline match is boundary-anchored, NOT a bare substring
			# test: cask versions routinely share prefixes across genuinely
			# different releases (e.g. "4.8.0" vs "4.8.0.1"), and a raw
			# `contains($v)` would let a later, unrelated commit whose version
			# happens to start with the target win over the true bump commit
			# (commits are newest-first and only `.[0]` is taken) — silently
			# UNDERSTATING staleness, which is worse than the tier-1
			# days_stale:null fallback because it looks authoritative. The
			# regex requires a non-digit/non-dot boundary (or start/end of
			# line) on both sides of the version string.
			commit_date=$(echo "$commits_json" | jq -r --arg v "$upstream_version" '
				($v | gsub("\\."; "\\.")) as $vre
				| [.[] | select((.commit.message // "") | split("\n")[0]
					| test("(^|[^0-9.])" + $vre + "([^0-9.]|$)"))]
				| .[0].commit.committer.date // empty
			' 2>/dev/null || echo "")
			if [[ -n "$commit_date" ]]; then
				days=$(days_since "$commit_date")
				# Sanity bound: a negative day count (clock skew, or a parse
				# edge case in days_since) is not a valid staleness reading —
				# fall back to tier 1 / days_stale:null rather than accept it.
				if [[ "$days" != "null" ]] && [[ "$days" -ge 0 ]]; then
					tier="2"
					days_stale_source="tap-bump"
				else
					days="null"
				fi
			fi
		fi
	fi

	emit "$name" "$upstream_version" "$homepage" "$deprecated" "$disabled" "$days" "$tier" "ok" "$days_stale_source"
done
