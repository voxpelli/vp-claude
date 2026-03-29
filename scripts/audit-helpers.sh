#!/bin/bash
set -euo pipefail

# audit-helpers.sh — Pre-built jq pipelines for knowledge-gardener audit.
# Covers Bash-native data sources (bm CLI + audit-scope-leak.sh output).
# MCP tool results should be reasoned about inline — not piped through scripts.
#
# Usage: bash scripts/audit-helpers.sh <subcommand> [args]
# Requires: jq, bm CLI

command -v jq >/dev/null 2>&1 || {
	echo "Error: jq is required" >&2
	exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-}" in
bm-stats)
	# Emit flat summary from bm project info
	bm project info main --json 2>/dev/null | jq -c '{
      total_notes:       .statistics.total_entities,
      isolated_entities: .statistics.isolated_entities,
      total_relations:   .statistics.total_relations,
      unresolved:        .statistics.total_unresolved_relations,
      top_types:         (.statistics.note_types | to_entries | sort_by(-.value) | .[:8] | from_entries),
      top_categories:    (.statistics.observation_categories | to_entries | sort_by(-.value) | .[:8] | from_entries)
    }'
	;;

scope-leak-summary)
	BM_ROOT="${2:?Usage: audit-helpers.sh scope-leak-summary <bm-root>}"
	BM_ROOT="${BM_ROOT/#\~/$HOME}"
	bash "$SCRIPT_DIR/audit-scope-leak.sh" "$BM_ROOT" |
		jq -sc 'group_by(.pattern) | map({pattern: .[0].pattern, count: length}) | sort_by(-.count)'
	;;

scope-leak-detail)
	BM_ROOT="${2:?Usage: audit-helpers.sh scope-leak-detail <bm-root> <pattern>}"
	PATTERN="${3:?Usage: audit-helpers.sh scope-leak-detail <bm-root> <pattern>}"
	BM_ROOT="${BM_ROOT/#\~/$HOME}"
	bash "$SCRIPT_DIR/audit-scope-leak.sh" "$BM_ROOT" |
		jq -sc --arg p "$PATTERN" '[.[] | select(.pattern == $p)]'
	;;

*)
	echo "Usage: audit-helpers.sh <subcommand> [args]" >&2
	echo "  bm-stats                           Graph stats summary" >&2
	echo "  scope-leak-summary <bm-root>       Group findings by pattern" >&2
	echo "  scope-leak-detail <bm-root> <pat>  Filter to one pattern" >&2
	exit 1
	;;
esac
