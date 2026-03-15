#!/bin/bash
set -euo pipefail

# Always emit the knowledge-graph context message
cat <<'EOF'
{"systemMessage": "Knowledge graph context: Use `mcp__basic-memory__list_directory(dir_name=\"/\", depth=1)` and `mcp__basic-memory__recent_activity(timeframe=\"7d\")` early in the session if the user's task involves the knowledge graph or packages. The /package-intel and /knowledge-gaps skills are available for multi-ecosystem package research (npm, Rust crates, Go modules, PHP Composer, Python PyPI, Ruby gems). Use prefixed invocations: /package-intel crate:serde, /package-intel pypi:requests, /package-intel go:github.com/gin-gonic/gin, /package-intel composer:vendor/pkg, /package-intel gem:rails. No prefix defaults to npm. The /tool-intel skill researches developer environment and CI/CD tooling: brew:<name> (Homebrew formulae), cask:<name> (Homebrew casks), action:<owner>/<repo> (GitHub Actions), docker:<image> (Docker images), vscode:<publisher>.<ext> (VSCode extensions). Use /knowledge-gaps to audit both package and tool manifest coverage. Use /schema-evolve <type> to detect schema drift, propose frequency-driven field changes, and dual-sync BM notes with local schema files."}
EOF

# Graph-audit cycle reminder: emit only on every 4th sprint (silent otherwise)
count=$(find . -maxdepth 1 -name "RETRO-*.md" 2>/dev/null | wc -l | tr -d ' ')

if [ "$count" -eq 0 ]; then
	exit 0
fi

mod=$((count % 4))

if [ "$mod" -eq 3 ]; then
	next=$((count + 1))
	printf '{"systemMessage": "Graph-audit reminder: Sprint %d will be a graph-audit sprint. When running /retrospective next time, also invoke the knowledge-gardener agent for full graph health: schema validation, stale-note detection, drift check, and orphan audit."}\n' "$next"
elif [ "$mod" -eq 0 ]; then
	current=$((count + 1))
	printf '{"systemMessage": "Graph-audit sprint: Sprint %d — run the knowledge-gardener agent alongside /retrospective for full graph health: schema validation, stale-note detection, drift detection, and orphan check."}\n' "$current"
fi
