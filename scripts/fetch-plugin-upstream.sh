#!/bin/bash
set -euo pipefail

# spec: skills/tool-intel/references/ecosystem-plugin.md
#
# Fetch upstream facts for a list of Claude Code plugin identifiers directly
# from GitHub — plugins have no central registry, so `plugin.json`'s `version`
# field on the live repo IS the upstream source of truth. Reads identifiers
# from stdin (one per line), emits NDJSON per identifier to stdout.
#
# This script NEVER touches ~/basic-memory/ — that is the caller's concern.
# The calling agent recovers each note's identifier via the BM MCP tools (see
# staleness-detection.md S3) and pipes just the identifiers here.
#
# Identifier shapes (one per line):
#   owner/repo#name   a marketplace repo hosting one-or-more named plugins —
#                     `#name` does NOT by itself imply a subdirectory: a
#                     root-level "./" source also produces this shape (see
#                     staleness-detection.md S3 and this project's plan notes)
#   owner/repo        a bare dedicated repo, no marketplace involved at all —
#                     plugin.json is fetched straight from that repo's root
#
# Unlike every other fetch-<eco>-upstream.sh script, the join-back key is the
# WHOLE identifier string, not a simple package/formula name — `name` in the
# NDJSON output always echoes the input line UNCHANGED, since the caller (S3)
# maps that composite string back to a `plugin-<owner>-<repo>-<name>` note
# title. Emitting a stripped/partial name would break that join.
#
# Marketplace resolution: for a `#name` identifier, fetch the marketplace
# repo's `.claude-plugin/marketplace.json` ONCE per distinct marketplace
# (cached — a marketplace can host many plugins), find the `plugins[]` entry
# matching `name`, and resolve its `source` field:
#   - a bare string ("./", "./plugins/foo")     -> same repo, that relative path
#   - {source:"github", repo:"owner/repo"}      -> a different repo, root path
#   - {source:"git-subdir", url:"..."}          -> a different repo, root path
#     (this repo's own lib/installed-plugins.mjs resolves only owner/repo from
#     this shape's `url`, with no separate path field — mirrored here for
#     consistency; see this project's plan notes for the open verification
#     item on whether that's complete)
# A bare `owner/repo` identifier skips marketplace resolution entirely and
# fetches plugin.json straight from that repo's root.
#
# Output fields per line:
#   name              the FULL input identifier, unchanged (composite join key)
#   upstream_version  plugin.json's .version ("" when not-in-api)
#   homepage          https://github.com/<resolved-owner>/<resolved-repo>
#   deprecated        always false (no deprecation concept for plugins)
#   disabled          always false
#   tier              always "1"
#   days_stale        days since the last commit touching the resolved
#                     plugin.json path | null
#   upstream_state    ok | not-in-api | api-unavailable
#                     (not-in-api covers: marketplace.json 404, no matching
#                     plugins[] entry, plugin.json 404, or plugin.json present
#                     but missing/null .version — verified via a live
#                     end-to-end run against real data: this is a PER-PLUGIN
#                     state, not per-marketplace — 13 of Anthropic's 18
#                     official plugins are version-less while the other 5
#                     carry real versions)
#
# Usage:
#   printf '%s\n' 'pbakaus/impeccable' 'anthropics/claude-plugins-official#code-review' | bash fetch-plugin-upstream.sh

command -v jq >/dev/null 2>&1 || {
	echo "Error: jq is required" >&2
	exit 1
}
command -v gh >/dev/null 2>&1 || {
	echo "Error: gh is required" >&2
	exit 1
}

HAS_GH=0
if gh auth status >/dev/null 2>&1; then
	HAS_GH=1
fi

CACHE_DIR=$(mktemp -d)
trap 'rm -rf "$CACHE_DIR"' EXIT

emit() {
	local d="${5:-null}"
	[[ -z "$d" ]] && d="null"
	jq -cn \
		--arg name "$1" \
		--arg up_v "$2" \
		--arg home "$3" \
		--arg tier "$4" \
		--argjson days "$d" \
		--arg upstream_state "$6" \
		'{name:$name, upstream_version:$up_v, homepage:$home, deprecated:false, disabled:false, tier:$tier, days_stale:$days, upstream_state:$upstream_state}'
}

# Days since an ISO 8601 UTC timestamp (GitHub commit dates are Z-suffixed).
# Tries BSD date (macOS) first, then GNU date. Unparseable input degrades to
# null (age-unknown), never a wrong number.
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

# Fetch + base64-decode a repo file via the GitHub Contents API. Echoes the
# decoded content on success, or nothing (empty string) on any failure —
# callers distinguish 404 (not-in-api) from other failures (api-unavailable)
# via the separate http_code probe below, since --jq on a failed response
# would otherwise mask the distinction.
fetch_content_http_code() {
	local repo="$1" path="$2" outfile="$3"
	gh api -H "Accept: application/vnd.github.raw+json" \
		"repos/$repo/contents/$path" >"$outfile" 2>/dev/null && echo "200" && return
	# gh api exits non-zero on any non-2xx; probe the status separately so we
	# can distinguish 404 (permanent — not-in-api) from other failures
	# (transient — api-unavailable) without losing the body on success above.
	gh api "repos/$repo/contents/$path" --jq . >/dev/null 2>/tmp/gh-err-$$ && {
		echo "200"
		return
	}
	if grep -q '"status":"404"' "/tmp/gh-err-$$" 2>/dev/null || grep -qi "404" "/tmp/gh-err-$$" 2>/dev/null; then
		rm -f "/tmp/gh-err-$$"
		echo "404"
		return
	fi
	rm -f "/tmp/gh-err-$$"
	echo "000"
}

# Cache: marketplace "owner/repo" -> path to its decoded marketplace.json (or
# a zero-byte file when the fetch failed, so a repeated failure isn't retried).
declare -A MARKETPLACE_STATUS

# Resolve a marketplace repo's marketplace.json, caching per distinct repo.
# Sets MARKETPLACE_STATUS[$repo] to "ok" | "not-in-api" | "api-unavailable".
ensure_marketplace() {
	local repo="$1" cachefile
	[[ -n "${MARKETPLACE_STATUS[$repo]:-}" ]] && return
	cachefile="$CACHE_DIR/$(echo -n "$repo" | tr '/' '_').json"
	local http_code
	http_code=$(gh api "repos/$repo/contents/.claude-plugin/marketplace.json" --jq .content 2>/dev/null | base64 -d >"$cachefile" 2>/dev/null && echo "200" || echo "")
	if [[ "$http_code" != "200" ]] || [[ ! -s "$cachefile" ]] || ! jq empty "$cachefile" >/dev/null 2>&1; then
		# Distinguish a real 404 (repo/file genuinely absent — not-in-api) from
		# any other failure (network, auth, rate limit — api-unavailable) via a
		# second, cheap metadata-only probe.
		if gh api "repos/$repo/contents/.claude-plugin/marketplace.json" >/dev/null 2>&1; then
			MARKETPLACE_STATUS[$repo]="api-unavailable"
		else
			local probe
			probe=$(gh api "repos/$repo/contents/.claude-plugin/marketplace.json" 2>&1 >/dev/null || true)
			if echo "$probe" | grep -qi "404\|Not Found"; then
				MARKETPLACE_STATUS[$repo]="not-in-api"
			else
				MARKETPLACE_STATUS[$repo]="api-unavailable"
			fi
		fi
		return
	fi
	MARKETPLACE_STATUS[$repo]="ok"
}

# Resolve one plugin entry's `source` field to a repo + in-repo path. Echoes
# "repo|path" (path may be empty for root) on success, or nothing on failure
# (entry not found, or an unrecognized/malformed source shape).
resolve_source() {
	local marketplace_repo="$1" name="$2" cachefile entry source_type
	cachefile="$CACHE_DIR/$(echo -n "$marketplace_repo" | tr '/' '_').json"
	entry=$(jq -c --arg n "$name" '(.plugins // []) | map(select(.name == $n)) | .[0] // empty' "$cachefile" 2>/dev/null)
	[[ -z "$entry" ]] && return

	local source_json
	source_json=$(echo "$entry" | jq -c '.source // empty')
	[[ -z "$source_json" ]] && return

	# Bare string source: same repo, that relative path (normalize "./" and
	# "." to root, strip a leading "./" from a subdirectory path).
	if echo "$source_json" | jq -e 'type == "string"' >/dev/null 2>&1; then
		local rel
		rel=$(echo "$source_json" | jq -r '.')
		rel="${rel#./}"
		[[ "$rel" == "." ]] && rel=""
		echo "$marketplace_repo|$rel"
		return
	fi

	source_type=$(echo "$source_json" | jq -r '.source // empty')
	if [[ "$source_type" == "github" ]]; then
		local repo
		repo=$(echo "$source_json" | jq -r '.repo // empty')
		[[ -z "$repo" ]] && return
		echo "$repo|"
		return
	fi
	if [[ "$source_type" == "git-subdir" ]]; then
		local url path repo
		url=$(echo "$source_json" | jq -r '.url // empty')
		path=$(echo "$source_json" | jq -r '.path // empty')
		[[ -z "$url" ]] && return
		# git-subdir carries a SEPARATE `path` field alongside `url` (verified
		# 2026-07-04 against real marketplaces: databricks/databricks-agent-
		# skills and hugohe3/ppt-master both use it) — path is NOT encoded
		# inside `url`. `url` itself has TWO real-world shapes: a bare
		# "owner/repo" shorthand (no scheme/domain at all) or a full GitHub git
		# URL (with or without a "github.com" host, scheme, or ".git" suffix).
		if [[ "$url" =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]]; then
			repo="$url"
		elif [[ "$url" =~ github\.com[/:]([^/]+/[^/]+?)(\.git)?/?$ ]]; then
			repo="${BASH_REMATCH[1]}"
		else
			return
		fi
		path="${path#./}"
		[[ "$path" == "." ]] && path=""
		echo "$repo|$path"
		return
	fi
	# Unrecognized source shape: caller treats as not-found.
}

while IFS= read -r identifier; do
	[[ -z "$identifier" ]] && continue
	identifier="${identifier#"${identifier%%[![:space:]]*}"}"
	identifier="${identifier%"${identifier##*[![:space:]]}"}"
	[[ -z "$identifier" ]] && continue

	if [[ "$HAS_GH" -eq 0 ]]; then
		emit "$identifier" "" "" "1" "null" "api-unavailable"
		continue
	fi

	resolved_repo=""
	resolved_path=""

	if [[ "$identifier" == *"#"* ]]; then
		marketplace_repo="${identifier%%#*}"
		plugin_name="${identifier#*#}"

		ensure_marketplace "$marketplace_repo"
		mp_status="${MARKETPLACE_STATUS[$marketplace_repo]}"
		if [[ "$mp_status" == "not-in-api" ]]; then
			emit "$identifier" "" "" "1" "null" "not-in-api"
			continue
		fi
		if [[ "$mp_status" == "api-unavailable" ]]; then
			emit "$identifier" "" "" "1" "null" "api-unavailable"
			continue
		fi

		resolution=$(resolve_source "$marketplace_repo" "$plugin_name")
		if [[ -z "$resolution" ]]; then
			# No matching plugins[] entry, or an unrecognized source shape —
			# both read as "this plugin isn't (or is no longer) resolvable".
			emit "$identifier" "" "" "1" "null" "not-in-api"
			continue
		fi
		resolved_repo="${resolution%%|*}"
		resolved_path="${resolution#*|}"
	else
		resolved_repo="$identifier"
		resolved_path=""
	fi

	plugin_json_path="${resolved_path:+$resolved_path/}.claude-plugin/plugin.json"
	plugin_body="$CACHE_DIR/plugin-$$.json"

	if ! gh api "repos/$resolved_repo/contents/$plugin_json_path" --jq .content 2>/dev/null | base64 -d >"$plugin_body" 2>/dev/null || [[ ! -s "$plugin_body" ]] || ! jq empty "$plugin_body" >/dev/null 2>&1; then
		if gh api "repos/$resolved_repo/contents/$plugin_json_path" >/dev/null 2>&1; then
			emit "$identifier" "" "https://github.com/$resolved_repo" "1" "null" "api-unavailable"
		else
			probe=$(gh api "repos/$resolved_repo/contents/$plugin_json_path" 2>&1 >/dev/null || true)
			if echo "$probe" | grep -qi "404\|Not Found"; then
				emit "$identifier" "" "https://github.com/$resolved_repo" "1" "null" "not-in-api"
			else
				emit "$identifier" "" "https://github.com/$resolved_repo" "1" "null" "api-unavailable"
			fi
		fi
		rm -f "$plugin_body"
		continue
	fi

	version=$(jq -r '.version // ""' "$plugin_body")
	rm -f "$plugin_body"

	if [[ -z "$version" ]]; then
		# plugin.json exists but carries no version field — a known, expected
		# per-PLUGIN state (verified: 13 of Anthropic's 18 official plugins lack
		# one while 5 siblings in the same marketplace carry real versions), not
		# a fetch failure.
		emit "$identifier" "" "https://github.com/$resolved_repo" "1" "null" "not-in-api"
		continue
	fi

	commit_date=$(gh api "repos/$resolved_repo/commits?path=$plugin_json_path&per_page=1" \
		--jq '.[0].commit.committer.date' 2>/dev/null || echo "")
	days="null"
	if [[ -n "$commit_date" && "$commit_date" != "null" ]]; then
		days=$(days_since "$commit_date")
	fi

	emit "$identifier" "$version" "https://github.com/$resolved_repo" "1" "$days" "ok"
done
