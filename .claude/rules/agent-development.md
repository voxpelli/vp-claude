---
paths:
  - "agents/**/*.md"
---

# Agent development rules

Loads when editing an `agents/**` file. The root `CLAUDE.md` keeps only a
one-line index of the four agents; the full detail and the frontmatter rules
live here.

## Agent inventory (full detail)

- **knowledge-gardener** — Read-only autonomous auditor: inventory, schema validation, orphan detection, relation integrity, stale/duplicate notes (step 5), version drift (step 5b — MCP enumeration + per-ecosystem `fetch-<eco>-upstream.sh` for API facts across brew/npm/cask/crate/vscode, emits `### Version Drift — <eco>` report sections; 2-D age×semver-distance bucketing, tap routing brew-only), cross-project consistency, tag alignment (step 8), fourth-wall note quality (step 10), source-URL provenance nudge (step 11 — informational, emerging-convention). Preloads `vp-note-quality` skill for audit guidance. **Never writes or modifies notes.**
- **knowledge-maintainer** — All-in-one write agent (`effort: high`, `model: inherit`) that acts on audit findings. Auto-fixes structural issues (missing sections, broken frontmatter, orphan linking, tag alignment, fourth-wall violations). Confirms before content changes (merging duplicates, rewriting prose, archiving). Auto-runs `/package-intel` for Tier 1 undocumented packages (3+ imports) and `/tool-intel` for undocumented tools from detected manifests. For gardener-flagged version drift, section 3b is a **queue, not an actor**: it never invokes `/tool-intel`/`/package-intel` itself — every `Drifted >30d` target (and any target with a prior `[security]` observation, regardless of bucket) is emitted as one line in a Refresh Queue report (Routine lane, or a HIGH PRIORITY / IMMEDIATE ACTION lane for the security-flagged override) for a human to action afterward; `Archive candidates`, `Drifted <30d`, `Drifted, age unknown`, and `Unparseable` surface under the approval queue instead. Since nothing executes automatically, there is no partial-failure handling to speak of — the only failure mode is a stale queue entry, guarded by a mandatory pre-enqueue re-read of each target. Preloads `vp-note-quality` skill. `delete_note` and `write_note` intentionally excluded — use `move_note` to `archive/`, delegate new notes to `/package-intel` or `/tool-intel` via `Skill`. For maximum quality, invoke from an Opus session — `model: inherit` propagates the parent model. Reactive only — user must explicitly invoke.
- **knowledge-primer** — Autonomous read-only agent that surfaces project-relevant BM knowledge before work begins. Scans project manifests, cross-references deps against BM, scores relevance, produces a context brief with key gotchas, and sweeps graph-wide observations for critical warnings from non-dependency notes. The "before work" counterpart to `/session-reflect`.
- **raindrop-gardener** — Read-only Raindrop tag auditor: library dashboard, tag inventory, naming violations, near-duplicates, mistagged bookmarks (via `find_mistagged_bookmarks`), orphan tags, legacy tag identification, co-occurrence analysis, non-primary-language tag detection, taxonomy gaps. Produces a structured report with exact `update_tags`/`delete_tags` tool calls as copy-paste recommendations. **Never modifies tags or bookmarks.**

## Agent frontmatter

Required fields: `name`, `description`, `model`, `color`, `tools`. Optional fields: `skills` (preloaded skill content), `effort` (`low`/`medium`/`high`/`max`). The `tools` field is a YAML list of allowed tool names. The knowledge-gardener must remain read-only — never add `write_note`, `edit_note`, or `delete_note` to its tools list. The knowledge-maintainer has write access (`effort: high`) but must confirm before content-level changes.

Color assignments and the agent description-tone conventions live in `VOICE.md` at the plugin root. Consult it before adding a fifth agent or rewriting an existing description.

## See also

- Tool-list hygiene (every tool in `tools` must be called; phantom-tool audit) also applies to agents → `skill-development.md`.
- The read-only enforcement for gardener agents combines the `tools` allowlist with the `PreToolUse` Bash-blocking hook → `hook-development.md`.
