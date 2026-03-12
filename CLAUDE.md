# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin (`vp-knowledge`) containing user-owned skills, agents, and hooks that build on [Basic Memory](https://github.com/basicmachines-co/basic-memory) (running as an MCP server). These complement the upstream `basicmachines-co/basic-memory-skills` (which provides core `memory-*` skills) with higher-level workflows for package and developer-tool research, knowledge graph maintenance, and automated quality checks.

## Plugin Layout

```
.claude-plugin/
  plugin.json                        # Plugin manifest
skills/
  package-intel/SKILL.md             # Five-source multi-ecosystem package research
  tool-intel/SKILL.md                # Four-source dev-tool research (brew/action/docker/vscode)
  knowledge-gaps/SKILL.md            # Cross-reference deps + tool manifests vs BM coverage
agents/
  knowledge-gardener.md              # Read-only graph health auditor
  knowledge-maintainer.md            # All-in-one graph enhancer (writes)
  session-reflector.md               # On-demand conversation → memory capture
hooks/
  hooks.json                         # PostToolUse, PreCompact, SessionStart hooks
```

No runtime code — pure markdown + JSON. No build step, no dependencies.

## Components

### Skills (3)

- **package-intel** — Researches a package via five sources (Basic Memory, DeepWiki, Context7, Tavily, Raindrop) and writes/updates a structured prefixed note. Supports npm, Rust crates, Go modules, PHP Composer, Python PyPI, and Ruby gems. User-invocable as `/package-intel <pkg>`.
- **tool-intel** — Researches a developer environment or CI/CD tool via four sources (Basic Memory, DeepWiki for actions/docker, Tavily, Raindrop) and writes/updates a structured prefixed note. Supports Homebrew formulae (`brew:`), casks (`cask:`), GitHub Actions (`action:`), Docker images (`docker:`), and VSCode extensions (`vscode:`). User-invocable as `/tool-intel <prefix>:<name>`.
- **knowledge-gaps** — Parses code manifest files (`package.json`, `Cargo.toml`, etc.) and tool manifests (`Brewfile`, `.github/workflows/*.yml`, `Dockerfile`, `.vscode/extensions.json`), checks BM coverage, tiers package gaps by import frequency, lists all undocumented tools. User-invocable as `/knowledge-gaps`.

### Agents (2)

- **knowledge-gardener** — Read-only autonomous auditor: inventory, schema validation, orphan detection, relation integrity, stale/duplicate notes, cross-project consistency. **Never writes or modifies notes.**
- **knowledge-maintainer** — All-in-one write agent that acts on audit findings. Auto-fixes structural issues (missing sections, broken frontmatter, orphan linking). Confirms before content changes (merging duplicates, rewriting prose, archiving). Auto-runs `/package-intel` for Tier 1 undocumented packages (3+ imports) and `/tool-intel` for undocumented tools from detected manifests. `delete_note` intentionally excluded — use `move_note` to `archive/`. Reactive only — user must explicitly invoke.
- **session-reflector** — On-demand reflection agent. Reviews the current conversation, extracts durable insights, shows a preview grouped by target note, waits for approval, then writes. Complements the automatic PreCompact hook with a deliberate, user-gated equivalent.

### Hooks (3)

- **PostToolUse** (`write_note`/`edit_note` matcher) — Validates notes against their BM schema after any write.
- **PreCompact** — Auto-reflects conversation insights into Basic Memory before context compaction.
- **SessionStart** — Injects a brief knowledge graph status summary (note count, last audit, top gaps).

## Schemas

The `schemas/` directory in the plugin root is the version-controlled source of truth for all Basic Memory note schemas. It contains twelve files mirroring the schema notes in BM:

**Package types:**
- `schemas/npm_package.md` — npm package notes (`npm_package` type)
- `schemas/crate_package.md` — Rust crate notes (`crate_package` type)
- `schemas/go_module.md` — Go module notes (`go_module` type)
- `schemas/composer_package.md` — PHP Composer package notes (`composer_package` type)
- `schemas/pypi_package.md` — Python PyPI package notes (`pypi_package` type)
- `schemas/ruby_gem.md` — Ruby gem notes (`ruby_gem` type)

**Tool types:**
- `schemas/brew_formula.md` — Homebrew formula notes (`brew_formula` type)
- `schemas/brew_cask.md` — Homebrew cask notes (`brew_cask` type)
- `schemas/github_action.md` — GitHub Actions notes (`github_action` type)
- `schemas/docker_image.md` — Docker image notes (`docker_image` type)
- `schemas/vscode_extension.md` — VSCode extension notes (`vscode_extension` type)

**Knowledge types:**
- `schemas/engineering.md` — engineering knowledge notes (`engineering` type)

**First-install seeding:** On a fresh Basic Memory instance, call `write_note` for each schema file (or simply run `/package-intel` / `/tool-intel` on any package — they auto-write their schema on first use, which will conform the note).

**Automatic validation:** The PostToolUse hook fires `mcp__basic-memory__schema_validate` after every `write_note`/`edit_note` call, surfacing any schema errors as a systemMessage without blocking the write.

**Keeping in sync:** When editing a schema (fixing drift, adding fields), update both the Basic Memory note via `edit_note` and the corresponding file in `schemas/` in the same PR.

## MCP Tool Dependencies

Skills and agents reference tools from multiple MCP servers. When editing, use exact tool names:

| Server | Prefix | Used by |
|--------|--------|---------|
| Basic Memory | `mcp__basic-memory__*` | All components |
| DeepWiki | `mcp__deepwiki__*` | package-intel, tool-intel |
| Context7 | `mcp__plugin_context7_context7__*` | package-intel only |
| Tavily | `mcp__tavily__*` | package-intel, tool-intel |
| Raindrop | `mcp__raindrop__*` | package-intel, tool-intel |

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

### Note structure conventions (for tool-intel output)

| Prefix | Directory | Type | Title example |
|--------|-----------|------|---------------|
| `brew:` | `brew/` | `brew_formula` | `brew:ripgrep` |
| `cask:` | `casks/` | `brew_cask` | `cask:warp` |
| `action:` | `actions/` | `github_action` | `action:actions/checkout` |
| `docker:` | `docker/` | `docker_image` | `docker:node` |
| `vscode:` | `vscode/` | `vscode_extension` | `vscode:esbenp.prettier-vscode` |

- Same three enrichment layers as package-intel: frontmatter, `## Observations`, `## Relations`
- Type-specific content section replaces `## Key APIs`: `## Common Usage` for brew/cask, `## Inputs & Outputs` + `## Permissions` for actions, `## Tags` + `## Base Layers` for docker, `## Features` + `## Configuration` for vscode
- Context7 is skipped for all tool types (npm-biased, not useful for tooling)

### Relationship to upstream memory-* skills

The `basicmachines-co/basic-memory-skills` package provides 9 core `memory-*` skills (notes, schema, tasks, lifecycle, etc.) installed via `npx skills add basicmachines-co/basic-memory-skills` ([skills.sh](https://skills.sh)). This plugin depends on those conventions but does not bundle or duplicate them. `package-intel` specializes the generic `memory-research` pattern for npm packages.
