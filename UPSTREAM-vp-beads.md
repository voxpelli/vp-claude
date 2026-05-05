# UPSTREAM: vp-beads

Friction, feature requests, and contribution opportunities against the
[vp-beads](https://github.com/voxpelli/claude-beads) plugin's skills and
tooling, discovered while building vp-knowledge.

## Feature Requests

- **synergy-tracker: mandate bilateral reciprocation in workflow prose** (2026-05-04) —
  The current skill says "Write entries from this project's point of view"
  but doesn't mandate that when the sibling has already written entries on
  their side, they should be reciprocated here. Sprint 19 found that
  asymmetric tracking silently misses drift: re-verifying vp-beads's
  existing 10 shared-pattern entries from vp-claude's side surfaced 3
  actively-drifting artifacts (`validate-plugin.mjs` 358 vs 333 lines;
  `scripts/check-hooks.mjs` 366 vs 284 lines; `npm-run-all2 parallel
  check stages` since-converged) and 1 stale `aligned`-row that vp-beads
  has no way to detect from their side (PreCompact retired in our
  v0.28.0). Reciprocation IS the verification step — the workflow prose
  should require it. Concrete change: add a sentence to workflow 1 (Log)
  saying "When the sibling has written entries from their side,
  reciprocate by re-verifying each from this project's angle and
  recording your verification dates and any drift you observe. Do not
  skip 'duplicates' — the reciprocation is the verification step."
  Ownership: upstream · Workaround: full — manual reciprocation completed
  this sprint in `SYNERGY-vp-beads.md` after user pushback on initial
  asymmetric framing. Skill prose change is purely vp-beads's responsibility.

- **synergy-tracker: add domain-fit test for "They Have / We Don't" section** (2026-05-04) —
  The current skill describes the section as "capabilities in the
  sibling project that this project lacks and may want to adopt" — too
  permissive. It admits category errors where the sibling has a
  capability in a *different domain* (e.g., vp-beads's `swarm-wave` for
  sprint orchestration; vp-beads's `vendor-sync` for vendored content)
  that don't fit because vp-claude has neither the underlying need nor
  the implementation. Concrete change: add a one-sentence test in the
  section's guidance — "Pass test: this project has the underlying need
  but lacks the implementation. Fail: the sibling has a capability in a
  different domain than this project's." Without it, every comparison
  run produces noise the user must dismiss; this sprint two such
  candidates (`swarm-wave`, `vendor-sync`) were proposed and rejected
  after user pushback.
  Ownership: upstream · Workaround: partial — test inlined as prose
  comment in vp-claude's `SYNERGY-vp-beads.md` (`## They Have / We Don't`
  section), but the skill prose itself remains permissive for any
  future user.

- **synergy-tracker: stale-row detection via inverse-file glob** (2026-05-04) —
  When this project retires a feature that the sibling tracks as
  `aligned` (e.g., vp-claude retired PreCompact in v0.28.0; vp-beads's
  `SYNERGY-vp-knowledge.md` still tags PreCompact aligned 2026-04-05),
  the sibling's row goes stale with no automated detection. Workflow 2
  (Review) could optionally glob the sibling's SYNERGY file (if
  accessible at `../<sibling>/SYNERGY-<this-project>.md`) and surface
  entries marked aligned that have measurable drift on this side, or
  features tracked as shared that no longer exist here. Workflow 3
  (Compare) already reads sibling files; workflow 2 could reuse the
  same access pattern to flag potential staleness. Lower-priority than
  the reciprocation mandate but pairs naturally with it.
  Ownership: upstream · Workaround: partial — manually noted stale rows
  in `SYNERGY-vp-beads.md` body prose for each affected entry
  (PreCompact, validate-plugin.mjs drift, check-hooks.mjs drift,
  npm-run-all2 since-converged).

- **synergy-tracker: extend registry schema with `local-path` + `.local.json` companion** (2026-05-04) —
  The current `synergy-registry.json` schema (`name`, `file`, `remote`,
  `bm-entity`, `relationship`) has no on-disk location field; workflow 3
  (Compare with sibling) hardcodes `../<sibling>/` as the path. Different
  machines have different layouts (`~/Sites/<name>`, `~/code/<name>`, CI
  checkout paths, monorepo subdirectories). Two complementary additions
  needed:
  (1) Add OPTIONAL `local-path` field to each entry — a sensible default
  for the common `../<name>` layout, recorded explicitly so the skill
  doesn't have to guess.
  (2) Support a gitignored `.claude/synergy-registry.local.json`
  companion file (object keyed by entry `name`) that overrides any field
  in the main registry — for users with non-standard local layouts.
  Mirrors the `settings.local.json` convention Claude Code already uses
  in `.claude/`. The skill resolves: load `synergy-registry.json`, merge
  `synergy-registry.local.json` if present, then use the merged result.
  Without this, every workflow that touches sibling files (compare,
  the proposed `/sibling-sync` below) must re-prompt for paths or fail
  on non-standard layouts. Same schema extension applies to
  `vendor-registry.json` for symmetry.
  Ownership: upstream · Workaround: partial — vp-claude's first
  `synergy-registry.json` (this sprint) omits `local-path` because the
  schema doesn't define it yet; future workflows depend on the schema
  landing.

- **vp-beads: new `/sibling-sync` skill for bilateral SYNERGY/UPSTREAM reconciliation** (2026-05-04) —
  Sprint 19 surfaced multiple drift modes that current skills don't
  catch: vp-beads's `SYNERGY-vp-knowledge.md` carries stale `aligned`
  rows for features vp-claude has since retired (PreCompact in v0.28.0);
  vp-claude's newly-reciprocated `SYNERGY-vp-beads.md` re-verified the
  same 9 shared patterns from our side and found 3 actively drifting
  (validate-plugin.mjs, check-hooks.mjs, npm-run-all2). Both directions
  need ongoing reconciliation. A new skill — provisional name
  `/sibling-sync`, alternative `/sync-tracker` (though the existing
  `/vendor-sync` precedent argues for verb-shaped sync names) — should:
  (1) read this project's `SYNERGY-<sibling>.md` alongside the sibling's
  inverse `SYNERGY-<this>.md` (path resolved via synergy-registry remote
  + optional `local-path` from the entry above; fall back to
  `../<sibling>/`);
  (2) diff entries by title and surface gaps in both directions
  (entries here but not there, or vice versa);
  (3) flag status conflicts (one side `aligned`, other `drifting`);
  (4) flag stale `Last verified` dates relative to commit cadence on
  the artifact paths cited;
  (5) optionally batch-apply reciprocation under user approval.
  Same scaffolding generalizes to UPSTREAM-* files when two siblings
  share a dependency (e.g., both maintain `UPSTREAM-basic-memory.md`)
  — one skill, two file types. Companion to the existing `/vendor-sync`
  (which handles upstream-to-project drift); this skill handles
  peer-to-peer drift. Benefits substantially from the registry schema
  extension above for path resolution across machines.
  Ownership: upstream · Workaround: partial — manually reciprocated 9
  SYNERGY entries this sprint after user pushback. Upstream-tracker
  entry 1 above (mandate reciprocation in workflow prose) provides
  partial relief via documentation; this skill would automate the
  verification at scale and catch drifts no manual reciprocation pass
  ever runs frequently enough to surface.

- **retrospective: add `npm run check` fallback to test-command waterfall** (2026-05-04) —
  Three-sprint repeat (RETRO-17, RETRO-18, RETRO-19) of `npm test`
  failing in projects whose health gate is `npm run check` instead of
  `npm test`. The current skill prose tries `npm test` →
  `npm run test:node` → `npm run test`. Adding `npm run check` as a
  fourth fallback would close the gap for validation-suite projects
  (vp-knowledge, vp-beads itself, vp-git). The retrospective skill is
  the place this matters most because retros surface the failure but
  the failure has no fix-path other than "next sprint, repeat."
  Ownership: upstream · Workaround: full — vp-claude-9mr (beads issue,
  P3) tracks the local fix; vp-beads users can manually edit the retro
  template in their cloned plugin.

- **upstream-tracker: clarify redirect rule for sibling projects with shipped skill code** (2026-05-04) —
  Workflow 1 step 1 currently says "If the observation is about a sibling
  project rather than an upstream package or tool, redirect to
  `/synergy-tracker` — this skill only tracks upstream dependency friction,
  not cross-project patterns." This conflates two distinct cases. When a
  sibling project is also an upstream skill/hook/agent source (the
  vp-plugins marketplace pattern: vp-beads, vp-knowledge, vp-git all
  consume each other's artifacts), filing concrete skill improvements
  (feature requests, bugs in skill prose, contribution opportunities to
  extract shared logic) IS upstream-tracker work — there's a real upstream
  artifact to file against. synergy-tracker is for patterns and
  divergences, not concrete code requests. Concrete change: rewrite the
  redirect rule to distinguish patterns from filable artifacts —
  "If the observation is a cross-project pattern (shared approach,
  divergence, extraction candidate, capability gap) between sibling
  projects, redirect to `/synergy-tracker`. Sibling projects that ship
  upstream artifacts (skills, hooks, agents) can still receive
  upstream-tracker entries for concrete bug reports, feature requests, or
  contribution opportunities against those artifacts." Sprint 19 logged
  4 such entries (the 3 synergy-tracker improvements plus the
  retrospective `npm run check` fallback above) that would have been
  miscategorized under the current rule.
  Ownership: upstream · Workaround: full — this `UPSTREAM-vp-beads.md`
  file exists despite the skill prose suggesting a redirect; the carve-out
  is exercised in practice but undocumented.

- **/harden-memories: new skill to triage and prune persistent memories** (2026-05-05) —
  `bd prime` injects every `bd remember` entry in full at SessionStart
  and PreCompact (~1.5–2k tokens for a 16-entry set; scales linearly).
  Entries silently accumulate as conventions drift, skills ship, or facts
  graduate to MEMORY.md / project CLAUDE.md / Basic Memory — but no skill
  automates the audit, so the token cost is paid forever until a manual
  pass. The canonical 3-question checklist already exists in Basic Memory
  at `engineering/agents/three-memory-systems-taxonomy-and-graduation`
  (`[pattern]` obs: "(1) already in BM or MEMORY.md/CLAUDE.md? → remove;
  (2) stable architectural state? → migrate; (3) only recovery-from-
  context-loss insights stay") with a `[lesson]` reporting "~40% token
  reduction" typical per audit. Concrete shape: read `bd memories`,
  cross-reference each entry against project CLAUDE.md / MEMORY.md /
  Basic Memory, present a triage table (delete / migrate→CLAUDE.md /
  migrate→MEMORY.md / migrate→BM / keep) with one-line rationale per
  entry, then on user approval execute `bd forget` for deletions and
  write migration patches with diff preview before applying. Sprint 20
  ran the audit manually for vp-knowledge: 16 entries → 0 (100% prune;
  most were post-shipping design notes), 5 facts migrated to project
  CLAUDE.md, 1 to global `~/.claude/CLAUDE.md`, 10 pure deletes. Proposed
  name: `/harden-memories` — names the end state (each remaining entry
  has earned its per-session injection cost) rather than the action,
  matching the verb-shaped style of `/vendor-sync` and `/session-reflect`.
  Avoid `compact` in the name — it collides with `bd admin compact`
  (closed-issue graceful decay), which already caused user confusion
  this sprint when both topics surfaced in adjacent turns. Alternative
  names considered: `/memories-audit`, `/remember-audit`, `/bd-prune`.
  Ownership: upstream · Workaround: partial — taxonomy + checklist
  exist in BM but no skill automates the triage; manual `bd forget`
  loops plus ad-hoc `/knowledge-ask` invocations cover the gap with
  significant ceremony per audit (~40 tool calls for vp-knowledge's
  16-entry pass; an automated skill would compress to ~10).

## Bugs

*No entries yet.*

## Upstream Opportunities

*No entries yet.*
