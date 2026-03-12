#!/bin/bash
cat <<'EOF'
{"systemMessage": "Knowledge graph context: Use `mcp__basic-memory__list_directory(dir_name=\"/\", depth=1)` and `mcp__basic-memory__recent_activity(timeframe=\"7d\")` early in the session if the user's task involves the knowledge graph or packages. The /package-intel and /knowledge-gaps skills are available for multi-ecosystem package research (npm, Rust crates, Go modules, PHP Composer, Python PyPI, Ruby gems). Use prefixed invocations: /package-intel crate:serde, /package-intel pypi:requests, /package-intel go:github.com/gin-gonic/gin, /package-intel composer:vendor/pkg, /package-intel gem:rails. No prefix defaults to npm."}
EOF
