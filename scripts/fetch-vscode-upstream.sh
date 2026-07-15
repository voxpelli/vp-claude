#!/bin/bash
set -euo pipefail

# spec: skills/intel/references/ecosystem-vscode.md
#
# Fetch upstream facts for a list of VSCode extension IDs from BOTH the Open
# VSX registry (authoritative — what the note links to and what a refresh
# records) and the VS Marketplace (best-effort annotation). Reads extension
# IDs (publisher.extension) from stdin, emits NDJSON per ID to stdout.
#
# This script NEVER touches ~/basic-memory/ — that is the caller's concern.
# The calling agent resolves each note's extension ID (strip the leading
# `vscode-` prefix) via the BM MCP tools and pipes just the IDs here.
#
# Drift verdict is computed against the latest STABLE Open VSX version
# (upstream_version) so a refresh converges. Open VSX has no `stable` alias and
# sorts CalVer pre-releases above semver stable, so `.version` (openvsx_version)
# can be a pre-release; when it is, upstream_version is resolved to the latest
# non-pre-release version. The Marketplace version is an annotation only.
#
# Output fields per line (brew contract + vscode-specific fields):
#   name                extension ID (matches input)
#   upstream_version    latest STABLE Open VSX version (the drift verdict);
#                       falls back to .version when no stable exists; "" when not-in-api
#   homepage            always ""
#   deprecated          always false
#   disabled            always false
#   tier                always "1"
#   days_stale          days since the resolved version's Open VSX .timestamp
#   upstream_state      ok | not-in-api | api-unavailable
#   openvsx_version     Open VSX default .version (raw; may be a pre-release)
#   marketplace_version VS Marketplace latest version ("" on failure/absence)
#   openvsx_namespace_access  "restricted" | "public" | "" — Open VSX namespace
#                             lock state; "public" means anyone may publish into
#                             the namespace (unverified bottom trust tier)
#   openvsx_verified    true | false — Open VSX namespace `verified` flag
#   openvsx_publisher   Open VSX publishedBy.loginName ("" when not on Open VSX)
#   openvsx_prerelease  true | false — whether the default .version is a
#                       pre-release (true also when only pre-releases exist and
#                       no stable could be resolved; consumers apply the
#                       semver↔calver scheme-mismatch guard in that case)
#
# A 404 on Open VSX with a non-empty marketplace_version is the "marketplace-only"
# signal: the namespace is unclaimed/squattable and fork-IDEs (Cursor, Windsurf,
# VSCodium, Theia) resolve installs against Open VSX — see
# `references/ecosystem-vscode.md` "Open VSX Trust Signal".
#
# Usage:
#   printf '%s\n' esbenp.prettier-vscode | bash fetch-vscode-upstream.sh

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
	local d="${5:-null}"
	[[ -z "$d" ]] && d="null"
	local ver="${9:-false}"
	[[ -z "$ver" ]] && ver="false"
	local prerel="${11:-false}"
	[[ -z "$prerel" ]] && prerel="false"
	jq -cn \
		--arg name "$1" \
		--arg up_v "$2" \
		--arg tier "$3" \
		--arg upstream_state "$4" \
		--argjson days "$d" \
		--arg ovsx "$6" \
		--arg mp "$7" \
		--arg nsa "$8" \
		--argjson verified "$ver" \
		--arg publisher "${10}" \
		--argjson prerelease "$prerel" \
		'{name:$name, upstream_version:$up_v, homepage:"", deprecated:false, disabled:false, tier:$tier, days_stale:$days, upstream_state:$upstream_state, openvsx_version:$ovsx, marketplace_version:$mp, openvsx_namespace_access:$nsa, openvsx_verified:$verified, openvsx_publisher:$publisher, openvsx_prerelease:$prerelease}'
}

# Days since an ISO 8601 UTC timestamp. Normalizes to the strict
# %Y-%m-%dT%H:%M:%SZ form both parsers require, in this order: (1) strip a
# trailing numeric offset like +02:00, (2) strip a trailing Z, (3) strip
# fractional seconds (Open VSX carries microseconds, e.g.
# 2026-03-16T19:14:43.319347Z), (4) re-append Z. NOTE: step (1) treats the
# wall-clock value as UTC rather than CONVERTING it — only safe because Open
# VSX emits Z-suffixed UTC; a real non-Z offset would skew the result by the
# offset amount. A colon-less offset (+0200) or otherwise unparseable input
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

# Set by extract_stable_version() to the resolved stable version's timestamp.
STABLE_TIMESTAMP=""

# Resolve the latest STABLE (non-pre-release) Open VSX version when the default
# .version is a pre-release. Open VSX has no `stable` alias and sorts CalVer
# pre-releases above semver stable, so `.version` alone is unreliable. Strategy:
# parse the allVersions map already in $BODY, drop CalVer keys (leading numeric
# component >= 2000) and non-version alias keys (e.g. "latest"/"pre-release",
# which lack a leading "<digits>." form), pick the highest-sorting semver key,
# then confirm preRelease:false with ONE extra request (capturing its timestamp
# into STABLE_TIMESTAMP). Echoes the resolved version, or "" if none qualifies
# (pre-release-only extension). Never fails the script.
extract_stable_version() {
	local pub="$1" ext="$2" cand verbody verhttp pr
	STABLE_TIMESTAMP=""

	cand=$(jq -r '
		(.allVersions // {}) | keys_unsorted[]
		| select(test("^[0-9]+\\.") and ((split(".")[0] | tonumber) < 2000))
	' "$BODY" 2>/dev/null |
		sort -t. -k1,1rn -k2,2rn -k3,3rn | head -1)

	if [[ -z "$cand" ]]; then
		echo ""
		return
	fi

	verbody=$(mktemp)
	verhttp=$(curl -s -o "$verbody" -w "%{http_code}" \
		--max-time 15 "https://open-vsx.org/api/$pub/$ext/$cand" 2>/dev/null) || verhttp="000"
	if [[ "$verhttp" != "200" ]] || ! jq empty "$verbody" >/dev/null 2>&1; then
		rm -f "$verbody"
		echo ""
		return
	fi
	pr=$(jq -r 'if .preRelease == true then "true" else "false" end' "$verbody")
	if [[ "$pr" == "true" ]]; then
		rm -f "$verbody"
		echo ""
		return
	fi
	STABLE_TIMESTAMP=$(jq -r '.timestamp // ""' "$verbody")
	rm -f "$verbody"
	echo "$cand"
}

# Best-effort VS Marketplace lookup. Never fails the script; empty on any error.
marketplace_version() {
	local id="$1" payload body
	payload=$(jq -cn --arg v "$id" '{filters:[{criteria:[{filterType:7,value:$v}]}],flags:914}')
	body=$(curl -s --max-time 15 \
		-X POST 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery' \
		-H 'Content-Type: application/json' \
		-H 'Accept: application/json;api-version=3.0-preview.1' \
		-d "$payload" 2>/dev/null || echo "")
	echo "$body" | jq -r '.results[0].extensions[0].versions[0].version // ""' 2>/dev/null || echo ""
}

while IFS= read -r name; do
	[[ -z "$name" ]] && continue
	name="${name#"${name%%[![:space:]]*}"}"
	name="${name%"${name##*[![:space:]]}"}"
	[[ -z "$name" ]] && continue

	# Split publisher.extension on the FIRST dot (extension names may contain
	# further dots, publishers may not).
	pub="${name%%.*}"
	ext="${name#*.}"

	mp_version=$(marketplace_version "$name")

	http_code=$(curl -s -o "$BODY" -w "%{http_code}" \
		--max-time 20 "https://open-vsx.org/api/$pub/$ext" 2>/dev/null) || http_code="000"

	# Open VSX 404 → not on Open VSX (often MS-proprietary). Surface the
	# Marketplace version as annotation but route the verdict to not-in-api.
	if [[ "$http_code" == "404" ]]; then
		emit "$name" "" "1" "not-in-api" "" "" "$mp_version" "" "false" "" "false"
		continue
	fi
	if [[ "$http_code" != "200" ]] || ! jq empty "$BODY" >/dev/null 2>&1; then
		emit "$name" "" "1" "api-unavailable" "" "" "$mp_version" "" "false" "" "false"
		continue
	fi

	ovsx_version=$(jq -r '.version // ""' "$BODY")
	ovsx_prerelease=$(jq -r 'if .preRelease == true then "true" else "false" end' "$BODY")
	timestamp=$(jq -r '.timestamp // ""' "$BODY")
	if [[ -z "$ovsx_version" ]]; then
		emit "$name" "" "1" "api-unavailable" "" "" "$mp_version" "" "false" "" "false"
		continue
	fi

	# The drift verdict uses the latest STABLE version; openvsx_version keeps the
	# raw default .version for provenance. When the default is a pre-release,
	# resolve the latest non-pre-release version (CalVer pre-releases sort above
	# semver stable on Open VSX, so .version alone would shadow the stable line).
	upstream_version="$ovsx_version"
	if [[ "$ovsx_prerelease" == "true" ]]; then
		stable_version=$(extract_stable_version "$pub" "$ext")
		if [[ -n "$stable_version" ]]; then
			upstream_version="$stable_version"
			[[ -n "$STABLE_TIMESTAMP" ]] && timestamp="$STABLE_TIMESTAMP"
		fi
	fi

	days="null"
	[[ -n "$timestamp" ]] && days=$(days_since "$timestamp")

	# Open VSX trust fields: namespace lock state, verified flag, publisher login.
	ns_access=$(jq -r '.namespaceAccess // ""' "$BODY")
	verified=$(jq -r 'if .verified == true then "true" else "false" end' "$BODY")
	ovsx_publisher=$(jq -r '.publishedBy.loginName // ""' "$BODY")

	emit "$name" "$upstream_version" "1" "ok" "$days" "$ovsx_version" "$mp_version" \
		"$ns_access" "$verified" "$ovsx_publisher" "$ovsx_prerelease"
done
