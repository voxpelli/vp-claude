# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin (`vp-knowledge`) containing user-owned skills, agents, and hooks that build on [Basic Memory](https://github.com/basicmachines-co/basic-memory) (running as an MCP server). These complement the upstream `basicmachines-co/basic-memory-skills` (which provides core `memory-*` skills) with higher-level workflows for package and developer-tool research, knowledge graph maintenance, and automated quality checks.

## Plugin Layout

```
.claude-plugin/
  plugin.json                        # Plugin manifest
skills/
  package-intel/SKILL.md             # Seven-source multi-ecosystem package research
    references/                      # 12 files: 6 ecosystem + 6 note templates
  tool-intel/SKILL.md                # Five-source dev-tool research (brew/action/docker/vscode)
    references/                      # 10 files: 5 ecosystem + 5 note templates
  knowledge-gaps/SKILL.md            # Cross-reference deps + tool manifests vs BM coverage
    references/                      # 2 files: standard-detection, concept-detection
  knowledge-prime/SKILL.md           # On-demand project context priming from BM
  schema-evolve/SKILL.md             # Frequency-driven schema drift detection and dual-sync
  session-reflect/SKILL.md           # On-demand conversation → memory capture
  knowledge-ask/SKILL.md             # Freeform Q&A against the BM knowledge graph
  vp-note-quality/SKILL.md           # Fourth-wall anti-pattern checklist (not user-invocable)
  tag-sync/SKILL.md                  # Raindrop tag vocabulary sync
  wander/SKILL.md                    # 5-mode purposeless knowledge exploration
  readwise-check/SKILL.md            # Quick pre-research Readwise lookup
  session-bookmarks/SKILL.md         # Session URL bookmarking to Raindrop
  raindrop-triage/SKILL.md           # Interactive unsorted bookmark triage
    references/                      # 2 files: tag-selection, promote-workflow
  people-intel/SKILL.md              # Five-source person research
    references/                      # 2 files: note-template, source-guide
agents/
  knowledge-gardener.md              # Read-only graph health auditor (incl. tag alignment)
  knowledge-maintainer.md            # All-in-one graph enhancer (writes, incl. tag fixes)
  knowledge-primer.md                # Autonomous project context priming
  raindrop-gardener.md               # Read-only Raindrop tag auditor
hooks/
  hooks.json                         # PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, SessionStart
```

No runtime code — pure markdown + JSON. No build step, no dependencies.

## Components

### Skills (14)

- **package-intel** — Researches a package via seven enrichment sources (DeepWiki, Context7, Tavily, Raindrop, Readwise, changelog, Socket) and writes/updates a structured prefixed note with post-write cross-linking. Supports npm, Rust crates, Go modules, PHP Composer, Python PyPI, and Ruby gems. Socket supply-chain scoring covers npm/pypi/cargo/gem (go/composer skip silently). User-invocable as `/package-intel <pkg>`.
- **tool-intel** — Researches a developer environment or CI/CD tool via five sources (Basic Memory, DeepWiki for actions/docker, Tavily, Raindrop, Readwise) and writes/updates a structured prefixed note with post-write cross-linking. Supports Homebrew formulae (`brew:`), casks (`cask:`), GitHub Actions (`action:`), Docker images (`docker:`), and VSCode extensions (`vscode:`). User-invocable as `/tool-intel <prefix>:<name>`.
- **knowledge-gaps** — Parses code manifest files (`package.json`, `Cargo.toml`, etc.) and tool manifests (`Brewfile`, `.github/workflows/*.yml`, `Dockerfile`, `.vscode/extensions.json`), checks BM coverage, tiers package gaps by import frequency, lists all undocumented tools, and detects concept-level hub gaps via graph analysis and Readwise reading signals. User-invocable as `/knowledge-gaps`.
- **knowledge-prime** — Surfaces project-relevant Basic Memory knowledge on demand. Detects the project stack, cross-references deps against BM notes, scores relevance, loads critical observations (`[gotcha]`, `[breaking]`, `[limitation]`), and produces a concise context brief. Supports `--deep` for extended output. User-invocable as `/knowledge-prime`.
- **schema-evolve** — Detects drift between BM schema definitions and actual note usage via `schema_diff`/`schema_infer`, proposes frequency-driven field additions/removals, and dual-syncs BM notes + local `schemas/` files after approval. User-invocable as `/schema-evolve <type>`.
- **session-reflect** — Reviews the current conversation, extracts durable insights, finds target notes in Basic Memory, shows a grouped preview, and writes only what the user approves. The deliberate, user-triggered counterpart to the automatic PreCompact hook. User-invocable as `/session-reflect`.
- **knowledge-ask** — Answers freeform questions by searching Basic Memory, loading relevant notes, traversing the graph, and synthesizing a cited answer with confidence tiers (Direct/Partial/No Coverage). Read-only — suggests `/package-intel` or `/tool-intel` for coverage gaps. User-invocable as `/knowledge-ask <question>`.
- **vp-note-quality** — Reference checklist preventing the fourth-wall anti-pattern (self-referential content in subject-domain notes). Not user-invocable — preloaded into knowledge-maintainer and knowledge-gardener agents via the `skills` frontmatter field.
- **wander** — Purposeless knowledge exploration with 5 modes: Random Walk (BM graph traversal), Time Machine (old+new bookmark pair), Cross-System Collision (Readwise highlight + Raindrop bookmark), Forgotten Shelf (old untagged bookmarks), Obsession Detector (recent topics with zero BM notes). Never scores, ranks, or recommends. User-invocable as `/wander [mode]`.
- **readwise-check** — Quick pre-research lookup reporting highlight count, document count, and reading depth for a topic across Readwise highlights and Reader documents. Two API calls, compact output. User-invocable as `/readwise-check <topic>`.
- **tag-sync** — Fetches tags from Raindrop, curates the top N by usage count, adds one-line characterizations, groups by cluster, and writes/syncs the vocabulary file at `~/.claude/references/raindrop-tags.md`. Follows the vendor-sync pattern. User-invocable as `/tag-sync [count|--reset]`.
- **session-bookmarks** — Scans the current conversation for high-signal URLs, suggests 1-3 as Raindrop bookmarks in the AI-bookmarked collection (discovered via `find_collections`, not hardcoded), and creates them after user approval. Auto-delegated from `/session-reflect` or invocable standalone. User-invocable as `/session-bookmarks`.
- **raindrop-triage** — Interactive triage of unsorted Raindrop bookmarks: deduplicates by normalized URL, detects research bursts (temporal clusters), clusters by theme, proposes vocabulary-grounded tags (blocklist, context tags, conventions all read from vocabulary file frontmatter), and moves approved bookmarks to AI-triaged. A `--promote` pass classifies AI-triaged items into AI-sorted (default), AI-gems (golden), AI-archive, or AI-attention. Supports `--source` to override the promote source collection. User-invocable as `/raindrop-triage`.
- **people-intel** — Researches a person via five enrichment sources (Basic Memory deep graph traversal, Raindrop, Readwise, Tavily, DeepWiki) and writes/updates a structured person note with post-write bidirectional cross-linking. Includes fourth-wall guardrail and anti-hagiography measures. DeepWiki is conditional (developer profiles only). User-invocable as `/people-intel <name>`.

### Agents (4)

- **knowledge-gardener** — Read-only autonomous auditor: inventory, schema validation, orphan detection, relation integrity, stale/duplicate notes, cross-project consistency, tag alignment (step 8), fourth-wall note quality (step 10). Preloads `vp-note-quality` skill for audit guidance. **Never writes or modifies notes.**
- **knowledge-maintainer** — All-in-one write agent (`effort: high`, `model: inherit`) that acts on audit findings. Auto-fixes structural issues (missing sections, broken frontmatter, orphan linking, tag alignment, fourth-wall violations). Confirms before content changes (merging duplicates, rewriting prose, archiving). Auto-runs `/package-intel` for Tier 1 undocumented packages (3+ imports) and `/tool-intel` for undocumented tools from detected manifests. Preloads `vp-note-quality` skill. `delete_note` and `write_note` intentionally excluded — use `move_note` to `archive/`, delegate new notes to `/package-intel` or `/tool-intel` via `Skill`. For maximum quality, invoke from an Opus session — `model: inherit` propagates the parent model. Reactive only — user must explicitly invoke.
- **knowledge-primer** — Autonomous read-only agent that surfaces project-relevant BM knowledge before work begins. Scans project manifests, cross-references deps against BM, scores relevance, produces a context brief with key gotchas, and sweeps graph-wide observations for critical warnings from non-dependency notes. The "before work" counterpart to `/session-reflect`.
- **raindrop-gardener** — Read-only Raindrop tag auditor: library dashboard, tag inventory, naming violations, near-duplicates, mistagged bookmarks (via `find_mistagged_bookmarks`), orphan tags, legacy tag identification, co-occurrence analysis, non-primary-language tag detection, taxonomy gaps. Produces a structured report with exact `update_tags`/`delete_tags` tool calls as copy-paste recommendations. **Never modifies tags or bookmarks.**

### Hooks (6)

- **PostToolUse** (`write_note`/`edit_note` matcher) — Command hook that emits `additionalContext` instructing the main session to call `schema_validate` on the written note. Skips schema definition notes (`/schema/` permalinks).
- **PostToolUse** (`Edit`/`Write` matcher) — Auto-formats shell scripts with `shfmt` and reminds to sync BM when editing schema files.
- **PostToolUseFailure** (`write_note`/`edit_note`/`schema_validate`/`schema_diff`/`schema_infer` matcher) — Command hook that pattern-matches BM tool errors into five categories (server-unavailable, note-not-found, invalid-argument, permission-error, unknown) and emits `additionalContext` with recovery guidance.
- **PreCompact** — Auto-reflects conversation insights into Basic Memory before context compaction.
- **SessionStart** — Emits a single `additionalContext` JSON object with knowledge graph guidance, skill suggestions (`/knowledge-prime`, `/knowledge-ask`, `/knowledge-gaps`, `/schema-evolve`, `/wander`, `/readwise-check`), and conditional graph-audit cycle reminders on every 4th sprint.
- **PreToolUse** (`Bash` matcher) — Blocks Python and Node.js script execution inside the knowledge-gardener agent, enforcing read-only discipline. Main session and other agents are unaffected.

## Schemas

The `schemas/` directory in the plugin root is the version-controlled source of truth for all Basic Memory note schemas. It contains twenty files mirroring the schema notes in BM:

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
- `schemas/pattern.md` — cross-domain structural insight notes (`pattern` type)
- `schemas/reference.md` — lookup document notes (`reference` type)
- `schemas/standard.md` — protocol and standard notes (`standard` type)
- `schemas/concept.md` — concept and movement notes (`concept` type)
- `schemas/milestone.md` — milestone and history notes (`milestone` type)
- `schemas/service.md` — service and product notes (`service` type)
- `schemas/person.md` — person notes (`person` type)
- `schemas/project.md` — project notes (`project` type)

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
| Raindrop | `mcp__raindrop__*` | package-intel, tool-intel, tag-sync, session-bookmarks, raindrop-triage, raindrop-gardener |
| Readwise | `mcp__readwise__*` | package-intel, tool-intel, knowledge-gaps |
| Socket | `mcp__socket-mcp__*` | package-intel only |

## Validation

`npm run check` — runs `check:plugin` (validate-plugin.mjs) + `check:md` (remark) + `check:sh` (shellcheck + shfmt) + `check:hooks` (hook integration tests).
Shell scripts are validated with `shellcheck` (linting) and `shfmt -d`
(format verification). Requires `brew install shfmt` if not already present.

## Scripts

The `scripts/` directory contains CLI-first audit utilities used by the
knowledge-gardener agent. All scripts use `bm tool` CLI commands where possible
and direct file access only for regex operations the CLI cannot express.

| Script | Purpose | Used by |
|--------|---------|---------|
| `audit-scope-leak.sh <bm-root>` | Detect project-specific content (paths, env vars) in cross-project notes | gardener Step 7b |
| `audit-helpers.sh <subcommand>` | Dispatcher: bm-stats, scope-leak-summary, scope-leak-detail | gardener Step 0.5, 7b |
| `check-hooks.mjs` | Integration tests verifying each hook emits exactly one JSON object | `npm run check:hooks` |

Scripts output NDJSON (one JSON object per line), use `set -euo pipefail`,
and pass shellcheck + shfmt. The `check:sh` npm script validates both
`hooks/*.sh` and `scripts/*.sh`.

## Conventions

### Skill frontmatter

Required fields: `name`, `description`, `user-invocable`, `allowed-tools`. The `description` is a trigger phrase list — write it so Claude picks the right skill when a user says something relevant. The `allowed-tools` list is an allowlist; only include tools the skill actually calls. Skills with `user-invocable: false` are valid for reference/context-injection purposes (e.g., `vp-note-quality`) — they can be preloaded into agents via the `skills` frontmatter field and have `allowed-tools: []` when they contain no workflow steps. Non-user-invocable skills use the `vp-` prefix followed by a descriptive kebab-case name (e.g., `vp-note-quality`). The `vp-` prefix signals plugin-internal ownership and avoids collision with upstream `memory-*` skills.

### Skill interaction conventions

Never add `AskUserQuestion` to a skill's `allowed-tools` — it auto-approves the interaction, bypassing the UI prompt and returning empty answers (bug anthropics/claude-code#29547, fixed v2.1.69, but auto-approving defeats the tool's purpose even post-fix). Reference `AskUserQuestion` by name in workflow prose or use generic phrasing ("Wait for user response before proceeding"). For write/batch operations, follow the preview-approve-execute pattern: present a summary table of proposed changes, wait for user response, execute only approved items. For progress feedback in multi-step skills, use `TodoWrite` — it is the only progress tool available.

### Agent frontmatter

Required fields: `name`, `description`, `model`, `color`, `tools`. Optional fields: `skills` (preloaded skill content), `effort` (`low`/`medium`/`high`/`max`). The `tools` field is a YAML list of allowed tool names. The knowledge-gardener must remain read-only — never add `write_note`, `edit_note`, or `delete_note` to its tools list. The knowledge-maintainer has write access (`effort: high`) but must confirm before content-level changes.

### Content conventions

All plugin content (schemas, skills, agents) must be **domain-generic** — no hardcoded directory paths, domain-specific examples, or topic-specific trigger phrases. Schema conventions should say "organized by domain" rather than prescribing specific directories. Examples in schemas should use broadly recognizable names (e.g. `HTTP/2`, `Vercel`) not niche domain terms. Tag blocklists, conventions, and context tags must be read from the vocabulary file frontmatter (`~/.claude/references/raindrop-tags.md`), never hardcoded in skill prose.

### Tool list hygiene

Every tool in `allowed-tools` (skills) or `tools` (agents) must be called in the workflow prose. Phantom tools (listed but never used) accumulate silently — run a periodic tool reference audit across all components. When creating a skill/agent pair that shares a workflow, keep tool lists identical and remove tools the agent doesn't need (e.g., `Bash` for git operations the agent can't perform).

### Cross-linking convention

After writing or updating a note (via intel skills or maintainer fixes), search
for existing notes that reference the topic in their body text but lack a
wiki-link in `## Relations`. Add `relates_to [[prefix:name]]` via `edit_note`
with `find_replace` targeting the last relation line. Only add links where the
relationship is genuine — don't link notes that mention the same word in an
unrelated context. This turns one-way references into bidirectional graph edges.

Relation verbs must exactly match picoschema field names — `related_to` (wrong
verb), `relates to` (space not underscore), and `related_to:` (colon suffix)
all silently create non-matching relations that `schema_validate` flags as
missing. Always use `relates_to`, `depends_on`, etc. exactly as declared.

### Basic Memory search patterns

When querying Basic Memory via `search_notes`, choose the right approach:

- **Find notes by type** — use `note_types=["standard"]`, NOT
  `search_type="text"` with `query="type: standard"` (FTS5 tokenizes the
  colon, matching false positives)
- **Find dead wiki-links** — use `entity_types=["relation"]` and check
  `to_entity` absence, NOT `search_type="text"` with `query="[[prefix:"`
  (FTS5 strips brackets)
- **Find wiki-links in observations** — use `search_type="text"` with
  `entity_types=["observation"]` and prefix-specific queries like
  `query="[[npm-"` (bare `[[` alone doesn't match)
- **Find relations involving an entity** — use `entity_types=["relation"]`
  with `query="<entity-title>"` (relation titles index both source and target)
- **Semantic topic search** — omit `search_type` (default hybrid) for natural
  language queries about concepts, topics, or package names

### Skill routing

When the user asks about knowledge or packages, choose the right skill:

| Signal | Skill |
|--------|-------|
| "prime", "project context", "coverage", "which deps are documented" | `/knowledge-prime` |
| "what do we know about \[X\]", "recall", "find notes on", topic question | `/knowledge-ask [topic]` |
| "research \[pkg\]", "document \[pkg\]", needs external sources | `/package-intel [pkg]` |
| "gaps", "undocumented", "audit coverage" | `/knowledge-gaps` |
| "wander", "surprise me", "time machine", "forgotten", "obsession" | `/wander [mode]` |
| "how much have I read about", "readwise check", "reading depth" | `/readwise-check [topic]` |
| "research person", "who is \[X\]", "person intel", "people intel" | `/people-intel [name]` |

### Output template conventions

Every section in an output template (skill synthesize step or agent output step) must have a corresponding workflow step that loads data for it. Sections without a data source produce empty or hallucinated content. Treat output templates as contracts: every field needs a provider.

### Hook conventions

Hooks use `${CLAUDE_PLUGIN_ROOT}` for portable paths. Command hooks with `additionalContext` are used for all event types — prompt hooks spawn Haiku without MCP access, so they cannot call MCP tools (see RETRO-02 for the PreCompact precedent). All hooks are defined in `hooks/hooks.json`. Hook scripts assume CWD = project root (consistent with vp-beads convention). Each hook must emit exactly one JSON object on stdout — Claude Code reads only the first object and silently drops the rest.

### Hook additionalContext pattern

SessionStart/PreCompact `additionalContext` should suggest existing skills (e.g., "suggest running `/knowledge-prime`") rather than duplicating skill workflow steps inline. Keeps hooks lightweight (~1 sentence) and avoids drift between hook instructions and skill definitions. PreCompact is an intentional exception — it operates under context-ceiling pressure where skill indirection is not acceptable.

### Three-level invocation pattern

Features that benefit from progressive disclosure can be offered at three levels: (1) SessionStart hook hint (passive, ~1 sentence `additionalContext`), (2) on-demand skill (user-invocable, full workflow), (3) autonomous agent (same workflow, runs as subagent). Not all features need all three levels — use the knowledge-prime/knowledge-primer pair as the reference implementation. `/session-reflect` is skill-only because its source of truth (the conversation transcript) requires main-session context that agents cannot access.

### Prefix convention: colons in commands, hyphens in titles

Users type colon-delimited prefixes in commands (`/package-intel npm:fastify`,
`/tool-intel brew:ripgrep`). The colon is an unambiguous delimiter — even with
scoped packages like `npm:@scope/pkg`. Skills parse the colon, then construct
the BM title by replacing all `:` and `/` with `-` (preserving `@` and `.`).
This matches the filename BM generates and enables native Obsidian wiki-link
resolution. Examples: `npm:fastify` → `npm-fastify`,
`action:actions/checkout` → `action-actions-checkout`,
`npm:@fastify/postgres` → `npm-@fastify-postgres`.

**Migration (v0.22.0+):** Existing vault notes need a one-time rename — see
`TODO-obsidian-migration.md`. New notes emitted by the plugin use hyphen
titles automatically.

### Note structure conventions (for package-intel output)

- Schema note identifiers use the permalink form (e.g. `main/schema/npm_package`), not the title — check with `read_note` before editing
- Title: `npm-<package-name>` (resolves `[[npm-pkg]]` wiki-links)
- Directory: `npm/`
- Type: `npm_package` (snake_case — Basic Memory enforces snake_case for all type fields)
- Three enrichment layers: frontmatter metadata, `## Observations` with `[category]` tags, `## Relations` with `[[wiki-links]]`
- Schema-required fields (like `source` for service) must be `[field]` observations in the note body — YAML frontmatter fields are NOT checked by `schema_validate`
- Use `edit_note` with `find_replace` for updates — `append` with `section` goes to end of file, not end of section
- Optional structured metadata on observations (following vp-beads convention):
  - `Ownership: upstream|us|shared` — distinguishes package bugs from integration choices
  - `Since: vX.Y.Z` — version where the observation was first relevant
  - These fields are backward-compatible — existing observations without them remain valid

### Note structure conventions (for tool-intel output)

| Prefix | Directory | Type | Title example |
|--------|-----------|------|---------------|
| `brew:` | `brew/` | `brew_formula` | `brew-ripgrep` |
| `cask:` | `casks/` | `brew_cask` | `cask-warp` |
| `action:` | `actions/` | `github_action` | `action-actions-checkout` |
| `docker:` | `docker/` | `docker_image` | `docker-node`, `docker-grafana-grafana` |
| `vscode:` | `vscode/` | `vscode_extension` | `vscode-esbenp.prettier-vscode` |

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

### Versioning

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
at major version 0. Under semver 0.x, **minor version bumps signal breaking
changes** (e.g., 0.22.0 for the colon-to-hyphen prefix migration). Patch
bumps are non-breaking additions and fixes.

### Release checklist

Version bump:
- `plugin.json` — version field
- `CHANGELOG.md` — new version entry + compare link
- `marketplace.json` — `vp-knowledge` version field
- `README.md` — component counts, skill/agent descriptions, structure tree
- `CLAUDE.md` — Agents/Skills descriptions, component counts
- `MEMORY.md` — component descriptions, version field

Tag the release (after committing and pushing the bump):
- Lightweight tag at the bump commit: `git tag vX.Y.Z <commit>` (convention
  is lightweight tags, not annotated — check `git cat-file -t vX.Y.Z` on a
  recent tag to confirm)
- Push the tag: `git push origin vX.Y.Z`
- Without the tag, the `CHANGELOG.md` compare link (`...compare/vA.B.C...vX.Y.Z`)
  will 404 until the tag exists on the remote

Source count propagation (when adding/removing a research source):
- `skills/package-intel/SKILL.md` or `skills/tool-intel/SKILL.md` — step prose
- `CLAUDE.md` — Skills section source count (e.g., "six enrichment sources")
- `README.md` — skill description
- `CHANGELOG.md` — note the source change

### Relationship to vp-beads

`vp-knowledge` and `vp-beads` are complementary plugins — both installable
via the `vp-plugins` marketplace at `voxpelli/vp-claude`.

- **Research feeds tracking** — `/package-intel` and `/tool-intel` output
  feeds vp-beads' `/upstream-tracker`. Friction or bugs discovered during
  research can be logged as upstream issues with matching prefix notation
  (`brew:<name>`, `action:<owner>/<repo>`, etc.).
- **Capture ↔ synthesis** — `/session-reflect` captures in-sprint
  discoveries into Basic Memory; at sprint-close, vp-beads' `/retrospective`
  synthesises those notes into the sprint record. Mental model:
  `/session-reflect` for in-sprint capture, retrospective for end-of-sprint synthesis.

### Parallel agent orchestration

Up to 10 background `/package-intel` + `/tool-intel` agents can run safely in parallel — notes are file-disjoint across ecosystems. The gardener→maintainer two-pass workflow (audit first, fix second) is the recommended approach for graph maintenance.

### Relationship to upstream memory-* skills

The `basicmachines-co/basic-memory-skills` package provides 9 core `memory-*` skills (notes, schema, tasks, lifecycle, etc.) installed via `npx skills add basicmachines-co/basic-memory-skills` ([skills.sh](https://skills.sh)). This plugin depends on those conventions but does not bundle or duplicate them. `package-intel` specializes the generic `memory-research` pattern for npm packages.
