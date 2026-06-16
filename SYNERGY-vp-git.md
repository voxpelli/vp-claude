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
  `.claude-plugin/plugin.json` manifest, `package.json` with a top-level
  `npm run check` orchestrator script, root-level `validate-plugin.mjs`,
  MIT license, `voxpelli` author, identical remark devDeps stack
  (`remark-cli`, `remark-frontmatter`, `remark-preset-lint-consistent`,
  `remark-preset-lint-recommended`, `js-yaml`, `npm-run-all2`).
  Status: aligned · Last verified: 2026-05-29
  Note: As of 2026-05-29 both genuinely share `npm-run-all2@^7.0.0` and the
  `run-p check:*` orchestrator — vp-claude adopted it this date (it had
  previously used sequential `&&` chaining despite this note's earlier claim
  of a shared devDep, which was aspirational). The convergence is tracked on
  vp-beads's side (`SYNERGY-vp-beads.md` "npm-run-all2 parallel check stages",
  now `Status: converged`).

- **`validate-plugin.mjs` tool-reference audit** (2026-05-04) — Both
  plugins maintain a root-level `validate-plugin.mjs` that audits
  `mcp__*__*` tool patterns mentioned in skill prose against declared
  `allowed-tools` frontmatter. From vp-claude's side: 358 lines vs
  vp-git's 330 (28-line gap, plugin-specific extensions including the
  gardener read-only invariant and `KNOWN_MCP_PREFIXES` allowlist). Strong
  extraction candidate alongside vp-beads's mirror entry — see
  `SYNERGY-vp-beads.md` Extraction Candidates ("Paired bundle:
  `@voxpelli/claude-plugin-tools`").
  Status: accept-difference (was drifting) · Last verified: 2026-05-29
  Note (2026-05-29 /sibling-sync): aligned to vp-git's 2026-05-21 reassessment —
  they refuted extraction as premature (the shared core is shrinking as a
  fraction; each plugin's extensions dominate) and reclassified
  `KNOWN_MCP_PREFIXES` as accept-difference, not drift (each plugin allowlists
  only the MCP servers its own skills reference). Revival trigger: shared core
  stable 2+ sprints AND a 3rd plugin needs a core-level change. NB: the
  vp-beads mirror still carries `drifting` — that pairing has genuinely
  drifting copies (358 vs 333 + this sprint's phantom-subagent and
  staleness-contract checks); the accept-difference verdict is vp-git-specific.

## Divergences

- **Hooks/agents/skills scope** (2026-05-19) — vp-claude has 14 skills, 4
  agents, 5 hooks. vp-git has 3 skills (`rebase-validate`, `stack-cascade`,
  `tag-audit`), 0 agents, 0 hooks. Domain choice — vp-git is a focused
  git-safety-skill plugin with no runtime intervention surface; vp-claude is
  a multi-skill BM platform.
  Convergence path: accept-difference · Reason: different plugin domains
  justify different scope.
  Note: `stack-cascade` added in vp-git 0.6.0 (2026-05-19); `tag-audit` added
  2026-05-27. Skill count refreshed 2→3 during the 2026-05-29 /sibling-sync
  pass (vp-git's reciprocal row already listed all three).

## Extraction Candidates

_No entries yet._

## They Have / We Don't

- **`tag-audit` SHA-grouped safety-tag triage** (2026-05-27) — vp-git's
  `/tag-audit` skill audits accumulated safety tags by sorting on SHA (not
  name) to expose duplicates, cross-references current branch refs, applies a
  per-tag decision tree, and gates deletion behind a KEEP/DROP proposal.
  Self-contained (one SKILL.md + one references sidecar), copy-on-demand.
  vp-knowledge has no tag-creation workflow today, so demand is hypothetical —
  a portable git-hygiene primitive to revisit if the pattern surfaces here.
  Priority: consider (no tag-creation workflow yet) · Effort: trivial (copy
  `skills/tag-audit/`) · Logged: 2026-06-16 via /sibling-sync

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
  Note (2026-05-29): **Corroborating instance found** — the `--stale`
  five-ecosystem work surfaced `vp-claude-fgy`: `staleness-detection.md` and
  `knowledge-gardener.md` invoke `bash scripts/fetch-<eco>-upstream.sh` with a
  bare CWD-relative path that breaks when the skill runs from a non-plugin-root
  directory (the vault-wide-audit case). This is precisely the regression class
  `check-portability.mjs` flags. The bug went undetected by every existing
  `npm run check` gate (shellcheck/shfmt/remark/validate-plugin) — exactly the
  blind spot this adoption closes. Escalates the case for adopting it.

- **`plugin-utils.mjs` shared utility module** (2026-05-04) — vp-git has a
  root-level `plugin-utils.mjs` exporting `ROOT`, `formatWarn`, and
  `extractFrontmatter`, consumed by both `validate-plugin.mjs` and
  `check-portability.mjs`. vp-claude's `validate-plugin.mjs` has analog
  logic inline (358 lines vs vp-git's 330 — the 28-line gap is mostly
  duplicated utility code). Adopting the shared module would deduplicate
  and improve maintainability if vg-3 (check-portability) is adopted.
  Priority: consider · Effort: trivial (extract, import in
  validate-plugin.mjs)
  Note (2026-05-29): vp-claude took its **first step toward this pattern** —
  the `--stale` work extracted `lib/staleness-contract.mjs` (pure
  emit↔consume bucket-contract logic) out of `validate-plugin.mjs`, imported
  back in, and unit-tested via `scripts/check-staleness-contract.mjs`
  (`npm run check:contract`). vp-claude now has a `lib/` dir and the
  extract-pure-logic-then-test habit vp-git's `plugin-utils.mjs` exemplifies;
  a shared module is a smaller leap from here.

- **`skill-check` spec validator via npx** (2026-05-04) — vp-git runs
  `npx --yes skill-check check --no-security-scan` as part of `npm run check`
  (script: `check:spec`). This is a third-party validator for skill
  frontmatter and prose conformance. vp-claude does not currently run it
  and may have skill-format drift that would surface only if/when the
  validator is added. Cost is minimal — one-line addition to package.json
  scripts and CI.
  Priority: consider · Effort: trivial
