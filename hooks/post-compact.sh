#!/bin/bash
set -euo pipefail

# PostCompact hook — re-injects knowledge-graph recovery context after a
# compaction. Compaction can drop the SessionStart graph guidance from the
# window; this restores a condensed form so the continuing session still knows
# the Basic Memory tools and research skills exist. Emits exactly ONE JSON
# object with additionalContext (Claude Code reads only the first on stdout).
# Adopted from vp-beads' PostCompact recovery pattern (bd vp-claude-1oah); the
# security-signal half of that bead is intentionally dropped — vp-knowledge has
# no Dependabot-style signal analog (revive if a graph-health alert emerges).

jq -n \
	--arg recovery 'Post-compaction recovery: the Basic Memory knowledge graph is still available. If the ongoing task touches packages, tools, or the graph, recall context with `mcp__basic-memory__recent_activity(timeframe="7d")` or `/knowledge-prime`, and answer topic questions with `/knowledge-ask`. Research skills remain available — /package-intel (npm/crate/go/composer/pypi/gem), /tool-intel (brew/cask/action/docker/vscode/gh/plugin/skill), /knowledge-gaps (coverage; --stale drift; --global installed plugin/skill coverage). Schema edits dual-sync to schemas/*.md; never edit ~/basic-memory files directly — always use the mcp__basic-memory__* tools.' \
	'{additionalContext: $recovery}'
