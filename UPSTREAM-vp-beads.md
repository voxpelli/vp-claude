# UPSTREAM: vp-beads

Friction, feature requests, and contribution opportunities against the
[vp-beads](https://github.com/voxpelli/claude-beads) plugin's skills and
tooling, discovered while building vp-knowledge.

## Feature Requests

- *(Resolved 2026-06-02, vp-beads `upstream-tracker/SKILL.md:86` — the carve-out now reads "Sibling projects that ship upstream artifacts (skills, hooks, agents) can still receive upstream-tracker entries…")* **upstream-tracker: clarify redirect rule for sibling projects with shipped skill code** (2026-05-04) —
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

- *(Resolved 2026-06-03, vp-beads v0.17.0 — ships the `/harden-memories` read-only audit skill under the exact proposed name; commits `e8734c3` + `5ad8394`)* **/harden-memories: new skill to triage and prune persistent memories** (2026-05-05) —
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

- *(Resolved 2026-06-03, vp-beads v0.17.0 — shipped as the `PRIVATE-SYNERGY-<project>.md` overlay, a different design than the proposed `.local.md` suffix; the proprietary↔public boundary is now protected upstream. Whether vp-claude adopts the `PRIVATE-SYNERGY-` convention is tracked as a Divergence in `SYNERGY-vp-beads.md`.)* **sibling-sync + synergy-tracker: `.local.md` SYNERGY variant for proprietary↔public boundaries** (2026-05-31) —
  Add support for gitignored `SYNERGY-<name>.local.md` files that hold local-only
  synergy content for siblings where the relationship crosses a trust/visibility
  boundary (e.g., `relationship: open-core-partner` where one project is
  public/MIT and the other is proprietary). The `.local.md` suffix mirrors the
  existing `.local.json` convention for machine-specific overrides. Motivation:
  the 2026-05-29 near-miss (BM note `sibling-sync-proprietary-public-licensing-classification-gap`)
  showed that reciprocation writes can leak proprietary-adjacent information
  (sprint references, bd issue IDs, internal paths, deprecation signals) into a
  public repo. The `open-core-partner` relationship marker already signals this
  boundary — the skill should protect it at the file level. Current workaround:
  set `file: "SYNERGY-<name>.local.md"` directly in the committed
  `synergy-registry.json` entry (pointing to the local variant) and add
  `SYNERGY-*.local.md` to `.gitignore`. This works today because skills read
  the `file` field as-is. But skills have no `.local.md` awareness — they read
  the file if it exists, but won't create it, won't surface local-only entries
  separately, and won't exclude them from bilateral comparison. Proposed changes:
  (1) `synergy-entry-format.md` — Document the `.local.md` convention: suffix
  for local-only SYNERGY files (gitignored, not shared with siblings, not
  promoted to BM). Add `local-file` as an optional registry field or document
  that `file` can point to a `.local.md` variant. (2) `synergy-tracker`
  workflow 1 (Log) — When logging an entry for a sibling with
  `relationship: open-core-partner`, offer "shared" vs "local-only" choice.
  Default to local-only. (3) `sibling-sync` workflow 2 (Sync) — Exclude
  `.local.md` entries from bilateral comparison; surface existence
  informatively. (4) `sibling-sync` workflow 4 (Apply reciprocation batch) —
  Never write reciprocal entries to `.local.md` files. (5) `validate-plugin.mjs`
  — Accept `.local.md` filenames in the `file` field; recommend
  `SYNERGY-*.local.md` in gitignore patterns.
  Ownership: upstream · Workaround: partial — `file` field override in
  `synergy-registry.json` works for reading, but no skill creates or surfaces
  `.local.md` files; local-only entries are silently included in bilateral
  comparison rather than excluded.

- **`bd close` persistence broken when `.beads/` is gitignored** (2026-05-18) — Regular `bd close <id>` reports `✓ Closed` success but state reverts to `IN_PROGRESS` on next `bd show`/`bd stats`/`bd blocked`. Auto-export step emits warning `Warning: auto-export: git add failed: ... .beads ignored by gitignore`, which seems to roll back the JSONL write. `bd close --force` succeeds in-memory and the success message persists in that invocation, but the close ALSO doesn't reliably persist across subsequent `bd` invocations in this configuration. Reproduced 2x on Sprint 24 (vp-claude-lgb + vp-claude-cuz). Both issues continue to appear in `bd blocked` and `bd stats` as `IN_PROGRESS` despite multiple `--force` closes. This is a data-integrity issue: closed work appears unfinished, leading to false-positive blocked-dependency reports and incorrect sprint-tracking metrics.
  Severity: degraded · Ownership: upstream · Workaround: partial — `--force` succeeds in the current shell invocation but doesn't persist; verify every close with `bd show <id>` and accept some closes won't stick. Tracked locally as bd `vp-claude-syw`.

## Upstream Opportunities

*No entries yet.*
