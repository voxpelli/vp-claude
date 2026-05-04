# SYNERGY-vp-git

Tracking cross-project synergy with [vp-git](https://github.com/voxpelli/claude-git).

**Architectural relationship:** vp-git is a focused git-workflow-safety plugin
(rebase/merge/stacked-PR validation). vp-claude (vp-knowledge) is the BM-
enrichment plugin. The two plugins share scaffolding conventions (plugin.json,
package.json scripts, validate-plugin.mjs, remark stack) but no domain logic.
Synergy worth tracking lives in plugin-scaffolding patterns and validation
tooling that vp-claude could adopt.

## Shared Patterns

- **Plugin scaffolding shape** (2026-05-04) — Both plugins share:
  `.claude-plugin/plugin.json` manifest, `package.json` with `npm run check`
  orchestrator (`run-p check:*`), root-level `validate-plugin.mjs`, MIT
  license, `voxpelli` author, identical remark devDeps stack
  (`remark-cli`, `remark-frontmatter`, `remark-preset-lint-consistent`,
  `remark-preset-lint-recommended`, `js-yaml`, `npm-run-all2`).
  Status: aligned · Last verified: 2026-05-04

- **`validate-plugin.mjs` tool-reference audit** (2026-05-04) — Both
  plugins maintain a root-level `validate-plugin.mjs` that audits
  `mcp__*__*` tool patterns mentioned in skill prose against declared
  `allowed-tools` frontmatter. From vp-claude's side: 358 lines vs
  vp-git's 330 (28-line gap, plugin-specific extensions including the
  gardener read-only invariant and `KNOWN_MCP_PREFIXES` allowlist). Strong
  extraction candidate alongside vp-beads's mirror entry — see
  `SYNERGY-vp-beads.md` Extraction Candidates ("Paired bundle:
  `@voxpelli/claude-plugin-tools`").
  Status: drifting · Last verified: 2026-05-04

## Divergences

- **Hooks/agents/skills scope** (2026-05-04) — vp-claude has 14 skills, 4
  agents, 5 hooks. vp-git has 1 skill (`rebase-validate`), 0 agents, 0 hooks.
  Domain choice — vp-git is a focused git-safety-skill plugin with no runtime
  intervention surface; vp-claude is a multi-skill BM platform.
  Convergence path: accept-difference · Reason: different plugin domains
  justify different scope.

## Extraction Candidates

_No entries yet._

## They Have / We Don't

- **`check-portability.mjs` portability lint** (2026-05-04) — vp-git ships a
  root-level `check-portability.mjs` (run via `npm run check:portability`)
  that warns on hard-coded `${CLAUDE_PLUGIN_ROOT}` paths and `../` path
  escapes that won't resolve outside the plugin loader. vp-claude relies
  heavily on `${CLAUDE_PLUGIN_ROOT}` in hook scripts and skill prose — a
  silent regression to bare relative paths would not surface without this
  check.
  Priority: adopt-soon · Effort: trivial-to-moderate (port the script,
  adapt to vp-knowledge file inventory, add `check:portability` to
  `npm run check`)

- **`plugin-utils.mjs` shared utility module** (2026-05-04) — vp-git has a
  root-level `plugin-utils.mjs` exporting `ROOT`, `formatWarn`, and
  `extractFrontmatter`, consumed by both `validate-plugin.mjs` and
  `check-portability.mjs`. vp-claude's `validate-plugin.mjs` has analog
  logic inline (358 lines vs vp-git's 330 — the 28-line gap is mostly
  duplicated utility code). Adopting the shared module would deduplicate
  and improve maintainability if vg-3 (check-portability) is adopted.
  Priority: consider · Effort: trivial (extract, import in
  validate-plugin.mjs)

- **`skill-check` spec validator via npx** (2026-05-04) — vp-git runs
  `npx --yes skill-check check --no-security-scan` as part of `npm run check`
  (script: `check:spec`). This is a third-party validator for skill
  frontmatter and prose conformance. vp-claude does not currently run it
  and may have skill-format drift that would surface only if/when the
  validator is added. Cost is minimal — one-line addition to package.json
  scripts and CI.
  Priority: consider · Effort: trivial
