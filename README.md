# vp-knowledge

A [Claude Code](https://claude.ai/code) plugin that turns [Basic Memory](https://github.com/basicmachines-co/basic-memory) into an actively maintained knowledge graph. Research packages from six ecosystems and tools from five dev-environment categories using parallel enrichment, find documentation gaps in your projects, surface project-relevant knowledge before coding, and let autonomous agents audit and improve your notes — all without leaving your terminal.

## What it does

### `/package-intel <pkg>` — Research any package

Queries six sources in parallel, synthesizes a structured note, and cross-links existing notes. Supports six ecosystems:

| Form | Ecosystem | Example |
|------|-----------|---------|
| `<name>` (no prefix) | npm (default) | `fastify` |
| `npm:<name>` | npm | `npm:@fastify/postgres` |
| `crate:<name>` | Rust / crates.io | `crate:serde` |
| `go:<module/path>` | Go modules | `go:github.com/gin-gonic/gin` |
| `composer:<vendor>/<pkg>` | PHP / Packagist | `composer:laravel/framework` |
| `pypi:<name>` | Python / PyPI | `pypi:requests` |
| `gem:<name>` | Ruby / RubyGems | `gem:rails` |

```
/package-intel @fastify/postgres
/package-intel crate:serde
/package-intel pypi:requests
```

| Source | What it finds |
|--------|--------------|
| Basic Memory | Existing notes, cross-references, usage patterns |
| DeepWiki | Architecture, design patterns, key APIs (2-3 targeted questions) |
| Context7 | API reference, code examples |
| Tavily | Security advisories, recent CVEs (RUSTSEC, PyPA, RubySec, etc.) |
| Raindrop | Your bookmarked articles (with full content extraction) |
| Readwise | Your highlights and saved articles about the package |

Plus changelog analysis via GitHub releases. After writing, searches for existing notes that reference the package and adds bidirectional cross-links. The result is an ecosystem-prefixed note (`npm:*`, `crate:*`, `pypi:*`, etc.) with observations, relations, and release highlights — connected into the graph from day one.

### `/tool-intel <prefix>:<name>` — Research any dev tool

Queries five sources in parallel, synthesizes a structured note, and cross-links existing notes. Supports five tool categories:

| Form | Category | Example |
|------|----------|---------|
| `brew:<name>` | Homebrew formula | `brew:ripgrep` |
| `cask:<name>` | Homebrew cask | `cask:warp` |
| `action:<owner>/<repo>` | GitHub Action | `action:actions/checkout` |
| `docker:<image>` | Docker Hub image | `docker:node` |
| `vscode:<publisher>.<ext>` | VSCode extension | `vscode:esbenp.prettier-vscode` |

```
/tool-intel brew:ripgrep
/tool-intel action:actions/checkout
/tool-intel docker:node
/tool-intel vscode:esbenp.prettier-vscode
```

| Source | What it finds |
|--------|--------------|
| Basic Memory | Existing notes, cross-references |
| DeepWiki | Architecture, design patterns (actions and docker only) |
| Tavily | Security advisories, CVEs, supply-chain risks, gotchas |
| Raindrop | Your bookmarked articles (with full content extraction) |
| Readwise | Your highlights and saved articles about the tool |

Plus version/changelog data (GitHub releases for actions, Docker Hub tags for images, API versions for brew/vscode). After writing, searches for existing notes that reference the tool and adds bidirectional cross-links. The result is a prefixed note (`brew:*`, `action:*`, etc.) with type-specific sections — `## Inputs & Outputs` + `## Permissions` for actions, `## Tags` + `## Base Layers` for Docker, `## Common Usage` for formulae — plus observations and relations.

### `/knowledge-gaps` — Find undocumented dependencies

Scans your project's manifest files for both code dependencies and dev tooling, checks which have Basic Memory notes, and reports the gaps:

```
## Knowledge Gap Report — my-project

### npm Coverage: 12/47 packages documented (25%)

#### Tier 1 — Must Document (3+ imports)
| Package | Import Count | Domain               |
|---------|--------------|----------------------|
| fastify | 12           | engineering/fastify/ |
| pg      | 8            | engineering/         |

#### Tier 2 — Should Document (1-2 imports)
...

---

### crates Coverage: 3/18 packages documented (17%)

#### Tier 1 — Must Document (3+ imports)
| Package | Import Count | Domain   |
|---------|--------------|----------|
| serde   | 28           | crates/  |
...

---

### Overall Summary
- Total packages across all ecosystems: 65
- Documented: 15 (23%)
- Undocumented Tier 1: 8 packages
```

**Package manifests scanned:** `package.json`, `Cargo.toml`, `go.mod`, `composer.json`, `pyproject.toml`, `Gemfile` — tiered by import frequency (3+ imports = Tier 1, must document).

**Tool manifests scanned:** `Brewfile` (formulae, casks, vscode entries), `.github/workflows/*.yml` (actions), `Dockerfile`/`*.dockerfile` (docker images), `.vscode/extensions.json` (vscode extensions) — all manifest entries count equally, no tiering.

Also detects **concept-level hub gaps** — topics referenced by 3+ notes but with no dedicated note — and **reading-signal gaps** from Readwise highlights. Offers to run `/package-intel` (with the right ecosystem prefix) for top undocumented packages and `/tool-intel` for undocumented tools.

### `/knowledge-prime` — Surface project-relevant knowledge

Scans your project's manifest files, cross-references dependencies against Basic Memory, and produces a concise context brief with key gotchas, coverage gaps, and recently updated notes:

```
## Project Knowledge Brief

### Stack detected
- npm: 45 deps (38 documented, 7 undocumented)
- brew: 12 tools (10 documented, 2 undocumented)

### Key gotchas
- **npm:fastify** — [gotcha] reply.send() after reply.redirect() causes hang
- **npm:pino** — [limitation] redaction doesn't work on nested arrays

### Recent activity
- 3 notes updated in last 7 days: npm:fastify, npm:pino, brew:ripgrep

### Gaps worth filling
- Top undocumented dep: `npm:undici` (used in 12 imports)
- Run `/knowledge-gaps` for full coverage analysis
```

Uses a three-pass relevance scoring algorithm: dependency match (score 3) → graph expansion via `build_context` (score 2) → beads/git boost (score 1). Loads only critical observations (`[gotcha]`, `[breaking]`, `[limitation]`) with an 800-token budget. Supports `--deep` for expanded output (2000 tokens, top 12 notes, additional categories).

### `/schema-evolve <type>` — Detect and fix schema drift

Compares actual note field usage against schema definitions, proposes additions (>25% usage) and removals (0% usage), and dual-syncs both the Basic Memory schema note and the local `schemas/` file after approval:

```
/schema-evolve npm_package
/schema-evolve brew_formula
```

Includes a watch list for emerging fields (10-24% usage) and validates after every change.

### Knowledge Gardener — Read-only graph auditor

An autonomous agent that produces a health report without modifying anything:

> "Audit my knowledge graph"

Checks for: missing sections, schema violations, orphan notes, broken `[[wiki-links]]`, stale notes (90+ days), duplicates, project-specific data leaking into cross-project notes, tag alignment (non-canonical forms, retired tags, missing ecosystem tags, out-of-vocabulary tags).

### Knowledge Maintainer — All-in-one graph enhancer

Acts on audit findings with tiered autonomy:

> "Fix the graph issues"

| Action | Autonomy |
|--------|----------|
| Add missing `## Observations` / `## Relations` sections | Auto-fix |
| Normalize observation categories | Auto-fix |
| Normalize tags (canonical forms, remove type-echo/retired) | Auto-fix |
| Add missing ecosystem tags to tool notes | Auto-fix |
| Link orphan notes to related notes | Auto-fix |
| Fix frontmatter type to match schema | Auto-fix |
| Run `/package-intel` for Tier 1 undocumented packages | Auto-fix |
| Run `/tool-intel` for undocumented tools from manifests | Auto-fix |
| Merge duplicate notes | Asks first |
| Archive abandoned notes (move to `archive/`) | Asks first |
| Rewrite note prose | Asks first |

### Knowledge Primer — Autonomous context loading

A read-only agent that surfaces project-relevant knowledge before you start working:

> "Prime the knowledge graph for this project" / "What does BM know about my deps?"

Same workflow as `/knowledge-prime` but runs as an autonomous subagent. Pinned to Sonnet for consistent quality regardless of session model. The "before work" counterpart to `/session-reflect` (which captures knowledge "after work").

### `/knowledge-ask <question>` — Ask the knowledge graph

A read-only skill that answers freeform questions by searching Basic Memory, loading relevant notes, traversing 1-hop graph neighbors, and synthesizing a cited answer:

> "What do I know about fastify error handling?" / "What does BM say about IndieWeb?"

Each answer includes a confidence tier (Direct, Partial, or No Coverage) so you know how much the graph actually covers. When coverage is incomplete, suggests `/package-intel`, `/tool-intel`, or `/knowledge-gaps` to fill the gap. Unlike `/knowledge-prime` (which shows project-wide dependency coverage), `/knowledge-ask` answers specific questions about individual topics.

### `/session-reflect` — On-demand conversation capture

A user-triggered skill that reviews the current conversation and saves insights to Basic Memory with your approval:

> "Reflect on this session" / "Save what we learned" / "Commit this to memory"

Unlike the automatic PreCompact hook (brief, fires under compaction pressure), `/session-reflect` is deliberate — it extracts candidates, finds the right target notes, shows a grouped preview, and waits before writing anything. Uses the same `[decision]`, `[lesson]`, `[gotcha]`, `[pattern]` observation vocabulary as PreCompact, plus `[limitation]` and `[breaking]` for thoroughness.

### Hooks — Automated quality guardrails

Six hooks run automatically in the background:

- **PostToolUse** (BM writes) — After any `write_note` or `edit_note`, validates the note structure against its schema. Catches malformed notes immediately.
- **PostToolUse** (file edits) — After editing shell scripts, auto-formats with `shfmt`. After editing schema files, reminds to sync Basic Memory.
- **PostToolUseFailure** — Classifies Basic Memory write and schema tool failures into five categories with actionable recovery guidance.
- **PreCompact** — Before context compaction, reviews the conversation for decisions, lessons, and gotchas worth saving. Writes them to Basic Memory so insights survive across sessions.
- **SessionStart** — Injects a knowledge graph status summary and suggests `/knowledge-prime` for project context or `/knowledge-ask` for topic-specific questions.
- **PreToolUse** (gardener Bash) — Blocks Python and Node.js script execution when running as the knowledge-gardener agent, enforcing read-only discipline.

## Installation

### Via slash commands

```bash
/plugin marketplace add voxpelli/vp-claude
/plugin install vp-knowledge@vp-plugins
```

### Manual settings.json

Add to `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "vp-plugins": {
      "source": { "source": "github", "repo": "voxpelli/vp-claude" }
    }
  },
  "enabledPlugins": {
    "vp-knowledge@vp-plugins": true
  }
}
```

## Prerequisites

### Required

**[Basic Memory](https://github.com/basicmachines-co/basic-memory)** MCP server — the knowledge graph backend:

```bash
claude mcp add basic-memory -- basic-memory mcp
```

**[basic-memory-skills](https://github.com/basicmachines-co/basic-memory-skills)** — core `memory-*` skills this plugin builds on. Install via [skills.sh](https://skills.sh), the open agent skills CLI:

```bash
npx skills add basicmachines-co/basic-memory-skills
```

### Required for enrichment pipelines

The `/package-intel` six-source pipeline and `/tool-intel` five-source pipeline need these additional MCP servers and plugins. Context7 is used by `/package-intel` only; DeepWiki and Tavily are used by both; Readwise is used by both plus `/knowledge-gaps`.

**[DeepWiki](https://docs.devin.ai/work-with-devin/deepwiki-mcp)** — repository documentation and architecture questions:

```bash
claude mcp add --transport http deepwiki https://mcp.deepwiki.com/mcp
```

**[Context7](https://context7.com/docs/clients/claude-code)** — library documentation and code examples:

```bash
/plugin install context7@claude-plugins-official
```

**[Tavily](https://docs.tavily.com/documentation/mcp)** — web search for security advisories, CVEs, and recent articles. Requires a [Tavily API key](https://tavily.com):

```bash
claude mcp add --transport http tavily https://mcp.tavily.com/mcp \
  --header "Authorization: Bearer tvly-YOUR_KEY_HERE"
```

**[Raindrop](https://help.raindrop.io/mcp)** — searches your bookmarked articles. Requires a [Raindrop.io](https://raindrop.io) Pro account:

```bash
claude mcp add --transport http raindrop https://api.raindrop.io/rest/v2/ai/mcp
```

**[Readwise](https://readwise.io/mcp)** — searches your reading highlights and saved articles from Readwise and Reader. Requires a [Readwise](https://readwise.io) account:

```bash
claude mcp add --transport http readwise https://mcp2.readwise.io/mcp
```

### Optional

- **[`gh` CLI](https://cli.github.com)** — enables changelog analysis via GitHub releases in `/package-intel`

## Plugin structure

```
.claude-plugin/plugin.json             Plugin manifest
skills/
  package-intel/
    SKILL.md                           Six-source research workflow
    references/ecosystem-npm.md        npm registry API + note template
    references/ecosystem-crates.md     crates.io API + note template
    references/ecosystem-go.md         Go module proxy + note template
    references/ecosystem-composer.md   Packagist API + note template
    references/ecosystem-pypi.md       PyPI API + note template
    references/ecosystem-gems.md       RubyGems API + note template
  tool-intel/
    SKILL.md                           Five-source research workflow
    references/ecosystem-brew.md       formulae.brew.sh API
    references/ecosystem-cask.md       formulae.brew.sh/cask API
    references/ecosystem-action.md     action.yml extraction + permissions
    references/ecosystem-docker.md     Docker Hub API + tag strategy
    references/ecosystem-vscode.md     Open VSX API + VS Marketplace fallback
    references/note-template-brew.md   brew_formula note template
    references/note-template-cask.md   brew_cask note template
    references/note-template-action.md github_action note template
    references/note-template-docker.md docker_image note template
    references/note-template-vscode.md vscode_extension note template
  knowledge-gaps/
    SKILL.md                           Package + tool + concept coverage analysis
  knowledge-prime/
    SKILL.md                           Project context priming from BM
  schema-evolve/
    SKILL.md                           Schema drift detection and dual-sync
  session-reflect/
    SKILL.md                           On-demand conversation → memory capture
  knowledge-ask/
    SKILL.md                           Freeform Q&A against the BM knowledge graph
  vp-note-quality/
    SKILL.md                           Fourth-wall anti-pattern checklist (not user-invocable)
agents/
  knowledge-gardener.md                Read-only graph auditor (tags + fourth-wall)
  knowledge-maintainer.md              Read-write graph enhancer (effort: high)
  knowledge-primer.md                  Autonomous project context priming
hooks/
  hooks.json                           PreToolUse, PostToolUse x2,
                                       PostToolUseFailure, PreCompact, SessionStart
  pre-bash-no-python.sh                Python/Node.js blocker for gardener agent
  post-bm-write-validate.sh            Schema validation after BM writes
  post-bm-failure-classify.sh          Error classification for BM failures
  session-start.sh                     Graph context + priming hint script
  precompact.sh                        Reflection instructions script
  post-file-edit.sh                    Shell formatting + schema sync script
schemas/
  npm_package.md                       npm package schema (npm_package type)
  crate_package.md                     Rust crate schema (crate_package type)
  go_module.md                         Go module schema (go_module type)
  composer_package.md                  PHP Composer schema (composer_package type)
  pypi_package.md                      Python PyPI schema (pypi_package type)
  ruby_gem.md                          Ruby gem schema (ruby_gem type)
  brew_formula.md                      Homebrew formula schema (brew_formula type)
  brew_cask.md                         Homebrew cask schema (brew_cask type)
  github_action.md                     GitHub Action schema (github_action type)
  docker_image.md                      Docker image schema (docker_image type)
  vscode_extension.md                  VSCode extension schema (vscode_extension type)
  engineering.md                       Engineering knowledge schema (engineering type)
  standard.md                          Protocol/standard schema (standard type)
  concept.md                           Concept/movement schema (concept type)
  milestone.md                         Milestone/history schema (milestone type)
  service.md                           Service/product schema (service type)
  person.md                            Person schema (person type)
```

## How it fits together

```
 User says            Triggers              Output
 ─────────────────    ───────────────────    ──────────────────────────
 /package-intel X  -> package-intel skill -> <ecosystem>:X note + cross-links
 /tool-intel X     -> tool-intel skill    -> <type>:X note + cross-links
 /knowledge-gaps   -> knowledge-gaps skill-> gap report (packages, tools, concepts)
                                             + offers /package-intel, /tool-intel
 /knowledge-prime  -> knowledge-prime     -> context brief with gotchas + gaps
 /knowledge-ask Q  -> knowledge-ask skill -> cited answer + confidence tier
 /schema-evolve X  -> schema-evolve skill -> field proposals + dual-sync
 "audit graph"     -> knowledge-gardener  -> health report (read-only, incl. tags)
 "fix the graph"   -> knowledge-maintainer-> structural + tag fixes + confirmations
                      ├── audits graph inline (lightweight)
                      ├── auto-fixes structure and tags
                      ├── auto-runs /package-intel for Tier 1 package gaps
                      ├── auto-runs /tool-intel for undocumented tool manifests
                      └── asks before content changes
 "prime context"   -> knowledge-primer    -> context brief (autonomous agent)

 [any BM write]    -> PostToolUse hook    -> schema validation feedback
 [any file edit]   -> PostToolUse hook    -> shfmt + schema sync reminder
 [BM tool failure] -> PostToolUseFailure  -> classified error + recovery guidance
 [context compact] -> PreCompact hook     -> insights saved to BM
 [session start]   -> SessionStart hook   -> graph context + priming hint
 /session-reflect  -> session-reflect     -> preview + write to BM
```

## Relationship to upstream

This plugin depends on but does not duplicate the 9 core `memory-*` skills from [`basicmachines-co/basic-memory-skills`](https://github.com/basicmachines-co/basic-memory-skills) (notes, schema, tasks, lifecycle, reflect, etc.). It adds multi-ecosystem package research (npm, Rust, Go, PHP, Python, Ruby), developer tool research (Homebrew, GitHub Actions, Docker, VSCode), project-level gap analysis, project context priming, schema evolution, tag alignment, and autonomous graph maintenance on top of those foundations.

## Possible future additions

These are scoped out of current releases but worth tracking:

- **Tier-drift log for `knowledge-gaps`** — track when packages move between tiers over time so you can see which undocumented packages are becoming more critical (medium effort, medium value)
- **Per-audit reflection notes from `knowledge-gardener`** — the gardener is intentionally read-only; surfacing audit findings to Basic Memory would need a new output mechanism (e.g. a paired write agent step or a PostToolUse hook on the audit output)
- **Adaptive research depth in `package-intel`** — extend the 60-day freshness check into a multi-tier strategy: skip specific sources based on what changed since last update, weight sources by past yield for a given package (Phase 2+ from ACE/MemInsight research patterns)

## License

MIT
