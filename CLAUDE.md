# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on
confirmation prompts. `cp`, `mv`, and `rm` may be aliased to `-i` (interactive)
mode, which hangs an agent indefinitely waiting for y/n input.

```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

Others that may prompt: `scp` and `ssh` (use `-o BatchMode=yes`), `apt-get`
(use `-y`), `brew` (use `HOMEBREW_NO_AUTO_UPDATE=1`).

## Task Tracking

**`bd` (beads) is this repo's tracker and `bd ready` is the work queue** — use
it rather than TodoWrite/TaskCreate or markdown TODO lists. Four things about
it here are not obvious:

- **bd's git-hook integration was removed deliberately** (2026-07-29):
  `core.hooksPath` no longer points at `.beads/hooks`. Those shims ran
  `bd hooks run <name>` on a 300 s timeout and **exited non-zero on a bd panic,
  aborting the commit or push**, while the JSONL auto-export they existed to
  drive had been broken since 2026-05-29. Do not re-arm it. Nothing syncs the
  store on a git operation now — export by hand.
- **`.beads/` is gitignored — the issue history is NOT in this repo.** A fresh
  clone carries no backlog. Treat the local Dolt database as a working copy,
  never as the record of truth. A committed snapshot lives at
  `docs/design/bd-export-2026-07-29.jsonl` (360 issues + 7 memories); refresh it
  with `bd export --include-memories -o docs/design/bd-export-<date>.jsonl`.
- **bd's write path is unreliable here.** The Dolt `invalid hash length: 19`
  panic recurred 2026-07-28, *after* the 1.1.2 upgrade meant to fix it. Reads
  survive panics that kill writes, so the store looks healthy while diverging.
  **Verify every `bd create` / `bd close` with `bd show <id>`** — see
  [bd CLI quirks](#bd-cli-quirks).
- **Migration to `diarie` is blocked**, not merely unscheduled. Published
  `diarie@0.2.2` reads acceptance criteria only from a `## Acceptance Criteria`
  heading, but this repo's bd records carry `acceptance_criteria` as a
  standalone field — so `diarie migrate` today silently drops it, exits 0, and
  passes `diarie validate`. The gate is a published diarie release with that fix.

**`ROADMAP.md` is the committed counterpart.** Because `.beads/` is gitignored
and bd's write path is unreliable, deferred work that must survive a session is
recorded in [ROADMAP.md](ROADMAP.md) with its revival trigger. Read it alongside
`bd ready`; a clone carries the roadmap and not the backlog.

**Pushing is human-gated.** An earlier machine-generated block in this repo
mandated `git push` at session end; it was removed on purpose. Commit freely,
push only when asked.

**MEMORY.md:** the same removed block said not to use it. This file is the
authority — where [Releasing](#releasing) asks for a MEMORY.md update, do it.

### bd CLI quirks

- `bd create` (not `bd add`) — the `Did you mean ado?` typo suggestion is misleading
- `bd create --type=bug` requires `## Steps to Reproduce` AND `## Acceptance Criteria` sections in the description
- `bd create --type=task` requires `## Acceptance Criteria` — title-case "Criteria" only (lowercase rejected)
- `bd close <id>` requires `-r "<summary>"` — non-empty reason is mandatory
- `bd list` hides lower-priority issues by default — a fresh P3/P4 create is invisible in the default view; verify with `bd list -p <N>`
- `bd close` success can silently revert when `.beads/` is gitignored — verify every close with `bd show <id>` (upstream: vp-claude-syw)

## What This Is

See [VISION.md](VISION.md) for why this plugin exists and what it refuses to do,
and [ROADMAP.md](ROADMAP.md) for deferred work and the trigger that revives each
item.


A Claude Code plugin (`vp-knowledge`) containing user-owned skills, agents, and hooks that build on [Basic Memory](https://github.com/basicmachines-co/basic-memory) (running as an MCP server). These complement the upstream `basicmachines-co/basic-memory-skills` (which provides core `memory-*` skills) with higher-level workflows for package and developer-tool research, knowledge graph maintenance, and automated quality checks.

## Plugin Layout

```
.claude-plugin/
  plugin.json                        # Plugin manifest
skills/
  intel/SKILL.md                     # Merged package+tool research (shared-core, two families); /intel <prefix>:<name>
    references/                      # 37 files: 14 ecosystem + 13 note templates + gh-api-fallback + forge-fallback + upgrade-haul + upgrade-haul-adapter-tool + 2 enrichment (package/tool) + 4 shared lifecycle
  knowledge-gaps/SKILL.md            # Cross-reference deps + tool manifests vs BM coverage; --stale for version drift (brew/npm/cask/crate/vscode/plugin); --global for installed plugin/skill coverage
    references/                      # 4 files: standard-detection, concept-detection, staleness-detection, report-templates
  knowledge-prime/SKILL.md           # On-demand project context priming from BM
  schema-evolve/SKILL.md             # Frequency-driven schema drift detection and dual-sync
  session-reflect/SKILL.md           # On-demand conversation → memory capture
  knowledge-ask/SKILL.md             # Freeform Q&A against the BM knowledge graph
  knowledge-garden/SKILL.md          # Scoped note audit inline; delegates graph-wide to gardener agent
  knowledge-maintain/SKILL.md        # Scoped note fixes inline; delegates heavy remediation to maintainer agent
  vp-note-quality/SKILL.md           # Fourth-wall anti-pattern checklist (not user-invocable)
  tag-sync/SKILL.md                  # Raindrop tag vocabulary sync
  session-bookmarks/SKILL.md         # Session URL bookmarking to Raindrop
  raindrop-triage/SKILL.md           # Interactive unsorted bookmark triage
    references/                      # 2 files: tag-selection, promote-workflow
  people-intel/SKILL.md              # Five-source person research
    references/                      # 2 files: note-template, source-guide
  nudge/SKILL.md                     # Mode-routed adoption nudges: bare /nudge = sync tip cache, /nudge check = adoption scan
    references/                      # 3 files: evidence-detection, adoption-limitations, tip-cache-contract
agents/
  knowledge-gardener.md              # Read-only graph health auditor (incl. tag alignment)
  knowledge-maintainer.md            # All-in-one graph enhancer (writes, incl. tag fixes)
  knowledge-primer.md                # Autonomous project context priming
  raindrop-gardener.md               # Read-only Raindrop tag auditor
  finding-verifier.md                # Read-only adversarial claim verifier (approve/refute findings)
agents-pi/                           # Hand-maintained port of agents/ to pi-subagents frontmatter;
                                     # sync source for the Pi extension, drift-guarded by check:agent-parity
hooks/
  hooks.json                         # PreToolUse, PostToolUse, PostToolUseFailure, SessionStart
schemas/                             # 23 BM note-schema definitions — source of truth (see ## Schemas)
scripts/                             # CLI-first audit + npm-run-check utilities (inventory: .claude/rules/scripts-and-validation.md)
lib/                                 # JS modules imported by check scripts (staleness-contract, version-distance, fourth-wall-rules, release-counts, mdast, installed-plugins, plugin-load-paths, portability-scan, bm-version-extract, analytics-guidance, observation-metadata, schema-vocab, check-harness, cohort-table-contract, bm-search, link-resolution, npm-triage, ndjson, ast-grep-scope, http-json, npm-downloads, upstream-heading-vocab, mcp-naming-guidance)
extensions/                          # Pi coding-agent extension (single-root hybrid): factory, agent-sync, config, MCP mapping
test/                                # node:test suites for extensions/ (run by test:node; also loaded offline by check:pi-load)
sgconfig.yml                         # ast-grep config — auto-discovers .ast-grep/rules/ (see .claude/rules/ast-grep-rules.md)
.ast-grep/
  rules/                              # Bespoke ast-grep lint rules enforcing house JS conventions (scope: lib/ast-grep-scope.mjs)
  rule-tests/                         # ast-grep test fixtures + snapshots proving each rule fires/stays silent correctly
.claude/rules/                       # Path-scoped dev conventions, load on edit of matching files (see ## Detailed conventions)
```

The **plugin content** is pure markdown + JSON — no runtime code, no build step. The repo also ships JS validation tooling (`scripts/`, `lib/`) with a handful of devDependencies that power `npm run check`.

## Components

One-line index. Full per-component detail lives in the path-scoped dev rules
(`.claude/rules/{skill,agent,hook}-development.md`) and loads when you edit that
component type — see [Detailed conventions](#detailed-conventions).

### Skills (14)

- **intel** — merged package + dev-tool research (shared-core, two families): npm/crate/go/composer/pypi/gem OR brew/cask/action/docker/vscode/gh/plugin/skill → BM note. `/intel <prefix>:<name>`
- **knowledge-gaps** — dep + tool-manifest coverage audit; `--stale [brew|npm|cask|crate|vscode|plugin]` for version drift; `--global` for installed plugin/skill coverage. `/knowledge-gaps`
- **knowledge-prime** — on-demand project context brief from BM. `/knowledge-prime`
- **schema-evolve** — schema-drift detection + dual-sync. `/schema-evolve <type>`
- **session-reflect** — conversation → BM capture with preview/approve. `/session-reflect`
- **knowledge-ask** — freeform cited Q&A against the BM graph (read-only). `/knowledge-ask <q>`
- **knowledge-garden** — scoped read-only note audit; graph-wide delegates to gardener. Explicit `/command` only.
- **knowledge-maintain** — scoped note fixes inline; heavy remediation delegates to maintainer. Explicit `/command` only.
- **vp-note-quality** — fourth-wall anti-pattern checklist; not user-invocable (preloaded into agents).
- **tag-sync** — Raindrop tag vocabulary sync to `~/.claude/references/raindrop-tags.md`. `/tag-sync`
- **session-bookmarks** — 1-3 high-signal session URLs → Raindrop AI-bookmarked. `/session-bookmarks`
- **raindrop-triage** — unsorted-bookmark triage + `--promote` classification across the AI-* collections. `/raindrop-triage`
- **people-intel** — five-source person research → BM person note. `/people-intel <name>`
- **nudge** — mode-routed adoption nudges: bare `/nudge` syncs the `claude-code-noteworthy-features` BM note to a local tip cache (filtering adopted features); `/nudge check` scans session transcripts for real feature-use evidence and writes adoption status after approval. `/nudge [check]`

### Agents (5)

- **knowledge-gardener** — read-only graph auditor (10 checks incl. version drift, tag alignment, fourth-wall). Never writes.
- **knowledge-maintainer** — write agent acting on audit findings; confirms content changes; `delete_note`/`write_note` excluded.
- **knowledge-primer** — read-only "before work" BM context briefer.
- **raindrop-gardener** — read-only Raindrop tag auditor.
- **finding-verifier** — read-only adversarial claim verifier; approves/refutes/qualifies findings against primary sources before they are written.

### Hooks (5)

- **PostToolUse** (`write_note`/`edit_note`) — emits a `schema_validate` reminder via `additionalContext`.
- **PostToolUse** (`Edit`/`Write`) — `shfmt` drift detect + auto-fix; schema-sync reminder.
- **PostToolUseFailure** — classifies BM write-tool errors into five recovery categories.
- **SessionStart** — graph guidance + skill suggestions + 4th-sprint audit reminder; on `source=compact` also re-injects condensed graph-recovery context (migrated from a former PostCompact hook — that event can't inject `additionalContext`).
- **PreToolUse** (`Bash`) — blocks Python/Node in the gardener agent (read-only enforcement).

## Schemas

The `schemas/` directory in the plugin root is the version-controlled source of truth for all Basic Memory note schemas. It contains twenty-three files mirroring the schema notes in BM:
<!-- schema-count: 23 — keep in sync with `ls schemas/*.md | wc -l` -->

**Package types:**
- `schemas/npm_package.md` — npm package notes (`npm_package` type)
- `schemas/crate_package.md` — Rust crate notes (`crate_package` type)
- `schemas/go_module.md` — Go module notes (`go_module` type)
- `schemas/composer_package.md` — PHP Composer package notes (`composer_package` type)
- `schemas/pypi_package.md` — Python PyPI package notes (`pypi_package` type)
- `schemas/ruby_gem.md` — Ruby gem notes (`ruby_gem` type)

**Tool types:**
- `schemas/brew_formula.md` — Homebrew formula notes (`brew_formula` type)
- `schemas/brew_cask.md` — Homebrew cask notes (`brew_cask` type)
- `schemas/github_action.md` — GitHub Actions notes (`github_action` type)
- `schemas/docker_image.md` — Docker image notes (`docker_image` type)
- `schemas/vscode_extension.md` — VSCode extension notes (`vscode_extension` type)
- `schemas/gh_extension.md` — GitHub CLI extension notes (`gh_extension` type)
- `schemas/claude_plugin.md` — Claude Code plugin / skills.sh bundle notes (`claude_plugin` type)

**Knowledge types:**
- `schemas/engineering.md` — engineering knowledge notes (`engineering` type)
- `schemas/pattern.md` — cross-domain structural insight notes (`pattern` type)
- `schemas/reference.md` — lookup document notes (`reference` type)
- `schemas/standard.md` — protocol and standard notes (`standard` type)
- `schemas/concept.md` — concept and movement notes (`concept` type)
- `schemas/milestone.md` — milestone and history notes (`milestone` type)
- `schemas/service.md` — service and product notes (`service` type)
- `schemas/person.md` — person notes (`person` type)
- `schemas/project.md` — project notes (`project` type)
- `schemas/git_builtin.md` — git built-in command notes (`git_builtin` type)

**Dual-sync rule:** edit a schema in **both** the BM note (`edit_note`) and `schemas/<type>.md` in the same PR; `/schema-evolve <type>` automates it, and the PostToolUse `Edit|Write` hook reminds you. The full schema lifecycle (first-install seeding, automatic validation, evolution workflow) and the note-output conventions live in `.claude/rules/schema-and-notes.md` (loads when editing `schemas/**`).

## MCP Tool Dependencies

Skills and agents reference tools from multiple MCP servers. When editing, use exact tool names:

| Server | Prefix | Used by |
|--------|--------|---------|
| Basic Memory | `mcp__basic-memory__*` | All components |
| DeepWiki | `mcp__deepwiki__*` | intel, people-intel |
| Context7 | `mcp__plugin_context7_context7__*`, `mcp__claude_ai_Context7__*`, or `mcp__hyper-mcp__context7-*` (prefix varies by install) | intel (package family only) |
| Tavily | `mcp__tavily__*` | intel, people-intel |
| Raindrop | `mcp__raindrop__*` | intel, people-intel, tag-sync, session-bookmarks, raindrop-triage, raindrop-gardener |
| Readwise | `mcp__readwise__*` | intel, people-intel, knowledge-gaps |
| Socket | `mcp__socket-mcp__*` | intel (package family only) |
| Homebrew MCP | `mcp__homebrew__*` | intel (tool family only, optional; brew/cask analytics) |
| Hugging Face | `mcp__huggingface__*` | finding-verifier (ML paper claims only) |

## Validation

`npm run check` — runs `check:plugin` (validate-plugin.mjs, incl. the CLAUDE.md size guard and the offline relation-vocabulary drift cross-check) + `check:lint` (eslint, `@voxpelli/eslint-config`) + `check:tsc` (`tsc --checkJs --allowJs` against JSDoc types; `tsconfig.json` extends `@voxpelli/tsconfig/node22.json`) + `check:type-coverage` (`type-coverage --at-least 99`) + `check:contract` (staleness drift-bucket contract self-test) + `check:md` (remark) + `check:sh` (shellcheck + shfmt) + `check:hooks` (hook integration tests) + `check:distance` (version-distance classifier self-test, incl. a source scan asserting every `return` literal in `classifyVersionDistance` is declared in `VERSION_DISTANCE_CLASSES` — the derived-map form of that check is vacuous and shipped once) + `check:npm-triage` (npm staleness-sweep decision-logic self-test — action classes, name normalization, completeness gate, and the lexicographic ordering key; a `DEFECT:`-prefixed case pins a current wrong answer so a fix has to flip a failing assertion — the five originally pinned are all flipped, the convention stands for the next) + `check:ndjson` (shared NDJSON reader/writer self-test — a truncated line is counted and reported, never thrown on and never dropped; the two drivers used to disagree about that) + `check:npm-downloads` (api.npmjs.org response-interpreter self-test — chunk boundaries, and the UNWRAPPED single-name response shape a 128-remainder chunk gets back, which the bulk path read as a keyed map and filed as `downloads-not-returned` while npm had in fact answered with a number) + `check:http-json` (throttle-aware JSON fetcher self-test — `Retry-After` in both RFC 9110 forms, jittered backoff, attempt counts in the failure reason; the policy it replaces lost 462 of the 512 eligible download counts to HTTP 429 and could only be observed in a live 21-minute run) + `check:mcp-naming-guidance` (drift guard against the retired MCP tool-naming rule — the claim that a Pi direct name replaces the server's hyphens with underscores, which named tools no host registers. Corrected in one place in 0.34.0 and found in three more by review, because the first sweep grepped for an identifier rather than for the rule in prose. Live scan over an explicit file allowlist plus a detector self-test; a historical qualifier within the preceding paragraph exempts a mention, so a design record may quote the retired rule as history) + `check:fourthwall` (fourth-wall rule-registry self-test) + `check:release-counts` (CLAUDE.md/README.md component counts ↔ disk) + `check:agent-parity` (drift guard between the canonical `agents/` set and the hand-maintained `agents-pi/` port, comparing each pi file's `portedFrom` sha256 against the canonical body — mirrors the drift-guard family. Its three early returns each push an error before returning: a missing `agents/`, an unreadable one, and — the vacuous case found 2026-08-27 — an `agents/` holding zero `.md` files, which left the comparison loop with nothing to iterate and reported success without checking anything) + `check:mdast` (mdast prose/fenced split self-test) + `check:installed-plugins` (installed-plugin/skill resolver self-test) + `check:plugin-load-paths` (`${CLAUDE_PLUGIN_ROOT}` cross-load paths in skill prose resolve on disk) + `check:portability` (classifies same-skill/cross-skill/tooling `${CLAUDE_PLUGIN_ROOT}` refs for standalone skills.sh install survivability — warn-only live scan + classifier self-test) + `check:bm-version-extract` (S2 version-extractor self-test) + `check:analytics-guidance` (brew/cask analytics-source doc guidance self-test, guards against the v0.31.5 inverted-claim regression) + `check:obs-metadata` (observation `Verified:`/`Since:`/`Ownership:` trailer parser self-test) + `check:schema-vocab` (relation-verb malformed-variant drift guard self-test) + `check:upstream-headings` (UPSTREAM-*.md `## ` heading-membership drift guard self-test) + `check:ast-grep` (bespoke `.ast-grep/rules/` structural lint over `lib/`+`scripts/`+`extensions/`+the `.claude/workflows/stale-npm-triage/` drivers, enforcing house JS conventions — ESM-only, no identifier-shadowing, JSDoc `@typedef`/`any` conventions. Its scope lives in `lib/ast-grep-scope.mjs`, shared with `fix:ast-grep` and drift-guarded against `package.json` before the scan runs; error-severity findings fail CI, warning-severity ones don't) + `check:ast-grep-test` (`ast-grep test` — snapshot self-test proving each bespoke rule fires on a planted violation and stays silent on the correct form) + `check:cohort-lockstep` (`--stale` cohort-table lockstep drift guard between `staleness-detection.md` and `knowledge-gardener.md` Step 5b self-test) + `check:bm-search` (shared `bm tool search-notes` enumeration core — envelope validation, paging against an injected fake, row shaping, completeness verdict; guards against an unrecognised response being coerced into a clean-looking empty page) + `check:pi-load` (offline Pi validation: the shared `skills/` tree via Pi's own `loadSkillsFromDir` + the `extensions/` factory import, no running agent) + `check:spec` (`skill-check` SKILL.md linter with a 1000-line body-line cap enforced as errors — the ~42 Claude-Code-vs-spec divergence findings stay non-gating warnings). `node --test` over `test/*.test.js` (the `node:test` suites for `extensions/`, isolated from the real `~/.pi/agent/agents/` via a preloaded `test/isolate-agents-dir.js`) runs as `test:node`, not under `check:*` — `npm test` runs `run-s check test:*` (checks then node tests) and `npm run test-ci` adds c8 coverage.
Shell scripts are validated with `shellcheck` (linting) and `shfmt -d`
(format verification). Requires `brew install shfmt` if not already present.
`npm run fix:ast-grep` (`ast-grep scan --update-all`) applies any auto-fixable
finding — deliberately NOT part of `npm run check`, since a check step must
only detect, never mutate; see `.claude/rules/ast-grep-rules.md`.

## Scripts

The `scripts/` directory contains CLI-first audit utilities (used by the
knowledge-gardener agent) plus `.mjs` self-tests wired into `npm run check`. The
shell workers use `bm tool` CLI commands where possible and direct file access
only for regex operations the CLI cannot express.

**The per-script inventory table lives in `.claude/rules/scripts-and-validation.md`**,
alongside the `bm` CLI quirks and the full drift-guard picture. That rule loads
automatically when you edit `scripts/**` or `lib/**` — exactly when the inventory
is useful — so it costs nothing at session start and keeps this file inside the
39,000-char size guard `check:plugin` enforces.

## Skill routing

When the user asks about knowledge or packages, choose the right skill:

| Signal | Skill |
|--------|-------|
| "prime", "project context", "coverage", "which deps are documented" | `/knowledge-prime` |
| "what do we know about \[X\]", "recall", "find notes on", topic question | `/knowledge-ask [topic]` |
| "research \[pkg\]", "document \[pkg\]", needs external sources | `/intel [pkg]` |
| "upgrade haul", "refresh these after upgrading", pasted `brew upgrade`/`npm outdated` line, batch of names | `/intel` batch mode (per ecosystem) |
| "gaps", "undocumented", "audit coverage" | `/knowledge-gaps` |
| "stale", "drifted", "outdated notes", "which tools/packages need updating" | `/knowledge-gaps --stale [<ecosystem>]` |
| "installed plugins", "which plugins/skills are documented", "plugin/skill coverage" | `/knowledge-gaps --global` |
| "research person", "who is \[X\]", "person intel", "people intel" | `/people-intel [name]` |
| "audit these notes", "check note health", "fourth-wall check \[note\]" (named notes) | `/knowledge-garden [note ...]` |
| "audit my knowledge graph", "full audit", "graph health" (graph-wide) | `knowledge-gardener` agent |
| "fix these notes", "apply audit fixes", "tidy \[note\]" (named notes) | `/knowledge-maintain [note ...]` |
| "fix the whole audit", "remediate the graph", "research missing packages" | `knowledge-maintainer` agent |
| "schema drift", "evolve schema", "sync schemas", "unused schema fields", "declare a relation verb" | `/schema-evolve <type>` |
| "sync nudge tips", "refresh the tip cache", "rebuild the tip cache" | `/nudge` |
| "nudge me on unused features", "which features haven't I adopted", "nudge adoption" | `/nudge check` |

`/nudge`/`/nudge check` are explicit-only (`disable-model-invocation: true`) with no delegate agent — unlike the knowledge-garden/knowledge-maintain rows, these phrases don't auto-route; listed so the model recognizes intent and suggests the command.

## Detailed conventions

Deep, file-type-specific conventions live in **path-scoped rules** under
`.claude/rules/`. Each loads automatically only when you edit a matching file,
which keeps this file lean and the warning-free size budget intact. When working
in the matching area, that rule is the authority:

| Rule file | Loads when editing | Covers |
|-----------|--------------------|--------|
| `skill-development.md` | `skills/**`, `plugin.json` | skill frontmatter, interaction + tool-list hygiene, content conventions, output templates, three-level + scope-partition patterns, prefix convention, full skill inventory |
| `agent-development.md` | `agents/**` | agent frontmatter, read-only enforcement, full agent inventory |
| `hook-development.md` | `hooks/**` | hook conventions, `additionalContext` pattern, full hook inventory |
| `schema-and-notes.md` | `schemas/**` | schema lifecycle, BM search patterns, cross-linking, source citations, note-output shapes |
| `scripts-and-validation.md` | `scripts/**`, `lib/**`, `validate-plugin.mjs` | drift-guard family, `bm` CLI quirks, script conventions |
| `ast-grep-rules.md` | `.ast-grep/**`, `sgconfig.yml` | bespoke structural-lint rule authoring, `ast-grep test` snapshot mechanics, check-vs-fix CI/dev split, extraction-to-shareable-package possibilities |

These are Claude Code path-scoped rules, so they do **not** load at session start
(no context cost until relevant) — that is the mechanism keeping `CLAUDE.md`
under Claude Code's 40k large-file warning while the conventions stay rich.

### Design records

`docs/design/` holds decision records and findings that outlive a sprint. They
are not indexed anywhere else, so a decision recorded there is invisible unless
you go looking. The one with the widest reach:

- **`intel-corrections-2026-07-28.md`** — read before touching `skills/intel/**`,
  the S2 version extractor, or the Homebrew analytics guidance. Its Part 5 maps
  which claims in that prose were verified at source and which were **never
  verified by anyone**; Part 3 records a pinned trade-off with its revival
  trigger, and Part 6 records why the 273 npm notes with no `[version]` slot are
  deliberately never backfilled.

## Releasing

After bumping the version in `plugin.json` and `CHANGELOG.md`, also update the
README.md (component counts, skill/agent descriptions, plugin structure tree,
"How it fits together" diagram) and the
`vp-knowledge` entry in `.claude-plugin/marketplace.json` in this same repo
(both live here — no cross-repo sync needed for vp-knowledge itself).

If vp-beads has also released and bumped its marketplace entry here, confirm the
`vp-beads` version in `marketplace.json` is current before tagging.

Installed plugin caches lag: after a release, users must reinstall to pick up
the new version (`/plugin install vp-knowledge@vp-plugins`).

### Versioning

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
at major version 0. Under semver 0.x, **minor version bumps signal breaking
changes** (e.g., 0.22.0 for the colon-to-hyphen prefix migration). Patch
bumps are non-breaking additions and fixes.

### Release checklist

Pre-release:
- Dogfood every changed skill on real data before tagging — static checks (`npm run check`) catch syntax issues, only live execution catches semantic leakage (e.g., domain-specific examples accidentally bleeding into generic skill prose).

Version bump:
- `plugin.json` — version field
- `CHANGELOG.md` — new version entry + compare link
- `marketplace.json` — `vp-knowledge` version field
- `README.md` — component counts, skill/agent descriptions, structure tree
- `CLAUDE.md` — Components index counts + Plugin Layout tree; **per-item descriptions live in `.claude/rules/{skill,agent,hook}-development.md`** — update those when behaviour changes. Also update the `## Validation` list here, plus the `## Script inventory` table and the `lib/` comment in `.claude/rules/scripts-and-validation.md`, when adding/removing a `scripts/*.mjs` or `lib/*.mjs` (prose-only, not machine-guarded)
- `MEMORY.md` — component descriptions, version field

Tag the release (after committing and pushing the bump):
- Lightweight tag at the bump commit: `git tag vX.Y.Z <commit>` (convention
  is lightweight tags, not annotated — check `git cat-file -t vX.Y.Z` on a
  recent tag to confirm)
- Push the tag: `git push origin vX.Y.Z`
- Without the tag, the `CHANGELOG.md` compare link (`...compare/vA.B.C...vX.Y.Z`)
  will 404 until the tag exists on the remote

Source count propagation (when adding/removing a research source):
- `skills/intel/SKILL.md` (and its `references/enrichment-package.md` / `references/enrichment-tool.md` family branches) — step prose
- `CLAUDE.md` Components index (e.g. "seven-source") + `.claude/rules/skill-development.md` — skill detail
- `README.md` — skill description
- `CHANGELOG.md` — note the source change

### Relationship to vp-beads

`vp-knowledge` and `vp-beads` are complementary plugins — both installable
via the `vp-plugins` marketplace at `voxpelli/vp-claude`.

- **Research feeds tracking** — `/intel` output
  feeds vp-beads' `/upstream-tracker`. Friction or bugs discovered during
  research can be logged as upstream issues with matching prefix notation
  (`brew:<name>`, `action:<owner>/<repo>`, etc.).
- **Capture ↔ synthesis** — `/session-reflect` captures in-sprint
  discoveries into Basic Memory; at sprint-close, vp-beads' `/retrospective`
  synthesises those notes into the sprint record. Mental model:
  `/session-reflect` for in-sprint capture, retrospective for end-of-sprint synthesis.

### Parallel agent orchestration

`/intel` agents are **write-safe** in parallel — notes are file-disjoint across ecosystems, so concurrent agents never corrupt each other's output. But file-disjointness does **not** imply *launch*-safety: bursting ~10 subagent launches at once trips an Anthropic API-side admission throttle (`Server is temporarily limiting requests (not your usage limit)`) that fails them near-instantly with zero writes — distinct from a 429/529 and from any upstream data-source limit. Cap concurrent *launches* to a handful (≈4–6 observed clean; the safe number is load-dependent, not fixed) or lower `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`. See BM note `engineering/agents/concurrent-subagent-launch-api-burst-throttle-not-file-safety`. The gardener→maintainer two-pass workflow (audit first, fix second) is the recommended approach for graph maintenance.

- File-disjoint writes are corruption-safe but **not cross-reference-safe**: when parallel agents (or a batch write wave) create cross-linked notes, a note written *before* a sibling it links to keeps a **dangling forward edge** — BM's `write_note`/`edit_note` resolves only a note's *outgoing* relations, so creating the target later does not heal the earlier note's link. Order writes so referenced targets precede referencers when controllable; otherwise run a no-op re-touch pass (`edit_note` find_replace) across the batch afterward, or let a sync pass run — then verify resolution with `build_context` (null `to_entity`), not the relation-index row. See BM note `engineering/agents/parallel-agent-orchestration-lessons`.
- Static checks (`npm run check`, `validate-plugin.mjs`) validate *structure*, not
  logic — a new audit/check can pass every gate and still measure the wrong thing;
  adversarial-review new check logic before shipping.
- A sub-agent's "couldn't find X" is absence-of-evidence, not proof X is wrong —
  verify against the authoritative source (e.g. `gh` for issue/PR numbers) before
  editing on a sub-agent's doubt.
- Adversarial pre-write verification (3 disjoint-scope agents: BM-internals via
  DeepWiki + graph-coverage via BM reads + external-evidence via
  Tavily/Readwise/Raindrop) is the Wave-1 second-order verification pattern
  applied **pre-`write_note` rather than post-write**. Sprint 28 demonstrated:
  9 /session-reflect candidate observations → 6 ship-able captures (1 dropped
  wrong-mechanism after DeepWiki read of the actual parser source, 1 skipped
  90%-duplicate after full-content read of likely targets, 1 merged). The
  three agents have disjoint scopes so they run concurrently in a single
  message with no coordination cost. Extension candidate for the
  /session-reflect skill itself.
- **Destination routing + red-team roster (2026-07-15).** Extends the panel above. (1) Add an explicit **adversary** (argues to DROP each candidate) + an **enrichment scout** (external corroboration + missed-capture hunt) to the 3 disjoint validators → 4 roles; the adversary earns its cost by catching *wrong* (not just duplicate) captures — one candidate claimed the relation index makes a dangling edge "look resolved, use `build_context` instead," which a DeepWiki source-read showed was **backwards** (the index reveals non-resolution). Net: 3 candidates → 0 kept as-written, 2 re-targeted, 1 CLAUDE.md rule. (2) **Destination test:** a *"do X next time"* behavioural rule → **CLAUDE.md** (loaded every session, steers action); a *"what is true about X"* fact → **Basic Memory** (on-demand); some both. `/session-reflect` only knows BM, so behavioural learnings get buried where they never fire — hand CLAUDE.md-bound findings to `/revise-claude-md`. **Cost-gate the panel** (~600k subagent tokens for 3 observations): opt-in for contested / security-relevant / thin-evidence captures, never default. Rationale + standardization plan (composable, not a merged skill; with YAGNI triggers) in BM note `engineering/agents/session-reflect-destination-routing-and-adversarial-pre-write-panel`.
- A gate reviewer that mutates a file as part of its own self-test (e.g.
  `pr-test-analyzer` sabotaging-then-restoring a function to prove a
  detector fires) can produce a misleading "external session is editing
  this file" signal if a concurrently-running *reading* reviewer observes
  the file mid-mutation. Verified 2026-07-03: `type-design-analyzer`
  witnessed `pr-test-analyzer`'s transient sabotage of
  `findUndeclaredBuiltinTools` and reasonably (but wrongly) inferred an
  unrelated concurrent process. Isolate mutating self-test reviewers from
  concurrent readers in a multi-reviewer gate, or run them sequentially.

### Relationship to upstream memory-* skills

The `basicmachines-co/basic-memory-skills` package provides 9 core `memory-*` skills (notes, schema, tasks, lifecycle, etc.) installed via `npx skills add basicmachines-co/basic-memory-skills` ([skills.sh](https://skills.sh)). This plugin depends on those conventions but does not bundle or duplicate them. `intel` specializes the generic `memory-research` pattern for npm packages.
