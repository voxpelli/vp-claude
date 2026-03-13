# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.8.0]: https://github.com/voxpelli/vp-claude/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/voxpelli/vp-claude/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/voxpelli/vp-claude/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/voxpelli/vp-claude/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/voxpelli/vp-claude/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/voxpelli/vp-claude/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/voxpelli/vp-claude/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/voxpelli/vp-claude/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/voxpelli/vp-claude/releases/tag/v0.1.0
