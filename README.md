# vp-claude

A Claude Code plugin for [Basic Memory](https://github.com/basicmachines-co/basic-memory) power users. Provides npm package research, knowledge gap analysis, graph maintenance agents, and automated quality hooks.

## Prerequisites

- [Basic Memory](https://github.com/basicmachines-co/basic-memory) running as an MCP server
- The upstream [`basic-memory-skills`](https://github.com/basicmachines-co/basic-memory-skills) installed (provides core `memory-*` skills)
- Optional: DeepWiki, Context7, Tavily, and Raindrop MCP servers for the full enrichment pipeline

## Components

### Skills

| Skill | Invocation | Description |
|-------|-----------|-------------|
| package-intel | `/package-intel <pkg>` | Five-source npm package research pipeline |
| knowledge-gaps | `/knowledge-gaps` | Cross-reference project deps vs Basic Memory coverage |

### Agents

| Agent | Trigger | Description |
|-------|---------|-------------|
| knowledge-gardener | "audit my knowledge graph" | Read-only graph health auditor |
| knowledge-maintainer | "fix the graph issues" | All-in-one graph enhancer (auto-fixes structure, confirms content changes) |

### Hooks

| Event | Purpose |
|-------|---------|
| PostToolUse | Validates note structure after Basic Memory writes |
| PreCompact | Auto-saves conversation insights before context compaction |
| SessionStart | Injects graph context reminder |

## Installation

```bash
claude --plugin-dir /path/to/vp-claude
```

## License

MIT
