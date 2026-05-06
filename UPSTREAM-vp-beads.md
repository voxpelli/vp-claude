# UPSTREAM: vp-beads

Friction, feature requests, and contribution opportunities against the
[vp-beads](https://github.com/voxpelli/claude-beads) plugin's skills and
tooling, discovered while building vp-knowledge.

## Feature Requests

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
