# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.33.1][] - 2026-07-21

### Added

- **Agent-leverage surface check for `brew:`/`cask:` `/intel`.** A new optional
  enrichment addendum documents *how a coding agent best invokes a tool* — an
  MCP-native path (only when the tool ships an MCP server, e.g. `serve --mcp` or
  a `<name>-mcp` companion binary) or a `--json`/machine-readable-CLI path usable
  by any bash-driven agent (Claude Code's own Bash tool, pi.dev, CI). It resolves
  the tool's actual binary first (a binary not found locally is a probe failure,
  never a false negative), keeps MCP negatives bounded (never an unqualified
  "best path"), and records **only** a genuine positive or a narrowly-scoped
  surprising negative — an ordinary text-only CLI gets no line at all. Casks are
  gated by a companion-binary (`artifacts.binary`) pre-filter so pure-GUI casks
  are skipped. Findings use a new **warn-only `[agent-leverage]` observation
  category** (deliberately not yet in the `brew_formula`/`brew_cask` schema —
  deferred to a future `/schema-evolve` pass per the `[installation]`/`[trust]`
  precedent) and cross-link to a new `Agent-Tool Leverage` Basic Memory hub note.
  Touches `enrichment-tool.md`, both note templates (a `### Agent-leverage
  observations` guideline + a category-table row), the skill-development rule,
  and the README source table. Kept as a "where-applicable" addendum, so the
  "six sources" headline is unchanged (no schema change, no source-count
  propagation).

## [0.33.0][] - 2026-07-18

This release does three things at once: it makes the plugin run on the **Pi
coding agent** (a single-root hybrid, with MCP tool calls working on Pi's default
shim), adds **triple-harness portability gates**, and **consolidates four skills
into two** (skill count **16 → 14** — one research lifecycle now serves both
packages and dev tools, and the two nudge skills become one mode-routed skill).
The skill merge is the breaking change; nothing else below removes a capability.

### ⚠️ Breaking

- **`/package-intel` and `/tool-intel` are removed — use `/intel`.** The two are
  merged into one **`/intel <prefix>:<name>`** skill (shared-core, two families).
  The prefixes are unchanged (`npm:`/`crate:`/`go:`/`composer:`/`pypi:`/`gem:` for
  the package family; `brew:`/`cask:`/`action:`/`docker:`/`vscode:`/`gh:`/`plugin:`/
  `skill:` for the tool family; no prefix still defaults to npm). A single call may
  now **mix families** (`/intel npm:fastify brew:ripgrep`) — a capability gain.
- **`/nudge-sync` and `/nudge-adoption` are removed — use `/nudge`.** Merged into a
  mode-routed **`/nudge`** skill: bare `/nudge` syncs the tip cache (was
  `/nudge-sync`); `/nudge check` runs the adoption scan (was `/nudge-adoption`).
- Any `settings.local.json` allowlist entries or muscle memory referencing the four
  old command names must be updated.

### Added

- **Pi single-root hybrid** — a root `package.json` `pi` key loads `./extensions`
  (the Pi extension factory) and the shared `./skills` tree; Claude's loader
  ignores `package.json`, so the two coexist with no build step. Adds the
  `extensions/` and `test/` directories, with `check:pi-load` (offline skill-tree
  plus factory smoke) and `check:test` wired into `npm run check`.
- **`docs/pi-setup.md`** — how to `pi install` the plugin + `pi-mcp-adapter`,
  configure `~/.pi/agent/mcp.json`, and the `directTools`/`toolPrefix` caveats.
- **`check:portability`** — a new `npm run check` gate (the pure classifier
  `lib/portability-scan.mjs` with `scripts/check-portability.mjs`) that classifies
  every `${CLAUDE_PLUGIN_ROOT}` reference in skill prose as same-skill (fixable
  portability debt — breaks under a standalone skills.sh install where the variable
  is undefined), cross-skill (an accepted sibling-skill dependency), or tooling.
  Warn-only live scan plus a hard classifier self-test. Orthogonal to
  `check:plugin-load-paths`: that gate asks "does this path resolve on disk"; this
  one asks "would this reference survive a standalone single-skill install".
- **`/intel`** — one research lifecycle (detect → check → resolve → enrich →
  synthesize → write → cross-link) routed by a provably-disjoint 14-prefix table,
  branching only at enrichment. Shared mechanics (note lookup/freshness, write
  mechanics, verify-before-capture, cross-linking, the upgrade-haul batch core, the
  forge/gh-api fallbacks) live in `skills/intel/references/`; the two families keep
  their distinct source rosters (package: seven sources incl. Context7 + Socket;
  tool: six sources incl. man-page, Homebrew analytics, Open VSX).
- **`/nudge`** — mode-routed (`disable-model-invocation`), with the transcript
  evidence-detection procedure and accepted-limitations extracted to references.
- **`check:spec`** — a new `npm run check` gate running `skill-check` (the
  agentskills.io SKILL.md linter, added as a devDependency) with a 1000-line body
  limit as errors (double skill-check's 500-line default, calibrated to the one
  skill — knowledge-gaps at 665 body lines — that exceeds 500); the ~42
  Claude-Code-vs-spec divergence findings stay non-gating warnings.

### Changed

- **MCP guidance is proxy-primary.** `pi-mcp-adapter` defaults to
  `directTools:false`, exposing every MCP tool ONLY through a single `mcp` proxy;
  the injected guidance now leads with
  `mcp({ server, tool, args: "<JSON string>" })` and keeps the flattened
  direct-name form as the `directTools:true` opt-in.
- **`/intel`'s description trimmed to fit the 1024-char Agent Skills
  (agentskills.io / skills.sh) spec limit** (the former `/tool-intel` at
  1127 → 929 characters) — all eight tool-prefix mappings and one strong trigger
  per tool type preserved; only redundant `'what does [X] do'` variants collapsed.
- The reconciled `gh-api-fallback.md` unions the two previously-drifted copies
  (restoring a citation the tool copy had dropped) and extends its applicability
  ladder to all 14 prefixes.
- All intra-skill reference cross-loads are now **bare-relative** rather than
  `${CLAUDE_PLUGIN_ROOT}`-prefixed, clearing the same-skill portability debt this
  plugin created and fixing two silent-broken relative paths. One accepted
  cross-skill exception remains: `intel`'s `upgrade-haul.md` and
  `ecosystem-plugin.md` still reference `knowledge-gaps`'s
  `staleness-detection.md` (a genuine sibling-skill dependency, not portability
  debt). The crates.io worker's `User-Agent` gains an RFC-3463 contact URL.
- Template alignment: `check:type-coverage` gains `--detail --strict --ignore-files
  'test/*'`; `tsconfig` restricts ambient types to `["node"]`.

### Fixed

- **MCP calls work on the default Pi config.** The `tool_result` quality checks
  (fourth-wall / schema\_validate / error classification) now fire on the `mcp`
  proxy path — where they were previously dead — across all three call shapes and
  the read-family tools.
- **The nudge skills get MCP guidance** — the nudge pair was wrongly excluded from
  the guidance set despite calling `mcp__basic-memory__read_note`.
- **`npm test` no longer overwrites `~/.pi/agent/agents/`** — the agent-sync target
  resolves at call time (a `VP_KNOWLEDGE_AGENTS_DIR` override) so tests isolate to a
  tmpdir. agent-sync also content-diffs before overwrite (`updated` now means a real
  change) and surfaces sync errors to stderr unconditionally, not only under a UI.
- **A transient config read no longer pins DEFAULTS** — the per-path config cache
  does not memoize a failed read.
- **`check:pi-load` fails on skill-name collisions** — a collision silently dropped
  a skill from the loaded set.
- **`/nudge check` guards against mis-derived search terms** — a tip whose first
  backtick span is not the feature's own term (e.g. `scratchpad` → `/tmp`,
  `subagents-background-default` → `background`) no longer drives a false adoption
  transition; the slug follows the ordinary no-evidence path instead.

### Removed

- `skills/package-intel/`, `skills/tool-intel/`, `skills/nudge-sync/`,
  `skills/nudge-adoption/` and their reference trees (content relocated, not lost).
- `docs/design/tool-intel-next-gen.md` retired in place (its premise — the two
  skills staying separate — no longer holds; kept with a revival trigger).

### Documentation

- **Accepted portability trade-offs ledger** in
  `docs/design/triple-harness-notes.md`: the verified relative-path resolution rule
  (a bare `references/...` path resolves against the active skill's own directory in
  both Claude Code and skills.sh) and the three reference buckets (same-skill
  fixable, cross-skill accepted, tooling degraded). Shared-reference headers explain
  why a cross-skill reference must keep the full plugin-relative path.

### Known limitations

- The new **bare-relative** intra-skill reference cross-loads are
  manually-verified-only, not machine-guarded. `nudge`'s references are markdown
  links already covered by `remark-validate-links`, but `intel`'s bare
  inline-code refs have no resolution check yet — a moved/renamed reference file
  would rot silently. Tracked as a follow-up (see
  `docs/design/wave3-skill-consolidation.md` Mandatory-fixes item 4).

## [0.32.5][] - 2026-07-10

### Fixed

- **brew/cask `@`-suffixed operands are no longer blindly de-qualified** —
  `references/upgrade-haul.md` Input parsing + both intel-skill adapters now
  carry a dual-key rule: an `@`-suffixed brew/cask operand can be a real token
  (`icu4c@78` is its own formula; `claude-code@latest` is a distinct cask
  channel), so the haul fetches BOTH the literal and stripped forms in the
  same stdin batch and prefers the literal hit. The Step-1 existence glob
  stays on the stripped base name so a channel cask folds into its base note
  (`cask-claude-code`) instead of forking a duplicate. (Dogfood 2026-07-10:
  the old strip silently fetched the lagging standard cask, 2.1.197, while
  the installed `@latest` channel was at 2.1.206.)
- **Registry-vs-upstream-tip arbitration documented** — new Stale-cache
  arbitration bullet: when upstream releases past the registry, the Axis-A
  slot records the REGISTRY version (what `--stale` compares); the tip goes
  in the Axis-B narrative with an "ahead of registry, not yet
  bottled/published" stamp. (Dogfood: llmfit formula 1.0.1 vs upstream v1.1.2
  same day.)

### Added

- **Batch full-listing rule** — for any upgrade-haul batch, the Step-1
  existence check now runs as one full `list_directory` per distinct
  ecosystem directory instead of per-name globs (O(dirs) vs O(2N) MCP calls;
  two listings resolved a 7-operand haul). Single-identifier calls keep the
  per-name glob.
- **Modernize-on-touch convention** — a haul touching a note that records its
  version only via a `| Version |` table row or prose (S2 Patterns 2/6) now
  also installs the Pattern-1 header pipe + Pattern-3 `[version]` observation
  in the same refresh (precedent: `brew-eza`), with a 40KB append-fallback
  caveat.

## [0.32.4][] - 2026-07-07

### Added

- **`tool-intel` library-formula handling** — a `brew:` formula can be a
  *library* consumed as a transitive dependency (e.g. `tree-sitter`, `icu4c`),
  not a leaf CLI tool. `references/ecosystem-brew.md` gains a self-contained
  `## Library formulae` branch (mirroring the third-party-tap branch):
  detection (a `caveats` library/CLI split, a `desc` ending in "library", no
  shipped binary, a low install-on-request ratio), real-dependent verification
  via `brew uses --installed` / `brew deps` / `brew linkage`, and a mandatory
  `## Upgrade Impact on Dependents` note section (statically-vendored consumers
  unaffected vs dynamically-linked consumers tracking the dylib soname).
  Generalized in the Basic Memory note "Homebrew Library Dependency Impact -
  Static Vendoring vs Dynamic Linking"; exemplars `brew-tree-sitter`,
  `brew-tree-sitter-cli`, `brew-icu4c@78`.
- **Relation-verb convention for brew notes (the root-cause guard)** —
  `references/note-template-brew.md` now documents that a dependency claim is
  load-bearing and must be verified against the package manager, never inferred
  from technology: `depends_on` only for a real Homebrew dependency (confirm
  with `brew deps` / `brew uses --installed`); `built_with` / `used_by` (both
  already declared `brew_formula` schema verbs) for a technology relationship
  where the consumer statically vendors the library. Prevents the class of
  wrong-dependent claim where a Rust/Go tool "built on" a C library gets
  mislabelled a formula dependent.
- **`install_on_request` in the `[popularity]` observation** — the
  formulae.brew.sh analytics already exposed `install_on_request`; it is now
  recorded (`… · R on-request/30d · …`) and its ratio to total installs drives a
  `[pattern]` library-vs-tool signal (near 1 = deliberately installed; far below
  1 = mostly a transitive dependency). Kept distinct from the per-host
  `Installed (on request)` line, which stays machine-specific and unrecorded.

## [0.32.3][] - 2026-07-04

### Added

- **`/knowledge-gaps --stale plugin`** — revives the deferred `vp-claude-5s83`
  epic now that its own revival trigger fired (22 documented `plugin-*`/
  `skill-*` notes, past the ~10 threshold). Claude Code plugins have no
  central registry, so `scripts/fetch-plugin-upstream.sh` resolves the
  current version by fetching `plugin.json` directly from GitHub via `gh
  api` — a marketplace-hosted identifier's path is resolved live via
  `marketplace.json` (never stored, mirroring `tool-intel`'s bare-name
  formula/cask auto-routing precedent). `lib/cohort-table-contract.mjs` +
  `check:cohort-lockstep` close a previously-unguarded drift risk between
  `staleness-detection.md`'s and `knowledge-gardener.md`'s cohort
  configuration tables. Verified end-to-end against the real graph.
- **Bespoke `.ast-grep/rules/` lint suite** (`@ast-grep/cli` devDependency):
  four JS rules enforcing existing house conventions (ESM-only, no
  identifier-shadowing, JSDoc `@typedef`/`@any` conventions — one with a
  surgical transform-based auto-fix), plus three new bash rules for the
  `fetch-<eco>-upstream.sh` script family (mandatory `set -euo pipefail`,
  injection-safe `jq` construction — filling a gap ShellCheck's own
  maintainers knowingly left open, and the documented
  "never touches `~/basic-memory/`" invariant). `check:ast-grep` (CI-annotated
  via `--format github`) and `check:ast-grep-test` wire into `npm run check`;
  `fix:ast-grep` is reachable via a new top-level `npm run fix`.
- **`remark-gfm` + `remark-lint-no-hidden-table-cell`** added so `check:md`
  can finally see markdown table structure — previously invisible to the
  lint pipeline entirely (plain `remark-parse` doesn't produce `table` nodes
  without the GFM extension). `remark-lint-table-cell-padding` is disabled
  (cosmetic noise, not correctness).

### Fixed

- **A real pre-existing bug in the 9-rule version-drift bucketing model**
  (`knowledge-gardener.md` Step 5b-iv, rules 2/2b): a `not-in-api` or
  `api-unavailable` note with a *parseable* recorded version fell through to
  the versions-differ rules, comparing against an empty `upstream_version`
  string and landing in a nonsensical `Drifted, age unknown` bucket instead
  of `Not in registry`/`API unavailable`. Cohort-agnostic — could have
  affected any past `--stale` run across brew/npm/cask/crate/vscode, not
  just the new plugin cohort that surfaced it.
- **`lib/installed-plugins.mjs`'s `ownerRepoFromUrl`** silently failed to
  resolve a `git-subdir` marketplace source whose `url` is a bare
  `owner/repo` shorthand with no domain (a verified real-world shape) —
  affects `/knowledge-gaps --global` plugin coverage.
- Two unescaped-bracket / bare-URL markdown findings caught by this
  session's own new lint additions (`\[degraded\]` escaping in the new
  `UPSTREAM-brew--sem-cli.md`; two `[upstream: ...]` bare URLs in
  `UPSTREAM-claude-code.md` reformatted to this repo's established link
  convention).

## [0.32.2][] - 2026-07-03

### Added

- **`tsc`/`type-coverage` are now real CI gates** (`check:tsc`, `check:type-coverage`
  at 99%), adopted from a stalled branch's infra-only commits — the branch's
  own `deep-intel` skill work stays deferred. `tsconfig.json` extends
  `@voxpelli/tsconfig/node22.json`; no `.ts` files, JSDoc types checked
  in-place. Closed 33 real pre-existing type errors this surfaced, all via
  honest narrowing (guards, early returns) — never `!`/`as`/`@ts-ignore`
  suppressions.
- **`knowledge-gardener` gains four new audit steps**: observation category
  hygiene (`[raindrop]`/`[readwise]` miscategorization, stale inventory-state
  `[gap]`s); a session-refresh version/maintainer contradiction audit (the
  one mechanically-checkable sliver of "verify-before-capture"); a
  `Verified:`/`Since:`/`Ownership:` trailer age cross-check; and a live
  schema-vocab comparison against the graph's actual relation-verb usage.
  All read-only, all narrowly scoped, none wired into CI (they need the live
  graph).
- **`fetch-cask-upstream.sh` gains opportunistic Tier-2 bump-date
  enrichment**, mirroring brew's Tier 2 — matches the leading comma-segment
  of a cask's version against `Homebrew/homebrew-cask` commit history so
  `--stale cask` can resolve `days_stale` instead of always landing in
  "age unknown." Font-token 3-level path shard handled; degrades cleanly
  for pre-sharding/pre-fonts-migration casks, renamed tokens, or no `gh`.
- **New drift guards**: `check:analytics-guidance` (guards against a
  regression class this project already hit once — brew/cask docs claiming
  the JSON API lacks analytics data when it doesn't); `check:schema-vocab`
  (malformed relation-verb variants vs. the 23 schemas' picoschema);
  `check:obs-metadata` (a new optional `Verified:`/`Since:`/`Ownership:`
  observation-trailer format, Phase A parser only — no schema changes yet).
- **`validate-plugin.mjs`'s bare-built-in-tool-name audit hardened**: the
  `subagent_type=` phantom-agent scan now uses the same mdast-based
  fenced-block exclusion as the `mcp__*` audit (the repo's only two real
  delegation call-sites were un-fenced to keep this check meaningful — see
  Fixed); a structural fence-balance detector (`findUnclosedFence`) replaces
  a heuristic that only caught a fence opening before all prose, missing the
  realistic prose-then-unclosed-fence case.
- **`.gitattributes`** forces `text` handling for source files — defense in
  depth against git's binary-content heuristic misfiring again (see Fixed).

### Changed

- **`lib/mdast.mjs`'s three hand-rolled AST walkers now share
  `unist-util-visit`**, eliminating manual `'children' in node` narrowing.
- **`validate-plugin.mjs` and `lib/installed-plugins.mjs` adopt
  `@voxpelli/typed-utils`** for untrusted-input narrowing, replacing
  hand-rolled `Record<string, unknown>` casts and `typeof` ladders.
- **The two upgrade-haul adapter sections realigned** (`package-intel` and
  `tool-intel` now share an identical `## Batch mode: upgrade haul` heading
  and placement) and the Axis-B `[version]` narrative-reel is now documented
  as intentionally distinct from the canonical `[version]` slot, not a
  pending decision.
- **`ecosystem-brew.md`/`ecosystem-cask.md`'s JSON-API fetch instructions
  now use `curl|jq`** instead of `tavily_extract`, matching this repo's own
  fetch scripts (cheaper, shape-exact, no MCP hop). The other ~10 ecosystem
  reference files are a tracked follow-up, not silently dropped.
- **The `check()` fixture-test harness duplicated across all 12
  `scripts/check-*.mjs` files is now one shared `lib/check-harness.mjs`**
  (net -123 lines; pure refactor, identical pass/fail results throughout).

### Fixed

- **A raw NUL byte, silently committed to `lib/installed-plugins.mjs` since
  its first commit a month ago, made git treat the file as binary** —
  invisible to every existing check, caught only because it broke a
  cherry-pick's 3-way merge. Replaced with the equivalent `\0` escape
  sequence (same runtime value).
- **The new cask Tier-2 enrichment initially matched commit headlines via a
  bare substring test**, which could silently attribute a later, unrelated
  commit's date when one cask version was a substring of another (e.g.
  `4.8.0` inside `4.8.0.1`) — understating staleness, the failure direction
  that hides real drift. Two independent gate reviewers converged on this
  from different angles; fixed with a boundary-anchored match before this
  release shipped.
- **A 9-agent pre-release review fleet** (3 `plugin-validator` + 6
  `skill-reviewer`, mixed adversarial/naive/normal postures) found several
  real, pre-existing bugs verified against actual code/script behavior:
  `knowledge-maintainer.md`'s Rule 3 instructed an `Edit` the agent has no
  tool to perform (now delegates to `/schema-evolve`); a 7-file doc
  inversion describing npm's version-slot read order backwards (the code
  proves `9q7e` shipped npm-only, but package-intel/tool-intel/
  upgrade-haul.md/3 schemas still said the header pipe was authoritative);
  `knowledge-prime`'s `build_context` template hardcoded to `npm/`
  regardless of actual project ecosystem; a stop-vs-continue contradiction
  in `tag-sync`; a factually wrong `days_stale_source` claim and an
  under-specified distance-classification row in `staleness-detection.md`;
  missing `plugin:`/`skill:`/`git:` prefixes in two skills' dispatch maps.

## [0.32.1][] - 2026-07-03

### Changed

- **The fourth-wall detector registry now has a runtime consumer.**
  `lib/fourth-wall-rules.mjs` previously ran only inside the CI fixture test
  (`check:fourthwall`) — the knowledge-gardener agent is markdown and can't
  import it, so the deterministic `detect` patterns never touched a real
  write. The PostToolUse write hook now runs a new `hooks/fourth-wall-check.mjs`
  entrypoint against every `write_note`/`edit_note` call and folds any hits
  into the existing `additionalContext` JSON object (never a second object;
  schema-permalink notes stay exempt). Always degrades to zero violations on
  empty/malformed input and never blocks a write.

### Added

- **`check:release-counts` now also gates README.md's hooks-count sentence
  and a previously-unwired `<!-- schema-count: N -->` comment in CLAUDE.md**,
  beyond its original CLAUDE.md-only Skills/Agents/Hooks headings check.
- **Canonical `[version]` observation slot extended to the 5 remaining
  package cohorts** — crate, go, composer, pypi, gem now carry the same
  machine-stable version slot npm gained in 0.31.4 (schema field,
  note-template seed line, `/package-intel` Step 4 emit rule). Existing
  notes are not bulk-backfilled — they acquire the slot organically on next
  refresh, matching the doctrine already adopted for the tool-cohort
  equivalent (`80r4`).
- **`/knowledge-gaps --stale` now reads the `[version]` observation ahead of
  the inline header pipe for npm notes specifically** — the misparse-shield
  for version-string packages (`yaml`, `semver`) originally promised in
  0.31.4 now actually fires. Scoped to npm only; every other cohort
  (including the 5 package cohorts above) still reads the header pipe first.
- **Honest-uncertainty conventions extended in package/tool/people-intel**:
  a single-source claim now gets hedged even absent contradiction, and a
  genuinely unresolved contradiction (neither source clearly more
  authoritative) is recorded as still-open within the existing
  `[gotcha]`/`[controversy]` categories rather than forced to pick a side.

### Fixed

- **`js-yaml` bumped to 4.3.0**, clearing a moderate Dependabot alert
  (GHSA-h67p-54hq-rp68, quadratic-complexity DoS in merge-key alias
  expansion) — dev-only dependency, never reachable at plugin runtime.
  `npm-run-all2` also bumped 7→9.
- **Two schema files had never been byte-audited against their Basic Memory
  counterparts** (`claude_plugin`, `git_builtin` — both added after the last
  audit): fixed whitespace-wrap drift in the `schema:` picoschema block,
  the same class of drift the prior audit fixed elsewhere. Purely
  cosmetic — verified via direct YAML parse that every folded value is
  byte-for-byte unchanged.

### Docs

- **4 agent frontmatter descriptions migrated off escaped `<example>` XML to
  prose triggers** (`knowledge-gardener`, `knowledge-maintainer`,
  `knowledge-primer`, `raindrop-gardener`), matching the convention already
  used by sibling-plugin agents. Read-only-vs-write-capable routing
  contrast preserved and made explicit in each rewritten description.

## [0.32.0][] - 2026-07-02

### Changed

- **`knowledge-maintainer` Section 3b redefined as a refresh queue, not an
  actor.** Field-testing found the prior "auto-batch up to 5 `/tool-intel`
  refreshes for `Drifted >30d`" behavior executed as minimal
  single-observation version bumps in unattended/background mode instead of
  full source-enrichment refreshes — concrete signal loss: a
  `cosign 3.0.5 → 3.0.6` bump looked routine but actually patched three 2026
  CVEs, caught only by a later manual `/tool-intel` run. Section 3b now
  never performs a refresh itself and never spawns recursive `/tool-intel`
  subagents from an unattended background agent; instead it emits a
  structured Refresh Queue for the human-supervised session to action —
  Routine lane ordered by `[semver-major]` > `[semver-minor-multi]` >
  `[patch]`, with any target carrying a prior `[security]` observation
  always routed to a separate HIGH PRIORITY / IMMEDIATE ACTION lane so a
  security-relevant drift can't go unnoticed. **This is a behavior change
  users relying on the old auto-refresh will notice** — the primary reason
  for this release's minor bump.

### Added

- **`tool-intel`/`package-intel` upgrade-haul: Axis-B changelog target now
  resolves to a linked timeline note when one exists**, instead of always
  writing inline — e.g. `cask-claude-code`'s changelog reel now correctly
  routes to `Claude Code Release History` rather than duplicating it inline.
  Disambiguates by title pattern against a note's `see_also`/`documented_in`
  relations, correctly skipping unrelated linked notes (e.g. a security-hub
  note) on the same subject.
- **`/knowledge-gaps --stale` gains `--limit N` / `--since <date>` /
  `--sample N` scope modifiers** for narrowing a large cohort (e.g. a
  388-note `npm` directory) before the expensive per-note read/fetch work
  runs, plus a documented parallel-subagent strategy for processing a cohort
  too large for one turn.
- **`check:plugin-load-paths`** — new drift guard asserting every
  `${CLAUDE_PLUGIN_ROOT}/...` path referenced in skill prose actually
  resolves on disk, catching a moved/renamed shared reference file that
  neither `remark-validate-links` nor `validate-plugin.mjs` cover.
- **`knowledge-gardener` surfaces silent schema drift** —
  `unmatched_observations`/`unmatched_relations` from `schema_validate` now
  appear as a "Silent drift" report subsection instead of being absorbed
  without comment.
- **`package-intel`/`tool-intel` batch trigger phrases added to
  `description`** so a keyword-less pasted `npm outdated` or
  `brew upgrade foo bar` line auto-routes to the right skill (the router
  only reads `description`, not skill body content).
- **Machine-stable `[version]` observation slot extended to brew/cask/vscode
  tool cohorts** (previously npm-only), hardening `--stale`'s drift
  detection against the same fragile prose/table extraction that
  misparsed version-centric packages before.
- **`package-intel`/`people-intel` reconcile bare-name `[[Name]]` stubs**
  after writing a descriptor-titled note — existing notes elsewhere that
  reference the new note via a bare wiki-link (which doesn't auto-resolve)
  now get rewritten to the full title.
- **`tool-intel` dispatches third-party Homebrew taps**
  (`brew:<owner>/<tap>/<formula>`) to a dedicated fetch path — Ruby-DSL
  formula parsing, upstream-repo DeepWiki pivot, license cross-check, and a
  `.github/workflows` SLSA/SHA-256 hygiene audit — instead of silently
  misrouting to the core registry.
- **`lib/bm-version-extract.mjs`** — the previously prose-duplicated
  6-pattern version-extraction logic (mirrored by hand across
  `staleness-detection.md` and `knowledge-gardener.md`) is now a real,
  44-fixture-tested library both docs point at as canonical.

### Fixed

- **`package-intel`/`tool-intel` Step 5 overwrite dropped relations and left
  a stale permalink** when relocating a note whose stub existed at a
  different directory/title (e.g. an old `indieweb/history/` stub for a
  now-documented npm package). A later live dry-run against the real Basic
  Memory instance found the original fix's premise was itself wrong —
  `write_note(overwrite=True)` targeting a new directory doesn't relocate
  the old note, it creates a genuine duplicate — corrected to add an
  explicit cleanup step for the orphaned stub.
- **`fetch-brew-upstream.sh` under-reported drift for tag-only formulae**
  (tagged releases with no GitHub Release) — added a git-tag date fallback
  with a new `days_stale_source` provenance field.
- **`recent_activity` `has_more`-based pagination instructions were
  unsatisfiable** (the tool has no `has_more` field; returns a flat
  `result` array) — fixed across 4 locations found this sprint
  (`staleness-detection.md`, `knowledge-gardener.md`, `knowledge-prime.md`,
  `knowledge-maintainer.md`).
- **`lib/bm-version-extract.mjs` Pattern 1 recognized only a `Homepage:`
  header label**, silently unparseable for 5 of 6 real ecosystem
  conventions (`GitHub:` for npm/crate/go/composer/pypi/gem, `Publisher:`
  for vscode, `Runs:` for action, `Source:` for gh, `Homepage / repo:` for
  plugin/skill) — found by an adversarial full-branch review after initial
  release. Fixed to a closed 6-label alternation; also made all 6 patterns
  fence-aware, since none previously skipped fenced code blocks (a
  version-looking string inside a documentation example was wrongly
  extracted as real data). Verified against real notes pulled from the live
  graph: extraction accuracy improves with zero regressions.
- **Relation-search mechanism documentation was inaccurate** for the
  bare-name-stub-reconciliation pattern — corrected twice: first from
  "relation titles index both source and target" (only true for resolved
  relations) to a permalink-based explanation, then refined again after
  verification against Basic Memory's actual source showed it's the default
  hybrid/semantic search doing the work, not full-text search (an explicit
  `search_type="text"` would not find the match).
- Small documentation accuracy pass: a stale "Auto-fix" row in the README
  autonomy table describing the now-removed Section 3b auto-behavior, a
  missing drift-guard entry, stale "batch ordering" phrasing, and a
  mis-pointed cross-reference in the relocated-stub step.

### Docs

- Tracked the Context7 MCP server's `resolve-library-id` parameter-schema
  bug (`UPSTREAM-mcp--context7.md`) — no valid invocation exists; already
  handled gracefully by both intel skills' existing fallback branches.

## [0.31.12][] - 2026-07-01

### Changed

- **Renamed `feature-nudge` to `nudge-adoption`.** The old name read as an
  imperative ("nudge about a feature") rather than what the skill does
  (scan history, detect adoption evidence, update status), and paired
  poorly with the sibling `/nudge-sync` skill it's meant to close the loop
  with. Pure rename — directory, frontmatter `name`, human-readable
  display text, and every cross-reference across the plugin's docs updated
  consistently; no behavior changed. `CHANGELOG.md`'s own historical
  entries for `0.31.7`–`0.31.11` still say `/feature-nudge`, since they
  describe what actually shipped at the time.

## [0.31.11][] - 2026-07-01

### Fixed

- **`/feature-nudge`'s 0.31.10 slash-command evidence check was itself
  broken — unsatisfiable against real dispatch data.** Running the
  released 0.31.10 fix for real found 0 of 15 catalog features showed
  confirmed evidence, even though several (`/goal`, `/fork`, `/advisor`,
  `/fewer-permission-prompts`) are demonstrably in heavy real use. Root
  cause, confirmed against 600 real dispatch samples across every project
  on the machine: the check required a `<command-name>` tag match **and**
  `promptSource:"typed"` **and** `origin.kind:"human"` together, but a
  genuine dispatch entry's `message` object is *always* exactly
  `{role, content}` — those two extra fields never exist on a real
  dispatch, only on ordinary typed prose. Requiring them made the check
  impossible to satisfy for any real usage. Fixed by replacing the
  field-based check with a structural one: the entry must be `type:"user"`
  with string (not array) content starting with the tag and none of the
  `tool_result` marker fields, **or** `type:"system"`/`subtype:"local_command"`
  with content sitting directly on the entry (Claude Code emits built-in
  local commands — confirmed for `/fork`, `/exit`, `/mcp`, `/doctor`,
  `/plugin`, `/model`, and others — in this second shape, not the first).
  Verified in both directions: real dispatches for `/goal`, `/advisor`,
  `/fewer-permission-prompts`, and `/fork` are now correctly detected, and
  the two self-contamination cases already found this session (an
  assistant tool-call's own arguments; a tool-result forwarding them) are
  still correctly excluded.

## [0.31.10][] - 2026-07-01

### Fixed

- **`/feature-nudge`'s tag-based dispatch check (0.31.9) still couldn't rule
  out a human quoting/pasting the tag text, and had no self-verifying check
  on its own format assumption.** A second review pass — rerunning the same
  reviewers against the 0.31.9 fix — found the "`type:"user"` + tag match
  is sufficient" rule was itself an overclaim: `type:"user"` is not
  synonymous with "a human typed this," and this reproduced live in the
  review session itself (task-notification and tool-result content quoting
  the tag showed up as `type:"user"` matches). Fixed by requiring the tag
  match **and** the `promptSource:"typed"` + `origin.kind=="human"` fields
  together, rather than either alone — confirmed via dogfooding that this
  correctly rejects every self-referential variant found, including a new
  one (a `type:"user"` tool-result forwarding an assistant's own tool-call
  arguments back). Also added a standing sanity check for the `<command-name>`
  tag format itself (mirroring the existing transcript-format check, so a
  wrong format assumption can't silently masquerade as universal
  non-adoption), fixed a self-contradiction where the worked example showed
  `opusplan` (a model-picker choice explicitly documented elsewhere as
  undetectable) as confidently "adopted," added a "scan failed" path and
  preview section for slugs where every matched file fails to read, and
  restructured Edge Cases into "Error handling" vs "Accepted limitations"
  to fix duplicated reasoning and clarify which evidence check applies to
  which branch.

## [0.31.9][] - 2026-07-01

### Fixed

- **`/feature-nudge` couldn't tell a human typing a slash command from a
  human merely mentioning it in prose.** An adversarial review of the
  0.31.8 fix (rerun after that fix landed) found the shape-check's
  `promptSource:"typed"` + `origin.kind=="human"` criteria — while
  correctly excluding synthetic/replayed content — never distinguished
  genuine invocation from discussion; both satisfy every stated field.
  Confirmed empirically that this could flip a never-used feature to a
  false `adopted`, permanently suppressing its nudge. Fixed for
  slash-command-style features by searching directly for Claude Code's own
  `<command-name>...</command-name>` dispatch tag (confirmed: wraps every
  genuine dispatch, built-in or plugin-namespaced; never appears around a
  free-text mention), which also closes a self-contamination risk the
  "Tool use" evidence path had (the search's own tool-call arguments could
  otherwise match a future re-scan of the same session). Also restored an
  edge case this same fix's own rewrite had dropped (an unreadable matched
  transcript file no longer silently counts as "no evidence"), made the
  whole-word-match check symmetric (both boundaries, not just one), and
  documented that a handful of features (settings.json fields, environment
  variables) can never be detected via transcript scanning at all —
  invoked or not.

## [0.31.8][] - 2026-07-01

### Fixed

- **`/feature-nudge` Step 2 could silently miss the most-recently-used
  feature.** The evidence-gathering step used `Glob` to build a
  most-recently-modified-first working set of ~50 transcript files, then
  searched only within it. Claude Code's `Glob` caps its returned file list,
  and that cap is a traversal-order truncation rather than a true
  mtime-sorted slice — so a live dogfood run found the actively-running
  session's own transcript completely absent from the computed "top 50."
  Fixed by searching by content directly instead of pre-filtering by
  recency: each feature's evidence search now derives a real search term
  from its tip's own backtick-quoted invocation syntax (not the normalized
  slug, which nobody types), greps for it across every project's
  transcripts with no file-count pre-filter, and requires a whole-word
  match to close a false-positive class found in the same dogfood run (a
  bare `advisor` search matching "security advisor**ies**" prose). A
  distinct fresh-install case (`~/.claude/projects` not existing yet) is
  now handled separately from a genuine tool/path failure.

## [0.31.7][] - 2026-07-01

### Added

- **Claude Code learning-nudge system.** A new Basic Memory reference note,
  `Claude Code Noteworthy Features` (`main/reference/claude-code-noteworthy-features`),
  tracks powerful-but-easy-to-miss Claude Code features via `[nudge]`
  observations (subject-first tip + normalized `Feature: <slug>` token) and a
  per-feature `adoption-<slug>` frontmatter status (`unseen`/`nudged`/`adopted`/
  `declined`) — seeded with 15 features. Two new skills operate on it:
  **`/nudge-sync`** (modeled on `/tag-sync`'s vendor-sync pattern) fetches the
  note via MCP, filters out anything already `adopted`, and writes the
  eligible tips to `~/.claude/references/claude-code-nudge-tips.txt`,
  reading BM via fast MCP rather than the slow `bm` CLI. The SessionStart
  hook that later surfaces the tip reads only that cache file, never BM.
  **`/feature-nudge`** (modeled on `/session-reflect`'s scan →
  preview → approve → write shape) scans recent session transcripts across
  all projects for real evidence of feature use, previews proposed
  adoption-status transitions, and writes approved changes to the note's
  frontmatter, regenerating the tip cache to close the loop. A new hook
  script, `hooks/tip-fragment.sh` (invoked from `session-start.sh`, not
  inlined), surfaces one tip per day — throttled, no repeats via a merged
  ring-buffer/throttle state file, degrading to empty output on any failure,
  behind a `VP_KNOWLEDGE_DISABLE_NUDGE=1` kill-switch.

## [0.31.6][] - 2026-06-25

### Added

- **Batch mode ("upgrade haul") for `/package-intel` and `/tool-intel`.** Both
  intel skills gain an additive batch-detection hook: instead of a single
  prefixed identifier, you can hand them a list of bare/prefixed names **or** a
  pasted upgrade/outdated command line (`brew upgrade a b c`, `npm outdated`,
  `npm i a@latest b@latest`) and they refresh every already-documented note
  against its recorded→current version delta in one pass. The
  ecosystem-agnostic core lives in a new shared reference,
  `skills/package-intel/references/upgrade-haul.md` (input parsing /
  de-qualification, curated highlights-reel synthesis across the delta, the two
  recording axes — Axis A the inline header pipe `| v<version> |` that `--stale`
  reads first (S2 Pattern 1; npm also moves its `[version]` observation) + Axis B
  prose reel — stale-cache arbitration favouring the authoritative registry/API
  read, a batch-outcome contract (per-item refreshed/failed/unverified
  reporting + Axis-A edit verification), and
  batch orchestration with file-disjoint per-note writes + a single central
  cross-link pass). Each skill supplies a per-skill adapter section
  (`package-intel`: **Batch mode: upgrade haul**, Axis-B target
  `## Release Highlights`; `tool-intel`: **Batch detection: upgrade haul**, with
  bare-name formula-vs-cask auto-routing via the artifacts-vs-`Dependencies`
  shape signal, a `fetch-brew-upstream.sh` → `fetch-cask-upstream.sh`
  re-dispatch on a `not-in-api` signal, and inline `[feature]` / `[version]`
  observations as the Axis-B target).
- **`/knowledge-gaps --stale` S7 is now the bidirectional partner.** The
  *Offer batched refresh* step in `references/staleness-detection.md` now points
  the accepted batch at the two executor adapter sections and the shared
  `upgrade-haul.md` core, completing the detector↔executor cross-reference: the
  `--stale` detector finds drift, the upgrade haul closes it against the same
  Axis-A slot S2 reads first (the inline header pipe, Pattern 1). The S7 handoff
  hands each skill its whole sublist in one multi-identifier call (the shape that
  triggers the batch path).

This is purely additive — the single prefixed-identifier path
(`/package-intel npm:fastify`, `/tool-intel brew:ripgrep`) is unchanged.

## [0.31.5][] - 2026-06-11

### Fixed

- **Homebrew analytics source guidance was inverted.** `/tool-intel`'s
  `brew`/`cask` ecosystem references, both note templates, and the
  `brew_formula` + `brew_cask` schemas all claimed *"the formulae.brew.sh JSON
  API does not expose analytics"* and instructed omitting the `[popularity]`
  observation whenever the Homebrew MCP was unavailable — but the JSON response
  already fetched in Step 2 **does** carry an `analytics` block
  (`install.{30d,90d,365d}`, `install_on_request`, and a formula-only
  `build_error.30d`; verified against `sem-cli`, `ripgrep`, and the
  `claude-code` cask). The guidance now treats that JSON block as a structured
  fallback — `[popularity]` is omitted only when *neither* source yields counts
  — notes that the MCP and the API draw on the same Homebrew dataset but can
  diverge via client-cache lag, and requires the observation to stamp which
  source it used: `(Homebrew MCP, YYYY-MM)` or `(formulae.brew.sh API,
  YYYY-MM-DD)`. The two schema changes are dual-synced to the Basic Memory
  `brew_formula`/`brew_cask` notes.

## [0.31.4][] - 2026-06-09

### Added

- **Machine-stable `[version]` observation slot for npm notes.** The
  `npm_package` schema gains an optional `[version]` observation (dual-synced to
  `schemas/npm_package.md` and the Basic Memory schema note) — the canonical slot
  `/knowledge-gaps --stale npm` reads first (Pattern 3), ahead of the fragile
  header/prose extraction that could misparse version-centric packages (the
  `yaml` note's `1.1` spec reference and the `semver` note's range example were
  both false positives caught while dogfooding). `/package-intel` now emits
  `[version]` for new and refreshed npm notes (template + Step 4 write rule), and
  71 existing npm notes were backfilled with their verified recorded version
  (header-line-verified; `semver` dropped as unparseable, `yaml` corrected to
  `2.7.0`). npm-cohort slice of bd `vp-claude-f3zx`; the other five package
  cohorts (crate/go/composer/pypi/gem) gain the slot in follow-up work.

## [0.31.3][] - 2026-06-09

### Fixed

- **Plugin namesake-collapse for `/knowledge-gaps --global`.** A single-plugin
  self-hosted marketplace whose repo name equals the plugin name (e.g.
  `pbakaus/impeccable`) now resolves to the collapsed identifier
  `plugin:pbakaus/impeccable` (title `plugin-pbakaus-impeccable`), matching its
  Basic Memory note by primary title instead of relying only on the bare-name
  fallback. The collapse is scoped to the local-string source branch; git-subdir
  sources always keep their `#<name>` suffix, so a namesake member of a
  multi-plugin repo can never collide with a sibling or a dedicated-repo homonym
  (`lib/installed-plugins.mjs`).
- **`/tool-intel` builds `plugin:`/`skill:` titles literally.** The skill no
  longer applies a namesake-collapse of its own (it cannot know the install's
  source branch, so a branch-blind collapse would diverge from a git-subdir
  namesake's resolver title). The `--global` offer hands over the canonical
  identifier, and Step 1's existence check globs the leaf segment to avoid
  forking a duplicate note on a manually-typed redundant suffix.
- **Tighter local-string shape guard.** A marketplace `source.repo` must match
  `owner/repo` exactly (`/^[^/\s]+\/[^/\s]+$/`); malformed values carrying a
  stray slash or whitespace fall through to `sourceResolved:false` rather than
  emitting a structurally-wrong identifier marked resolved.
- Documented edges (deliberately not fixed): a *multi-plugin* local-string
  marketplace with a member named after its repo also collapses (bd
  `vp-claude-asmm`; gating on plugin-count was rejected as fragile to upstream
  marketplace growth), and `toTitle` aliases distinct identifiers that share a
  delimiter-normalized form (bd `vp-claude-xqqe`).

## [0.31.2][] - 2026-06-03

### Added

- **Research-quality: verify-before-capture step.** `package-intel` / `tool-intel`
  / `people-intel` gained a mandatory (not CI-enforced) verify-before-capture +
  contradiction-record + hedging step, applied when Step 1 does not fast-path the
  note (missing, 60+ days old, or security-sensitive); `session-reflect` gained a
  mechanism/attribution verification scan. Addresses a proprietary open-core-partner sibling's feature request.
- **Fourth-wall rule registry + `check:fourthwall`.** The `vp-note-quality` checklist
  is now an ID'd registry (`lib/fourth-wall-rules.mjs`) with a per-rule
  deterministic/judgment flag; `check:fourthwall` fixture-tests every deterministic
  pattern, the checklist id-coverage, and the Detection-column parity. New
  `fw-session-boundary` rule.
- **`plugin:` and `skill:` prefixes for `/tool-intel`** + a new `claude_plugin`
  schema. Researches Claude Code plugins (marketplace.json + plugin.json + git tags)
  and skills.sh skill bundles (SKILL.md + tree + install counts) into `claude_plugin`
  notes carrying a 4-state publisher trust ladder.
- **`/knowledge-gaps --global`** audits host-installed Claude Code plugins +
  skills.sh bundles (reads `~/.claude/plugins/` + `~/.agents/.skill-lock.json` via
  `lib/installed-plugins.mjs` and the `scripts/list-installed-plugins.mjs` CLI)
  against `claude_plugin` coverage, surfacing undocumented installs as gaps.
- **Post-compaction recovery via SessionStart.** The SessionStart hook now
  re-injects a condensed graph-recovery block on `source=compact` — the only hook
  slot that injects `additionalContext` into the resumed, tool-capable agent
  (`PreCompact`/`PostCompact` are observability-only and cannot inject).
- **`controversy` observation category** added to the `person` schema.
- **New drift guards:** `check:release-counts` (CLAUDE.md component counts vs disk),
  `check:mdast` (the mdast prose/fenced split powering `auditToolReferences`), and
  `check:installed-plugins` (the host-installed plugin/skill resolver self-test).

### Changed

- `auditToolReferences` now walks an mdast AST (`lib/mdast.mjs`) instead of regex
  fence-masking — robust at any fence depth (tilde, 4-backtick nesting). Adds
  `unified` + `remark-parse` devDeps.
- `validate-plugin.mjs` gained `marketplace.json` shape validation.
- `knowledge-gaps` report templates extracted to a reference; navigational reference
  files gained Contents TOCs; `session-bookmarks` and `session-reflect` trigger
  descriptions disambiguated.
- Adopted vp-beads's remark lint config (pinned `settings`, `remark-validate-links`,
  and `remark-lint-unordered-list-marker-style`), so `remark -o` autofix behaves
  identically across the vp-plugins marketplace.
- `validate-plugin.mjs` gained a `VALID_HOOK_EVENTS` allowlist + a `description`-length
  warning; the `knowledge-gaps` description was trimmed; the fourth-wall registry is
  frozen with `@satisfies`/`@type {const}`, and redundant `{object}` annotations were
  dropped from property-bearing `@typedef`s.

## [0.31.1][] - 2026-05-29

### Added

- **Open VSX trust signal for VSCode extensions.** `/tool-intel vscode:<id>` now
  records a 4-state Open VSX trust observation (`verified-restricted` /
  `public-namespace` / `marketplace-only=squattable` / `not-published-anywhere`)
  as a `[security]` observation and links the note to the
  `Publisher Verification Gradient` hub. The sharp case: an extension present on
  the VS Marketplace but **absent from Open VSX** has an unclaimed, *squattable*
  namespace — fork-IDEs (Cursor, Windsurf, VSCodium, Theia) resolve installs
  against Open VSX, so an attacker who registers the namespace ships malware to
  those users (motivated by SecureAnnex "These Vibes Are Off", the GlassWorm
  worm, and fork-IDE recommended-extension attacks). Documented in `tool-intel`'s
  `references/ecosystem-vscode.md` "Open VSX Trust Signal".
- **`scripts/fetch-vscode-upstream.sh`** emits three additive NDJSON fields —
  `openvsx_namespace_access` (`restricted`/`public`/`""`), `openvsx_verified`
  (bool), `openvsx_publisher` — so `/knowledge-gaps --stale vscode` and the
  `knowledge-gardener` can flag the squattable case.
- **`vscode_extension` schema** gains a `security` observation category
  (dual-synced to the Basic Memory schema note).

### Changed

- **`/knowledge-gaps --stale vscode` and the `knowledge-gardener` no longer treat
  every "Not in registry" vscode note as benign.** A `not-in-api` result with a
  non-empty `marketplace_version` is annotated as a ⚠ squattable-namespace
  security exposure (fork-IDE risk); an empty `marketplace_version` remains the
  benign not-published-anywhere case. Bucket strings unchanged (an annotation,
  not a new bucket) — the emit↔consume contract is untouched.

## [0.31.0][] - 2026-05-29

### Changed

- **BREAKING (bucket rename): `--stale` version-drift detection extended from
  Homebrew-only to five ecosystems — brew, npm, cask, crate, and vscode.** The
  `/knowledge-gaps --stale` flag now takes an optional ecosystem token
  (`--stale [brew|npm|cask|crate|vscode]`; bare = all). The user-facing bucket
  `Tap-only` is renamed **`Not in registry`** (now covers tap-distributed brew
  formulae, unpublished/renamed packages, and Marketplace-only VSCode
  extensions), and the report section heading `Brew Version Drift` /
  `Brew Note Staleness` is renamed **`Version Drift — <eco>`** (one section per
  cohort). These are the canonical strings the `knowledge-gardener` emits and
  the `knowledge-maintainer` Section 3b consumes, so the rename is a breaking
  change under semver-0.x → minor bump.

### Added

- **Four self-contained fetch scripts** — `scripts/fetch-{cask,npm,crate,vscode}-upstream.sh`,
  mirroring `fetch-brew-upstream.sh`'s NDJSON contract and read-only/MCP-free
  discipline. npm uses the abbreviated packument (`dist-tags.latest`, deprecation
  via `versions[latest].deprecated`); cask reads the bulk `cask.json`
  (comma-segment normalization, `version=="latest"` → not-in-api, `auto_updates`
  casks still checked); crate uses `crates.io` (`max_stable_version`, required
  User-Agent, 1 s rate-limit); vscode queries **both** Open VSX (authoritative
  drift verdict) and the VS Marketplace (best-effort annotation). All strip
  fractional-second timestamps and split HTTP 404 (`not-in-api`) from 5xx
  (`api-unavailable`) per row.
- **`validate-plugin.mjs` staleness-bucket contract check** — machine-checks
  the emit side (gardener + `staleness-detection.md` `#### <bucket>` headings)
  and consume side (maintainer Section 3b routing bullets) against a single
  canonical bucket list, with a ">=1 heading matched" guard against vacuous
  passes.

### Notes

- The brew fetch script's NDJSON output is byte-identical (only a comment
  updated). The `knowledge-gardener` Step 5b 2-D (age × semver-distance)
  bucketing model is preserved verbatim and applied to all semver cohorts
  (cask normalizes to `distance-unknown`; tap routing stays brew-only).
- `action`, `gh`, `go`, and `docker` are excluded by construction (no single
  canonical comparable version); `pypi`, `gem`, and `composer` are deferred
  until their cohorts grow.

## [0.30.1][] - 2026-05-21

### Changed

- **`/tool-intel` (Step 3d) + `/package-intel` (Step 3e) — release-list
  staleness heuristic + git-tag fallback.** Maintainers sometimes tag a release
  and ship it to a registry without cutting a GitHub Release, so `gh release
  list` can lag the true latest version. Both skills now compare the newest
  Release against the registry/formula stable version and, on mismatch (or an
  empty release list for an active repo), fall back to `gh api
  repos/<owner>/<repo>/tags` and derive a changelog equivalent from the commits
  between the last released tag and the newest tag. Recovered versions record
  their provenance (`git tag … — no GitHub Release as of <date>`). Discovered
  while researching `brew:sem` (formula stable `0.6.0`, git tag `v0.6.0`, but
  `gh release list` topped out at `v0.5.5`).
- **DeepWiki indexing-lag callout** — Step 3a of both skills now notes that
  DeepWiki re-indexes periodically and may not yet cover recently added
  features; when the changelog reveals a newer version, supplement from
  `--help`/README/commit log.
- **Both `references/gh-api-fallback.md`** gained a git-tags endpoint row and a
  "Recovering a Version/Changelog from Tags" section documenting the GitHub API
  footguns the fallback must avoid: `/tags` and `gh release list` are not
  semver-sorted, pre-release/CalVer tags must be excluded, `compare` truncates
  at 250 commits and reports a `status`, and a suppressed error reads the same
  as an empty result. The `tool-intel` copy also routes the `brew:` changelog
  step here for the formula-newer-than-Release case (the `brew:sem` shape),
  closing an orphaned-guidance gap.

## [0.30.0][] - 2026-05-20

### Added

- **`/knowledge-garden` + `/knowledge-maintain` skills** — scope-partitioned
  front-doors for the `knowledge-gardener` / `knowledge-maintainer` agents.
  Audit/fix a bounded set of named notes inline (in the main session, with
  per-edit confirmation for `/knowledge-maintain`); graph-wide work delegates
  to the agent via the `Agent` tool. Both are explicit `/command` only
  (`disable-model-invocation: true`) so they never compete with their
  delegate-target agents for trigger phrases. Hardened from multi-agent review:
  delegate-failure handling, insert-then-strip observation moves with an
  `N_before`/`N_after` survival check, two-pass orphan detection, and
  `identifier`-scoped `schema_validate`.
- **knowledge-gardener Step 11 — source-URL provenance nudge** (read-only,
  informational). Flags notes that already have a `## Sources`/`## Key Sources`
  body section citing in bare text, nudging toward the new "Source citations"
  convention. Reads the body (not observations); never resolves URLs itself.
- **CLAUDE.md "Source citations (all note types)" convention** — source URLs
  belong in a body `## Sources` markdown list or `url:`/`source:` frontmatter,
  never inside a `[category]` observation (a markdown link there can silently
  drop — verified during this cycle's Simon Willison note backfill).
- **`validate-plugin.mjs` phantom-subagent check** — a typo'd
  `Agent(subagent_type=...)` reference in a skill now fails the build, mirroring
  the existing agent→skill phantom-reference check.

### Removed

- **BREAKING: `/wander` skill** — the 5-mode purposeless-exploration skill was
  cut as off-core; it never wrote to the knowledge graph.
- **BREAKING: `/readwise-check` skill** — removed as a standalone command; the
  Readwise reading-depth lookup is subsumed by the Readwise enrichment step
  already present in `/package-intel`, `/tool-intel`, and `/knowledge-gaps`.

  Skill count 16 → 14. Under semver 0.x a minor bump signals a breaking change.

### Changed

- SessionStart hook (`session-start.sh`) drops the now-dead `/wander` and
  `/readwise-check` suggestions and hints the explicit-only
  `/knowledge-garden` / `/knowledge-maintain` instead.
- The subagent tool is referenced as `Agent` (renamed from `Task` in Claude
  Code v2.1.63; `Task` remains an alias) across the new skills.

## [0.29.4][] - 2026-05-19

### Fixed

- **Append-mode regression in intel-skill update paths** (`vp-claude-fo8`)
  — Step 5 of `/package-intel` and `/tool-intel`, and Step 4 of
  `/people-intel`, documented a prohibition against
  `edit_note(operation="append", section="Observations")` but gave no
  concrete positive example. Models executing the update path fell back
  to `append`, which Basic Memory treats as end-of-file regardless of the
  `section` parameter — observations landed below `## Relations` and were
  parsed as malformed relations, some with ~300-char `relation_type`
  overflows. Three npm notes were silently damaged before detection
  (`npm-umzeption`, `npm-@voxpelli-pg-utils`, `npm-@yikesable-fastify-saas-auth-pg`,
  all hand-repaired in a prior maintainer pass).

  Each affected Step 5 / Step 4 block now contains a state→action
  decision table covering all four note states (`## Observations`
  populated, empty, absent, or with a multi-line last observation), a
  canonical `edit_note(find_replace)` template, an empty-section
  fallback anchored on the section header, a generic `<prefix>-<X>`
  placeholder that works across every ecosystem each skill supports
  (npm/crate/go/composer/pypi/gem for package-intel;
  brew/cask/action/docker/vscode/gh for tool-intel), a clarification
  that `find_replace` does byte-exact substring matching, and a bounded
  retry instruction (one retry on no-match, then report to user — no
  infinite loop).

- **Follow-up tracking** — `vp-claude-ytn` (P2) tracks the upstream
  Basic Memory footgun (`edit_note(append, section=X)` ignores the
  section parameter). `vp-claude-c1r` (P2) tracks a graph-wide sweep
  for legacy append-mode damage in notes outside the three confirmed
  cases. `vp-claude-bce` (P3) tracks a CLAUDE.md release-checklist
  clarification (MEMORY.md is referenced but absent).

## [0.29.3][] - 2026-05-13

### Added

- **Brew note staleness detection** — three-layer drift detector for
  Homebrew formulae documented in Basic Memory. Answers "which of my
  documented brew tools have received upstream updates since I last
  refreshed them?"

  - **`scripts/fetch-brew-upstream.sh`** — API-only worker. Reads formula
    names on stdin, queries `formulae.brew.sh/api/formula.json`,
    optionally enriches GitHub-hosted formulae with `gh release list`
    timing, emits NDJSON per name. **Never reads `~/basic-memory/`** —
    BM access flows through MCP per project convention; the script is
    pure external I/O. Defensive JSON validation guards against
    malformed API payloads silently mislabeling the entire vault.

  - **`knowledge-gardener` Step 5b — Brew Version Drift** — MCP-first
    audit step. Enumerates documented brew notes via `list_directory`,
    extracts recorded versions via `read_note` (handles three known
    Formula Details / inline header / Registry Metadata formats with
    explicit priority tiebreak), pipes bare formula names to the
    upstream script, computes drift in-context, and emits a
    `### Brew Version Drift` report section with canonical `####`
    sub-headings: `Drifted >30d`, `Archive candidates`, `Drifted <30d`,
    `Drifted, age unknown`, `Unparseable`, and `Tap-only`.

  - **`knowledge-maintainer` Section 3b** — text-searches for the
    `### Brew Version Drift` section in the gardener report and
    auto-batches up to 5 `/tool-intel brew:<name>` refreshes for the
    `Drifted >30d` bucket. Routes `Archive candidates`, `Drifted <30d`,
    `Drifted, age unknown`, and `Unparseable` to the approval queue.
    Explicit partial-failure handling distinguishes succeeded from
    failed refreshes rather than claiming whole-batch success.

  - **`/knowledge-gaps --stale` mode** — user-invocable staleness check.
    The `knowledge-gaps` skill now has a structural Mode A / Mode B
    dispatch in its `## Workflow` section. Mode A (triggered by
    `--stale`) delegates to a new `references/staleness-detection.md`
    reference file following the same MCP-first pattern, with a
    user-facing report shape sharing canonical bucket names with the
    gardener's audit-time output. Mode B (default) runs the existing
    coverage workflow unchanged.

### Notes

- **Patch version bump** (semver 0.x: additive, non-breaking). The
  script is a new file, the agent sub-sections are new, and the
  `--stale` flag is purely additive on `/knowledge-gaps`. No existing
  surface behavior changes.
- **Phase 2 enhancements** documented inline but not yet implemented:
  `[version]` observation in `brew_formula` schema (would eliminate the
  three-format regex matching by making version extraction
  MCP-structural), `mcp__homebrew__info` popularity sort in the
  gardener, cross-ecosystem staleness for npm/crates/Go/Composer/PyPI/
  Gems/Actions/Docker/VSCode/gh.
- **Deferred follow-ups** flagged by three rounds of agent reviews:
  heading-hierarchy refactor in `knowledge-gaps/SKILL.md` (Steps 0-15
  should be `####` under Mode B), canonical classification table
  extraction to eliminate the bucket-name copy across gardener / skill
  reference / maintainer, and the `audit-scope-leak.sh` carve-out
  decision (architect: legitimate exception; reviewer: also in
  violation — contested, user decision needed).
- `npm run check` passes all four stages (validate-plugin + remark +
  shellcheck/shfmt + 25/25 hook integration tests).

## [0.29.2][] - 2026-05-06

### Added

- **`VOICE.md`** at the plugin root, documenting the gardener-with-notebook
  identity, agent color assignments, description-tone conventions
  (scoped to agent descriptions only — skill descriptions remain
  trigger-phrase lists for routing), and a checklist for adding a fifth
  agent. Cited from `CLAUDE.md`'s Agent frontmatter section for
  discoverability.

### Changed

- **Agent colors refreshed.** `knowledge-gardener` cyan → green (the
  central gardener; observation, growth). `knowledge-maintainer` green →
  magenta (the only writer; avoids `red`'s destructive overcurrent and
  `cyan`'s collision with `vp-beads:sprint-review`). `knowledge-primer`
  (blue) and `raindrop-gardener` (yellow) unchanged. All four colors are
  in the documented `validate-plugin.mjs` allowlist.

### Fixed

- **README catch-up to v0.29.1+ surface area.** Adds full sections in
  "What it does" for `/session-bookmarks`, `/tag-sync`, and the Raindrop
  Gardener agent (previously only in the diagram). Adds fourth-wall
  coverage to the Knowledge Gardener "Checks for:" list and a
  fourth-wall row to the Knowledge Maintainer autonomy table. Adds
  `gh_extension` schema, `scripts/`, `validate-plugin.mjs`, `VOICE.md`,
  and `marketplace.json` to the plugin structure tree, plus the `gh:`
  ecosystem reference files (`ecosystem-gh.md`, `note-template-gh.md`,
  `gh-api-fallback.md`) and the `knowledge-gaps/references/` subdir.
- **README v0.22.0 banner demoted** to a "Migration notes" section near
  License — still discoverable for users with pre-v0.22 vaults but no
  longer claiming top-of-page real estate.
- **Upstream skill count corrected** from 9 to 10 in the "Relationship
  to upstream" section (verified against installed
  `~/.claude/skills/memory-*`).

### Notes

- **Patch version bump** (semver 0.x: additive, non-breaking). No
  functional changes — documentation, conventions, and agent
  presentation only. `npm run check` passes all four stages
  (validate-plugin + remark + shellcheck + 25/25 hook tests).

## [0.29.1][] - 2026-05-02

### Fixed

- **Canonicalize relation-vocabulary verbs to underscored forms across 13
  schemas + their BM mirrors.** A 3-gardener audit on the v0.29.0 launch wave
  discovered the new `gh_extension` schema's `## Relation Vocabulary` prose
  section used spaced verbs (`see also`, `runs on`, `pairs with`,
  `depends on`, `alternative to`, `relates to`) — the launch-wave agents
  copied this into their notes, producing relation_type strings BM stores
  but does not match against the canonical picoschema field names. Per
  CLAUDE.md: "Relation verbs must exactly match picoschema field names —
  `relates to` (space not underscore) silently creates non-matching
  relations." Sweep applied to both repo files (`schemas/*.md`) AND BM
  mirrors (`schema/*` notes) per the dual-sync rule.
- **`pattern` schema vocabulary fix is the highest-stakes** — its
  picoschema explicitly declares `has_instance`, `instance_of`, `applied_to`,
  `implemented_by`, `part_of` as Note relation fields, so the prose forms
  with spaces were a true picoschema mismatch. Fixed all 5.
- **Other vocabulary canonicalizations**: `brew_formula`/`brew_cask`/
  `github_action`/`docker_image`/`vscode_extension`/`crate_package`/
  `go_module`/`composer_package`/`pypi_package`/`ruby_gem`/`reference`
  vocabulary verbs now use underscored forms.
- **Fix the 5 v0.29.0 launch-wave gh-extension notes' `## Relations`**
  whose verbs had drifted to spaced form: `gh-github-gh-models`,
  `gh-seachicken-gh-poi`, `gh-cschleiden-gh-actionlint`. Plus
  `brew-actionlint`'s `also_available_as` (non-vocabulary verb) → `relates_to`.
- **Fix `brew-gh` hub note**: 5 sequential launch-wave agent appends to
  `## Extensions` had created a duplicate `### Documented Extensions`
  subsection with overlapping bullets. Merged into one canonical 5-entry
  list. `## Relations` normalized — all 5 extension links now use
  `extended_by` (was inconsistent: 2× `extended_by`, 2× `relates_to`,
  1× `has_extension`).
- **Add `extended_by` to the `gh_extension` schema's vocabulary** — used
  on the host (`brew-gh`) side to point at extensions, was missing from
  the documented vocabulary.
- **`note-template-gh.md` Relations example block** — canonicalize verbs
  in the worked `gh-meiji163-gh-notify` example so future authors don't
  copy spaced forms.

### Notes

- **Patch version bump (semver 0.x: additive, non-breaking).** No existing
  notes break from this change — relation_type strings are now canonical
  going forward, but graph-stored relations from prior runs remain
  recognizable as the same edges.
- **Skip-list verbs preserved** (intentional, separate design discussion):
  `runtime dep of`, `Layer 1 alias in`, `Layer 2 nudge in`, `base layer for`,
  `application pattern in` — multi-word noun-phrase relation labels that
  don't fit cleanly into single-token underscored forms.
- **Schemas' own `## Relations` blocks** still use `see also` (spaced)
  in their cross-schema cross-references — pre-existing graph-wide
  convention drift, not introduced by this PR. Filed as candidate for a
  future broader sweep; non-blocking because `see_also` isn't a declared
  picoschema relation field, so spaced vs underscored is convention-only
  here, not picoschema-conformance.
- All 21 schema_validate calls pass (0 errors). `npm run check` passes:
  validate-plugin + remark + shellcheck + 25/25 hook tests.

## [0.29.0][] - 2026-05-02

### Added

- **`gh:` ecosystem prefix for `/tool-intel`.** Researches GitHub CLI
  extensions (installed via `gh extension install <owner>/<repo>` and
  invoked as `gh <name> ...`) into a new `gh_extension` Basic Memory
  schema with title format `gh-<owner>-<repo>` and directory `gh/`.
  Sixth ecosystem alongside `brew:`, `cask:`, `action:`, `docker:`,
  `vscode:`. Five-source enrichment with DeepWiki **conditional** —
  runs only when `gh release list` returns ≥1 release (alpha bash
  extensions like `gh-notify` aren't indexed and would 404). Mirrors
  `/people-intel`'s conditional DeepWiki pattern.
- **`gh_extension` schema** — frontmatter fields include
  `runtime_shape` (`binary | script | local`), `discovery_mechanism`,
  `host_command`, `naming_convention`, `language`, `source`. `local`
  is required despite Wave-2 design discussion suggesting drop —
  symlinked dev installs (`gh ext install .`) are real and present in
  the user's environment. The `runtime_shape` classification ladder
  in `references/ecosystem-gh.md` checks symlink first because
  symlinked dev installs contain `.git/` too and would otherwise
  misclassify as `script`.
- **`gh-extension` controlled tag** — added to the per-type required-
  tags table in `agents/knowledge-gardener.md` and
  `agents/knowledge-maintainer.md`. Tag vocabulary entry added to
  `~/.claude/references/raindrop-tags.md`.
- **Reciprocal schema cross-refs** — `schemas/github_action.md` and
  `schemas/brew_formula.md` gain `see also [[schema/gh_extension]]`
  relations. gh extensions often invoke or wrap actions; gh itself
  is brew-installed, so adjacency through both peers is genuine.
- **Three new reference files**: `schemas/gh_extension.md`,
  `skills/tool-intel/references/ecosystem-gh.md`, and
  `skills/tool-intel/references/note-template-gh.md`.

### Changed

- **`/tool-intel` SKILL.md** — Arguments table, dispatch table,
  Step 0 error message, Step 3 enrichment templates (Tavily, DeepWiki,
  changelog), and Step 4 conventions table all extended with `gh:`
  rows.
- **Sibling skill prefix lists** — `knowledge-ask/SKILL.md`'s prefix
  table and prose mention now include `gh:`. `knowledge-gaps/SKILL.md`
  description notes that gh extensions have no manifest and stay
  user-invoked (no auto-detect).
- **`hooks/session-start.sh`** prefix list extended with
  `gh:<owner>/<repo>`. Bash heredoc quoting verified intact via
  `npm run check:sh`.
- **`agents/knowledge-gardener.md`** — 8 prefix-mention spots updated:
  inventory `list_directory`, `schema_validate` calls, wiki-link
  search queries, observation-link queries, ecosystem→directory
  mapping, per-type required-tag table.
- **`agents/knowledge-maintainer.md`** — schema-validation list
  extended to 18 types (adds `gh_extension`), required-ecosystem-
  tag rule added, `Skill(skill: "tool-intel", args: "gh:...")`
  example added.
- **README.md, CLAUDE.md** — opener counts ("five → six categories"),
  tool-intel section, references file count comment
  (`12 files: 6 ecosystem + 6 note templates`).

### Notes

- **Patch version bump (semver 0.x: additive non-breaking).** New
  ecosystem prefix is purely additive — no existing notes break, no
  existing schemas change, no existing skill workflows alter their
  outputs for non-`gh:` invocations.
- **gh-audit-envs migration deliberately skipped.** The user's own
  `voxpelli/gh-audit-envs` is documented at `engineering/security/...`
  with type `engineering` and rich landscape content (competitive
  matrix, USP, GitHub roadmap analysis). Wave-2 research evaluated a
  split (thin `gh_extension` note + renamed engineering essay) but
  the user chose to leave it as-is — the landscape content is genuinely
  engineering-shaped, and `/knowledge-gaps` doesn't auto-detect
  installed gh extensions (no manifest), so no false-positive flagging
  risk. Revival trigger: if the engineering note acquires
  `runtime_shape`/`host_command` fields it can't carry, or if the
  upstream repo is retired.
- **`pattern:extensible-cli-tools` hub note deferred.** Singleton hub
  notes become orphans. Will revisit when a 2nd CLI-extension ecosystem
  (`git_extension` or `kubectl_plugin`) lands and the hub has ≥2
  concrete instances for authentic `[precedent]` and `[tradeoff]`
  observations.
- **Manifest detection deferred.** No checked-in installer scripts,
  `gh-extensions.txt`, or `~/.config/gh/extensions.yml` patterns
  observed in user repos. `gh:` stays user-invoked, mirroring `action:`.
  A 2-line grep parser is stubbed as a comment for the future-
  conditional path.

## [0.28.0][] - 2026-04-29

### Removed

- **PreCompact reflection hook retired.** No positive evidence of effectiveness
  surfaced across 7 sprints of BM/retro review; the user's own
  `Session Reflector Patterns` `[gotcha]` flagged its output as "low-quality
  changelog noise". Outcome of a 9-agent audit that triangulated the finding,
  ran an adversarial counter-pass to disprove it, and confirmed via doc-grep
  that no forward-facing references survive. RETRO-02 lesson preserved as
  historical record. Removes `hooks/precompact.sh`, the `PreCompact` matcher
  in `hooks.json`, and references in `CLAUDE.md`, `README.md`, the project
  `MEMORY.md`, plugin layout trees, the "How it fits together" diagram, and
  the session-reflect skill's hook-comparison passages. Hook count: 6 → 5.

### Changed

- **`PreToolUse` gardener block uses `permissionDecision: "deny"`** (canonical
  2026 form) instead of legacy `decision: "block"`. Surfaces a labelled
  `[Plugin]` decision in the TUI and integrates with the post-fix
  `permissions.deny` precedence rules. Three test assertions in
  `check-hooks.mjs` updated atomically with the hook-output change to avoid
  a transient broken-test window.
- **`post-file-edit.sh` shfmt branch flipped to noisy-flag mode.** Replaces
  the silent `shfmt -w "$FILE_PATH" 2>/dev/null || true` (which swallowed
  every error) with a detect-then-fix pattern: `shfmt -d` surfaces the diff
  in `additionalContext`, then `shfmt -w` auto-fixes. Style drift becomes
  visible during edits instead of being absorbed silently.
- **`PostToolUseFailure` skill prose narrowed** in `skills/session-reflect/SKILL.md`
  and `skills/knowledge-ask/SKILL.md` to scope coverage to BM write tools only
  (`write_note`, `edit_note`, `schema_validate`, `schema_diff`, `schema_infer`),
  matching the matcher's actual coverage. The previous line claiming "covers
  tool-level errors" was actively misleading.
- **`SessionStart` audit reminder** now mentions `knowledge-maintainer`
  alongside `knowledge-gardener` so the two-pass audit-then-fix workflow is
  discoverable from the reminder text alone.

### Added

- **Two new hook integration tests** in `scripts/check-hooks.mjs` covering the
  shfmt branch: drift detection (asserts the diff appears in `additionalContext`)
  and clean-file silence (asserts zero JSON objects emitted). Closes the gap
  identified by the audit: prior to this release, the shfmt path had zero
  test coverage despite handling every shell-script edit in the plugin.

### Notes

- **Minor version bump (semver 0.x: breaking change).** PreCompact removal
  is the breaking part — users relying on automatic context-compaction
  reflection should invoke `/session-reflect` manually, or wait for the
  PostCompact research bead (vp-claude-m7u) to land.
- All 25 `check:hooks` integration tests pass. All four `npm run check` jobs
  green: `check:plugin`, `check:md`, `check:sh`, `check:hooks`.
- Three follow-ups filed as beads for later sprints:
  - **vp-claude-k4d** — broaden `PostToolUseFailure` matcher to non-BM MCP
    tools (Raindrop, Tavily, Readwise, DeepWiki) when retros surface real
    failures going unhandled
  - **vp-claude-pwp** — write-time wiki-link colon anti-pattern detector
    (`[[npm:foo]]` → `[[npm-foo]]` correction at `write_note` / `edit_note`
    time, gardener already catches these in periodic audits)
  - **vp-claude-m7u** — research `PostCompact` (v2.1.76+) as a potential
    replacement for the retired PreCompact, contingent on observed
    `compact_summary` input shape and MCP-tool access in post-compact context

## [0.27.1][] - 2026-04-20

### Added

- **Homebrew MCP as optional complementary source for `/tool-intel`** —
  integrates `mcp__homebrew__info` to fetch install analytics (30/90/365-day
  install counts plus build-error counts for formulae) that the
  `formulae.brew.sh` JSON API does not expose. Emits as `[popularity]`
  observations on `brew_formula` / `brew_cask` notes, matching the category
  already used by `/package-intel` for cross-ecosystem consistency. Tavily
  remains the primary structured-metadata source — reading the upstream
  implementation (`Homebrew/brew` PR #20041, `Library/Homebrew/mcp_server.rb`)
  showed the MCP returns human CLI text via `Open3.popen2e`, not JSON, so
  it complements rather than replaces the JSON API.
- **Graceful degradation** — when the MCP server is unavailable (stdio MCPs
  can disconnect mid-session; we experienced this while writing the change),
  the analytics step skips silently with no retry and no fabricated values.
  The rest of the `/tool-intel` research proceeds unchanged.
- **Schema additions** — optional `popularity?(array)` field on both
  `brew_formula` and `brew_cask` schemas plus a `[convention]` observation
  stating the MCP-only provenance rule. Dual-synced to the Basic Memory
  schema notes; all 52 existing formula notes and 5 cask notes remain
  valid (purely additive change).

### Notes

- Patch version bump (semver 0.x: additive, non-breaking, optional
  integration — no required install step for users who don't want the
  `[popularity]` observation).
- `mcp__homebrew__` added to `KNOWN_MCP_PREFIXES` in `validate-plugin.mjs`.
- Only `mcp__homebrew__info` is in `allowed-tools`. The other 13 MCP tools
  (`install`, `uninstall`, `upgrade`, etc.) stay out; opting in per-tool
  follows the tool-list hygiene rule in CLAUDE.md.

## [0.27.0][] - 2026-04-19

### Added

- **Socket.dev as 7th `/package-intel` source** — integrates
  `mcp__socket-mcp__depscore` to add supply-chain risk scoring (license,
  maintenance, quality, supply-chain, vulnerability) as a `[security]`
  observation. Empirically verified ecosystems: npm, pypi, cargo (our
  `crate:` prefix maps to Socket's `cargo` token), and gem. Go and
  composer currently return no data and skip silently — no error, no
  halting. Skill prose explicitly overrides Socket's default "stop
  generating code on low scores" behaviour: this is a research skill,
  not a code-generation gate.
- **README install instructions** for the new Socket MCP server
  (`claude mcp add --transport http socket-mcp https://mcp.socket.dev/`).

### Notes

- Minor version bump (semver 0.x: new source = additive but introduces
  an install-time dependency for users who want the new observation).
- `/tool-intel` is unchanged — brew/cask/action/docker/vscode are
  distribution channels, not package ecosystems Socket indexes.

## [0.26.1][] - 2026-04-14

### Added

- **`/people-intel <name>` skill** (14th skill) — five-source person research
  (Basic Memory deep graph traversal, Raindrop, Readwise, Tavily, DeepWiki).
  Creates/updates structured person notes with bidirectional cross-linking,
  fourth-wall guardrail, anti-hagiography step (explicit controversy search),
  and cross-cluster discovery. DeepWiki is conditional (developer profiles
  only). Includes 2 reference files: note template and source guide.

## [0.26.0][] - 2026-04-13

### Added

- **`/wander` skill** (12th skill) — purposeless knowledge exploration with 5
  modes: Random Walk (BM graph traversal), Time Machine (old+new bookmark pair),
  Cross-System Collision (Readwise highlight + Raindrop bookmark), Forgotten
  Shelf (old untagged bookmarks), Obsession Detector (recent topics with zero BM
  notes). Critical design constraint: never scores, ranks, or recommends —
  presents collisions and lets the user make meaning.
- **`/readwise-check <topic>` skill** (13th skill) — quick pre-research lookup
  reporting highlight count, document count, and reading depth for a topic across
  Readwise. Two API calls, compact output.
- **SessionStart `/wander` hint** — session start now mentions `/wander` and
  `/readwise-check` alongside existing `/knowledge-prime` and `/knowledge-ask`
  suggestions.

## [0.25.1][] - 2026-04-13

### Fixed

- **Personal content leakage** — removed hardcoded employer name (`040.se`),
  personal tag conventions (`040-work`, TypeScript→javascript+types), hardcoded
  collection ID (`69372352`), library size references (`13k+`), and
  Swedish-specific audit steps from published plugin files. All user-specific
  behavior now reads from the vocabulary file's YAML frontmatter.

### Added

- **Vocabulary file config fields** — `blocklist`, `context_tags`, and
  `conventions` frontmatter fields in `~/.claude/references/raindrop-tags.md`.
  Tag-sync seeds sensible defaults on creation and preserves config across sync
  cycles.
- **`--source` argument** for `/raindrop-triage --promote` — overrides the
  default AI-triaged source collection, solving the bootstrap problem for
  pre-triaged bookmarks.
- **Progressive disclosure** — extracted tag selection strategy and promote
  workflow from raindrop-triage SKILL.md into `references/` files, reducing
  SKILL.md from ~3,200 to ~1,800 words.
- **Count verification gate** in promote workflow — verifies processed + skipped
  = source total after all batches.
- **TodoWrite progress checklist** for the promote pass.
- **Collection discovery** in session-bookmarks — replaced hardcoded collection
  ID with `find_collections`/`create_collections` discovery pattern.

### Changed

- **raindrop-gardener** — Swedish/English parallel tag detection generalized to
  non-primary-language detection (works for any language pair).
- **Description trigger phrases** — added "deduplicate bookmarks", "find
  duplicate bookmarks", "tag unsorted", "process raindrop inbox" to
  raindrop-triage.

## [0.25.0][] - 2026-04-12

### Added

- **`/raindrop-triage` skill** (11th skill) — interactive triage of unsorted
  Raindrop bookmarks with URL normalization dedup, research burst detection
  (temporal clusters of 3+ within 30min), theme-based clustering, vocabulary-
  grounded tag proposals, and batch-approval UX. Moves approved bookmarks to
  AI-triaged collection. A `--promote` pass classifies AI-triaged items into
  AI-sorted (default), AI-gems (golden), AI-archive, or AI-attention with
  structured note annotations. Operates within a 6-collection AI-managed
  namespace (AI-bookmarked, AI-triaged, AI-sorted, AI-gems, AI-archive,
  AI-attention) — never touches user-curated collections.

### Changed

- **Raindrop collection rule** — expanded from "AI-bookmarked only" to
  "AI-\* namespace only" (AI-bookmarked, AI-triaged, AI-sorted, AI-gems,
  AI-archive, AI-attention) in both global and project CLAUDE.md.
- **session-bookmarks blocklist narrowed** — removed `cool`, `web2.0`, and
  Swedish personal tags (active curation tags, not legacy); added `2` to
  numeric ratings. Aligned with raindrop-triage blocklist.
- **`argument-hint` frontmatter** added to 6 skills (package-intel,
  tool-intel, knowledge-ask, schema-evolve, tag-sync, raindrop-triage) —
  shows expected input format in the slash-command picker.
- **`paths` frontmatter** added to knowledge-gaps — skill conditionally
  activates when manifest files (package.json, Cargo.toml, etc.) are touched.
- **`validate-plugin.mjs` expanded** — known-fields allowlist for skill
  frontmatter warns on unknown fields (catches typos); type validation for
  `argument-hint`, `paths`, `effort`, `maxTurns`, `context` fields.
- **Skill interaction conventions** added to CLAUDE.md — AskUserQuestion
  must not be in allowed-tools, preview-approve-execute pattern, TodoWrite
  for progress feedback.

## [0.24.1][] - 2026-04-06

### Fixed

- **session-bookmarks** — removed dead reference to `legacy_avoid` and
  `overlap_groups` vocabulary frontmatter fields that were never added
- **raindrop-gardener** — removed hardcoded tag count "1,773" that would
  go stale

## [0.24.0][] - 2026-04-06

### Added

- **`raindrop-gardener` agent** (4th agent) — read-only Raindrop tag auditor
  with 10 audit steps: library dashboard, tag inventory, naming violations,
  near-duplicate detection, mistagged bookmarks (via `find_mistagged_bookmarks`),
  orphan tags, legacy tags, co-occurrence analysis, Swedish/English parallels,
  and taxonomy gaps. Produces structured reports with exact `update_tags`/
  `delete_tags` tool calls as copy-paste recommendations. Uses 3 novel
  Raindrop MCP tools: `find_mistagged_bookmarks`, `fetch_current_user`,
  `fetch_popular_keywords`.

### Changed

- **`/session-bookmarks` hybrid tag selection** — tag selection now uses
  copy-from-similar as primary signal (searches for similar bookmarks,
  extracts their tags, counts frequency) with topic-match boosting for
  specific tags, a legacy tag blocklist (`5`, `4`, `cool`, `web2.0`,
  `for:*`, Swedish personal tags), vocabulary fallback for novel topics,
  and selection rules with BAD/GOOD examples. Empirically tested across
  6 scenarios against the real 13k bookmark library.
- **Two-pass `url_pattern` dedup** — duplicate checking now uses
  `url_pattern` for precise wildcard URL matching (Pass 1), falling back
  to semantic `search` only when no exact match found (Pass 2). GitHub
  URLs use owner/repo-scoped patterns for precision.

## [0.23.0][] - 2026-04-06

### Added

- **`/tag-sync` skill** (10th skill) — fetches tags from Raindrop via `find_tags`,
  curates the top N by usage count, auto-characterizes each with a one-line
  description from sampled bookmarks, groups by cluster (Ecosystem, Architecture,
  Content Type, Other), and writes/syncs a vocabulary file at
  `~/.claude/references/raindrop-tags.md`. Follows the vendor-sync pattern from
  vp-beads. Supports `--reset` for full recreation. User-invocable as
  `/tag-sync [count|--reset]`.
- **`/session-bookmarks` skill** (9th skill) — scans the current conversation for
  1-3 high-signal URLs discovered during research, previews them with proposed
  tags and rationale, and creates bookmarks in the AI-bookmarked Raindrop
  collection (ID 69372352) after user approval. Signal heuristics exclude
  registry index pages, repo root pages, and user-pasted seed URLs. Auto-delegated
  from `/session-reflect` Step 6, or invocable standalone.
- **Canonical `url:` frontmatter field** — all 11 package/tool note templates now
  include a `url:` field pointing to the canonical registry page (npmjs.com,
  crates.io, formulae.brew.sh, etc.). Metadata-only — not a schema observation
  field. Docker template documents the `/_/` vs `/r/org/` URL conditional.
- **`project` schema** (20th schema) — for things you own and build, with ownership
  boundary test ("you build it → project; you consume it → service"). 9 notes
  (3 existing + 6 retyped from service).
- **Person schema +5 fields** — `connection`, `influence`, `influenced_by`,
  `influences`, `relates_to` relation fields based on 83-note frequency analysis.
- **Milestone schema +1 field** — `created_by` relation (16% usage).
- **Standard schema +2 fields** — `created_by` and `contrasts_with` relations.
- **vp-git 0.2.0 in marketplace** — added `voxpelli/claude-git` to the
  vp-plugins marketplace.

### Fixed

- **Session-reflect bookmark delegation** — clarified that `/session-bookmarks`
  is invoked via the Skill tool, not automatically.
- **Docker template URL** — added comment for community image URL pattern
  (`/r/org/name` vs `/_/name` for official images).

## [0.22.1][] - 2026-04-06

### Fixed

- **Slash-to-hyphen in prefixed titles** — extends v0.22.0 to also replace
  slashes with hyphens in 5 ecosystems that use them: action (`action:actions/checkout`
  → `action-actions-checkout`), npm scoped (`npm:@fastify/postgres` →
  `npm-@fastify-postgres`), composer, go, and docker community images. The
  title rule is now: replace all `:` and `/` with `-`; preserve `@` and `.`.
  Migration script in `TODO-obsidian-migration.md` updated to handle both
  colons and slashes in a single run.

## [0.22.0][] - 2026-04-05

### Breaking

- **Colon-to-hyphen prefix migration for Obsidian compatibility** — note titles
  and wiki-links now use hyphen delimiters (`npm-fastify`, `[[npm-fastify]]`)
  instead of colons (`npm:fastify`, `[[npm:fastify]]`). BM's
  `sanitize_for_filename()` already produces `npm-fastify.md` on disk — this
  aligns titles with filenames, enabling native Obsidian wiki-link resolution.
  User command syntax is unchanged (`/package-intel npm:fastify`). Affects all
  11 ecosystem prefixes: npm, crate, go, composer, pypi, gem, brew, cask,
  action, docker, vscode. Existing vault notes require a one-time migration —
  see `TODO-obsidian-migration.md` for a shell script and verification steps.

## [0.21.1][] - 2026-04-05

### Added

- **Observation sweep for knowledge-primer** — Step 4b searches for critical
  `[gotcha]`/`[breaking]`/`[limitation]` observations across the entire graph,
  not just dependency-matched notes. Results appear in a new "Other warnings"
  section of the context brief (max 3 entries). Added `search_notes` to both
  knowledge-primer agent and knowledge-prime skill tool lists.
- **Scope-leak self-check for session-reflect** — Step 3 now scans candidate
  observations for project-specific content (absolute paths, env vars,
  localhost references) before showing the preview. Three-tier classification:
  false positive (keep), generalizable (rewrite), not generalizable (drop).

### Fixed

- **Naming convention documented** — established `vp-` prefix convention for
  non-user-invocable skills in CLAUDE.md Skill frontmatter section
- **Release checklist added** — formal checklist in CLAUDE.md Releasing section
  covering version bump locations and source count propagation paths

## [0.21.0][] - 2026-04-05

### Added

- **`vp-note-quality` skill** — non-user-invocable reference checklist
  preventing the fourth-wall anti-pattern (self-referential content in
  subject-domain notes). Contains 10 quality rules, violation examples, and
  enforcement guidance. Preloaded into agents via the `skills` frontmatter
  field — zero-latency context injection at agent startup.
- **Agent `skills` preloading** — knowledge-maintainer and knowledge-gardener
  now preload `vp-note-quality` via the native `skills` frontmatter field,
  injecting the full checklist into agent context at startup.
- **Maintainer `effort: high`** — the knowledge-maintainer now defaults to
  high effort for improved note prose quality during writes. Works on both
  Sonnet 4.6 and Opus 4.6.
- **`[popularity]` observation category** in package-intel — fetches download
  statistics from registry APIs (npm weekly, crates.io/Packagist/RubyGems
  all-time). Omitted for PyPI (deprecated) and Go (no metric). Includes
  metric-window disambiguation (`downloads/week` vs `total downloads`).
- **Maintainer Step 2e** — fourth-wall quality check searches for red-flag
  phrases in edited notes and queues rewrites for user confirmation.
- **Gardener Step 10** — fourth-wall audit step searches for self-referential
  content and reports violations with severity classification.
- **Validator: agent `skills` resolution** — `validate-plugin.mjs` now
  verifies that skill names referenced in agent `skills` arrays resolve to
  actual `skills/<name>/SKILL.md` files, preventing phantom skill references.

### Fixed

- **package-intel Step 6/7 ordering** — Step 6 summary no longer references
  cross-links from Step 7 before it has run.
- **npm note template fence** — normalized from triple to quadruple backticks
  for consistency with all other ecosystem templates.
- **Bash hook false positive** — `pre-bash-no-python.sh` regex no longer
  matches `node_modules` or `nodemon` as `node` commands. Anchored to match
  `node` only as a standalone command.
- **Source counting discrepancy** — CLAUDE.md now matches SKILL.md in listing
  the six enrichment sources (DeepWiki, Context7, Tavily, Raindrop, Readwise,
  changelog) instead of counting Basic Memory as a source.

### Changed

- **Marketplace: vp-beads 0.9.2 → 0.10.0** — syncs marketplace entry with the
  vp-beads hardening release (command hook fix, trigger overlap removal,
  session-context dead code cleanup).

## [0.20.0][] - 2026-04-05

### Added

- **`/knowledge-ask` skill** — freeform Q&A against the Basic Memory knowledge
  graph. Searches notes, loads candidates, traverses 1-hop neighbors, and
  synthesizes a cited answer with confidence tiers (Direct/Partial/No Coverage).
  Read-only — suggests `/package-intel` or `/tool-intel` when coverage is
  incomplete. User-invocable as `/knowledge-ask <question>`.
- **Skill routing table** in CLAUDE.md conventions — disambiguates
  `/knowledge-prime` (project-wide coverage) vs `/knowledge-ask` (topic Q&A)
  vs `/package-intel` (external research) vs `/knowledge-gaps` (audit).

### Changed

- **`/knowledge-prime` description** — added "NOT for" negative differentiator
  and coverage-focused trigger phrases; removed overlapping phrase that could
  route to `/knowledge-ask`.
- **SessionStart hook** — now suggests `/knowledge-ask` for topic-specific
  questions alongside existing `/knowledge-prime` hint.

## [0.19.0][] - 2026-04-04

### Changed

- **session-reflector agent → `/session-reflect` skill** — converted from agent
  to skill so it runs in the main conversation context (agents cannot access the
  conversation transcript). The skill has the same 6-step workflow (extract →
  find targets → preview → write → relation check → report) plus a new Edge
  Cases section and `find_replace` failure fallback. User-invocable as
  `/session-reflect`.
- **knowledge-maintainer Step 1** — deduplicated the 40-line audit enumeration
  (17 `schema_validate` + 9 `schema_diff` calls) into a concise 4-step triage
  that references the gardener for comprehensive audits.
- **tool-intel freshness check** — replaced vague "consider scoping down" with
  a 3-tier decision table (<60 days / 60–180 / >180 days). Applied same fix to
  package-intel.
- **tool-intel DeepWiki scoping** — removed blanket vscode skip; DeepWiki now
  runs for `vscode:` when a public GitHub repo exists (aligning SKILL.md with
  ecosystem-vscode.md).

### Fixed

- **engineering.md schema** — `relates_to(array)` was missing `?` (required
  instead of optional), unlike all 16 other schemas. Changed to
  `relates_to?(array)`.
- **knowledge-maintainer** — removed phantom `write_note` from tools list
  (never directly called; new notes delegated to `/package-intel` via `Skill`).
- **post-file-edit.sh** — changed `systemMessage` to `additionalContext` to
  match all other hooks.
- **pre-bash-no-python.sh** — normalized `jq -cn` to `jq -n` for consistency.
- **tool-intel** — replaced bare `references/` paths with full
  `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/...` paths (6 locations).
- **concept.md schema** — added `relates_to?(array)` field and Relation
  Vocabulary entry.
- **service.md schema** — added `architecture?(array)` field.

### Added

- **Hook comments** — clarifying comments in `session-start.sh` (mod-4 audit
  cycle), `post-bm-failure-classify.sh` (heuristic pattern matching),
  `post-file-edit.sh` (optional shfmt).
- **CLAUDE.md** — added 2 missing scripts to table (`audit-helpers.sh`,
  `check-hooks.mjs`), added `check:hooks` to validation description, added
  `references/` directories to plugin layout tree.

## [0.18.3][] - 2026-03-31

### Fixed

- **knowledge-maintainer Step 2d** — added missing `[[crate:` prefix to
  wiki-link-in-observations search (had 10/11 prefixes, gardener had all 11).
- **session-reflector** — removed phantom `list_directory` from tools list
  (never called in workflow).
- **knowledge-prime** — fixed `Glob(pattern=".beads")` which never matches
  directories; changed to `Glob(pattern=".beads/*")`. Added pagination note
  for `recent_activity`.
- **tool-intel Step 4** — removed incorrect `search_type="text"` from
  fallback name search (should use hybrid, not FTS5).
- **schemas/npm_package.md** — updated stale "five-source" to "six-source".
- **Documentation** — fixed hook count from 5 to 6 (PreToolUse was missing),
  fixed source counts in layout tree (Five→Six, Four→Five), added missing
  hook scripts to README structure tree.

## [0.18.2][] - 2026-03-30

### Fixed

- **standard-detection.md** — replaced broken FTS5 query `search_notes(query=
  "type: standard")` with proper `note_types=["standard"]` filter. Added word
  boundaries (`\b`) to grep patterns and broadened file glob to include Rust,
  Go, PHP, Python, Ruby extensions.
- **knowledge-gardener Step 4c** — added missing `search_type="text"` to all
  wiki-link-in-observations queries (inconsistent with Step 4).
- **knowledge-maintainer Step 2d** — added missing `search_type="text"` and
  `page_size=100` to all wiki-link-in-observations queries.
- **knowledge-maintainer Step 3** — replaced Glob with Read for root manifest
  detection (same node_modules recursion bug fixed in knowledge-gaps v0.18.1).
  Removed phantom `Grep` from tool list.
- **knowledge-prime and knowledge-primer** — replaced Glob with Read for root
  manifest detection.

### Added

- **UPSTREAM-basic-memory.md** — three new entries documenting
  `entity_types=["relation"]` for relation-index search, `note_types` filter
  for type queries, and `most_connected_entities`/`total_unresolved_relations`
  in project stats. Corrected "exact text match" claim to "FTS5 tokenized
  search".
- **CLAUDE.md** — new "Basic Memory search patterns" convention section
  codifying correct query approaches to prevent FTS5 assumption bugs.

## [0.18.1][] - 2026-03-30

### Fixed

- **knowledge-gaps Step 0** — replaced `Glob` with `Read` for root manifest
  detection. Glob recurses into `node_modules/` returning 100+ false matches.
- **knowledge-gaps Step 10** — replaced broken `search_notes(query="[[npm:",
  search_type="text")` with relation-index approach using
  `entity_types=["relation"]`. FTS5 tokenizes brackets, making literal `[[`
  queries impossible. The new approach queries the relation index directly and
  checks `to_entity` absence to identify dead wiki-links.
- **knowledge-gaps Steps 14-15** — extracted to
  `references/concept-detection.md` (matching Steps 11-13 pattern). Fixed
  Step 14a to use `most_connected_entities` seeds + relation-index queries
  instead of broken FTS5 text search. Fixed Step 14b Readwise queries to
  derive from project stack and hub gap candidates instead of generic phrases.
- **knowledge-gaps tool list** — added `Bash` for `bm project info` quick-exit
  gate in Step 10. Added edge cases for Readwise and bm CLI unavailability.

## [0.18.0][] - 2026-03-30

### Added

- **Readwise as enrichment source** — `package-intel` gains Readwise as a 6th
  source (now six-source enrichment); `tool-intel` gains it as a 5th source
  (now five-source enrichment). Both use `readwise_search_highlights` and
  `reader_search_documents` to surface the user's curated reading highlights —
  expert-selected passages with high signal-to-noise ratio.
- **Post-write cross-linking** (Step 7) — both `package-intel` and `tool-intel`
  now search Basic Memory for existing notes that reference the newly written
  package/tool and add bidirectional `relates_to` wiki-links via `edit_note`.
  Turns one-way references into connected graph edges.
- **Raindrop content fetching** — both intel skills now use
  `fetch_bookmark_content` on the top 2-3 most relevant Raindrop bookmarks,
  extracting full article content instead of just titles and tags.
- **Multi-query research guidance** — `package-intel` Step 3 now advises
  asking 2-3 targeted questions per source (API design, gotchas, configuration)
  rather than one broad query.
- **Concept-level gap detection** — `knowledge-gaps` gains Steps 14-15 that
  detect hub topics referenced by 3+ notes but with no dedicated concept note
  (structural gap), and topics with 3+ Readwise highlights but no BM note
  (interest gap). Combined signals are flagged as highest priority.
- **Cross-linking convention** added to CLAUDE.md under Conventions.
- **Readwise** added to MCP Tool Dependencies table in CLAUDE.md.

### Changed

- **knowledge-maintainer** orphan linking enhanced to create bidirectional
  graph edges — when linking an orphan, also adds `relates_to` links FROM
  existing notes that reference the orphan back TO it.
- **`validate-plugin.mjs`** now recognizes `mcp__readwise__` as a known MCP
  prefix.

## [0.17.1][] - 2026-03-30

### Fixed

- **REGRESSION: PreToolUse hook blocked all sessions** — the hook blocking
  script runtimes in Bash was project-global, affecting the main session and
  all agents. Now scoped to the knowledge-gardener agent only via the
  `agent_type` field in the hook input JSON. Main session and all other agents
  are completely unaffected.

## [0.17.0][] - 2026-03-29

### Added

- **Knowledge-gardener audit improvements** — Step 0.5 (`bm project info main
  --json`) for aggregate graph stats snapshot that gates Step 3 orphan
  detection. Step 4c for wiki-link-in-observations detection via
  `search_notes(entity_types=["observation"])` per ecosystem prefix. Step 7
  probe+scan split for scope-leak detection.
- **`scripts/audit-scope-leak.sh`** — CLI-first audit script for regex-based
  detection of project-specific content in cross-project BM notes. Three
  passes: relative paths, absolute paths, project-specific env vars.
- **Knowledge-maintainer Step 2d** — wiki-link-in-observations detection and
  auto-fix (strip `[[...]]` from observations, add to Relations).
- **`scripts/check-hooks.mjs`** — 16 integration tests verifying every hook
  emits exactly ONE valid JSON object on stdout. Catches the multi-object bug
  class that went undetected for 3 releases.
- **`validate-plugin.mjs` prompt-hook warning** — warns when hooks use
  `type: "prompt"` (silently non-functional for MCP calls per RETRO-02).

### Changed

- **Gardener Step 8a** extended to accumulate observation counts alongside
  tags (zero extra MCP cost). Step 9b uses accumulated counts.
- **CLAUDE.md** — added Scripts section documenting CLI-first audit utilities.
- **`check:sh`** extended to cover `scripts/*.sh`.

### Fixed

- **Gardener Step 0.5** — corrected to `bm project info main --json` (requires
  project name argument).
- **`audit-scope-leak.sh`** — replaced `eval echo` with safe tilde expansion,
  fixed IFS colon split, added jq dependency check, added missing `[[cask:`
  prefix to wiki-link detection.

## [0.16.1][] - 2026-03-28

### Fixed

- **session-start.sh multi-object stdout** — the hook emitted 2-3 separate
  JSON objects but Claude Code reads only the first. The `additionalContext`
  (priming suggestion) and audit reminder have been silently dropped since
  v0.15.0. Now merges all content into a single `additionalContext` field
  using `jq -n`.
- **JSON fallback chain in post-bm-failure-classify.sh** — dropped `.tool_result`
  from error extraction (captures MCP response body, not error text).
- **knowledge-gaps Step 5 forward-reference** — tool-intel enrichment offers
  referenced Steps 6-9 output before those steps ran. Moved tool offers to
  Step 9 where the data is available.
- **knowledge-gaps Domain column** — removed from Step 4 template (no data
  provider existed).
- **knowledge-primer agent drift** — synced with knowledge-prime skill: added
  `--deep` flag, edge cases, Step 7 (suggest next steps), clarified
  `recent_activity` fetch timing.

### Changed

- **knowledge-gaps Steps 11-13 extracted** to `references/standard-detection.md`
  for structural consistency with package-intel and tool-intel reference
  patterns.
- **CLAUDE.md hook conventions** — documented single-JSON-object stdout rule,
  CWD assumption (project root), and PreCompact as intentional exception to
  the skill-reference pattern.

### Removed

- **Phantom `Glob` from tool-intel** — was `list_directory`'s `file_name_glob`
  parameter, not the Claude `Glob` tool.

## [0.16.0][] - 2026-03-28

### Changed

- **PostToolUse validation hook converted from prompt to command** — prompt hooks
  spawn Haiku without MCP access, making the `schema_validate` call silently
  non-functional since creation (same bug class as PreCompact v0.1–v0.10,
  documented in RETRO-02). Now emits `additionalContext` so the main session
  calls `schema_validate` with full MCP access.
- **PostToolUseFailure hook converted from prompt to command** — pattern-matches
  BM tool errors into five categories (server-unavailable, note-not-found,
  invalid-argument, permission-error, unknown) and emits `additionalContext`
  with recovery guidance. Eliminates misleading "hook stopped continuation"
  framework labels.
- **Wiki-link-in-observations warning** added to all 11 note templates and both
  research skill SKILL.md files. BM's parser treats `[[` as a relation boundary
  — text before it becomes `relation_type` (max 200 chars), causing validation
  failures.
- **tool-intel description** — added missing trigger phrases for cask, docker,
  and vscode query patterns.
- **knowledge-prime Step 3** — removed git/Bash dependency (Bash not in
  allowed-tools); now uses `recent_activity` for the boost pass.
- **CLAUDE.md hook conventions** — updated to reflect command-only hook pattern
  and document prompt hook MCP limitation.

### Removed

- **`list_directory` from schema-evolve allowed-tools** — phantom tool, never
  called in the workflow.

## [0.15.0][] - 2026-03-15

### Added

- **`/knowledge-prime` skill** — on-demand project context priming from Basic
  Memory. Detects the project stack (package.json, Cargo.toml, Brewfile, etc.),
  cross-references dependencies against BM notes, scores relevance using a
  three-pass algorithm (dep match → graph expansion → beads/git boost), loads
  critical observations (`[gotcha]`, `[breaking]`, `[limitation]`), and produces
  a concise context brief. Supports `--deep` flag for extended output (2000-token
  budget, top 12 notes, additional observation categories).
- **`knowledge-primer` agent** — autonomous read-only agent for project context
  priming. Same workflow as the skill but runs as a subagent. Pinned to `sonnet`
  (read-only, matches gardener). The "before work" counterpart to
  `session-reflector` (which captures knowledge "after work").
- **Tag alignment in `knowledge-gardener`** (Step 0 + Step 8) — loads the Tag
  Vocabulary Standard at audit start, then audits tags across all note types:
  non-canonical form detection, retired tag detection, missing required per-type
  ecosystem tags, out-of-vocabulary tags, and tag count checks (3–7 range).
- **Tag auto-fix in `knowledge-maintainer`** (Step 2b) — three auto-fix
  sub-steps: normalize canonical forms (deterministic 1:1 renames), remove
  type-echo and retired tags, add missing required ecosystem tags. All
  deterministic and low-risk — applied without confirmation.
- **SessionStart hook enhanced** — now emits `additionalContext` suggesting
  `/knowledge-prime` for project context priming when the task involves
  dependencies or tools. Also suggests `/knowledge-gaps` and `/schema-evolve`
  for deeper analysis.

### Changed

- **CLAUDE.md documentation refresh** — skills count from 4 to 5, agents count
  from 3 to 4, plugin layout diagram updated, new component descriptions added
  for knowledge-prime and knowledge-primer.
- **`plugin.json` description** — now mentions project context priming and tag
  alignment.
- **`marketplace.json` description** — now mentions project context priming.

## [0.14.1][] - 2026-03-15

### Changed

- **`concept` schema evolved** — added `principle`, `opportunity` (observations)
  and `enables`, `implements`, `depends_on` (relations) based on 33% usage
  across 6 notes. Removed unused `relates_to` and `complements` (0% usage).
- **`milestone` schema pruned** — removed 3 dead fields at 0% usage: `failure`,
  `anti-pattern`, `proven`.

## [0.14.0][] - 2026-03-15

### Changed

- **CI workflow** — added `permissions: contents: read` (principle of least
  privilege) and bumped `actions/checkout` v4 → v5. Aligns with vp-beads
  v0.6.2 CI patterns.
- **PostToolUseFailure matcher expanded** — now covers `schema_validate`,
  `schema_diff`, and `schema_infer` in addition to `write_note`/`edit_note`.
  Schema tools can fail during trend-review sprints and benefit from the same
  five-category error classification and recovery guidance.
- **Script naming: `check:shell` → `check:sh`** — standardizes npm script
  name to match vp-beads convention.

## [0.13.1][] - 2026-03-15

### Fixed

- **`schema-evolve` skill reviewer fixes** — clarified "No schema found" edge
  case (directs to `/package-intel` or `/memory-schema` instead of ambiguous
  "suggest seeding"), added pre-existing divergence edge case (compare BM and
  local before evolving), replaced "revert and retry" with explicit error
  reporting strategy, added trigger phrases (`check schema`, `schema audit`,
  `schema changes`).
- **knowledge-gardener** — added `Glob` to tools list (step 4b needs it for
  `UPSTREAM-*.md` file detection).
- **knowledge-maintainer** — removed `\[config\]`→`\[config\]` no-op row from
  observation normalization table.
- **`post-file-edit.sh`** — added early exit guard with comment when
  `PLUGIN_ROOT` is unset, removed redundant inline guards.
- **CI workflow** — added `shfmt` installation step (`shellcheck` is
  pre-installed on ubuntu-latest but `shfmt` is not). Mirrors vp-beads CI.

### Changed

- **`plugin.json` description** — now mentions schema evolution.
- **vp-beads marketplace** — bumped to v0.6.2.
- **Adopted vp-beads v0.6.0 patterns:**
  - Annotation-not-deletion for resolved observations in knowledge-maintainer
  - Optional structured metadata on observations (`Ownership:`, `Since:`)
  - Cross-plugin friction awareness in knowledge-gardener step 4b

## [0.13.0][] - 2026-03-15

### Added

- **`/schema-evolve <type>` skill** — frequency-driven schema drift detection
  and evolution. Runs `schema_diff` + `schema_infer`, proposes field additions
  (>25% usage), removals (0% usage), and cardinality fixes. Dual-syncs both
  the BM schema note and local `schemas/` file after approval. Includes a
  watch list (10-24% usage) for emerging fields.
- **PostToolUse `Edit|Write` hook** — combined `command` hook that auto-formats
  shell scripts with `shfmt -w` after edits to `hooks/*.sh`, and emits a
  `systemMessage` reminder to sync BM when editing `schemas/*.md` files.
  Silently skips if `shfmt` is not installed.
- **Observation category normalization in knowledge-maintainer** (step 2a) —
  two-tier mapping: deterministic auto-fixes for unambiguous tag renames
  (`[install]`→`[usage]`, `[mechanism]`→`[purpose]`, etc.) and confirmation-
  gated mapping for ambiguous tags. Schema-type-aware — checks the note's
  schema before mapping to avoid false corrections.

### Changed

- **CLAUDE.md documentation refresh** — hooks count corrected from 3 to 5
  (adds PostToolUseFailure and Edit/Write hooks), skills count from 3 to 4,
  plugin layout diagram updated.

## [0.12.1][] - 2026-03-15

### Changed

- **Schema evolution — 3 schemas updated based on drift analysis:**
  - `github_action`: added `version?(array)` (89% usage) and `usage?(array)`
    (78% usage) — both were widely used but not in the schema
  - `npm_package`: added `security?(array)` (25% usage) and synced
    `api?(array)` from BM — aligns schema with how package-intel actually
    writes notes
  - `standard`: added `trend?(array)` (38%), `pattern?(array)` (25%),
    `complements?` (25%), and `lesson_for?` (25%) — all emerged organically
    in IndieWeb standard notes

## [0.12.0][] - 2026-03-14

### Added

- **5 new knowledge schemas** — `standard`, `concept`, `milestone`, `service`,
  `person` types for documenting protocols, movements, historical events,
  products, and key figures. Each schema added to `schemas/` and synced to BM.
- **Domain standard detection in `/knowledge-gaps`** (Steps 11–13) — searches
  BM for `type: standard` notes, greps the codebase for mentions, classifies
  by reference count (key/referenced/undocumented), and appends a Domain
  Standard Coverage section to the gap report. Skips ubiquitous standards
  (HTTP, HTML, JSON, etc.).
- **Schema validation for new types in agents** — `knowledge-gardener` and
  `knowledge-maintainer` now run `schema_validate`, `schema_infer`, and
  `schema_diff` for the 5 new types.
- **CLAUDE.md updated** — schema count from twelve to seventeen, new types
  listed under Knowledge types.

### Fixed

- **Schema quality issues across all 5 new schemas:**
  - Converted multi-value observation fields to arrays (`limitation`,
    `innovation`, `design`, `pattern`, `trend`, `gap`, `risk`, `lesson`,
    `failure`, `anti-pattern`, `precedent`, `insight`)
  - `milestone`: renamed `validation` → `proven` (collided with
    `settings.validation`); dropped `cautionary` and `competitive-gap`
    (12→10 observation fields)
  - `concept`: removed domain-specific fields `ux`, `accessibility`,
    `display_for`
  - `person`: `source` now required (matches other 4 schemas)
- **`UPSTREAM-claude-code.md`** — escaped `[degraded]` bracket to fix
  pre-existing remark warning.

## [0.11.0][] - 2026-03-14

### Added

- **PostToolUseFailure hook** — classifies Basic Memory write/edit failures
  into five categories (server unavailable, invalid argument, note not found,
  permission error, unknown) and surfaces actionable recovery guidance as a
  systemMessage. Short timeout (10s) — classification only, no retry.
- **Validator: agent color and model checks** — validates against the allowed
  sets (`blue`/`cyan`/`green`/`yellow`/`magenta`/`red` for colors;
  `inherit`/`sonnet`/`opus`/`haiku` for models).
- **Validator: tool-reference audit** — cross-checks `mcp__*__*` patterns in
  skill/agent prose against their declared `allowed-tools`/`tools` frontmatter,
  catching references that would be silently blocked at runtime.
- **Validator: expanded hook type allowlist** — now accepts `agent` and `http`
  in addition to `prompt` and `command` (future-proofing).

### Changed

- **PreCompact hook converted from prompt to command** — the previous
  `type: "prompt"` hook was non-conforming (PreCompact only supports command
  hooks per official docs) and prompt hooks spawn a separate Haiku instance
  with no MCP tool access, making the reflection instructions unreachable.
  Now emits `additionalContext` JSON via a shell script, injecting reflection
  instructions into the main Claude session which has full MCP access.
  Timeout drops from 30s to 5s (static JSON output).

### Fixed

- **`session-reflector` color** — `purple` → `magenta` (purple not in the
  valid agent color set).
- **CLAUDE.md agent count** — "Agents (2)" → "Agents (3)", wrong since
  session-reflector was added in v0.3.0.
- **Removed duplicate `note-template.md`** — identical to
  `note-template-npm.md` and unreferenced by any skill.
- **Cross-reference comments** added between `package-intel` and `tool-intel`
  at Steps 1 and 5 (shared existence-check and write/update patterns).

## [0.10.1][] - 2026-03-14

### Changed

- **`knowledge-gardener` model set to `sonnet`** — read-only agent with high
  tool volume (50-100+ calls) now pinned to sonnet for consistent audit quality
  regardless of session model. Zero write risk makes this safe — worst case is a
  less thorough report, never data corruption. Matches the pattern used by
  official Claude Code plugins (`code-explorer`, `code-architect`). The other
  two agents (`knowledge-maintainer`, `session-reflector`) remain at `inherit`.

## [0.10.0][] - 2026-03-13

### Added

- **SessionStart: cycle-aware graph-audit reminder** — `hooks/session-start.sh`
  now counts `RETRO-*.md` files and emits an additional `systemMessage` on
  every 4th sprint: an advance warning on sprint mod=3, an active reminder on
  sprint mod=0. Silent in all other sprints. Mirrors vp-beads' trend-review
  cycling pattern, adapted for graph health (knowledge-gardener) instead of
  sprint workflow.
- **`## Releasing` section in `CLAUDE.md`** — documents the version bump
  checklist (`plugin.json`, `CHANGELOG.md`, `marketplace.json`) and cache-lag
  note for plugin consumers. Mirrors vp-beads' CLAUDE.md release section.
- **`## Edge Cases` section in `knowledge-gaps`** — defensive handling for
  missing manifests, empty Brewfiles, workflow files with no `uses:` lines,
  and missing BM ecosystem directories. Mirrors vp-beads' sprint-review edge
  case documentation pattern.

## [0.9.0][] - 2026-03-13

### Added

- **`read_note` guard before missing-sections append in `knowledge-maintainer`**
  — the "Missing sections" fix example previously omitted the required
  `read_note` step, risking blind append of duplicate section headers.
  Now explicitly reads first, appends only what's confirmed absent.
- **`build_context` activated in `session-reflector` Step 2** — after
  `search_notes` identifies candidate notes, the agent now traverses each
  candidate's immediate graph neighborhood (`depth=1`) before committing,
  surfacing better targets and preventing duplicate observations.
- **Graph curation step in `tool-intel` Step 4** — mirrors the curation
  pattern already present in `package-intel`: check how the tool is
  referenced in the knowledge graph before writing, to populate `## Relations`
  back-links and avoid duplicating linked-note observations.
- **Step 10 "Detect dead wiki-links" in `knowledge-gaps`** — searches
  existing notes for `[[prefix:name]]` wiki-links that point to non-existent
  notes, cross-references against `list_directory` results already collected,
  and adds a "Referenced but not documented" section to the gap report.
  Uses `search_type="text"` (exact match) for structural `[[` syntax.

## [0.8.0][] - 2026-03-13

### Added

- **"Relationship to vp-beads" section in CLAUDE.md** — documents how
  `/package-intel` and `/tool-intel` output feeds vp-beads' upstream-tracker
  and the session-reflector ↔ retrospective mental model. Mirrors the
  reciprocal section already present in vp-beads' CLAUDE.md.
- **vp-beads integration section in `session-reflector` agent** — guidance
  for beads projects: log upstream friction via `/upstream-tracker` when
  discovered during research; use session-reflector for in-sprint capture and
  vp-beads `/retrospective` for end-of-sprint synthesis.
- **`shfmt -d` added to `check:shell`** — shell scripts now validated for
  both linting (`shellcheck`) and formatting (`shfmt -d`), matching vp-beads'
  shell validation pattern. Requires `brew install shfmt`.

## [0.7.1][] - 2026-03-13

### Fixed

- **`security?(array)` missing from `github_action` and `docker_image` schemas** — `tool-intel` writes `[security]` observations (CVEs, supply-chain advisories) for action and docker notes, but neither schema defined the field. PostToolUse validation hook fired spurious unknown-field warnings on every such note. Field added to both schemas (+ BM mirrors) with a convention observation distinguishing `security` (advisory/CVE info) from `gotcha` (usage pitfalls).
- **`schema_diff` absent from `knowledge-gardener` tools list** — Added in `knowledge-maintainer` but never mirrored to the read-only gardener. Added `mcp__basic-memory__schema_diff` to the tools list and a `schema_diff` block in Audit Check 2 (5 types: `npm_package`, `crate_package`, `brew_formula`, `brew_cask`, `engineering`) with guidance to report drift findings without treating them as validation failures.
- **`brew_formula` missing from `schema_infer` in `knowledge-gardener`** — Only `npm_package`, `crate_package`, and `engineering` were listed; `brew_formula` was absent despite being a high-volume type. Added.
- **"Three enrichment layers" counted incorrectly** — `tool-intel` SKILL.md and CLAUDE.md said "three enrichment layers" but listed four items (frontmatter, type-specific section, Observations, Relations). Restructured as "three core layers + one type-specific section" to match package-intel's actual three-layer model.

## [0.7.0][] - 2026-03-12

### Added

- **`schemas/` directory** — version-controlled source of truth for all 12 Basic Memory note schemas, mirroring schema notes in BM. Enables first-install seeding and keeps plugin repo + BM in sync.
  - **Package schemas (6):** `npm_package`, `crate_package`, `go_module`, `composer_package`, `pypi_package`, `ruby_gem`
  - **Tool schemas (5):** `brew_formula`, `brew_cask`, `github_action`, `docker_image`, `vscode_extension`
  - **Knowledge schemas (1):** `engineering`

### Fixed

- **`brew_cask` schema missing three fields** — `perf?(array)`, `relates_to?(array)`, and `depends_on?(array)` were absent from the schema but used in notes. Discovered via `schema_diff`; all three added to both the BM note and `schemas/brew_cask.md`.
- **PostToolUse hook false positives** — The schema validation hook was firing on schema definition notes themselves (notes in the `schema/` directory), producing spurious validation errors since schema notes aren't package/tool notes. Hook prompt now short-circuits when the permalink contains `/schema/`.

## [0.6.0][] - 2026-03-12

### Added

- **`/tool-intel <prefix>:<name>` skill** — four-source research pipeline for developer environment and CI/CD tooling. Supports five tool types:
  - `brew:<name>` — Homebrew formulae (formulae.brew.sh API)
  - `cask:<name>` — Homebrew casks (formulae.brew.sh/cask API)
  - `action:<owner>/<repo>` — GitHub Actions (tavily_extract on action.yml + README)
  - `docker:<image>` — Docker Hub images (hub.docker.com API; official and community images)
  - `vscode:<publisher>.<ext>` — VSCode extensions (Open VSX API, VS Marketplace fallback)
- **`skills/tool-intel/references/` — ecosystem guides** — five reference files (`ecosystem-brew.md`, `ecosystem-cask.md`, `ecosystem-action.md`, `ecosystem-docker.md`, `ecosystem-vscode.md`) covering registry APIs, field docs, and security notes for each tool type
- **`skills/tool-intel/references/` — note templates** — five templates (`note-template-brew.md`, `note-template-cask.md`, `note-template-action.md`, `note-template-docker.md`, `note-template-vscode.md`) with type-specific content sections (`## Common Usage` for brew/cask, `## Inputs & Outputs` + `## Permissions` for actions, `## Tags` + `## Base Layers` for Docker, `## Features` + `## Configuration` for VSCode)
- **`/knowledge-gaps` extended with Steps 6–9** — detects and parses `Brewfile`, `.github/workflows/*.yml`, `Dockerfile`/`*.dockerfile`, `.vscode/extensions.json`; cross-references against Basic Memory `brew/`, `casks/`, `actions/`, `docker/`, `vscode/` directories; adds a tool coverage section to the gap report with `/tool-intel` enrichment offers
- **Five new tool note types in PostToolUse hook** — `brew_formula`, `brew_cask`, `github_action`, `docker_image`, `vscode_extension` validated after writes
- **`knowledge-gardener`** — inventory, schema validation, and relation integrity extended for all five tool directories and types
- **`knowledge-maintainer`** — assessment and enrichment step extended; auto-detects tool manifests and invokes `/tool-intel` for undocumented tools alongside existing `/package-intel` for packages
- **SessionStart hook** — now mentions `/tool-intel` and lists all five tool prefixes

## [0.5.0][] - 2026-03-12

### Added

- **Multi-ecosystem support for `/package-intel`** — extended from npm-only to six ecosystems: npm, Rust crates, Go modules, PHP Composer, Python PyPI, Ruby gems. Each ecosystem has a dedicated reference file (`ecosystem-crates.md`, `ecosystem-go.md`, etc.) and note template (`note-template-crates.md`, etc.) under `skills/package-intel/references/`.
- **`/knowledge-gaps` extended to all six ecosystems** — scans `Cargo.toml`, `go.mod`, `composer.json`, `pyproject.toml`/`requirements.txt`, and `Gemfile` in addition to `package.json`. Import frequency tiering adapted per language (e.g. `use <crate>::` for Rust, `"<module/path>"` for Go).
- **Ecosystem-prefixed invocations** — `/package-intel crate:serde`, `/package-intel pypi:requests`, etc. No-prefix still defaults to npm.
- **RUSTSEC / PyPA / RubySec advisory search** — Tavily security query adapted per ecosystem advisory format.
- **PostToolUse hook extended** — added type checks for `crate_package`, `go_module`, `composer_package`, `pypi_package`, `ruby_gem` alongside the existing `npm_package` check.
- **`knowledge-gardener` extended** — inventory, schema validation, and relation integrity checks added for `crates/`, `go/`, `composer/`, `pypi/`, `gems/` directories and their corresponding note types.
- **`knowledge-maintainer` extended** — schema assessment and enrichment steps updated for all six package ecosystems; offers `/package-intel crate:*`, `pypi:*`, etc. for Tier 1 gaps.
- **`Glob` re-added to `knowledge-gaps`** — removed in 0.2.0 (was unused); re-added in 0.5.0 for multi-ecosystem manifest detection (`Cargo.toml`, `go.mod`, etc.).
- **SessionStart hook updated** — lists multi-ecosystem prefixes (`crate:`, `pypi:`, `go:`, `composer:`, `gem:`) in the session context message.

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

[0.33.1]: https://github.com/voxpelli/vp-claude/compare/v0.33.0...v0.33.1
[0.33.0]: https://github.com/voxpelli/vp-claude/compare/v0.32.5...v0.33.0
[0.32.5]: https://github.com/voxpelli/vp-claude/compare/v0.32.4...v0.32.5
[0.32.4]: https://github.com/voxpelli/vp-claude/compare/v0.32.3...v0.32.4
[0.32.3]: https://github.com/voxpelli/vp-claude/compare/v0.32.2...v0.32.3
[0.32.2]: https://github.com/voxpelli/vp-claude/compare/v0.32.1...v0.32.2
[0.32.1]: https://github.com/voxpelli/vp-claude/compare/v0.32.0...v0.32.1
[0.32.0]: https://github.com/voxpelli/vp-claude/compare/v0.31.12...v0.32.0
[0.31.12]: https://github.com/voxpelli/vp-claude/compare/v0.31.11...v0.31.12
[0.31.11]: https://github.com/voxpelli/vp-claude/compare/v0.31.10...v0.31.11
[0.31.10]: https://github.com/voxpelli/vp-claude/compare/v0.31.9...v0.31.10
[0.31.9]: https://github.com/voxpelli/vp-claude/compare/v0.31.8...v0.31.9
[0.31.8]: https://github.com/voxpelli/vp-claude/compare/v0.31.7...v0.31.8
[0.31.7]: https://github.com/voxpelli/vp-claude/compare/v0.31.6...v0.31.7
[0.31.6]: https://github.com/voxpelli/vp-claude/compare/v0.31.5...v0.31.6
[0.31.5]: https://github.com/voxpelli/vp-claude/compare/v0.31.4...v0.31.5
[0.31.4]: https://github.com/voxpelli/vp-claude/compare/v0.31.3...v0.31.4
[0.31.3]: https://github.com/voxpelli/vp-claude/compare/v0.31.2...v0.31.3
[0.31.2]: https://github.com/voxpelli/vp-claude/compare/v0.31.1...v0.31.2
[0.31.1]: https://github.com/voxpelli/vp-claude/compare/v0.31.0...v0.31.1
[0.31.0]: https://github.com/voxpelli/vp-claude/compare/v0.30.1...v0.31.0
[0.30.1]: https://github.com/voxpelli/vp-claude/compare/v0.30.0...v0.30.1
[0.30.0]: https://github.com/voxpelli/vp-claude/compare/v0.29.4...v0.30.0
[0.29.4]: https://github.com/voxpelli/vp-claude/compare/v0.29.3...v0.29.4
[0.29.3]: https://github.com/voxpelli/vp-claude/compare/v0.29.2...v0.29.3
[0.29.2]: https://github.com/voxpelli/vp-claude/compare/v0.29.1...v0.29.2
[0.29.1]: https://github.com/voxpelli/vp-claude/compare/v0.29.0...v0.29.1
[0.29.0]: https://github.com/voxpelli/vp-claude/compare/v0.28.0...v0.29.0
[0.28.0]: https://github.com/voxpelli/vp-claude/compare/v0.27.1...v0.28.0
[0.27.1]: https://github.com/voxpelli/vp-claude/compare/v0.27.0...v0.27.1
[0.27.0]: https://github.com/voxpelli/vp-claude/compare/v0.26.1...v0.27.0
[0.26.1]: https://github.com/voxpelli/vp-claude/compare/v0.26.0...v0.26.1
[0.26.0]: https://github.com/voxpelli/vp-claude/compare/v0.25.1...v0.26.0
[0.25.1]: https://github.com/voxpelli/vp-claude/compare/v0.25.0...v0.25.1
[0.25.0]: https://github.com/voxpelli/vp-claude/compare/v0.24.1...v0.25.0
[0.24.1]: https://github.com/voxpelli/vp-claude/compare/v0.24.0...v0.24.1
[0.24.0]: https://github.com/voxpelli/vp-claude/compare/v0.23.0...v0.24.0
[0.23.0]: https://github.com/voxpelli/vp-claude/compare/v0.22.1...v0.23.0
[0.22.1]: https://github.com/voxpelli/vp-claude/compare/v0.22.0...v0.22.1
[0.22.0]: https://github.com/voxpelli/vp-claude/compare/v0.21.1...v0.22.0
[0.21.1]: https://github.com/voxpelli/vp-claude/compare/v0.21.0...v0.21.1
[0.21.0]: https://github.com/voxpelli/vp-claude/compare/v0.20.0...v0.21.0
[0.20.0]: https://github.com/voxpelli/vp-claude/compare/v0.19.0...v0.20.0
[0.19.0]: https://github.com/voxpelli/vp-claude/compare/v0.18.3...v0.19.0
[0.18.3]: https://github.com/voxpelli/vp-claude/compare/v0.18.2...v0.18.3
[0.18.2]: https://github.com/voxpelli/vp-claude/compare/v0.18.1...v0.18.2
[0.18.1]: https://github.com/voxpelli/vp-claude/compare/v0.18.0...v0.18.1
[0.18.0]: https://github.com/voxpelli/vp-claude/compare/v0.17.1...v0.18.0
[0.17.1]: https://github.com/voxpelli/vp-claude/compare/v0.17.0...v0.17.1
[0.17.0]: https://github.com/voxpelli/vp-claude/compare/v0.16.1...v0.17.0
[0.16.1]: https://github.com/voxpelli/vp-claude/compare/v0.16.0...v0.16.1
[0.16.0]: https://github.com/voxpelli/vp-claude/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/voxpelli/vp-claude/compare/v0.14.1...v0.15.0
[0.14.1]: https://github.com/voxpelli/vp-claude/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/voxpelli/vp-claude/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/voxpelli/vp-claude/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/voxpelli/vp-claude/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/voxpelli/vp-claude/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/voxpelli/vp-claude/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/voxpelli/vp-claude/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/voxpelli/vp-claude/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/voxpelli/vp-claude/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/voxpelli/vp-claude/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/voxpelli/vp-claude/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/voxpelli/vp-claude/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/voxpelli/vp-claude/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/voxpelli/vp-claude/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/voxpelli/vp-claude/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/voxpelli/vp-claude/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/voxpelli/vp-claude/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/voxpelli/vp-claude/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/voxpelli/vp-claude/releases/tag/v0.1.0
