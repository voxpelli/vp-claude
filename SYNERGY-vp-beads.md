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
  Status: drifting · Last verified: 2026-05-29
  Note: Bilaterally confirmed drifting after Sprint 20 /sibling-sync pass
  — vp-beads's row also marks drifting (LV 2026-05-04). The 25-line gap
  reflects vp-claude additions since. Re-converge candidate when vg-3/vg-4
  (extracting plugin-utils.mjs) is acted on. 2026-05-20 (Sprint 27): vp-claude
  added a **phantom-subagent check** — `Agent(subagent_type="X")` references in
  skill prose are validated against `agents/X.md`, mirroring the existing
  agent→skill phantom-skill check. vp-beads lacks it; widens the drift.
  2026-05-29: vp-claude added a **staleness-bucket emit↔consume contract
  check** but extracted its logic to `lib/staleness-contract.mjs` (a new
  pure-module pattern) imported back into `validate-plugin.mjs`, so the
  net inline growth is small while a new shared-able artifact appeared. This
  is the first vp-claude validator check with its own fixture self-test
  (`check:contract`) — a testability approach the shared `@voxpelli/...`
  package should inherit.
  Extractable as part of the shared validator (see Extraction Candidates).

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

- **ESLint via `@voxpelli/eslint-config` (neostandard)** (2026-06-03) — Both
  plugins lint their `.mjs` validation tooling with the `voxpelli()` factory from
  `@voxpelli/eslint-config` (vp-knowledge on `^25.1.0`), same knobs: `noMocha:
  true`, `semi: false`, and `cliFiles` (relax `no-process-exit`/`no-console`/sync
  I/O for `scripts/` + `validate-plugin.mjs`). Both adopted it 2026-06-03 and wire
  `check:lint` into `run-p check:*`.
  Status: aligned · Last verified: 2026-06-03
  Note: deliberate divergence — vp-knowledge has a `lib/`, so `cliFiles` keeps
  `lib/` library-strict and we disable `unicorn/no-null` (NDJSON wire format) plus
  `security/detect-non-literal-fs-filename`/`-regexp` (self-file validation
  tooling); vp-beads has no `lib/` (every `.mjs` is a CLI) and fixed its `null`s
  to `undefined` instead. Both disable `unicorn/import-style` (uniform named
  node-builtin imports). Reciprocates vp-beads's `SYNERGY-vp-knowledge.md` entry
  of the same name (vp-knowledge adopted in commit `a7ad92d`).

## Divergences

- **npm-run-all2 parallel check stages** (2026-05-19) — *(Converged
  2026-05-29)* vp-claude adopted `npm-run-all2@^7.0.0` + `run-p check:*`,
  matching vp-beads and vp-git exactly. Its `package.json` "check" script is
  now `run-p check:*` (was sequential `&&` chaining across 5 sub-checks);
  the 5th sub-check (`check:contract`, added in the v0.31.0 staleness work)
  was the tipping incentive. `npm run check` verified green in parallel.
  Convergence path: adopt-theirs · Status: converged · Last verified: 2026-05-29
  Note: Sprint 19's reciprocation pass falsely claimed convergence; it was
  finally real on 2026-05-29 after three sibling-sync passes flagged
  vp-claude as the lone sequential holdout. **Bilaterally reciprocated** — the
  2026-06-02 /sibling-sync pass found vp-beads's `SYNERGY-vp-knowledge.md`
  now records `Status: converged` (uncommitted in their working tree at pass
  time); the reciprocation gap is closed. Residual sub-check divergence their
  row flags: vp-claude runs **6** sub-checks (adds `check:contract` +
  `check:distance`) vs vp-beads's 4, and our `check:md` lacks
  `--ignore-path .gitignore` — the `run-p check:*` pattern converged, the
  sub-check sets did not.

- **PreCompact hook retired in v0.28.0** (2026-05-04) — *(Converged
  2026-06-03)* vp-claude retired its PreCompact hook in v0.28.0 (commit
  `624e3df`, 2026-04-29) per the Sprint 18 hook audit, judged redundant with
  PostToolUse-driven session-reflect propagation. The 2026-06-03 /sibling-sync
  pass found vp-beads retired BOTH its PreCompact and PostCompact hooks in
  v0.17.0 — its `SYNERGY-vp-knowledge.md` now records this divergence as
  `adopt-theirs · converged` ("Both sides are now PreCompact-free"). The
  earlier `accept-difference` rationale ("vp-beads keeps PreCompact for
  sprint-reflect-before-cliff semantics") is superseded: that premise no longer
  holds now that vp-beads ships no PreCompact hook.
  Convergence path: adopt-theirs · Status: converged · Last verified: 2026-06-03

- **PostCompact hook is a dead letter for context injection** (2026-06-03) —
  *(Converged 2026-06-03)* Reciprocates vp-beads's `SYNERGY-vp-knowledge.md`
  "Compaction-capture hook slot" finding. Confirmed first-hand against the live
  Claude Code hooks docs (adversarially verified): `PreCompact`/`PostCompact` do
  not support `additionalContext` at all (observability-only / fire
  pre-compaction), so only `SessionStart` with `source="compact"` injects
  post-compaction context into the resumed, tool-capable agent. vp-claude's
  former `PostCompact` hook (`post-compact.sh`) was therefore a dead letter; its
  recovery payload has been migrated into `session-start.sh`'s `source=compact`
  branch and the PostCompact hook removed (hooks 6→5), matching vp-beads's
  v0.17.0 migration. Tracked as bd `vp-claude-1oah`.
  Convergence path: adopt-theirs · Status: converged · Last verified: 2026-06-03

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

- **Frontmatter features (skills, user-invocable, effort, disable-model-invocation)** (2026-04-05) —
  vp-claude v0.21.0+ uses `skills` (agent skill preloading),
  `user-invocable: false` (reference-only skills like `vp-note-quality`),
  `effort`, and (v0.30.0) `disable-model-invocation: true` — the latter on the
  scope-partitioned `/knowledge-garden` and `/knowledge-maintain` skills so they
  stay explicit-`/command`-only and never compete with their delegate-target
  agents (`knowledge-gardener`/`knowledge-maintainer`) for trigger phrases.
  vp-beads has skill/agent pairs (e.g. the sprint-review agent alongside sprint
  skills) but validates these fields without using them yet.
  Convergence path: evaluate · Last verified: 2026-05-20 · Reason: vp-beads will
  adopt when a reference-only skill, preloading, or skill↔agent trigger-collision
  need surfaces — the collision-avoidance pattern is the newly relevant one.

- **remark config richness: pinned settings, GFM, link and list-marker
  enforcement** (2026-06-02) — vp-beads (v0.16.0 lint foundation) pins
  `remarkConfig.settings` (bullet `-`, emphasis/strong `*`, rule `-`, fenced,
  one-space list indent), adds `remark-gfm` (GFM table-cell + checkbox rules),
  `remark-validate-links`, and `remark-lint-unordered-list-marker-style` (`-`),
  and runs `check:md` with `--ignore-path .gitignore`. vp-claude runs the bare
  two-preset config (consistent + recommended) with no pinned settings and no
  `--ignore-path`. The pinned settings are what make `remark -o` a safe
  autofixer (lint rules and stringify settings must be hand-synchronized).
  Convergence path: propose-shared · Status: partially converged · Last verified: 2026-06-03
  Reason: extract a shared remark preset (see Extraction Candidates) rather than
  hand-syncing three partial configs. Reciprocates vp-beads's
  `SYNERGY-vp-knowledge.md` entry of the same name.
  Resolution (2026-06-03, bd vp-claude-veqf): vp-claude adopted the pinned
  `settings` block + `remark-validate-links` + `remark-lint-unordered-list-marker-style`
  (`-`). Two items are accept-difference carve-outs: `remark-gfm` (adds 424
  table-cell-padding warnings — vp-claude tables are compact `|x|y|`; aligns with
  bd `jzra`'s gfm-YAGNI gate) and `--ignore-path .gitignore` (it OVERRIDES rather
  than stacks with vp-claude's `.remarkignore`, re-exposing the committed
  `schemas/` BM bracket-prose that `.gitignore` cannot cover). The
  pinned-settings + two-plugin core is the converged surface.
  Sibling-sync 2026-06-03: vp-beads's reciprocal row is still bare
  `propose-shared` (no Status), not yet reflecting vp-claude's partial
  convergence — reciprocation lag, re-check next pass.

- **Private SYNERGY overlay: `.local.md` suffix vs `PRIVATE-SYNERGY-` prefix**
  (2026-06-03) — Both plugins protect proprietary↔public synergy content from
  bilateral comparison and BM promotion, but via different file conventions.
  vp-claude uses a `SYNERGY-<name>.local.md` file pointed to by the registry
  `file:` field, gitignored via `SYNERGY-*.local.md` (in use for a proprietary
  open-core-partner sibling). vp-beads v0.17.0 shipped a first-class
  `PRIVATE-SYNERGY-<project>.md` overlay (a separate `PRIVATE-`-prefixed file
  alongside the shared one, gitignored, skill-aware). This shipped design
  resolves vp-claude's `UPSTREAM-vp-beads.md` `.local.md` feature request — but
  with a different shape than proposed.
  Convergence path: evaluate · Status: drifting · Last verified: 2026-06-03
  Reason: decide whether to adopt vp-beads's `PRIVATE-SYNERGY-` convention
  (migrating the gitignored `.local.md` file to a `PRIVATE-SYNERGY-` overlay) or
  keep the `.local.md` workaround. Adoption would re-converge the marketplace on
  one private-overlay mechanism.

- **Private sibling registration requires a committed entry (no local-only siblings)**
  (2026-06-03) — vp-beads's `synergy-registry.local.json` only *overrides* fields
  of an entry that already exists in the committed `synergy-registry.json`; a
  `.local.json`-only entry (name absent from the committed base) is ignored
  (`sibling-sync/SKILL.md:106-107`). So a fully-private proprietary
  (open-core-partner) sibling cannot be a recognized, sibling-syncable sibling
  without a committed entry naming it — `PRIVATE-SYNERGY-` made the *content*
  private, but *registration* (the relationship's existence) is still forced
  public. vp-claude wants local-only registration for proprietary partners.
  Convergence path: propose-shared · Status: drifting · Last verified: 2026-06-03
  Reason: filed as a feature request in `UPSTREAM-vp-beads.md` ("synergy-registry:
  support local-only sibling entries"). Until shipped, the workaround is either a
  committed entry (public footprint) or a hand-maintained
  `PRIVATE-SYNERGY-<sibling>.md` doc kept outside the registry machinery.

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
  Note (2026-05-29): vp-claude's `--stale` work added a sixth artifact and,
  more usefully, a **testability template** for the bundle:
  `lib/staleness-contract.mjs` (pure logic) + `scripts/check-staleness-contract.mjs`
  (fixture self-test, `npm run check:contract`). It demonstrates the
  pure-module-plus-fixture-test shape the shared package would want for every
  check — proving a contract guard actually catches drift, rather than trusting
  a manual negative-test. When the bundle is built, mirror this shape;
  `check-hooks.mjs` (already shared) + `check-staleness-contract.mjs` are the
  two worked examples of self-testing plugin tooling to generalize from.

- **Shared `@voxpelli/remark-config` preset** (2026-06-02) — vp-beads's
  `remarkConfig` (pinned `settings` plus the `remark-gfm`,
  `remark-validate-links`, two-preset, and
  `remark-lint-unordered-list-marker-style` plugin stack) is a reusable
  lint+format contract vp-claude and vp-git could consume instead of each
  maintaining a partial copy — eliminating the config drift tracked in
  Divergences and making `remark -o` autofix behave identically across the
  vp-plugins marketplace. Natural co-extraction with the
  `@voxpelli/claude-plugin-tools` bundle.
  Source: vp-beads `package.json` `remarkConfig` · Readiness: needs-cleanup
  Effort: moderate · Reciprocates vp-beads's entry of the same name.

## They Have / We Don't

*No entries yet.*
