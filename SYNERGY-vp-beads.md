# SYNERGY-vp-beads

Tracking cross-project synergy with [vp-beads](https://github.com/voxpelli/claude-beads).

**Architectural relationship:** vp-knowledge owns BM infrastructure (write
validation, schema enforcement, note quality). vp-beads builds sprint workflows
on top and consumes some of vp-knowledge's hooks where useful. The two plugins
ship in the `vp-plugins` marketplace as companions, each with its own domain.
Drift to watch for is plugin-scaffolding shared infrastructure (validators,
hooks, hook-test rigs); domain logic is intentionally non-overlapping.

This file is reciprocal with vp-beads's `SYNERGY-vp-knowledge.md`. Each side
records the same shared patterns and divergences from its own POV — the act
of maintaining both halves catches drift cases a single-source record misses.

## Shared Patterns

- **validate-plugin.mjs tool-reference audit** (2026-05-04) — Both plugins
  maintain a `validate-plugin.mjs` that audits `mcp__*__*` tool patterns
  mentioned in skill/agent prose against declared `allowed-tools` or `tools`
  frontmatter. From vp-claude's side: 358 lines vs vp-beads's 333 (25-line
  gap from plugin-specific extensions including the gardener read-only
  invariant and `KNOWN_MCP_PREFIXES` allowlist). Changes to either copy
  must stay in sync or the audit logic diverges silently.
  Status: drifting · Last verified: 2026-05-06
  Note: Bilaterally confirmed drifting after Sprint 20 /sibling-sync pass
  — vp-beads's row also marks drifting (LV 2026-05-04). The 25-line gap
  reflects vp-claude additions since. Re-converge candidate when vg-3/vg-4
  (extracting plugin-utils.mjs) is acted on.

- **post-file-edit.sh shfmt auto-format** (2026-05-04) — Both plugins use a
  PostToolUse command hook (matcher: `Edit|Write`) that runs `shfmt -d`
  drift-detection then `shfmt -w` auto-fix on edited shell scripts. Sprint 18
  (RETRO-18) hardened vp-claude's version with noisy-flag drift detection
  and clean-file paths.
  Status: aligned · Last verified: 2026-05-04

- **wc -l portability guard** (2026-04-05) — Both plugins guard `wc -l`
  pipelines against failure with `|| count=0` and strip leading whitespace
  with `tr -d ' '` (macOS `wc -l` pads with spaces). Pattern lives in
  hook scripts that count entities or files.
  Status: aligned · Last verified: 2026-04-05 (per vp-beads's record)

- **edit_note append-with-section gotcha — independently documented**
  (2026-04-05) — Both plugins encountered the `edit_note` + `append` +
  `section` EOF bug independently and wrote explicit warnings into reference
  files / skill prose. vp-claude's version lives in the BM tool catalog
  observation cluster.
  Status: aligned · Last verified: 2026-04-05 (per vp-beads's record)

- **check-hooks.mjs hook integration test suite** (2026-05-04) — Both
  plugins maintain `scripts/check-hooks.mjs` with shared core infrastructure
  (`parseJsonObjects()` with `}\s*{` multi-object detection, `runHook()`
  via `spawnSync`, jq preflight). From vp-claude's side: 366 lines vs
  vp-beads's 284 lines (~80-line gap). Sprint 18 added shfmt drift + clean
  test paths; v0.29.0 added gh-ecosystem hook coverage. Bilaterally
  confirmed drifting after Sprint 20 /sibling-sync pass — vp-beads's row
  also marks drifting (LV 2026-05-04).
  Status: drifting · Last verified: 2026-05-06
  Note: Strong extraction candidate for shared `@voxpelli/claude-plugin-tools`.

- **BM error classification hook** (2026-04-05) — Both plugins have a
  PostToolUseFailure command hook for BM tools that classifies errors into
  categories (`server-unavailable`, `note-not-found`, `invalid-argument`,
  `permission-error`, `unknown-error`) and emits recovery guidance via
  `additionalContext`.
  Status: aligned · Last verified: 2026-04-05 (per vp-beads's record)
  Note: vp-claude matches 5 BM tools (`write_note`, `edit_note`,
  `schema_validate`, `schema_diff`, `schema_infer`); vp-beads matches 7
  (adds `read_note`, `search_notes`). Difference is tracked as a
  Divergence below — the *hook itself* is shared.

- **Single-JSON output contract** (2026-04-05) — Both plugins enforce that
  every hook script emits at most one JSON object on stdout. Claude Code
  reads only the first object; multi-object emission silently drops data.
  Both test suites verify this contract; vp-claude added 2 new tests in
  Sprint 18 (shfmt drift + clean paths) without ever tripping the rule.
  Status: aligned · Last verified: 2026-04-05 (per vp-beads's record)

- **jq preflight in check-hooks.mjs** (2026-04-05) — Both test suites
  check for `jq` availability before running hook tests, since several
  hooks depend on it.
  Status: aligned · Last verified: 2026-04-05 (per vp-beads's record)

## Divergences

- **npm-run-all2 parallel check stages** (2026-05-19) — vp-beads and
  vp-git both use `run-p check:*` for parallel CI execution; vp-claude
  still uses sequential `&&` chaining in its `package.json` "check"
  script. Convergence is a one-line edit on this side.
  Convergence path: adopt-theirs · Last verified: 2026-05-19
  Note: Re-filed from Shared Patterns 2026-05-19 — the entry had been
  carrying `Status: diverging` which is not a valid Shared Patterns
  value (only `aligned | drifting`). Sprint 19's reciprocation pass
  falsely claimed vp-claude had converged; vp-beads's re-verification
  (2026-05-04) and Sprint 20's /sibling-sync run (2026-05-06) both
  re-confirmed vp-claude remains sequential. Reciprocate on vp-beads's
  `SYNERGY-vp-knowledge.md` (their row carries the same
  misclassification).

- **PreCompact hook retired in v0.28.0** (2026-05-04) — vp-claude retired
  its PreCompact hook in v0.28.0 (commit `624e3df`, 2026-04-29) per the
  Sprint 18 hook audit, judged redundant with PostToolUse-driven
  session-reflect propagation. vp-beads keeps PreCompact for
  sprint-reflect-before-cliff semantics. Bilaterally reciprocated 2026-05-04:
  vp-beads's `SYNERGY-vp-knowledge.md` now carries the matching "PreCompact
  hook retired in vp-knowledge v0.28.0" divergence with `Convergence path:
  accept-difference`.
  Convergence path: accept-difference · Reason: vp-beads's
  reflect-before-compact tier is sprint-cycle-specific; vp-claude reflects
  via the on-demand `/session-reflect` skill instead. Different time-scales,
  different optimal hook surfaces.

- **PostToolUse BM write-validation hook** (2026-04-05) — vp-claude
  provides `post-bm-write-validate.sh` (emits `additionalContext` with
  `schema_validate` instructions after BM writes); vp-beads relies on it
  via the layered plugin dependency rather than duplicating. From
  vp-claude's side: this is a hook we OWN and vp-beads consumes —
  layered-plugin-dependency pattern.
  Convergence path: delegate-to-ours · Status: resolved by design
  Note: This is the canonical example of "hooks that vp-knowledge provides
  for the marketplace" — when vp-beads is co-installed, our hook fires.

- **Agent count and model selection** (2026-04-05) — vp-claude has 4
  agents (knowledge-gardener `model: sonnet`, knowledge-maintainer
  `model: inherit`, knowledge-primer `model: sonnet`, raindrop-gardener
  `model: sonnet`). vp-beads has 1 (sprint-review `model: inherit`).
  Convergence path: accept-difference · Reason: BM enrichment vs sprint
  workflow have different multi-agent task profiles.

- **Skill invocation layering: two-level vs three-level** (2026-04-05) —
  vp-beads uses three-level invocation (SessionStart hook → user invokes
  skill → agent as read-only gate) for sprint workflows. vp-claude uses
  two-level (hooks emit hints → skills do work; agents are workers, not
  gates) for BM enrichment.
  Convergence path: accept-difference · Reason: sprint lifecycle justifies
  the extra agent layer; BM-enrichment workflows don't have a comparable
  gate point.

- **PreToolUse hook** (2026-04-05) — vp-claude has `pre-bash-no-python.sh`
  (blocks Python and Node.js script execution inside knowledge-gardener
  via `permissionDecision: "deny"`); vp-beads has no PreToolUse hooks.
  Convergence path: accept-difference · Reason: read-only-agent
  enforcement is a vp-knowledge-specific invariant (gardener must never
  write or run scripts).

- **PostToolUseFailure matcher scope** (2026-04-05) — vp-claude matches
  5 BM tools (write_note, edit_note, schema_validate, schema_diff,
  schema_infer); vp-beads matches 7 (adds read_note, search_notes).
  Convergence path: accept-difference · Reason: vp-beads uses BM read
  paths more heavily in skill workflows, so a misclassified read-failure
  matters more on their side.

- **Frontmatter features (skills, user-invocable, effort)** (2026-04-05) —
  vp-claude v0.21.0+ uses `skills` (agent skill preloading),
  `user-invocable: false` (reference-only skills like `vp-note-quality`),
  and `effort` in agent/skill frontmatter. vp-beads validates these fields
  but has no use case yet.
  Convergence path: evaluate · Reason: vp-beads will adopt when a
  reference-only skill or preloading need surfaces.

## Extraction Candidates

- **validate-plugin.mjs** (2026-05-04) — Both plugins maintain independent
  copies with substantial overlap. After v0.10.1 convergence on vp-beads's
  side, the remaining divergence is plugin-specific (gardener read-only
  invariant + KNOWN_MCP_PREFIXES allowlist on vp-claude; hook count in
  description on vp-beads). A shared `@voxpelli/validate-claude-plugin`
  package would eliminate the ~25-line gap and make `validate-plugin.mjs`
  a thin wrapper. From vp-claude's side: cleanup needed for the gardener
  invariant — it's tied to vp-claude-specific agent semantics that don't
  generalize cleanly.
  Source: `validate-plugin.mjs` · Readiness: needs-cleanup
  Effort: moderate

- **wc -l portability guard pattern** (2026-04-05) — Safe integer counting
  in shell hooks: `count=$(wc -l < file 2>/dev/null | tr -d ' ' || echo 0)`.
  Non-obvious, easy to get wrong, needed by any Claude plugin with hook
  scripts that count entities. Three+ projects (vp-claude, vp-beads,
  potentially vp-git if it gains hooks) would benefit from a shared
  helper or documentation.
  Source: `hooks/session-start.sh`, hook scripts that count · Readiness: ready
  Effort: trivial

- **Paired bundle: `@voxpelli/claude-plugin-tools` shared package** (2026-05-04) —
  Cross-reference observation linking the two preceding candidates with
  `scripts/check-hooks.mjs` (Shared Pattern, drifting) and vp-git's
  `plugin-utils.mjs` / `check-portability.mjs` (per `SYNERGY-vp-git.md`
  "They Have / We Don't"). All five are plugin-scaffolding artifacts that
  would benefit from being maintained in one place — co-extraction
  amortizes package-creation cost across multiple artifacts and prevents
  future bilateral drift across the three vp-plugins.
  Source: this file + `SYNERGY-vp-git.md` · Readiness: proof-of-concept
  Effort: significant

## They Have / We Don't

*No entries yet.*
