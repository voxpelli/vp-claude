# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-09

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

## [0.1.0] - 2026-02-01

### Added

- Initial release: `package-intel` skill, `knowledge-gaps` skill, `knowledge-gardener` agent, `knowledge-maintainer` agent, PostToolUse / PreCompact / SessionStart hooks.

[0.2.0]: https://github.com/voxpelli/vp-claude/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/voxpelli/vp-claude/releases/tag/v0.1.0
