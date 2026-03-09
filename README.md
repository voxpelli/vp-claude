# vp-claude

A [Claude Code](https://claude.ai/code) plugin that turns [Basic Memory](https://github.com/basicmachines-co/basic-memory) into an actively maintained knowledge graph. Research npm packages from five sources at once, find documentation gaps in your projects, and let autonomous agents audit and improve your notes — all without leaving your terminal.

## What it does

### `/package-intel <pkg>` — Research any npm package

Queries five sources in parallel and synthesizes a structured note:

```
/package-intel @fastify/postgres
```

| Source | What it finds |
|--------|--------------|
| Basic Memory | Existing notes, cross-references, usage patterns |
| DeepWiki | Architecture, design patterns, key APIs |
| Context7 | API reference, code examples |
| Tavily | Security advisories, recent CVEs |
| Raindrop | Your bookmarked articles about the package |

Plus changelog analysis via GitHub releases. The result is a `npm:*` note with observations, relations, and release highlights — ready to query later.

### `/knowledge-gaps` — Find undocumented dependencies

Scans your `package.json`, checks which packages have Basic Memory notes, and tiers the gaps by how heavily you use each package:

```
## Knowledge Gap Report — my-project

### Coverage: 12/47 packages documented (25%)

### Tier 1 — Must Document (3+ imports)
| Package     | Import Count | Domain              |
|-------------|-------------|---------------------|
| fastify     | 12          | engineering/fastify/ |
| pg          | 8           | engineering/        |

### Tier 2 — Should Document (1-2 imports)
...
```

Offers to run `/package-intel` for the top undocumented packages.

### Knowledge Gardener — Read-only graph auditor

An autonomous agent that produces a health report without modifying anything:

> "Audit my knowledge graph"

Checks for: missing sections, schema violations, orphan notes, broken `[[wiki-links]]`, stale notes (90+ days), duplicates, and project-specific data leaking into cross-project notes.

### Knowledge Maintainer — All-in-one graph enhancer

Acts on audit findings with tiered autonomy:

> "Fix the graph issues"

| Action | Autonomy |
|--------|----------|
| Add missing `## Observations` / `## Relations` sections | Auto-fix |
| Link orphan notes to related notes | Auto-fix |
| Fix frontmatter type to match schema | Auto-fix |
| Run `/package-intel` for Tier 1 undocumented packages | Auto-fix |
| Merge duplicate notes | Asks first |
| Archive/delete abandoned notes | Asks first |
| Rewrite note prose | Asks first |

### Hooks — Automated quality guardrails

Three hooks run automatically in the background:

- **PostToolUse** — After any `write_note` or `edit_note`, validates the note structure against its schema. Catches malformed notes immediately.
- **PreCompact** — Before context compaction, reviews the conversation for decisions, lessons, and gotchas worth saving. Writes them to Basic Memory so insights survive across sessions.
- **SessionStart** — Reminds Claude that graph tools and research skills are available.

## Prerequisites

- [Basic Memory](https://github.com/basicmachines-co/basic-memory) running as an MCP server
- The upstream [`basic-memory-skills`](https://github.com/basicmachines-co/basic-memory-skills) installed (provides core `memory-*` skills this plugin builds on)
- For the full enrichment pipeline: DeepWiki, Context7, Tavily, and Raindrop MCP servers

## Installation

```bash
claude --plugin-dir /path/to/vp-claude
```

## Plugin structure

```
.claude-plugin/plugin.json             Plugin manifest
skills/
  package-intel/
    SKILL.md                           Five-source research workflow
    references/note-template.md        Note template for npm:* notes
  knowledge-gaps/
    SKILL.md                           Dependency coverage analysis
agents/
  knowledge-gardener.md                Read-only graph auditor
  knowledge-maintainer.md              Read-write graph enhancer
hooks/
  hooks.json                           PostToolUse, PreCompact, SessionStart
  session-start.sh                     Graph context injection script
```

## How it fits together

```
 User says            Triggers              Output
 ─────────────────    ───────────────────    ──────────────────────────
 /package-intel X  -> package-intel skill -> npm:X note in Basic Memory
 /knowledge-gaps   -> knowledge-gaps skill-> gap report + offers /package-intel
 "audit graph"     -> knowledge-gardener  -> health report (read-only)
 "fix the graph"   -> knowledge-maintainer-> structural fixes + confirmations
                      ├── runs gardener audit internally
                      ├── auto-fixes structure
                      ├── auto-runs /package-intel for Tier 1 gaps
                      └── asks before content changes

 [any BM write]    -> PostToolUse hook    -> schema validation feedback
 [context compact] -> PreCompact hook     -> insights saved to BM
 [session start]   -> SessionStart hook   -> graph context reminder
```

## Relationship to upstream

This plugin depends on but does not duplicate the 9 core `memory-*` skills from [`basicmachines-co/basic-memory-skills`](https://github.com/basicmachines-co/basic-memory-skills) (notes, schema, tasks, lifecycle, reflect, etc.). It adds npm-ecosystem-specific research, project-level gap analysis, and autonomous graph maintenance on top of those foundations.

## License

MIT
