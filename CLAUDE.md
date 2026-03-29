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
  knowledge-prime/SKILL.md           # On-demand project context priming from BM
  schema-evolve/SKILL.md             # Frequency-driven schema drift detection and dual-sync
agents/
  knowledge-gardener.md              # Read-only graph health auditor (incl. tag alignment)
  knowledge-maintainer.md            # All-in-one graph enhancer (writes, incl. tag fixes)
  knowledge-primer.md                # Autonomous project context priming
  session-reflector.md               # On-demand conversation → memory capture
hooks/
  hooks.json                         # PostToolUse, PostToolUseFailure, PreCompact, SessionStart
```

No runtime code — pure markdown + JSON. No build step, no dependencies.

## Components

### Skills (5)

- **package-intel** — Researches a package via five sources (Basic Memory, DeepWiki, Context7, Tavily, Raindrop) and writes/updates a structured prefixed note. Supports npm, Rust crates, Go modules, PHP Composer, Python PyPI, and Ruby gems. User-invocable as `/package-intel <pkg>`.
- **tool-intel** — Researches a developer environment or CI/CD tool via four sources (Basic Memory, DeepWiki for actions/docker, Tavily, Raindrop) and writes/updates a structured prefixed note. Supports Homebrew formulae (`brew:`), casks (`cask:`), GitHub Actions (`action:`), Docker images (`docker:`), and VSCode extensions (`vscode:`). User-invocable as `/tool-intel <prefix>:<name>`.
- **knowledge-gaps** — Parses code manifest files (`package.json`, `Cargo.toml`, etc.) and tool manifests (`Brewfile`, `.github/workflows/*.yml`, `Dockerfile`, `.vscode/extensions.json`), checks BM coverage, tiers package gaps by import frequency, lists all undocumented tools. User-invocable as `/knowledge-gaps`.
- **knowledge-prime** — Surfaces project-relevant Basic Memory knowledge on demand. Detects the project stack, cross-references deps against BM notes, scores relevance, loads critical observations (`[gotcha]`, `[breaking]`, `[limitation]`), and produces a concise context brief. Supports `--deep` for extended output. User-invocable as `/knowledge-prime`.
- **schema-evolve** — Detects drift between BM schema definitions and actual note usage via `schema_diff`/`schema_infer`, proposes frequency-driven field additions/removals, and dual-syncs BM notes + local `schemas/` files after approval. User-invocable as `/schema-evolve <type>`.

### Agents (4)

- **knowledge-gardener** — Read-only autonomous auditor: inventory, schema validation, orphan detection, relation integrity, stale/duplicate notes, cross-project consistency, tag alignment (step 8). **Never writes or modifies notes.**
- **knowledge-maintainer** — All-in-one write agent that acts on audit findings. Auto-fixes structural issues (missing sections, broken frontmatter, orphan linking, tag alignment). Confirms before content changes (merging duplicates, rewriting prose, archiving). Auto-runs `/package-intel` for Tier 1 undocumented packages (3+ imports) and `/tool-intel` for undocumented tools from detected manifests. `delete_note` intentionally excluded — use `move_note` to `archive/`. Reactive only — user must explicitly invoke.
- **knowledge-primer** — Autonomous read-only agent that surfaces project-relevant BM knowledge before work begins. Scans project manifests, cross-references deps against BM, scores relevance, and produces a context brief with key gotchas and coverage gaps. The "before work" counterpart to session-reflector.
- **session-reflector** — On-demand reflection agent. Reviews the current conversation, extracts durable insights, shows a preview grouped by target note, waits for approval, then writes. Complements the automatic PreCompact hook with a deliberate, user-gated equivalent.

### Hooks (5)

- **PostToolUse** (`write_note`/`edit_note` matcher) — Command hook that emits `additionalContext` instructing the main session to call `schema_validate` on the written note. Skips schema definition notes (`/schema/` permalinks).
- **PostToolUse** (`Edit`/`Write` matcher) — Auto-formats shell scripts with `shfmt` and reminds to sync BM when editing schema files.
- **PostToolUseFailure** (`write_note`/`edit_note`/`schema_validate`/`schema_diff`/`schema_infer` matcher) — Command hook that pattern-matches BM tool errors into five categories (server-unavailable, note-not-found, invalid-argument, permission-error, unknown) and emits `additionalContext` with recovery guidance.
- **PreCompact** — Auto-reflects conversation insights into Basic Memory before context compaction.
- **SessionStart** — Emits a single `additionalContext` JSON object with knowledge graph guidance, skill suggestions (`/knowledge-prime`, `/knowledge-gaps`, `/schema-evolve`), and conditional graph-audit cycle reminders on every 4th sprint.

## Schemas

The `schemas/` directory in the plugin root is the version-controlled source of truth for all Basic Memory note schemas. It contains seventeen files mirroring the schema notes in BM:

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
- `schemas/standard.md` — protocol and standard notes (`standard` type)
- `schemas/concept.md` — concept and movement notes (`concept` type)
- `schemas/milestone.md` — milestone and history notes (`milestone` type)
- `schemas/service.md` — service and product notes (`service` type)
- `schemas/person.md` — person notes (`person` type)

**First-install seeding:** On a fresh Basic Memory instance, call `write_note` for each schema file (or simply run `/package-intel` / `/tool-intel` on any package — they auto-write their schema on first use, which will conform the note).

**Automatic validation:** The PostToolUse command hook emits `additionalContext` after every `write_note`/`edit_note` call, instructing the main session to call `schema_validate`. Schema errors are surfaced inline without blocking the write.

**Keeping in sync:** When editing a schema (fixing drift, adding fields), update both the Basic Memory note via `edit_note` and the corresponding file in `schemas/` in the same PR. Use `/schema-evolve <type>` to automate this — it detects drift, proposes changes, and dual-syncs both targets. The PostToolUse `Edit|Write` hook will also remind you to sync when editing schema files manually.

**Schema evolution workflow:** Run `schema_diff` to find fields used in notes but absent from schema (and vice versa). Fields above 25% usage are candidates for addition; fields at 0% across 10+ notes are candidates for removal. Additive changes (new optional fields) don't need a version bump. Always validate after updating: `schema_validate(note_type="<type>")`.

## MCP Tool Dependencies

Skills and agents reference tools from multiple MCP servers. When editing, use exact tool names:

| Server | Prefix | Used by |
|--------|--------|---------|
| Basic Memory | `mcp__basic-memory__*` | All components |
| DeepWiki | `mcp__deepwiki__*` | package-intel, tool-intel |
| Context7 | `mcp__plugin_context7_context7__*` | package-intel only |
| Tavily | `mcp__tavily__*` | package-intel, tool-intel |
| Raindrop | `mcp__raindrop__*` | package-intel, tool-intel |

## Validation

`npm run check` — runs `check:plugin` (validate-plugin.mjs) + `check:md` (remark) + `check:sh` (shellcheck).
Shell scripts are validated with `shellcheck` (linting) and `shfmt -d`
(format verification). Requires `brew install shfmt` if not already present.

## Scripts

The `scripts/` directory contains CLI-first audit utilities used by the
knowledge-gardener agent. All scripts use `bm tool` CLI commands where possible
and direct file access only for regex operations the CLI cannot express.

| Script | Purpose | Used by |
|--------|---------|---------|
| `audit-scope-leak.sh <bm-root>` | Detect project-specific content (paths, env vars) in cross-project notes | gardener Step 7b |

Scripts output NDJSON (one JSON object per line), use `set -euo pipefail`,
and pass shellcheck + shfmt. The `check:sh` npm script validates both
`hooks/*.sh` and `scripts/*.sh`.

## Conventions

### Skill frontmatter

Required fields: `name`, `description`, `user-invocable`, `allowed-tools`. The `description` is a trigger phrase list — write it so Claude picks the right skill when a user says something relevant. The `allowed-tools` list is an allowlist; only include tools the skill actually calls.

### Agent frontmatter

Required fields: `name`, `description`, `model`, `color`, `tools`. The `tools` field is a YAML list of allowed tool names. The knowledge-gardener must remain read-only — never add `write_note`, `edit_note`, or `delete_note` to its tools list. The knowledge-maintainer has write access but must confirm before content-level changes.

### Content conventions

All plugin content (schemas, skills, agents) must be **domain-generic** — no hardcoded directory paths, domain-specific examples, or topic-specific trigger phrases. Schema conventions should say "organized by domain" rather than prescribing specific directories. Examples in schemas should use broadly recognizable names (e.g. `HTTP/2`, `Vercel`) not niche domain terms.

### Tool list hygiene

Every tool in `allowed-tools` (skills) or `tools` (agents) must be called in the workflow prose. Phantom tools (listed but never used) accumulate silently — run a periodic tool reference audit across all components. When creating a skill/agent pair that shares a workflow, keep tool lists identical and remove tools the agent doesn't need (e.g., `Bash` for git operations the agent can't perform).

### Output template conventions

Every section in an output template (skill synthesize step or agent output step) must have a corresponding workflow step that loads data for it. Sections without a data source produce empty or hallucinated content. Treat output templates as contracts: every field needs a provider.

### Hook conventions

Hooks use `${CLAUDE_PLUGIN_ROOT}` for portable paths. Command hooks with `additionalContext` are used for all event types — prompt hooks spawn Haiku without MCP access, so they cannot call MCP tools (see RETRO-02 for the PreCompact precedent). All hooks are defined in `hooks/hooks.json`. Hook scripts assume CWD = project root (consistent with vp-beads convention). Each hook must emit exactly one JSON object on stdout — Claude Code reads only the first object and silently drops the rest.

### Hook additionalContext pattern

SessionStart/PreCompact `additionalContext` should suggest existing skills (e.g., "suggest running `/knowledge-prime`") rather than duplicating skill workflow steps inline. Keeps hooks lightweight (~1 sentence) and avoids drift between hook instructions and skill definitions. PreCompact is an intentional exception — it operates under context-ceiling pressure where skill indirection is not acceptable.

### Three-level invocation pattern

Features that benefit from progressive disclosure can be offered at three levels: (1) SessionStart hook hint (passive, ~1 sentence `additionalContext`), (2) on-demand skill (user-invocable, full workflow), (3) autonomous agent (same workflow, runs as subagent). Not all features need all three levels — use the primer/reflector pair as the reference implementation.

### Note structure conventions (for package-intel output)

- Schema note identifiers use the permalink form (e.g. `main/schema/npm_package`), not the title — check with `read_note` before editing
- Title: `npm:<package-name>` (resolves `[[npm:pkg]]` wiki-links)
- Directory: `npm/`
- Type: `npm_package` (snake_case — Basic Memory enforces snake_case for all type fields)
- Three enrichment layers: frontmatter metadata, `## Observations` with `[category]` tags, `## Relations` with `[[wiki-links]]`
- Use `edit_note` with `find_replace` for updates — `append` with `section` goes to end of file, not end of section
- Optional structured metadata on observations (following vp-beads convention):
  - `Ownership: upstream|us|shared` — distinguishes package bugs from integration choices
  - `Since: vX.Y.Z` — version where the observation was first relevant
  - These fields are backward-compatible — existing observations without them remain valid

### Note structure conventions (for tool-intel output)

| Prefix | Directory | Type | Title example |
|--------|-----------|------|---------------|
| `brew:` | `brew/` | `brew_formula` | `brew:ripgrep` |
| `cask:` | `casks/` | `brew_cask` | `cask:warp` |
| `action:` | `actions/` | `github_action` | `action:actions/checkout` |
| `docker:` | `docker/` | `docker_image` | `docker:node` |
| `vscode:` | `vscode/` | `vscode_extension` | `vscode:esbenp.prettier-vscode` |

- Same three core enrichment layers as package-intel (frontmatter, `## Observations`, `## Relations`) plus a type-specific content section per tool type
- Type-specific content section replaces `## Key APIs`: `## Common Usage` for brew/cask, `## Inputs & Outputs` + `## Permissions` for actions, `## Tags` + `## Base Layers` for docker, `## Features` + `## Configuration` for vscode
- Context7 is skipped for all tool types (npm-biased, not useful for tooling)

## Releasing

After bumping the version in `plugin.json` and `CHANGELOG.md`, also update the
README.md (component counts, skill/agent descriptions, plugin structure tree,
"How it fits together" diagram) and the
`vp-knowledge` entry in `.claude-plugin/marketplace.json` in this same repo
(both live here — no cross-repo sync needed for vp-knowledge itself).

If vp-beads has also released and bumped its marketplace entry here, confirm the
`vp-beads` version in `marketplace.json` is current before tagging.

Installed plugin caches lag: after a release, users must reinstall to pick up
the new version (`/plugin install vp-knowledge@vp-plugins`).

### Relationship to vp-beads

`vp-knowledge` and `vp-beads` are complementary plugins — both installable
via the `vp-plugins` marketplace at `voxpelli/vp-claude`.

- **Research feeds tracking** — `/package-intel` and `/tool-intel` output
  feeds vp-beads' `/upstream-tracker`. Friction or bugs discovered during
  research can be logged as upstream issues with matching prefix notation
  (`brew:<name>`, `action:<owner>/<repo>`, etc.).
- **Capture ↔ synthesis** — `session-reflector` captures in-sprint
  discoveries into Basic Memory; at sprint-close, vp-beads' `/retrospective`
  synthesises those notes into the sprint record. Mental model: session-
  reflector for in-sprint capture, retrospective for end-of-sprint synthesis.

### Parallel agent orchestration

Up to 10 background `/package-intel` + `/tool-intel` agents can run safely in parallel — notes are file-disjoint across ecosystems. The gardener→maintainer two-pass workflow (audit first, fix second) is the recommended approach for graph maintenance.

### Relationship to upstream memory-* skills

The `basicmachines-co/basic-memory-skills` package provides 9 core `memory-*` skills (notes, schema, tasks, lifecycle, etc.) installed via `npx skills add basicmachines-co/basic-memory-skills` ([skills.sh](https://skills.sh)). This plugin depends on those conventions but does not bundle or duplicate them. `package-intel` specializes the generic `memory-research` pattern for npm packages.
