# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.14.0][] - 2026-03-15

### Changed

- **CI workflow** — added `permissions: contents: read` (principle of least
  privilege) and bumped `actions/checkout` v4 → v5. Aligns with vp-beads
  v0.6.2 CI patterns.
- **PostToolUseFailure matcher expanded** — now covers `schema_validate`,
  `schema_diff`, and `schema_infer` in addition to `write_note`/`edit_note`.
  Schema tools can fail during trend-review sprints and benefit from the same
  five-category error classification and recovery guidance.
- **Script naming: `check:shell` → `check:sh`** — standardizes npm script
  name to match vp-beads convention.

## [0.13.1][] - 2026-03-15

### Fixed

- **`schema-evolve` skill reviewer fixes** — clarified "No schema found" edge
  case (directs to `/package-intel` or `/memory-schema` instead of ambiguous
  "suggest seeding"), added pre-existing divergence edge case (compare BM and
  local before evolving), replaced "revert and retry" with explicit error
  reporting strategy, added trigger phrases (`check schema`, `schema audit`,
  `schema changes`).
- **knowledge-gardener** — added `Glob` to tools list (step 4b needs it for
  `UPSTREAM-*.md` file detection).
- **knowledge-maintainer** — removed `\[config\]`→`\[config\]` no-op row from
  observation normalization table.
- **`post-file-edit.sh`** — added early exit guard with comment when
  `PLUGIN_ROOT` is unset, removed redundant inline guards.
- **CI workflow** — added `shfmt` installation step (`shellcheck` is
  pre-installed on ubuntu-latest but `shfmt` is not). Mirrors vp-beads CI.

### Changed

- **`plugin.json` description** — now mentions schema evolution.
- **vp-beads marketplace** — bumped to v0.6.2.
- **Adopted vp-beads v0.6.0 patterns:**
  - Annotation-not-deletion for resolved observations in knowledge-maintainer
  - Optional structured metadata on observations (`Ownership:`, `Since:`)
  - Cross-plugin friction awareness in knowledge-gardener step 4b

## [0.13.0][] - 2026-03-15

### Added

- **`/schema-evolve <type>` skill** — frequency-driven schema drift detection
  and evolution. Runs `schema_diff` + `schema_infer`, proposes field additions
  (>25% usage), removals (0% usage), and cardinality fixes. Dual-syncs both
  the BM schema note and local `schemas/` file after approval. Includes a
  watch list (10-24% usage) for emerging fields.
- **PostToolUse `Edit|Write` hook** — combined `command` hook that auto-formats
  shell scripts with `shfmt -w` after edits to `hooks/*.sh`, and emits a
  `systemMessage` reminder to sync BM when editing `schemas/*.md` files.
  Silently skips if `shfmt` is not installed.
- **Observation category normalization in knowledge-maintainer** (step 2a) —
  two-tier mapping: deterministic auto-fixes for unambiguous tag renames
  (`[install]`→`[usage]`, `[mechanism]`→`[purpose]`, etc.) and confirmation-
  gated mapping for ambiguous tags. Schema-type-aware — checks the note's
  schema before mapping to avoid false corrections.

### Changed

- **CLAUDE.md documentation refresh** — hooks count corrected from 3 to 5
  (adds PostToolUseFailure and Edit/Write hooks), skills count from 3 to 4,
  plugin layout diagram updated.

## [0.12.1][] - 2026-03-15

### Changed

- **Schema evolution — 3 schemas updated based on drift analysis:**
  - `github_action`: added `version?(array)` (89% usage) and `usage?(array)`
    (78% usage) — both were widely used but not in the schema
  - `npm_package`: added `security?(array)` (25% usage) and synced
    `api?(array)` from BM — aligns schema with how package-intel actually
    writes notes
  - `standard`: added `trend?(array)` (38%), `pattern?(array)` (25%),
    `complements?` (25%), and `lesson_for?` (25%) — all emerged organically
    in IndieWeb standard notes

## [0.12.0][] - 2026-03-14

### Added

- **5 new knowledge schemas** — `standard`, `concept`, `milestone`, `service`,
  `person` types for documenting protocols, movements, historical events,
  products, and key figures. Each schema added to `schemas/` and synced to BM.
- **Domain standard detection in `/knowledge-gaps`** (Steps 11–13) — searches
  BM for `type: standard` notes, greps the codebase for mentions, classifies
  by reference count (key/referenced/undocumented), and appends a Domain
  Standard Coverage section to the gap report. Skips ubiquitous standards
  (HTTP, HTML, JSON, etc.).
- **Schema validation for new types in agents** — `knowledge-gardener` and
  `knowledge-maintainer` now run `schema_validate`, `schema_infer`, and
  `schema_diff` for the 5 new types.
- **CLAUDE.md updated** — schema count from twelve to seventeen, new types
  listed under Knowledge types.

### Fixed

- **Schema quality issues across all 5 new schemas:**
  - Converted multi-value observation fields to arrays (`limitation`,
    `innovation`, `design`, `pattern`, `trend`, `gap`, `risk`, `lesson`,
    `failure`, `anti-pattern`, `precedent`, `insight`)
  - `milestone`: renamed `validation` → `proven` (collided with
    `settings.validation`); dropped `cautionary` and `competitive-gap`
    (12→10 observation fields)
  - `concept`: removed domain-specific fields `ux`, `accessibility`,
    `display_for`
  - `person`: `source` now required (matches other 4 schemas)
- **`UPSTREAM-claude-code.md`** — escaped `[degraded]` bracket to fix
  pre-existing remark warning.

## [0.11.0][] - 2026-03-14

### Added

- **PostToolUseFailure hook** — classifies Basic Memory write/edit failures
  into five categories (server unavailable, invalid argument, note not found,
  permission error, unknown) and surfaces actionable recovery guidance as a
  systemMessage. Short timeout (10s) — classification only, no retry.
- **Validator: agent color and model checks** — validates against the allowed
  sets (`blue`/`cyan`/`green`/`yellow`/`magenta`/`red` for colors;
  `inherit`/`sonnet`/`opus`/`haiku` for models).
- **Validator: tool-reference audit** — cross-checks `mcp__*__*` patterns in
  skill/agent prose against their declared `allowed-tools`/`tools` frontmatter,
  catching references that would be silently blocked at runtime.
- **Validator: expanded hook type allowlist** — now accepts `agent` and `http`
  in addition to `prompt` and `command` (future-proofing).

### Changed

- **PreCompact hook converted from prompt to command** — the previous
  `type: "prompt"` hook was non-conforming (PreCompact only supports command
  hooks per official docs) and prompt hooks spawn a separate Haiku instance
  with no MCP tool access, making the reflection instructions unreachable.
  Now emits `additionalContext` JSON via a shell script, injecting reflection
  instructions into the main Claude session which has full MCP access.
  Timeout drops from 30s to 5s (static JSON output).

### Fixed

- **`session-reflector` color** — `purple` → `magenta` (purple not in the
  valid agent color set).
- **CLAUDE.md agent count** — "Agents (2)" → "Agents (3)", wrong since
  session-reflector was added in v0.3.0.
- **Removed duplicate `note-template.md`** — identical to
  `note-template-npm.md` and unreferenced by any skill.
- **Cross-reference comments** added between `package-intel` and `tool-intel`
  at Steps 1 and 5 (shared existence-check and write/update patterns).

## [0.10.1][] - 2026-03-14

### Changed

- **`knowledge-gardener` model set to `sonnet`** — read-only agent with high
  tool volume (50-100+ calls) now pinned to sonnet for consistent audit quality
  regardless of session model. Zero write risk makes this safe — worst case is a
  less thorough report, never data corruption. Matches the pattern used by
  official Claude Code plugins (`code-explorer`, `code-architect`). The other
  two agents (`knowledge-maintainer`, `session-reflector`) remain at `inherit`.

## [0.10.0][] - 2026-03-13

### Added

- **SessionStart: cycle-aware graph-audit reminder** — `hooks/session-start.sh`
  now counts `RETRO-*.md` files and emits an additional `systemMessage` on
  every 4th sprint: an advance warning on sprint mod=3, an active reminder on
  sprint mod=0. Silent in all other sprints. Mirrors vp-beads' trend-review
  cycling pattern, adapted for graph health (knowledge-gardener) instead of
  sprint workflow.
- **`## Releasing` section in `CLAUDE.md`** — documents the version bump
  checklist (`plugin.json`, `CHANGELOG.md`, `marketplace.json`) and cache-lag
  note for plugin consumers. Mirrors vp-beads' CLAUDE.md release section.
- **`## Edge Cases` section in `knowledge-gaps`** — defensive handling for
  missing manifests, empty Brewfiles, workflow files with no `uses:` lines,
  and missing BM ecosystem directories. Mirrors vp-beads' sprint-review edge
  case documentation pattern.

## [0.9.0][] - 2026-03-13

### Added

- **`read_note` guard before missing-sections append in `knowledge-maintainer`**
  — the "Missing sections" fix example previously omitted the required
  `read_note` step, risking blind append of duplicate section headers.
  Now explicitly reads first, appends only what's confirmed absent.
- **`build_context` activated in `session-reflector` Step 2** — after
  `search_notes` identifies candidate notes, the agent now traverses each
  candidate's immediate graph neighborhood (`depth=1`) before committing,
  surfacing better targets and preventing duplicate observations.
- **Graph curation step in `tool-intel` Step 4** — mirrors the curation
  pattern already present in `package-intel`: check how the tool is
  referenced in the knowledge graph before writing, to populate `## Relations`
  back-links and avoid duplicating linked-note observations.
- **Step 10 "Detect dead wiki-links" in `knowledge-gaps`** — searches
  existing notes for `[[prefix:name]]` wiki-links that point to non-existent
  notes, cross-references against `list_directory` results already collected,
  and adds a "Referenced but not documented" section to the gap report.
  Uses `search_type="text"` (exact match) for structural `[[` syntax.

## [0.8.0][] - 2026-03-13

### Added

- **"Relationship to vp-beads" section in CLAUDE.md** — documents how
  `/package-intel` and `/tool-intel` output feeds vp-beads' upstream-tracker
  and the session-reflector ↔ retrospective mental model. Mirrors the
  reciprocal section already present in vp-beads' CLAUDE.md.
- **vp-beads integration section in `session-reflector` agent** — guidance
  for beads projects: log upstream friction via `/upstream-tracker` when
  discovered during research; use session-reflector for in-sprint capture and
  vp-beads `/retrospective` for end-of-sprint synthesis.
- **`shfmt -d` added to `check:shell`** — shell scripts now validated for
  both linting (`shellcheck`) and formatting (`shfmt -d`), matching vp-beads'
  shell validation pattern. Requires `brew install shfmt`.

## [0.7.1][] - 2026-03-13

### Fixed

- **`security?(array)` missing from `github_action` and `docker_image` schemas** — `tool-intel` writes `[security]` observations (CVEs, supply-chain advisories) for action and docker notes, but neither schema defined the field. PostToolUse validation hook fired spurious unknown-field warnings on every such note. Field added to both schemas (+ BM mirrors) with a convention observation distinguishing `security` (advisory/CVE info) from `gotcha` (usage pitfalls).
- **`schema_diff` absent from `knowledge-gardener` tools list** — Added in `knowledge-maintainer` but never mirrored to the read-only gardener. Added `mcp__basic-memory__schema_diff` to the tools list and a `schema_diff` block in Audit Check 2 (5 types: `npm_package`, `crate_package`, `brew_formula`, `brew_cask`, `engineering`) with guidance to report drift findings without treating them as validation failures.
- **`brew_formula` missing from `schema_infer` in `knowledge-gardener`** — Only `npm_package`, `crate_package`, and `engineering` were listed; `brew_formula` was absent despite being a high-volume type. Added.
- **"Three enrichment layers" counted incorrectly** — `tool-intel` SKILL.md and CLAUDE.md said "three enrichment layers" but listed four items (frontmatter, type-specific section, Observations, Relations). Restructured as "three core layers + one type-specific section" to match package-intel's actual three-layer model.

## [0.7.0][] - 2026-03-12

### Added

- **`schemas/` directory** — version-controlled source of truth for all 12 Basic Memory note schemas, mirroring schema notes in BM. Enables first-install seeding and keeps plugin repo + BM in sync.
  - **Package schemas (6):** `npm_package`, `crate_package`, `go_module`, `composer_package`, `pypi_package`, `ruby_gem`
  - **Tool schemas (5):** `brew_formula`, `brew_cask`, `github_action`, `docker_image`, `vscode_extension`
  - **Knowledge schemas (1):** `engineering`

### Fixed

- **`brew_cask` schema missing three fields** — `perf?(array)`, `relates_to?(array)`, and `depends_on?(array)` were absent from the schema but used in notes. Discovered via `schema_diff`; all three added to both the BM note and `schemas/brew_cask.md`.
- **PostToolUse hook false positives** — The schema validation hook was firing on schema definition notes themselves (notes in the `schema/` directory), producing spurious validation errors since schema notes aren't package/tool notes. Hook prompt now short-circuits when the permalink contains `/schema/`.

## [0.6.0][] - 2026-03-12

### Added

- **`/tool-intel <prefix>:<name>` skill** — four-source research pipeline for developer environment and CI/CD tooling. Supports five tool types:
  - `brew:<name>` — Homebrew formulae (formulae.brew.sh API)
  - `cask:<name>` — Homebrew casks (formulae.brew.sh/cask API)
  - `action:<owner>/<repo>` — GitHub Actions (tavily_extract on action.yml + README)
  - `docker:<image>` — Docker Hub images (hub.docker.com API; official and community images)
  - `vscode:<publisher>.<ext>` — VSCode extensions (Open VSX API, VS Marketplace fallback)
- **`skills/tool-intel/references/` — ecosystem guides** — five reference files (`ecosystem-brew.md`, `ecosystem-cask.md`, `ecosystem-action.md`, `ecosystem-docker.md`, `ecosystem-vscode.md`) covering registry APIs, field docs, and security notes for each tool type
- **`skills/tool-intel/references/` — note templates** — five templates (`note-template-brew.md`, `note-template-cask.md`, `note-template-action.md`, `note-template-docker.md`, `note-template-vscode.md`) with type-specific content sections (`## Common Usage` for brew/cask, `## Inputs & Outputs` + `## Permissions` for actions, `## Tags` + `## Base Layers` for Docker, `## Features` + `## Configuration` for VSCode)
- **`/knowledge-gaps` extended with Steps 6–9** — detects and parses `Brewfile`, `.github/workflows/*.yml`, `Dockerfile`/`*.dockerfile`, `.vscode/extensions.json`; cross-references against Basic Memory `brew/`, `casks/`, `actions/`, `docker/`, `vscode/` directories; adds a tool coverage section to the gap report with `/tool-intel` enrichment offers
- **Five new tool note types in PostToolUse hook** — `brew_formula`, `brew_cask`, `github_action`, `docker_image`, `vscode_extension` validated after writes
- **`knowledge-gardener`** — inventory, schema validation, and relation integrity extended for all five tool directories and types
- **`knowledge-maintainer`** — assessment and enrichment step extended; auto-detects tool manifests and invokes `/tool-intel` for undocumented tools alongside existing `/package-intel` for packages
- **SessionStart hook** — now mentions `/tool-intel` and lists all five tool prefixes

## [0.5.0][] - 2026-03-12

### Added

- **Multi-ecosystem support for `/package-intel`** — extended from npm-only to six ecosystems: npm, Rust crates, Go modules, PHP Composer, Python PyPI, Ruby gems. Each ecosystem has a dedicated reference file (`ecosystem-crates.md`, `ecosystem-go.md`, etc.) and note template (`note-template-crates.md`, etc.) under `skills/package-intel/references/`.
- **`/knowledge-gaps` extended to all six ecosystems** — scans `Cargo.toml`, `go.mod`, `composer.json`, `pyproject.toml`/`requirements.txt`, and `Gemfile` in addition to `package.json`. Import frequency tiering adapted per language (e.g. `use <crate>::` for Rust, `"<module/path>"` for Go).
- **Ecosystem-prefixed invocations** — `/package-intel crate:serde`, `/package-intel pypi:requests`, etc. No-prefix still defaults to npm.
- **RUSTSEC / PyPA / RubySec advisory search** — Tavily security query adapted per ecosystem advisory format.
- **PostToolUse hook extended** — added type checks for `crate_package`, `go_module`, `composer_package`, `pypi_package`, `ruby_gem` alongside the existing `npm_package` check.
- **`knowledge-gardener` extended** — inventory, schema validation, and relation integrity checks added for `crates/`, `go/`, `composer/`, `pypi/`, `gems/` directories and their corresponding note types.
- **`knowledge-maintainer` extended** — schema assessment and enrichment steps updated for all six package ecosystems; offers `/package-intel crate:*`, `pypi:*`, etc. for Tier 1 gaps.
- **`Glob` re-added to `knowledge-gaps`** — removed in 0.2.0 (was unused); re-added in 0.5.0 for multi-ecosystem manifest detection (`Cargo.toml`, `go.mod`, etc.).
- **SessionStart hook updated** — lists multi-ecosystem prefixes (`crate:`, `pypi:`, `go:`, `composer:`, `gem:`) in the session context message.

## [0.4.0][] - 2026-03-09

### Changed

- **Plugin renamed from `vp-claude` to `vp-knowledge`** — the old name
  didn't reflect what the plugin does (Basic Memory knowledge graph
  management). If you have `vp-claude@vp-plugins` installed, uninstall
  and reinstall as `vp-knowledge@vp-plugins`.
- **`vp-plugins` marketplace adds `vp-beads`** — sprint workflow automation
  (retrospectives, upstream vendor tracking) now available as a separate
  installable plugin at `voxpelli/vp-beads`.

## [0.3.0][] - 2026-03-09

### Fixed

- **Orphan detection was looking in the wrong place** — `build_context(url="memory://npm/*")` only traverses connected nodes; zero-link notes are invisible to it. Replaced with a two-pass approach: `read_note(..., output_format="json")` inspects the structured `relations` field to find zero-outgoing notes, then `build_context` on each candidate confirms zero-incoming. True orphans (zero in + zero out) are now reliably detected.
- **`recent_activity` pagination missing** — stale note detection in `knowledge-gardener` did not paginate `recent_activity` results, so large graphs could miss notes. Added explicit instruction to paginate until `has_more=false`.
- **Confusing identifier example in `package-intel`** — `read_note(identifier="npm/npm-<sanitized-slug>")` implied the caller must sanitize the name. The title form `npm:<package-name>` resolves identically and matches the `[[npm:pkg]]` wiki-link convention. Replaced throughout.

### Changed

- **Removed `delete_note` from `knowledge-maintainer`** — archiving uses `move_note`; deletion is irreversible. Removing the tool prevents accidental permanent loss. Notes that must be deleted can be removed via the Basic Memory CLI or `memory-lifecycle` skill.
- **`knowledge-maintainer` autonomy rules** — "Deleting or archiving notes" split into "Archiving notes (move to `archive/` via `move_note`)" and a note that permanent deletion is unavailable from the agent.

### Added

- **`agents/session-reflector.md`** — on-demand reflection agent. User-triggered counterpart to the automatic PreCompact hook. Reviews the conversation, extracts candidates, shows a preview grouped by target note, waits for approval, then writes. Uses the same `[category]` observation vocabulary as PreCompact for consistency.
- **Freshness check in `package-intel` step 1** — if an existing note was updated within 60 days, skip Tavily and Raindrop (low churn) and focus DeepWiki/Context7 on recent changes. Notes older than 60 days or missing trigger the full five-source pipeline. Previous `[gotcha]` and `[limitation]` observations are surfaced to guide the new research pass.

## [0.2.0][] - 2026-03-09

### Fixed

- **Agent prompts generated Python scripts instead of calling MCP tools** — `python`-tagged code blocks in `knowledge-maintainer.md` caused the model to produce executable Python and run it via Bash rather than invoking MCP tools directly. Replaced all ` ```python ` fences with bare fences and added an explicit "call MCP tools directly, never scripts" directive.
- **`noteType` → `note_type`** — Wrong parameter name in `schema_validate` and `schema_infer` calls in both agents. Basic Memory uses snake_case throughout.
- **`npm-package` → `npm_package`** — Wrong type value. Basic Memory enforces snake_case for all frontmatter `type` fields; `npm_package` is canonical.
- **Reversed find-replace in maintainer** — The frontmatter-fix example had `find: npm_package, replace: npm-package` — backwards, would actively corrupt correct notes. Fixed to `find: npm-package, replace: npm_package`.
- **Broken `append`+`section` pattern** — Orphan-linking example used `operation="append", section="Relations"`, which appends to end of file, not end of section. Replaced with the correct `find_replace` pattern. Both agents now document this gotcha.
- **Double-prefix bug in `package-intel`** — `read_note(identifier="npm/npm-<slug>")` example had a spurious `npm/` prefix. Correct form is `npm/<package-name>`.

### Changed

- **Removed `Bash` from `knowledge-gardener`** — the agent is read-only and operates entirely through Basic Memory MCP tools; no workflow step needs shell access. Removing Bash structurally prevents script execution.
- **Removed `Bash` from `knowledge-maintainer`** — all write workflows use MCP tools or invoke skills via the `Skill` tool (which carries its own permissions). No workflow step in the agent itself needs shell access.
- **Removed `Agent` from `knowledge-maintainer`** — no workflow step delegates to a sub-agent. The initial audit is performed inline; `/package-intel` is invoked via `Skill`, not `Agent`.
- **Removed 8 external research tools from `knowledge-maintainer`** — DeepWiki, Context7, Tavily, and Raindrop tools belonged to `package-intel`, not to the maintainer directly. Skills invoked via `Skill` carry their own permissions; callers don't inherit the callee's tools.
- **`knowledge-gaps`: replaced `bash find` pipeline with direct `Grep` calls** — The `find … | sed | sort -u` pipeline existed only to feed directory names to grep. ripgrep (which powers the `Grep` tool) respects `.gitignore` and skips `node_modules` automatically, so a single `Grep(glob="**/*.{js,ts,mjs,cjs}", output_mode="count")` call per package replaces the three-step bash pipeline. Also adds guidance for scoped packages (`@scope/pkg`).
- **Removed `Read`, `Grep`, `Glob` from `knowledge-gardener`** — the agent operates entirely through Basic Memory MCP tools; no audit step touches the local filesystem.
- **Removed `Read`, `Grep`, `Glob` from `package-intel`** — no workflow step reads local project files; all filesystem access goes through `Bash` (for `npm view`, `gh`).
- **Removed `read_wiki_structure` from `package-intel`** — unreferenced in any workflow step; `ask_question` covers the DeepWiki usage.
- **Removed `Glob` from `knowledge-gaps`** — unused; `Grep` handles import counting and the bash `find` (now removed) handled directory discovery.
- **Removed `Agent` from `package-intel`** — the skill never delegates to sub-agents.

### Added

- **`fetch_bookmark_content` to `package-intel`** — genuine functional gap: step 3d could find bookmarks via `find_bookmarks` but had no way to read their content. Now the full bookmark content is reachable.
- **`Skill` to `knowledge-gaps`** — enables step 5 to chain into `/package-intel` for Tier 1 undocumented packages.

## [0.1.0][] - 2026-02-01

### Added

- Initial release: `package-intel` skill, `knowledge-gaps` skill, `knowledge-gardener` agent, `knowledge-maintainer` agent, PostToolUse / PreCompact / SessionStart hooks.

[0.14.0]: https://github.com/voxpelli/vp-claude/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/voxpelli/vp-claude/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/voxpelli/vp-claude/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/voxpelli/vp-claude/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/voxpelli/vp-claude/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/voxpelli/vp-claude/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/voxpelli/vp-claude/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/voxpelli/vp-claude/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/voxpelli/vp-claude/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/voxpelli/vp-claude/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/voxpelli/vp-claude/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/voxpelli/vp-claude/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/voxpelli/vp-claude/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/voxpelli/vp-claude/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/voxpelli/vp-claude/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/voxpelli/vp-claude/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/voxpelli/vp-claude/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/voxpelli/vp-claude/releases/tag/v0.1.0
