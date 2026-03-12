# vp-knowledge

A [Claude Code](https://claude.ai/code) plugin that turns [Basic Memory](https://github.com/basicmachines-co/basic-memory) into an actively maintained knowledge graph. Research packages from six ecosystems and tools from five dev-environment categories using parallel enrichment, find documentation gaps in your projects, and let autonomous agents audit and improve your notes — all without leaving your terminal.

## What it does

### `/package-intel <pkg>` — Research any package

Queries five sources in parallel and synthesizes a structured note. Supports six ecosystems:

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
| DeepWiki | Architecture, design patterns, key APIs |
| Context7 | API reference, code examples |
| Tavily | Security advisories, recent CVEs (RUSTSEC, PyPA, RubySec, etc.) |
| Raindrop | Your bookmarked articles about the package |

Plus changelog analysis via GitHub releases. The result is an ecosystem-prefixed note (`npm:*`, `crate:*`, `pypi:*`, etc.) with observations, relations, and release highlights — ready to query later.

### `/tool-intel <prefix>:<name>` — Research any dev tool

Queries four sources in parallel and synthesizes a structured note. Supports five tool categories:

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
| Raindrop | Your bookmarked articles about the tool |

Plus version/changelog data (GitHub releases for actions, Docker Hub tags for images, API versions for brew/vscode). The result is a prefixed note (`brew:*`, `action:*`, etc.) with type-specific sections — `## Inputs & Outputs` + `## Permissions` for actions, `## Tags` + `## Base Layers` for Docker, `## Common Usage` for formulae — plus observations and relations.

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

Offers to run `/package-intel` (with the right ecosystem prefix) for top undocumented packages and `/tool-intel` for undocumented tools.

### Knowledge Gardener — Read-only graph auditor

An autonomous agent that produces a health report without modifying anything:

> "Audit my knowledge graph"

Checks for: missing sections, schema violations, orphan notes, broken `[[wiki-links]]`, stale notes (90+ days), duplicates, and project-specific data leaking into cross-project notes.

### Knowledge Maintainer — All-in-one graph enhancer

Acts on audit findings with tiered autonomy:

> "Fix the graph issues"

| Action | Autonomy |
|--------|----------|
| Add missing `## Observations` / `## Relations` sections | Auto-fix |
| Link orphan notes to related notes | Auto-fix |
| Fix frontmatter type to match schema | Auto-fix |
| Run `/package-intel` for Tier 1 undocumented packages | Auto-fix |
| Run `/tool-intel` for undocumented tools from manifests | Auto-fix |
| Merge duplicate notes | Asks first |
| Archive abandoned notes (move to `archive/`) | Asks first |
| Rewrite note prose | Asks first |

### Session Reflector — On-demand conversation capture

A user-triggered agent that reviews the current conversation and saves insights to Basic Memory with your approval:

> "Reflect on this session" / "Save what we learned" / "Commit this to memory"

Unlike the automatic PreCompact hook (brief, fires under compaction pressure), the reflector is deliberate — it extracts candidates, finds the right target notes, shows a grouped preview, and waits before writing anything. Uses the same `[decision]`, `[lesson]`, `[gotcha]`, `[pattern]`, `[limitation]`, `[breaking]` observation vocabulary as PreCompact for consistency.

### Hooks — Automated quality guardrails

Three hooks run automatically in the background:

- **PostToolUse** — After any `write_note` or `edit_note`, validates the note structure against its schema. Catches malformed notes immediately.
- **PreCompact** — Before context compaction, reviews the conversation for decisions, lessons, and gotchas worth saving. Writes them to Basic Memory so insights survive across sessions.
- **SessionStart** — Injects a brief knowledge graph status summary (note count, recent activity, top gaps) so Claude is graph-aware from the start of every session.

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

The `/package-intel` five-source pipeline and `/tool-intel` four-source pipeline need these additional MCP servers and plugins. Context7 is used by `/package-intel` only; DeepWiki and Tavily are used by both.

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

### Optional

- **[`gh` CLI](https://cli.github.com)** — enables changelog analysis via GitHub releases in `/package-intel`

## Plugin structure

```
.claude-plugin/plugin.json             Plugin manifest
skills/
  package-intel/
    SKILL.md                           Five-source research workflow
    references/ecosystem-npm.md        npm registry API + note template
    references/ecosystem-crates.md     crates.io API + note template
    references/ecosystem-go.md         Go module proxy + note template
    references/ecosystem-composer.md   Packagist API + note template
    references/ecosystem-pypi.md       PyPI API + note template
    references/ecosystem-gems.md       RubyGems API + note template
  tool-intel/
    SKILL.md                           Four-source research workflow
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
    SKILL.md                           Package + tool coverage analysis
agents/
  knowledge-gardener.md                Read-only graph auditor
  knowledge-maintainer.md              Read-write graph enhancer
  session-reflector.md                 On-demand conversation capture
hooks/
  hooks.json                           PostToolUse, PreCompact, SessionStart
  session-start.sh                     Graph context injection script
```

## How it fits together

```
 User says            Triggers              Output
 ─────────────────    ───────────────────    ──────────────────────────
 /package-intel X  -> package-intel skill -> <ecosystem>:X note in Basic Memory
 /tool-intel X     -> tool-intel skill    -> <type>:X note in Basic Memory
 /knowledge-gaps   -> knowledge-gaps skill-> gap report + offers /package-intel
                                             and /tool-intel for undocumented tools
 "audit graph"     -> knowledge-gardener  -> health report (read-only)
 "fix the graph"   -> knowledge-maintainer-> structural fixes + confirmations
                      ├── audits graph inline (lightweight)
                      ├── auto-fixes structure
                      ├── auto-runs /package-intel for Tier 1 package gaps
                      ├── auto-runs /tool-intel for undocumented tool manifests
                      └── asks before content changes

 [any BM write]    -> PostToolUse hook    -> schema validation feedback
 [context compact] -> PreCompact hook     -> insights saved to BM
 [session start]   -> SessionStart hook   -> graph context reminder
 "save insights"   -> session-reflector   -> preview + write to BM
```

## Relationship to upstream

This plugin depends on but does not duplicate the 9 core `memory-*` skills from [`basicmachines-co/basic-memory-skills`](https://github.com/basicmachines-co/basic-memory-skills) (notes, schema, tasks, lifecycle, reflect, etc.). It adds multi-ecosystem package research (npm, Rust, Go, PHP, Python, Ruby), developer tool research (Homebrew, GitHub Actions, Docker, VSCode), project-level gap analysis, and autonomous graph maintenance on top of those foundations.

## Possible future additions

These are scoped out of current releases but worth tracking:

- **Tier-drift log for `knowledge-gaps`** — track when packages move between tiers over time so you can see which undocumented packages are becoming more critical (medium effort, medium value)
- **Per-audit reflection notes from `knowledge-gardener`** — the gardener is intentionally read-only; surfacing audit findings to Basic Memory would need a new output mechanism (e.g. a paired write agent step or a PostToolUse hook on the audit output)
- **Adaptive research depth in `package-intel`** — extend the 60-day freshness check into a multi-tier strategy: skip specific sources based on what changed since last update, weight sources by past yield for a given package (Phase 2+ from ACE/MemInsight research patterns)

## License

MIT
