# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin (`vp-claude`) containing user-owned skills, agents, and hooks that build on [Basic Memory](https://github.com/basicmachines-co/basic-memory) (running as an MCP server). These complement the upstream `basicmachines-co/basic-memory-skills` (which provides core `memory-*` skills) with higher-level workflows for npm package research, knowledge graph maintenance, and automated quality checks.

## Plugin Layout

```
.claude-plugin/
  plugin.json                        # Plugin manifest
skills/
  package-intel/SKILL.md             # Five-source npm package research pipeline
  knowledge-gaps/SKILL.md            # Cross-reference deps vs BM coverage
agents/
  knowledge-gardener.md              # Read-only graph health auditor
  knowledge-maintainer.md            # All-in-one graph enhancer (writes)
  session-reflector.md               # On-demand conversation → memory capture
hooks/
  hooks.json                         # PostToolUse, PreCompact, SessionStart hooks
```

No runtime code — pure markdown + JSON. No build step, no dependencies.

## Components

### Skills (2)

- **package-intel** — Researches an npm package via five sources (Basic Memory, DeepWiki, Context7, Tavily, Raindrop) and writes/updates a structured `npm:*` note. User-invocable as `/package-intel <pkg>`.
- **knowledge-gaps** — Parses `package.json` dependencies, checks which have `npm:*` notes in Basic Memory, tiers undocumented packages by import frequency. User-invocable as `/knowledge-gaps`.

### Agents (2)

- **knowledge-gardener** — Read-only autonomous auditor: inventory, schema validation, orphan detection, relation integrity, stale/duplicate notes, cross-project consistency. **Never writes or modifies notes.**
- **knowledge-maintainer** — All-in-one write agent that acts on audit findings. Auto-fixes structural issues (missing sections, broken frontmatter, orphan linking). Confirms before content changes (merging duplicates, rewriting prose, archiving). Auto-runs `/package-intel` for Tier 1 undocumented packages (3+ imports). `delete_note` intentionally excluded — use `move_note` to `archive/`. Reactive only — user must explicitly invoke.
- **session-reflector** — On-demand reflection agent. Reviews the current conversation, extracts durable insights, shows a preview grouped by target note, waits for approval, then writes. Complements the automatic PreCompact hook with a deliberate, user-gated equivalent.

### Hooks (3)

- **PostToolUse** (`write_note`/`edit_note` matcher) — Validates notes against their BM schema after any write.
- **PreCompact** — Auto-reflects conversation insights into Basic Memory before context compaction.
- **SessionStart** — Injects a brief knowledge graph status summary (note count, last audit, top gaps).

## MCP Tool Dependencies

Skills and agents reference tools from multiple MCP servers. When editing, use exact tool names:

| Server | Prefix | Used by |
|--------|--------|---------|
| Basic Memory | `mcp__basic-memory__*` | All components |
| DeepWiki | `mcp__deepwiki__*` | package-intel |
| Context7 | `mcp__plugin_context7_context7__*` | package-intel |
| Tavily | `mcp__tavily__*` | package-intel |
| Raindrop | `mcp__raindrop__*` | package-intel |

## Conventions

### Skill frontmatter

Required fields: `name`, `description`, `user-invocable`, `allowed-tools`. The `description` is a trigger phrase list — write it so Claude picks the right skill when a user says something relevant. The `allowed-tools` list is an allowlist; only include tools the skill actually calls.

### Agent frontmatter

Required fields: `name`, `description`, `model`, `color`, `tools`. The `tools` field is a YAML list of allowed tool names. The knowledge-gardener must remain read-only — never add `write_note`, `edit_note`, or `delete_note` to its tools list. The knowledge-maintainer has write access but must confirm before content-level changes.

### Hook conventions

Hooks use `${CLAUDE_PLUGIN_ROOT}` for portable paths. Prompt-based hooks are preferred for complex logic. All hooks are defined in `hooks/hooks.json`.

### Note structure conventions (for package-intel output)

- Title: `npm:<package-name>` (resolves `[[npm:pkg]]` wiki-links)
- Directory: `npm/`
- Type: `npm_package` (snake_case — Basic Memory enforces snake_case for all type fields)
- Three enrichment layers: frontmatter metadata, `## Observations` with `[category]` tags, `## Relations` with `[[wiki-links]]`
- Use `edit_note` with `find_replace` for updates — `append` with `section` goes to end of file, not end of section

### Relationship to upstream memory-* skills

The `basicmachines-co/basic-memory-skills` package provides 9 core `memory-*` skills (notes, schema, tasks, lifecycle, etc.) installed via `npx skills add basicmachines-co/basic-memory-skills` ([skills.sh](https://skills.sh)). This plugin depends on those conventions but does not bundle or duplicate them. `package-intel` specializes the generic `memory-research` pattern for npm packages.
