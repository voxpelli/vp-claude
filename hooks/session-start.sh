#!/bin/bash
set -euo pipefail

# SessionStart hook — emits exactly ONE JSON object with all context merged
# into additionalContext. Prior versions emitted 2-3 separate objects but
# Claude Code reads only the first, silently dropping the rest.

# Count RETRO files for the audit-cycle reminder (CWD = project root at SessionStart)
count=$(find . -maxdepth 1 -name "RETRO-*.md" 2>/dev/null | wc -l | tr -d ' ')

# Build the optional audit-cycle sentence
audit_reminder=""
if [ "$count" -gt 0 ]; then
	mod=$((count % 4))
	if [ "$mod" -eq 3 ]; then
		next=$((count + 1))
		audit_reminder="Graph-audit reminder: Sprint ${next} will be a graph-audit sprint. When running /retrospective next time, also invoke the knowledge-gardener agent for full graph health: schema validation, stale-note detection, drift check, and orphan audit."
	elif [ "$mod" -eq 0 ]; then
		current=$((count + 1))
		audit_reminder="Graph-audit sprint: Sprint ${current} — run the knowledge-gardener agent alongside /retrospective for full graph health: schema validation, stale-note detection, drift detection, and orphan check."
	fi
fi

# Emit exactly one JSON object with all content in additionalContext
jq -n \
	--arg graph 'Knowledge graph context: Use `mcp__basic-memory__list_directory(dir_name="/", depth=1)` and `mcp__basic-memory__recent_activity(timeframe="7d")` early in the session if the user'"'"'s task involves the knowledge graph or packages. The /package-intel and /knowledge-gaps skills are available for multi-ecosystem package research (npm, Rust crates, Go modules, PHP Composer, Python PyPI, Ruby gems). Use prefixed invocations: /package-intel crate:serde, /package-intel pypi:requests, /package-intel go:github.com/gin-gonic/gin, /package-intel composer:vendor/pkg, /package-intel gem:rails. No prefix defaults to npm. The /tool-intel skill researches developer environment and CI/CD tooling: brew:<name> (Homebrew formulae), cask:<name> (Homebrew casks), action:<owner>/<repo> (GitHub Actions), docker:<image> (Docker images), vscode:<publisher>.<ext> (VSCode extensions). Use /knowledge-gaps to audit both package and tool manifest coverage. Use /schema-evolve <type> to detect schema drift, propose frequency-driven field changes, and dual-sync BM notes with local schema files.' \
	--arg prime 'At session start, if the task involves understanding project dependencies, tools, or the knowledge graph, suggest running /knowledge-prime to load a context brief with documented packages, coverage gaps, and key gotchas. For comprehensive gap analysis, suggest /knowledge-gaps. For schema drift detection, suggest /schema-evolve.' \
	--arg audit "$audit_reminder" \
	'{additionalContext: ([$graph, $prime] + (if $audit != "" then [$audit] else [] end) | join("\n\n"))}'
