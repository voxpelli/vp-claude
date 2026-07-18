#!/bin/bash
set -euo pipefail

# SessionStart hook — emits exactly ONE JSON object with all context merged
# into additionalContext. Prior versions emitted 2-3 separate objects but
# Claude Code reads only the first, silently dropping the rest.

# Count RETRO files for the audit-cycle reminder (CWD = project root at SessionStart)
count=$(find . -maxdepth 1 -name "RETRO-*.md" 2>/dev/null | wc -l | tr -d ' ')

# Build the optional audit-cycle sentence.
# Audit cycle: every 4th sprint (mod 4 == 3 is pre-warning, mod 4 == 0 is audit sprint).
# Assumes sequential RETRO-N.md naming.
audit_reminder=""
if [ "$count" -gt 0 ]; then
	mod=$((count % 4))
	if [ "$mod" -eq 3 ]; then
		next=$((count + 1))
		audit_reminder="Graph-audit reminder: Sprint ${next} will be a graph-audit sprint. When running /retrospective next time, run the knowledge-gardener agent (read-only audit) then knowledge-maintainer (auto-fix) for full graph health: schema validation, stale-note detection, drift check, and orphan audit."
	elif [ "$mod" -eq 0 ]; then
		current=$((count + 1))
		audit_reminder="Graph-audit sprint: Sprint ${current} — run knowledge-gardener (audit) then knowledge-maintainer (fix) alongside /retrospective for full graph health: schema validation, stale-note detection, drift detection, and orphan check."
	fi
fi

# Read the hook payload from stdin. SessionStart provides {"source": "..."},
# where source is startup|resume|clear|compact. Only "compact" needs the
# post-compaction recovery block: PreCompact/PostCompact additionalContext is
# never injected into the resumed agent (Claude Code docs — those events are
# observability-only / fire pre-compaction), so SessionStart source=compact is
# the only slot that reaches it.
input=$(cat)
source=$(jq -r '.source // empty' <<<"$input" 2>/dev/null || true)

recovery=""
if [ "$source" = "compact" ]; then
	# Backticks below are literal markdown code spans in the message, not command
	# substitution — the string is emitted verbatim, never evaluated.
	# shellcheck disable=SC2016
	recovery='Post-compaction recovery: the Basic Memory knowledge graph is still available. If the ongoing task touches packages, tools, or the graph, recall context with `mcp__basic-memory__recent_activity(timeframe="7d")` or `/knowledge-prime`, and answer topic questions with `/knowledge-ask`. Research skills remain available — /intel <prefix>:<name> (packages: npm/crate/go/composer/pypi/gem, no prefix defaults to npm; tools: brew/cask/action/docker/vscode/gh/plugin/skill), /knowledge-gaps (coverage; --stale drift; --global installed plugin/skill coverage). Schema edits dual-sync to schemas/*.md; never edit ~/basic-memory files directly — always use the mcp__basic-memory__* tools.'
fi

# Learning-nudge tip fragment — a separate script run as a subprocess (not
# inlined, not sourced) so it gets its own check-hooks.mjs fixture without
# touching the two already-load-bearing fragments above. ${CLAUDE_PLUGIN_ROOT}
# substitution only happens inside hooks.json's command string, not inside a
# script's own body, so the sibling is resolved via ${BASH_SOURCE[0]} instead.
# Every failure mode inside it degrades to empty output, never an error —
# this call is guarded the same way for the same reason.
tip=$(bash "$(dirname "${BASH_SOURCE[0]}")/tip-fragment.sh" "$source" 2>/dev/null) || tip=""

# Emit exactly one JSON object with all content in additionalContext
jq -n \
	--arg graph 'Knowledge graph context: Use `mcp__basic-memory__list_directory(dir_name="/", depth=1)` and `mcp__basic-memory__recent_activity(timeframe="7d")` early in the session if the user'"'"'s task involves the knowledge graph or packages. The /intel and /knowledge-gaps skills are available for research. /intel researches a package (npm, Rust crates, Go modules, PHP Composer, Python PyPI, Ruby gems) OR a developer/CI tool and creates/updates a Basic Memory note. Prefixed invocations: /intel crate:serde, /intel pypi:requests, /intel go:github.com/gin-gonic/gin, /intel npm:fastify (no prefix defaults to npm), /intel brew:ripgrep (Homebrew formulae), /intel cask:warp (casks), /intel action:actions/checkout (GitHub Actions), /intel docker:grafana/grafana (Docker images), /intel vscode:<publisher>.<ext> (VSCode extensions), /intel gh:<owner>/<repo> (gh CLI extensions), /intel plugin:<owner>/<repo> (Claude Code plugins), /intel skill:<owner>/<repo> (skills.sh bundles). Use /knowledge-gaps to audit both package and tool manifest coverage. Use /schema-evolve <type> to detect schema drift, propose frequency-driven field changes, and dual-sync BM notes with local schema files.' \
	--arg prime 'At session start, if the task involves understanding project dependencies, tools, or the knowledge graph, suggest running /knowledge-prime to load a context brief with documented packages, coverage gaps, and key gotchas. For topic-specific questions about a package, tool, or concept already in the graph, suggest /knowledge-ask. For comprehensive gap analysis, suggest /knowledge-gaps. For schema drift detection, suggest /schema-evolve. For scoped note health, /knowledge-garden audits one or more named notes and /knowledge-maintain applies fixes inline — both are explicit /commands (not auto-triggered), so mention them when the task involves checking or repairing specific notes.' \
	--arg audit "$audit_reminder" \
	--arg recovery "$recovery" \
	--arg tip "$tip" \
	'{additionalContext: ([$graph, $prime] + (if $audit != "" then [$audit] else [] end) + (if $recovery != "" then [$recovery] else [] end) + (if $tip != "" then [$tip] else [] end) | join("\n\n"))}'
