# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- Imports vendor-neutral agent instructions (shell-safety rules + `bd onboard` integration block). AGENTS.md is the file other agents read directly; `@AGENTS.md` is Claude Code's documented import syntax that inlines its contents here at session start. -->
@AGENTS.md

## What This Is

A Claude Code plugin (`vp-knowledge`) containing user-owned skills, agents, and hooks that build on [Basic Memory](https://github.com/basicmachines-co/basic-memory) (running as an MCP server). These complement the upstream `basicmachines-co/basic-memory-skills` (which provides core `memory-*` skills) with higher-level workflows for package and developer-tool research, knowledge graph maintenance, and automated quality checks.

## Plugin Layout

```
.claude-plugin/
  plugin.json                        # Plugin manifest
skills/
  package-intel/SKILL.md             # Seven-source multi-ecosystem package research
    references/                      # 14 files: 6 ecosystem + 6 note templates + gh-api-fallback + forge-fallback
  tool-intel/SKILL.md                # Five-source dev-tool research (brew/cask/action/docker/vscode/gh)
    references/                      # 13 files: 6 ecosystem + 6 note templates + gh-api-fallback
  knowledge-gaps/SKILL.md            # Cross-reference deps + tool manifests vs BM coverage; --stale flag for version drift (brew/npm/cask/crate/vscode)
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
agents/
  knowledge-gardener.md              # Read-only graph health auditor (incl. tag alignment)
  knowledge-maintainer.md            # All-in-one graph enhancer (writes, incl. tag fixes)
  knowledge-primer.md                # Autonomous project context priming
  raindrop-gardener.md               # Read-only Raindrop tag auditor
hooks/
  hooks.json                         # PreToolUse, PostToolUse, PostToolUseFailure, SessionStart
schemas/                             # 22 BM note-schema definitions — source of truth (see ## Schemas)
scripts/                             # CLI-first audit + npm-run-check utilities (see ## Scripts)
lib/                                 # JS modules imported by check scripts (staleness-contract, version-distance, fourth-wall-rules, release-counts)
.claude/rules/                       # Path-scoped dev conventions, load on edit of matching files (see ## Detailed conventions)
```

The **plugin content** is pure markdown + JSON — no runtime code, no build step. The repo also ships JS validation tooling (`scripts/`, `lib/`) with a handful of devDependencies that power `npm run check`.

## Components

One-line index. Full per-component detail lives in the path-scoped dev rules
(`.claude/rules/{skill,agent,hook}-development.md`) and loads when you edit that
component type — see [Detailed conventions](#detailed-conventions).

### Skills (14)

- **package-intel** — seven-source package research (npm/crate/go/composer/pypi/gem) → BM note. `/package-intel <pkg>`
- **tool-intel** — five-source dev-tool research (brew/cask/action/docker/vscode/gh) → BM note. `/tool-intel <prefix>:<name>`
- **knowledge-gaps** — dep + tool-manifest coverage audit; `--stale [brew|npm|cask|crate|vscode]` for version drift. `/knowledge-gaps`
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

### Agents (4)

- **knowledge-gardener** — read-only graph auditor (10 checks incl. version drift, tag alignment, fourth-wall). Never writes.
- **knowledge-maintainer** — write agent acting on audit findings; confirms content changes; `delete_note`/`write_note` excluded.
- **knowledge-primer** — read-only "before work" BM context briefer.
- **raindrop-gardener** — read-only Raindrop tag auditor.

### Hooks (5)

- **PostToolUse** (`write_note`/`edit_note`) — emits a `schema_validate` reminder via `additionalContext`.
- **PostToolUse** (`Edit`/`Write`) — `shfmt` drift detect + auto-fix; schema-sync reminder.
- **PostToolUseFailure** — classifies BM write-tool errors into five recovery categories.
- **SessionStart** — graph guidance + skill suggestions + 4th-sprint audit reminder.
- **PreToolUse** (`Bash`) — blocks Python/Node in the gardener agent (read-only enforcement).

## Schemas

The `schemas/` directory in the plugin root is the version-controlled source of truth for all Basic Memory note schemas. It contains twenty-two files mirroring the schema notes in BM:
<!-- schema-count: 22 — keep in sync with `ls schemas/*.md | wc -l` -->

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
| DeepWiki | `mcp__deepwiki__*` | package-intel, tool-intel, people-intel |
| Context7 | `mcp__plugin_context7_context7__*` | package-intel only |
| Tavily | `mcp__tavily__*` | package-intel, tool-intel, people-intel |
| Raindrop | `mcp__raindrop__*` | package-intel, tool-intel, people-intel, tag-sync, session-bookmarks, raindrop-triage, raindrop-gardener |
| Readwise | `mcp__readwise__*` | package-intel, tool-intel, people-intel, knowledge-gaps |
| Socket | `mcp__socket-mcp__*` | package-intel only |
| Homebrew MCP | `mcp__homebrew__*` | tool-intel (optional; brew/cask analytics) |

## Validation

`npm run check` — runs `check:plugin` (validate-plugin.mjs, incl. the CLAUDE.md size guard) + `check:contract` (staleness drift-bucket contract self-test) + `check:md` (remark) + `check:sh` (shellcheck + shfmt) + `check:hooks` (hook integration tests) + `check:distance` (version-distance classifier self-test) + `check:fourthwall` (fourth-wall rule-registry self-test) + `check:release-counts` (CLAUDE.md component counts ↔ disk).
Shell scripts are validated with `shellcheck` (linting) and `shfmt -d`
(format verification). Requires `brew install shfmt` if not already present.

## Scripts

The `scripts/` directory contains CLI-first audit utilities (used by the
knowledge-gardener agent) plus `.mjs` self-tests wired into `npm run check`. The
shell workers use `bm tool` CLI commands where possible and direct file access
only for regex operations the CLI cannot express. The `bm` CLI quirks and the
full drift-guard picture live in `.claude/rules/scripts-and-validation.md`.

| Script | Purpose | Used by |
|--------|---------|---------|
| `audit-scope-leak.sh <bm-root>` | Detect project-specific content (paths, env vars) in cross-project notes | gardener Step 7b |
| `fetch-brew-upstream.sh` (stdin: names) | API-only: fetch upstream version/homepage/deprecated/disabled facts from formulae.brew.sh for a list of formula names piped on stdin; Tier 2 enrichment via gh release timing. **Never accesses `~/basic-memory/`** — the calling agent does BM access via MCP and pipes names here. | gardener Step 5b, `/knowledge-gaps --stale` |
| `fetch-cask-upstream.sh` (stdin: tokens) | API-only: bulk `cask.json` indexed by token; leading comma-segment version, deprecated/disabled, `version=="latest"` → not-in-api. NDJSON-identical contract to brew. | gardener Step 5b, `/knowledge-gaps --stale cask` |
| `fetch-npm-upstream.sh` (stdin: names) | API-only: abbreviated packument per name; `dist-tags.latest`, `.modified` age, latest-version `deprecated`. Scoped names work unencoded. | gardener Step 5b, `/knowledge-gaps --stale npm` |
| `fetch-crate-upstream.sh` (stdin: names) | API-only: crates.io per name; `max_stable_version` + matching `created_at`. Required User-Agent, 1 s rate-limit between calls. | gardener Step 5b, `/knowledge-gaps --stale crate` |
| `fetch-vscode-upstream.sh` (stdin: ids) | API-only: dual-source per `publisher.ext` id — Open VSX (authoritative verdict, `.version`/`.timestamp`) + VS Marketplace `extensionquery` (best-effort `marketplace_version` annotation). | gardener Step 5b, `/knowledge-gaps --stale vscode` |
| `audit-helpers.sh <subcommand>` | Dispatcher: bm-stats, scope-leak-summary, scope-leak-detail | gardener Step 0.5, 7b |
| `check-hooks.mjs` | Integration tests verifying each hook emits exactly one JSON object | `npm run check:hooks` |
| `check-staleness-contract.mjs` | Fixture tests for the emit↔consume staleness drift-bucket contract (imports `lib/staleness-contract.mjs`) — proves the validator check catches bucket-string drift | `npm run check:contract` |
| `check-version-distance.mjs` | Fixture tests for the semver↔calver version-distance classifier (imports `lib/version-distance.mjs`) — proves the scheme-mismatch guard and version-zero rule hold | `npm run check:distance` |
| `check-fourthwall.mjs` | Fixture tests for the fourth-wall rule registry (imports `lib/fourth-wall-rules.mjs`) — every deterministic `detect` fires on a planted violation + stays silent on near-misses; vp-note-quality documents every rule id + its Detection column matches the registry | `npm run check:fourthwall` |
| `check-release-counts.mjs` | Live + fixture check: CLAUDE.md `### Skills/Agents/Hooks (N)` headings match on-disk counts (imports `lib/release-counts.mjs`) | `npm run check:release-counts` |

### bd CLI quirks

- `bd create` (not `bd add`) — the `Did you mean ado?` typo suggestion is misleading
- `bd create --type=bug` requires `## Steps to Reproduce` AND `## Acceptance Criteria` sections in the description
- `bd create --type=task` requires `## Acceptance Criteria` — title-case "Criteria" only (lowercase rejected)
- `bd close <id>` requires `-r "<summary>"` — non-empty reason is mandatory

## Skill routing

When the user asks about knowledge or packages, choose the right skill:

| Signal | Skill |
|--------|-------|
| "prime", "project context", "coverage", "which deps are documented" | `/knowledge-prime` |
| "what do we know about \[X\]", "recall", "find notes on", topic question | `/knowledge-ask [topic]` |
| "research \[pkg\]", "document \[pkg\]", needs external sources | `/package-intel [pkg]` |
| "gaps", "undocumented", "audit coverage" | `/knowledge-gaps` |
| "stale", "drifted", "outdated notes", "which tools/packages need updating" | `/knowledge-gaps --stale [<ecosystem>]` |
| "research person", "who is \[X\]", "person intel", "people intel" | `/people-intel [name]` |
| "audit these notes", "check note health", "fourth-wall check \[note\]" (named notes) | `/knowledge-garden [note ...]` |
| "audit my knowledge graph", "full audit", "graph health" (graph-wide) | `knowledge-gardener` agent |
| "fix these notes", "apply audit fixes", "tidy \[note\]" (named notes) | `/knowledge-maintain [note ...]` |
| "fix the whole audit", "remediate the graph", "research missing packages" | `knowledge-maintainer` agent |

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

These are Claude Code path-scoped rules, so they do **not** load at session start
(no context cost until relevant) — that is the mechanism keeping `CLAUDE.md`
under Claude Code's 40k large-file warning while the conventions stay rich.

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
- `CLAUDE.md` — Components index counts + Plugin Layout tree; **per-item descriptions live in `.claude/rules/{skill,agent,hook}-development.md`** — update those when behaviour changes. Also update the `## Validation` list, `## Scripts` table, and `lib/` comment when adding/removing a `scripts/*.mjs` or `lib/*.mjs` (prose-only, not machine-guarded)
- `MEMORY.md` — component descriptions, version field

Tag the release (after committing and pushing the bump):
- Lightweight tag at the bump commit: `git tag vX.Y.Z <commit>` (convention
  is lightweight tags, not annotated — check `git cat-file -t vX.Y.Z` on a
  recent tag to confirm)
- Push the tag: `git push origin vX.Y.Z`
- Without the tag, the `CHANGELOG.md` compare link (`...compare/vA.B.C...vX.Y.Z`)
  will 404 until the tag exists on the remote

Source count propagation (when adding/removing a research source):
- `skills/package-intel/SKILL.md` or `skills/tool-intel/SKILL.md` — step prose
- `CLAUDE.md` Components index (e.g. "seven-source") + `.claude/rules/skill-development.md` — skill detail
- `README.md` — skill description
- `CHANGELOG.md` — note the source change

### Relationship to vp-beads

`vp-knowledge` and `vp-beads` are complementary plugins — both installable
via the `vp-plugins` marketplace at `voxpelli/vp-claude`.

- **Research feeds tracking** — `/package-intel` and `/tool-intel` output
  feeds vp-beads' `/upstream-tracker`. Friction or bugs discovered during
  research can be logged as upstream issues with matching prefix notation
  (`brew:<name>`, `action:<owner>/<repo>`, etc.).
- **Capture ↔ synthesis** — `/session-reflect` captures in-sprint
  discoveries into Basic Memory; at sprint-close, vp-beads' `/retrospective`
  synthesises those notes into the sprint record. Mental model:
  `/session-reflect` for in-sprint capture, retrospective for end-of-sprint synthesis.

### Parallel agent orchestration

Up to 10 background `/package-intel` + `/tool-intel` agents can run safely in parallel — notes are file-disjoint across ecosystems. The gardener→maintainer two-pass workflow (audit first, fix second) is the recommended approach for graph maintenance.

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

### Relationship to upstream memory-* skills

The `basicmachines-co/basic-memory-skills` package provides 9 core `memory-*` skills (notes, schema, tasks, lifecycle, etc.) installed via `npx skills add basicmachines-co/basic-memory-skills` ([skills.sh](https://skills.sh)). This plugin depends on those conventions but does not bundle or duplicate them. `package-intel` specializes the generic `memory-research` pattern for npm packages.
