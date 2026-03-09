#!/bin/bash
cat <<'EOF'
{"systemMessage": "Knowledge graph context: Use `mcp__basic-memory__list_directory(dir_name=\"/\", depth=1)` and `mcp__basic-memory__recent_activity(timeframe=\"7d\")` early in the session if the user's task involves the knowledge graph or npm packages. The /package-intel and /knowledge-gaps skills are available for package research."}
EOF
