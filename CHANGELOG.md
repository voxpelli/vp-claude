# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.4.0]: https://github.com/voxpelli/vp-claude/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/voxpelli/vp-claude/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/voxpelli/vp-claude/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/voxpelli/vp-claude/releases/tag/v0.1.0
