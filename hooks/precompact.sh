#!/bin/bash
set -euo pipefail

# Emit additionalContext so the main Claude session receives reflection
# instructions with full MCP tool access (unlike prompt hooks which can't
# call MCP tools).
cat <<'EOF'
{"additionalContext": "Context is about to be compacted. Before losing conversation history, review the current conversation for insights worth preserving in Basic Memory:\n\n1. Were any technical decisions made? (architecture choices, library selections, API designs)\n2. Were any debugging insights discovered? (root causes, non-obvious fixes, gotchas)\n3. Were any patterns or conventions established?\n4. Were any packages researched or evaluated?\n\nFor each valuable insight found, use mcp__basic-memory__edit_note to append observations to the most relevant existing note (find the right one with mcp__basic-memory__search_notes first), or mcp__basic-memory__write_note to create a new note if no relevant note exists.\n\nKeep notes concise — capture the insight, not the full conversation. Use [decision], [lesson], [gotcha], or [pattern] observation categories.\n\nDo not capture version bumps, release notes, or changelog entries as observations — these belong in CHANGELOG.md or a Version History section, not as [pattern] or [lesson] observations. Only capture insights that would be useful in a different project or a future session.\n\nIf nothing worth preserving was discussed, do nothing."}
EOF
