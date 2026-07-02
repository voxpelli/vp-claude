# UPSTREAM: vp-beads

Friction, feature requests, and contribution opportunities against the
[vp-beads](https://github.com/voxpelli/claude-beads) plugin's skills and
tooling, discovered while building vp-knowledge.

## Feature Requests

- **synergy-registry: support local-only sibling entries (private sibling, zero committed footprint)** (2026-06-03) _(Resolved 2026-06-16 — vp-beads shipped private-add mode: a `.local.json` entry whose `file` is `PRIVATE-SYNERGY-<name>.md` is added as a private sibling; confirmed in the running sibling-sync v0.18.0 skill. Detailed entry retained below for design context.)_ —
  The `PRIVATE-SYNERGY-<project>.md` overlay (v0.17.0) makes a sibling's synergy
  _content_ private, but registry resolution still forces the sibling's
  _existence_ to be public: `.claude/synergy-registry.local.json` only
  **overrides** fields of an entry that already exists in the committed
  `synergy-registry.json`; an entry whose `name` is absent from the committed
  base is **ignored** (`sibling-sync/SKILL.md:106-107`;
  `synergy-entry-format.md:180` scopes `.local.json` to `local-path` only). So a
  fully-private sibling — e.g. `relationship: open-core-partner`, a proprietary
  partner whose existence shouldn't appear in a public OSS repo — cannot be
  registered without committing a base entry that names it and its relationship.
  PRIVATE-SYNERGY closed the _content_ half of the proprietary↔public boundary;
  this is the _registration_ half. Concrete change: let
  `.claude/synergy-registry.local.json` **add** local-only entries (not just
  override) — a local-only entry (name not in the committed base) registers a
  recognized, sibling-syncable sibling whose `name`, `file`, `bm-entity`, and
  `relationship` live in `.local.json`, with zero committed footprint; such
  entries are local-only by construction (never reciprocated or promoted — the
  same guarantee as PRIVATE-SYNERGY content). Affected: sibling-sync registry
  merge rule (resolution step 2), synergy-tracker workflow 1 step 1b (already
  writes `local-path` to `.local.json` — extend it to write the full entry there
  for private siblings), and `validate-plugin.mjs` registry validation (accept
  local-only entries).
  Ownership: upstream · Workaround: partial — either keep the sibling entirely
  outside the registry machinery (a hand-maintained `PRIVATE-SYNERGY-<name>.md`
  doc, no `/sibling-sync` automation), or accept the public committed entry (the
  relationship's existence becomes public, content stays private). Neither
  delivers private-registration plus automation. This is the exact tradeoff
  vp-claude faces for a proprietary open-core-partner sibling.

- _(Resolved 2026-06-02, vp-beads `upstream-tracker/SKILL.md:86` — the carve-out now reads "Sibling projects that ship upstream artifacts (skills, hooks, agents) can still receive upstream-tracker entries…")_ **upstream-tracker: clarify redirect rule for sibling projects with shipped skill code** (2026-05-04) —
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

- _(Resolved 2026-06-03, vp-beads v0.17.0 — ships the `/harden-memories` read-only audit skill under the exact proposed name; commits `e8734c3` + `5ad8394`)_ **/harden-memories: new skill to triage and prune persistent memories** (2026-05-05) —
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

- _(Resolved 2026-06-03, vp-beads v0.17.0 — shipped as the `PRIVATE-SYNERGY-<project>.md` overlay, a different design than the proposed `.local.md` suffix; the proprietary↔public boundary is now protected upstream. Whether vp-claude adopts the `PRIVATE-SYNERGY-` convention is tracked as a Divergence in `SYNERGY-vp-beads.md`.)_ **sibling-sync + synergy-tracker: `.local.md` SYNERGY variant for proprietary↔public boundaries** (2026-05-31) —
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

- **backlog-groomer: multi-agent swarm mode for large backlogs, plus an adversarial close-gate before presenting closure candidates** (2026-07-01) — `/vp-beads:backlog-groomer` (workflows 1 and 3) triages sequentially: one agent runs `bd list`/`bd stale`/`bd blocked`/`bd find-duplicates` and reads issues in turn. A 2026-07-01 vp-knowledge session hand-orchestrated a different shape over 173 non-closed beads — a Haiku swarm followed by an Opus refutation pass — and it surfaced things a single sequential agent plausibly wouldn't reach in one context window:
  1. **Wave 1 (breadth):** N cheap-model agents, round-robin partition (not contiguous slices — a priority-sorted `NR % N` split gives every agent a representative cross-section, so verdicts stay comparable across agents) over the non-closed issue set; each reads its slice via `bd show` and classifies NEXT/LATER/STALE/CLOSE?/BLOCKED.
  2. **Wave 2 (verify):** re-partition thematically (by epic/subsystem, cutting across wave-1's round-robin) and re-run, but this time each agent checks wave-1's guesses against ground truth — grep the repo, read the schema/config file, check `git log`/branch state — not just re-reading the bead. This is where the real value concentrated: it confirmed a feature branch was 18 commits ahead of main while its beads still showed 2/27 done, and caught an inverted-looking `bd` dependency read that (see point 3) turned out to itself need re-checking.
  3. **Adversarial close-gate before presenting to the user:** a single stronger-model agent (Opus vs. the swarm's Haiku) whose only job is to refute the close-list, re-reading each candidate's FULL acceptance criteria (not just the field the swarm's evidence cited) and re-running the swarm's own ground-truth checks independently. This caught 2 live false-closes (a bead whose upstream dependency shipped but whose own in-repo retirement edits were undone; a check that gates 1 of 5 claimed surfaces by design) and refuted 2 of the verify-wave's own "corrections" — including a `bd dep tree <epic-root-id>` run that returned flat/no-deps and got over-generalized to "this epic's blocking is all soft prose"; `bd dep tree` on the root alone is empty precisely because the root has no deps of its own, while its children (confirmed via `bd blocked`, which IS graph-wide and reported the real chains correctly) carried genuine wired dependencies. Workflow 2 step 3's phrasing ("If `bd dep tree` is available, use it to visualize blocking power") reads as a `bd blocked` substitute; worth clarifying in the skill that `bd dep tree <id>` on a container/epic id is not equivalent to `bd blocked` and can look deceptively clean.
  4. A final synthesis pass pooled cross-chunk duplicates (round-robin splits scatter an epic's children across every wave-1 chunk; only a whole-set pass catches "these 4 beads are the same shipped feature filed 4×") and reported the _real_ backlog size (this run: 173 nominal → ~35 actually live once stale/closeable/deferred-with-trigger are separated out) — a number workflow 1's per-issue table doesn't currently surface.
  Suggested shape for vp-beads: an opt-in "swarm mode" for workflow 1 on large backlogs (some threshold, e.g. >50 open issues), and — regardless of swarm vs. sequential — folding a second-opinion refutation step into workflow 3 (Suggest closures) before candidates are shown to the user, since a close is a mutation that silently strands tracked work if wrong (asymmetric cost vs. a false LATER/STALE call). Known constraint if a swarm mode is built: bursting many agent launches at once can trip a provider-side admission throttle distinct from rate limits — cap concurrent launches to a handful, not one-shot-all-N.
  Ownership: shared · Workaround: none — currently reproduced by hand-orchestrating agents per session; the existing skill's sequential single-agent workflows remain the checked-in default.

## Upstream Opportunities

_No entries yet._
