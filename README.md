# vp-knowledge

A [Claude Code](https://claude.ai/code) plugin that turns [Basic Memory](https://github.com/basicmachines-co/basic-memory) into an actively maintained knowledge graph. Research packages from six ecosystems and tools from eight dev-environment categories using parallel enrichment, find documentation gaps in your projects, detect when documented packages and tools have drifted from upstream registries (brew, npm, cask, crate, vscode), surface project-relevant knowledge before coding, and let autonomous agents audit and improve your notes — all without leaving your terminal.

## Installation

vp-knowledge is a **single-root hybrid**: the same `skills/` tree and `extensions/` factory serve both [Claude Code](https://claude.ai/code) and the Pi coding agent (0.32.6+). Claude's loader reads `.claude-plugin/` and ignores `package.json`, so the two installs coexist with no build step.

See [Prerequisites](#prerequisites) below for the MCP servers the enrichment pipelines need — at minimum, Basic Memory.

### On Claude Code

Via slash commands:

```bash
/plugin marketplace add voxpelli/vp-claude
/plugin install vp-knowledge@vp-plugins
```

Or add to `~/.claude/settings.json` manually:

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

### On Pi

Pi reads the root `package.json` `pi` key. Install the plugin (extension + shared skills tree), then the MCP shim — Pi ships no native MCP by design, so a shim provides it:

```sh
pi install <path-or-git-url-of-this-repo>
pi install npm:pi-mcp-adapter
```

Then wire the MCP servers the skills use (at minimum `basic-memory`) in `~/.pi/agent/mcp.json`:

```jsonc
{
  "mcpServers": {
    "basic-memory": { "command": "basic-memory", "args": ["mcp"] }
  }
}
```

See [`docs/pi-setup.md`](docs/pi-setup.md) for the full Pi story — the recommended `directTools: true` setting, the MCP mapping the extension injects, and the offline verification checks.

## What it does

### `/intel` — Research any package or dev tool

One research lifecycle (detect → check → resolve → enrich → synthesize → write → cross-link) for two families — packages and dev tools — routed by prefix. It queries the family's source roster in parallel, synthesizes a structured note, and cross-links existing notes. A single call may mix families (`/intel npm:fastify brew:ripgrep`).

#### Packages — seven sources, six ecosystems

Queries seven sources in parallel. Supports six ecosystems:

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
/intel @fastify/postgres
/intel crate:serde
/intel pypi:requests
```

| Source | What it finds |
|--------|--------------|
| Basic Memory | Existing notes, cross-references, usage patterns |
| DeepWiki | Architecture, design patterns, key APIs (2-3 targeted questions) |
| Context7 | API reference, code examples |
| Tavily | Security advisories, recent CVEs (RUSTSEC, PyPA, RubySec, etc.) |
| Raindrop | Your bookmarked articles (with full content extraction) |
| Readwise | Your highlights and saved articles about the package |
| Socket | Supply-chain risk scores (license, maintenance, quality, supply-chain, vulnerability) for npm, pypi, cargo, gem |

Plus changelog analysis via GitHub releases — with a git-tag fallback when the release list lags the registry version (a tag pushed without a published Release). After writing, searches for existing notes that reference the package and adds bidirectional cross-links, and rewrites any bare-name `[[Name]]` wiki-link stub elsewhere in the graph to the note's full title (bare-name links don't auto-resolve against a descriptor-titled note). The result is an ecosystem-prefixed note (`npm-*`, `crate-*`, `pypi-*`, etc.) with observations, relations, and release highlights — connected into the graph from day one.

#### Dev tools — six sources, eight categories

Queries six sources in parallel. Supports eight tool categories:

| Form | Category | Example |
|------|----------|---------|
| `brew:<name>` | Homebrew formula | `brew:ripgrep` |
| `brew:<owner>/<tap>/<name>` | Third-party Homebrew tap formula | `brew:dicklesworthstone/tap/br` |
| `cask:<name>` | Homebrew cask | `cask:warp` |
| `action:<owner>/<repo>` | GitHub Action | `action:actions/checkout` |
| `docker:<image>` | Docker Hub image | `docker:node` |
| `vscode:<publisher>.<ext>` | VSCode extension | `vscode:esbenp.prettier-vscode` |
| `gh:<owner>/<repo>` | GitHub CLI extension | `gh:meiji163/gh-notify` |
| `plugin:<owner>/<repo>` | Claude Code plugin | `plugin:voxpelli/vp-claude#vp-knowledge` |
| `skill:<owner>/<repo>` | Agent skill bundle (skills.sh) | `skill:obra/superpowers` |

```
/intel brew:ripgrep
/intel action:actions/checkout
/intel docker:node
/intel vscode:esbenp.prettier-vscode
/intel gh:meiji163/gh-notify
/intel plugin:voxpelli/vp-claude#vp-knowledge
/intel skill:obra/superpowers
```

| Source | What it finds |
|--------|--------------|
| Basic Memory | Existing notes, cross-references |
| DeepWiki | Architecture, design patterns (actions and docker; conditional for gh — only when `gh release list` returns ≥1 release) |
| Tavily | Security advisories, CVEs, supply-chain risks, gotchas |
| Raindrop | Your bookmarked articles (with full content extraction) |
| Readwise | Your highlights and saved articles about the tool |
| Local man page | Flag/option exhaustiveness for `brew:`/`cask:` — `man -P cat -- "<name>" \| col -bx \| head -300`; per-lookup skip when a formula ships no man page, or the whole source skips for the session if the `man`/`col` toolchain itself is missing (checked once, not per-lookup) |
| Homebrew MCP (optional) | Install analytics (30/90/365-day counts + build errors) for `brew:` and `cask:` — skipped silently when unavailable |
| Agent-leverage check (optional) | How a coding agent invokes the tool, split by the tool's own interface, not the agent — MCP server tools/flags for the rare MCP-native tool, `--json`/machine-readable CLI for any bash-driven agent (Claude Code's own Bash tool included, plus pi.dev, CI) — for `brew:`/`cask:` only (dev-tool-adjacent casks only); most CLIs get no line at all, recording only a genuine positive or a narrowly-scoped surprising negative |

Plus version/changelog data (GitHub releases for actions, Docker Hub tags for images, API versions for brew/vscode) — with a git-tag fallback for `action:`/`gh:`/`brew:` when the release list lags the newest git tag. For `vscode:`, it also records an **Open VSX trust signal** — a `[security]` observation placing the extension on a 4-state ladder (verified-restricted / public-namespace / **marketplace-only = squattable** / not-published-anywhere); a Marketplace-only extension has an unclaimed Open VSX namespace that fork-IDEs (Cursor, Windsurf, VSCodium) resolve installs against, a known supply-chain exposure. Third-party Homebrew taps (`brew:<owner>/<tap>/<name>`) get a dedicated fetch path — Ruby-DSL formula parsing, an upstream-repo DeepWiki pivot, a license cross-check against the upstream repo's own LICENSE, and a `.github/workflows` SLSA/SHA-256 hygiene audit — instead of misrouting to the core registry. **Library formulae** (mostly-transitive-dependency libs like `tree-sitter`/`icu4c`) are detected from the fetched metadata and get real-dependent verification via `brew uses --installed`/`brew deps`/`brew linkage` plus an `## Upgrade Impact on Dependents` section — so a note never over-claims dependents from technology alone (a dependency relation is `depends_on` only when the package manager confirms it; a statically-vendored technology link is `built_with`/`used_by`). After writing, searches for existing notes that reference the tool and adds bidirectional cross-links. The result is a prefixed note (`brew-*`, `action-*`, etc.) with type-specific sections — `## Inputs & Outputs` + `## Permissions` for actions, `## Tags` + `## Base Layers` for Docker, `## Common Usage` for formulae — plus observations and relations.

#### Batch mode ("upgrade haul")

Hand `/intel` a list of names or a pasted upgrade/outdated command line and it refreshes every already-documented note against its recorded→current version delta in one pass. The single prefixed-identifier path is unchanged; batch mode is purely additive, and is the executor half of `/knowledge-gaps --stale` — its batched-refresh offer routes straight into this mode. For **packages** (`npm outdated`, `npm i a@latest b@latest`, and the crate/go/composer/pypi/gem equivalents) it synthesizes a curated changelog reel for just that interval, stamps the new version into the `## Release Highlights` prose, and records the machine-stable `[version]` observation where the schema carries that slot (npm today; the other ecosystems as the slot lands). For **tools** (`brew upgrade` / `brew outdated` or a list of bare names) it routes bare names to formula or cask automatically via the artifacts-vs-`Dependencies` shape signal (re-dispatching from `fetch-brew-upstream.sh` to `fetch-cask-upstream.sh` on a `not-in-api` result) and records each note's delta as inline `[feature]` / `[version]` observations.

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

Also detects **concept-level hub gaps** — topics referenced by 3+ notes but with no dedicated note — and **reading-signal gaps** from Readwise highlights. Offers to run `/intel` for top undocumented packages (with the right ecosystem prefix) and for undocumented tools.

### `/knowledge-gaps --stale` — Check version drift across ecosystems

A focused alternative mode of `/knowledge-gaps` that detects when documented notes have drifted from their upstream stable releases. Takes an optional ecosystem token — `--stale [brew|npm|cask|crate|vscode|plugin]` (bare = all six). Uses an MCP-first workflow (BM-side data via `list_directory` + `read_note`) plus per-ecosystem API-only worker scripts (`scripts/fetch-<eco>-upstream.sh`) for upstream facts. vscode checks both Open VSX (authoritative) and the VS Marketplace (annotation); plugin has no registry at all, so its worker resolves `plugin.json` directly from GitHub via `gh api`. For npm, the recorded version is read from a machine-stable `[version]` observation (emitted by `/intel`) before falling back to header/prose extraction, so version-centric packages can't be misparsed.

```
## Version Drift — brew — 40 documented notes checked

#### Drifted >30d (3 notes — refresh recommended)

| Note      | Documented | Upstream | Released | Refresh command           |
|-----------|------------|----------|----------|---------------------------|
| brew-bat  | 0.24.0     | 0.26.1   | 47d ago  | `/intel brew:bat`    |
| brew-deno | 1.45.5     | 2.4.1    | 31d ago  | `/intel brew:deno`   |
| brew-eza  | 0.18.0     | 0.20.5   | unknown  | `/intel brew:eza`    |

#### Archive candidates (1 note)
| Note      | Documented | Upstream status | Suggested action            |
|-----------|------------|-----------------|-----------------------------|
| brew-foo  | 1.2.3      | deprecated      | `move_note(... archive/...)` |

#### Not in registry (2 notes — drift check skipped)
- brew-arm-none-eabi-gcc, brew-mcp-netutils
```

Bucket names (`Drifted >30d`, `Drifted <30d`, `Drifted, age unknown`, `Archive candidates`, `Unparseable`, `Not in registry`, `API unavailable`) match the ones the `knowledge-gardener` agent's own version-drift audit emits, so a report from either source feeds the same `knowledge-maintainer` refresh queue — the two are interchangeable inputs. That queue never runs a refresh automatically; it lists `Drifted >30d` notes (and any note with a prior security flag) for a human to action afterward. Supported cohorts: brew, npm, cask, crate, vscode. `action`/`gh`/`go`/`docker` are excluded (no single canonical comparable version); `pypi`/`gem`/`composer` are deferred until their cohorts grow.

### `/knowledge-prime` — Surface project-relevant knowledge

Scans your project's manifest files, cross-references dependencies against Basic Memory, and produces a concise context brief with key gotchas, coverage gaps, and recently updated notes:

```
## Project Knowledge Brief

### Stack detected
- npm: 45 deps (38 documented, 7 undocumented)
- brew: 12 tools (10 documented, 2 undocumented)

### Key gotchas
- **npm-fastify** — [gotcha] reply.send() after reply.redirect() causes hang
- **npm-pino** — [limitation] redaction doesn't work on nested arrays

### Recent activity
- 3 notes updated in last 7 days: npm-fastify, npm-pino, brew-ripgrep

### Gaps worth filling
- Top undocumented dep: `undici` (used in 12 imports)
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

### `/people-intel <name>` — Research any person

Queries five sources in parallel, synthesizes a structured person note, and cross-links existing notes:

```
/people-intel Aaron Gustafson
/people-intel Linus Torvalds
```

| Source | What it finds |
|--------|--------------|
| Basic Memory | Existing mentions, cross-cluster connections (depth-2 traversal) |
| Raindrop | Your bookmarked articles by or about the person |
| Readwise | Your highlights from their writing |
| Tavily | Bio, current role, projects, contributions, controversies |
| DeepWiki | GitHub repo philosophy (developer profiles only) |

Includes a fourth-wall guardrail (no self-referential knowledge-graph content in person notes) and an anti-hagiography step (explicit controversy search). After writing, searches for existing notes that mention the person and adds bidirectional cross-links using the person schema's relation vocabulary (`created`, `founded`, `maintains`, `works_with`, `enables`, `relates_to`), and rewrites any bare-name `[[Name]]` wiki-link stub elsewhere in the graph to the note's full title (bare-name links don't auto-resolve against a descriptor-titled note).

### Knowledge Gardener — Read-only graph auditor

An autonomous agent that produces a health report without modifying anything:

> "Audit my knowledge graph"

Checks for: missing sections, schema violations, orphan notes, broken `[[wiki-links]]`, stale notes (90+ days), **version drift** (recorded versions compared against upstream registries for brew, npm, cask, crate, and vscode, emitted as `### Version Drift — <eco>` report sections), duplicates, project-specific data leaking into cross-project notes, tag alignment (non-canonical forms, retired tags, missing ecosystem tags, out-of-vocabulary tags), and fourth-wall violations (self-referential knowledge-graph language in subject-domain notes).

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
| Fix fourth-wall violations (self-referential graph language) | Auto-fix |
| Run `/intel` for Tier 1 undocumented packages and undocumented tools from manifests | Auto-fix |
| Enqueue drifted notes (>30d, or any security-flagged target) into a Refresh Queue | Queues for review |
| Archive deprecated/disabled packages (brew/cask/npm) | Asks first |
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

Each answer includes a confidence tier (Direct, Partial, or No Coverage) so you know how much the graph actually covers. When coverage is incomplete, suggests `/intel` or `/knowledge-gaps` to fill the gap. Unlike `/knowledge-prime` (which shows project-wide dependency coverage), `/knowledge-ask` answers specific questions about individual topics.

### `/knowledge-garden [note ...]` — Audit named notes

A read-only skill that audits a bounded set of named notes for schema, structure, relation integrity, orphan status, and fourth-wall quality, then reports copy-paste-ready remediation:

> "Audit npm-fastify and npm-undici" / "Fourth-wall check on the Ted Nelson note"

The scoped, interactive sibling of the `knowledge-gardener` agent. Named-note requests run inline in the main session; graph-wide requests delegate to the agent via `Agent` so the full sweep's hundreds of note reads stay out of the main context. Explicit `/command` only (`disable-model-invocation`) — the agent owns automatic graph-wide routing. Hands fixes to `/knowledge-maintain`.

### `/knowledge-maintain [note ...]` — Fix named notes

A write skill that applies targeted fixes to a bounded set of named notes — missing sections, relation-verb drift, trailing-observation tidies, archival — inline, so you see and confirm each edit:

> "Fix the orphan links in npm-foo" / "Apply the audit fixes to these two notes"

The scoped, interactive sibling of the `knowledge-maintainer` agent. Heavy or autonomous remediation ("fix the whole audit", anything that spawns `/intel`, brew-refresh batches) delegates to the agent via `Agent`. Explicit `/command` only (`disable-model-invocation`). Shares the agent's write discipline: `find_replace` only (never `append`+`section`), read-before-edit, a before/after observation-count check on any insert-then-strip move to catch accidental content loss, `schema_validate` after each change, and `write_note`/`delete_note` excluded (new notes via the intel skill, archival via `move_note`).

### `/session-reflect` — On-demand conversation capture

A user-triggered skill that reviews the current conversation and saves insights to Basic Memory with your approval:

> "Reflect on this session" / "Save what we learned" / "Commit this to memory"

User-triggered: extracts candidates, finds the right target notes, shows a grouped preview, and waits before writing anything. Uses the `[decision]`, `[lesson]`, `[gotcha]`, `[pattern]`, `[limitation]`, and `[breaking]` observation vocabularies.

### `/session-bookmarks` — Save high-signal URLs from a session

Scans the current conversation for high-signal URLs discovered during research and creates Raindrop bookmarks in the AI-bookmarked collection (after preview + approval):

> "Bookmark URLs from this session" / "Save links we found" / "Save session URLs"

Auto-delegated by `/session-reflect` when the conversation contains worth-keeping links, or invocable standalone. Creates 1-3 bookmarks per call, each with a one-line note explaining why it was bookmarked. Operates only within the AI-* collection namespace — never touches user-curated collections.

### `/raindrop-triage` — Interactive unsorted bookmark triage

Triages unsorted Raindrop bookmarks in interactive batches:

> "Triage unsorted bookmarks" / "Clean up raindrop inbox" / "Sort unsorted"

The first pass deduplicates by normalized URL (stripping tracking params), detects research bursts (temporal clusters of 3+ bookmarks within 30 minutes), clusters by theme, proposes vocabulary-grounded tags, and moves approved bookmarks to AI-triaged. A `--promote` pass classifies AI-triaged items into AI-sorted (default), AI-gems (golden), AI-archive (low-reuse), or AI-attention (needs human decision) with structured note annotations. Operates within a 6-collection AI-managed namespace — never touches user-curated collections.

### `/tag-sync [count|--reset]` — Curate Raindrop tag vocabulary

Fetches your tags from Raindrop, curates the top N by usage count, adds one-line characterizations, groups by cluster, and writes/syncs the vocabulary file at `~/.claude/references/raindrop-tags.md`:

> "Sync raindrop tags" / "Refresh tag vocabulary" / "Update raindrop-tags.md"

Used by `/raindrop-triage` as the canonical tag dictionary — the vocabulary file's frontmatter holds the blocklist, context tags, and naming conventions read at triage time. `--reset` rebuilds the file from scratch; without flags, syncs the top N (default 200) tags.

### Raindrop Gardener — Read-only Raindrop tag auditor

A read-only autonomous agent that audits the Raindrop bookmark library:

> "Audit raindrop tags" / "Check raindrop tag health"

Produces a structured report covering: library dashboard, tag inventory, naming violations, near-duplicate tags, mistagged bookmarks (via `find_mistagged_bookmarks`), orphan tags, legacy tag identification, co-occurrence analysis, non-primary-language tag detection, and taxonomy gaps. Output includes exact `update_tags` and `delete_tags` tool calls as copy-paste recommendations. Never modifies tags or bookmarks itself.

### `/nudge` — Sync the Claude Code nudge tip cache

Reads the `Claude Code Noteworthy Features` Basic Memory note via MCP, filters out any feature already marked adopted in frontmatter, and writes the eligible tips to `~/.claude/references/claude-code-nudge-tips.txt` for the SessionStart hook to read:

> "Sync nudge tips" / "Refresh the tip cache" / "Nudge sync"

Follows the same fetch-and-regenerate approach as `/tag-sync`: it fully rewrites the tip cache file each run. Reads BM via fast MCP, never the slow `bm` CLI; the SessionStart hook it feeds reads only the local cache file, never Basic Memory.

### `/nudge check` — Track adoption of noteworthy Claude Code features

Scans recent session transcripts across all projects for real evidence of feature use, cross-references against the `[nudge]`-tagged catalog, previews which features have adoption evidence versus none, and updates each feature's status in Basic Memory after approval:

> "Nudge me on unused features" / "Which Claude Code features haven't I adopted" / "Nudge adoption"

Mirrors `/session-reflect`'s scan → preview → approve → write shape. Marking a feature adopted stops it from being surfaced by the SessionStart tip — regenerating the same cache `/nudge` writes closes the loop.

### Hooks — Automated quality guardrails

Five hooks run automatically in the background:

- **PostToolUse** (BM writes) — After any `write_note` or `edit_note`, validates the note structure against its schema and scans the note content for deterministic fourth-wall violations. Catches malformed notes and self-referential graph language immediately.
- **PostToolUse** (file edits) — After editing shell scripts, detects formatting drift with `shfmt -d`, surfaces the diff, and auto-fixes with `shfmt -w`. After editing schema files, reminds to sync Basic Memory.
- **PostToolUseFailure** — Classifies Basic Memory write and schema tool failures into five categories with actionable recovery guidance.
- **SessionStart** — Injects a knowledge graph status summary and suggests `/knowledge-prime` for project context or `/knowledge-ask` for topic-specific questions. After a compaction (`source=compact`), it also re-injects a condensed graph-recovery context so the continuing session still knows the Basic Memory tools and research skills exist. On non-compact sessions it also surfaces one learning-nudge tip per day (throttled, no repeats) from the `/nudge`-synced cache, behind a `VP_KNOWLEDGE_DISABLE_NUDGE=1` kill-switch.
- **PreToolUse** (gardener Bash) — Blocks Python and Node.js script execution when running as the knowledge-gardener agent (via `permissionDecision: "deny"`), enforcing read-only discipline.

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

`/intel`'s package-family (seven-source) and tool-family (six-source) pipelines need these additional MCP servers and plugins. Context7 and Socket are used by the package family only; DeepWiki and Tavily are used by both; Readwise is used by both plus `/knowledge-gaps`.

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

**[Socket](https://socket.dev/blog/introducing-socket-mcp)** — supply-chain risk scores (license, maintenance, quality, supply-chain, vulnerability) for npm, PyPI, Rust/cargo, and RubyGems packages. Used by `/intel`'s package family only:

```bash
claude mcp add --transport http socket-mcp https://mcp.socket.dev/
```

### Optional for intel's tool family

**[Homebrew MCP](https://github.com/Homebrew/brew/blob/master/Library/Homebrew/mcp_server.rb)** — bundled with Homebrew 4.5+ (`brew mcp-server`). Surfaces install analytics (30/90/365-day install counts and build-error counts) in human-readable form. The same counts are also in the `formulae.brew.sh` JSON API's `analytics` block that `/intel` already fetches in Step 2, so the MCP is a convenience source, not the only one. `/intel` picks the counts up as `[popularity]` observations on `brew:` and `cask:` notes; when the MCP is not installed, `/intel` falls back to that JSON `analytics` data without affecting the rest of the research.

```bash
claude mcp add homebrew -- brew mcp-server
```

### Optional

- **[`gh` CLI](https://cli.github.com)** — enables changelog analysis via GitHub releases (with a git-tag fallback when the release list lags) in `/intel`

## Plugin structure

Every note this plugin writes follows a schema — a structured contract for required sections and observation categories. The schema files under `schemas/` below are the version-controlled source of truth: each note type's schema self-seeds into Basic Memory the first time a note of that type is written via `/intel` (e.g. researching an npm package seeds only `npm_package`, not the other 22), and stays dual-synced with its Basic Memory copy afterward. `/schema-evolve` (above) detects when real note usage has drifted from a schema and proposes updates to both.

```
.claude-plugin/plugin.json             Plugin manifest
.claude-plugin/marketplace.json        Marketplace listing for vp-plugins
skills/
  intel/
    SKILL.md                           Shared-core, two-family research workflow (package: 7 sources; tool: 6 sources)
    references/enrichment-package.md   Package-family enrichment step (Step 3 branch)
    references/enrichment-tool.md      Tool-family enrichment step (Step 3 branch)
    references/ecosystem-npm.md        npm registry API + note template
    references/ecosystem-crates.md     crates.io API + note template
    references/ecosystem-go.md         Go module proxy + note template
    references/ecosystem-composer.md   Packagist API + note template
    references/ecosystem-pypi.md       PyPI API + note template
    references/ecosystem-gems.md       RubyGems API + note template
    references/ecosystem-brew.md       formulae.brew.sh API
    references/ecosystem-cask.md       formulae.brew.sh/cask API
    references/ecosystem-action.md     action.yml extraction + permissions
    references/ecosystem-docker.md     Docker Hub API + tag strategy
    references/ecosystem-vscode.md     Open VSX API + VS Marketplace fallback
    references/ecosystem-gh.md         gh CLI extension API + classification ladder
    references/ecosystem-plugin.md     Claude plugin manifest (marketplace.json + plugin.json) + trust ladder
    references/ecosystem-skill.md      skills.sh bundle (SKILL.md + tree + install counts)
    references/note-template-npm.md    npm_package note template
    references/note-template-crates.md crate_package note template
    references/note-template-go.md     go_module note template
    references/note-template-composer.md composer_package note template
    references/note-template-pypi.md   pypi_package note template
    references/note-template-gems.md   ruby_gem note template
    references/note-template-brew.md   brew_formula note template
    references/note-template-cask.md   brew_cask note template
    references/note-template-action.md github_action note template
    references/note-template-docker.md docker_image note template
    references/note-template-vscode.md vscode_extension note template
    references/note-template-gh.md     gh_extension note template
    references/note-template-plugin.md claude_plugin note template (plugin + skill)
    references/gh-api-fallback.md      GitHub API fallback for unindexed/wrong-repo cases (shared, both families)
    references/forge-fallback.md       Forge-agnostic fallback helper (shared, both families)
    references/upgrade-haul.md         Shared batch-refresh core (both families)
    references/upgrade-haul-adapter-tool.md  Tool-family batch adapter
    references/note-lookup-and-freshness.md  Shared existing-note lookup + freshness check
    references/verify-before-capture.md      Shared claim-verification step
    references/cross-link-existing-notes.md  Shared post-write cross-linking step
    references/note-write-mechanics.md       Shared write/edit mechanics
  knowledge-gaps/
    SKILL.md                           Package + tool + concept coverage analysis; --stale flag switches to the version-drift check
    references/concept-detection.md    Concept-level hub gap detection
    references/standard-detection.md   Domain standard coverage detection
    references/staleness-detection.md  Version-drift check across ecosystems (the --stale workflow)
    references/report-templates.md     Knowledge-gap + tool-coverage report templates
  knowledge-prime/
    SKILL.md                           Project context priming from BM
  schema-evolve/
    SKILL.md                           Schema drift detection and dual-sync
  session-reflect/
    SKILL.md                           On-demand conversation → memory capture
  knowledge-ask/
    SKILL.md                           Freeform Q&A against the BM knowledge graph
  knowledge-garden/
    SKILL.md                           Scoped note audit inline; delegates graph-wide to gardener agent
  knowledge-maintain/
    SKILL.md                           Scoped note fixes inline; delegates heavy remediation to maintainer agent
  vp-note-quality/
    SKILL.md                           Fourth-wall anti-pattern checklist (not user-invocable)
  tag-sync/
    SKILL.md                           Raindrop tag vocabulary sync
  session-bookmarks/
    SKILL.md                           Session URL bookmarking to Raindrop
  raindrop-triage/
    SKILL.md                           Interactive unsorted bookmark triage
    references/                        Tag selection strategy + promote workflow
  people-intel/
    SKILL.md                           Five-source person research
    references/note-template-person.md Person note template
    references/source-guide.md         Source-specific research guidance
  nudge/
    SKILL.md                           Mode-routed: bare = BM note -> local tip cache sync; check = transcript-scan feature-adoption tracking -> BM frontmatter
    references/tip-cache-contract.md   Shared exclusion rule + line grammar (used by both modes)
    references/evidence-detection.md   Adoption-mode transcript evidence detection
    references/adoption-limitations.md Adoption-mode known limitations
agents/
  knowledge-gardener.md                Read-only graph auditor (tags + fourth-wall)
  knowledge-maintainer.md              Read-write graph enhancer (effort: high)
  knowledge-primer.md                  Autonomous project context priming
  raindrop-gardener.md                 Read-only Raindrop tag auditor
hooks/
  hooks.json                           PreToolUse, PostToolUse x2, PostToolUseFailure,
                                       SessionStart
  pre-bash-no-python.sh                Python/Node.js blocker for gardener agent
  post-bm-write-validate.sh            Schema validation after BM writes
  post-bm-failure-classify.sh          Error classification for BM failures
  session-start.sh                     Graph context + priming hint script
  tip-fragment.sh                      Learning-nudge tip surfacer, invoked by session-start.sh
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
  gh_extension.md                      gh CLI extension schema (gh_extension type)
  claude_plugin.md                     Claude plugin / skills.sh bundle schema (claude_plugin type)
  engineering.md                       Engineering knowledge schema (engineering type)
  pattern.md                           Cross-domain structural insight schema (pattern type)
  reference.md                         Lookup document schema (reference type)
  standard.md                          Protocol/standard schema (standard type)
  concept.md                           Concept/movement schema (concept type)
  milestone.md                         Milestone/history schema (milestone type)
  service.md                           Service/product schema (service type)
  person.md                            Person schema (person type)
  project.md                           Project schema (project type)
  git_builtin.md                       git built-in command schema (git_builtin type)
scripts/
  audit-helpers.sh                     Audit subcommands: bm-stats, scope-leak summary/detail
  audit-scope-leak.sh                  Project-specific content detection in cross-project notes
  check-hooks.mjs                      Hook integration tests (npm run check:hooks)
  check-staleness-contract.mjs         Staleness drift-bucket contract tests (npm run check:contract)
  check-version-distance.mjs           Version-distance classifier tests (npm run check:distance)
  check-fourthwall.mjs                 Fourth-wall rule registry tests (npm run check:fourthwall)
  check-release-counts.mjs             Component-count contract: CLAUDE.md ↔ disk (npm run check:release-counts)
  check-mdast.mjs                      mdast prose/fenced split tests (npm run check:mdast)
  check-list-installed-plugins.mjs     Installed-plugin/skill resolver tests (npm run check:installed-plugins)
  check-plugin-load-paths.mjs          ${CLAUDE_PLUGIN_ROOT} cross-load path resolution tests (npm run check:plugin-load-paths)
  check-portability.mjs                Same/cross-skill ref classifier for skills.sh install survivability (npm run check:portability)
  check-bm-version-extract.mjs         S2 version-extractor tests (npm run check:bm-version-extract)
  check-analytics-guidance.mjs         Brew/cask analytics-source doc-rot guard (npm run check:analytics-guidance)
  check-observation-metadata.mjs       Verified:/Since:/Ownership: trailer parser tests (npm run check:obs-metadata)
  check-schema-vocab.mjs               Relation-verb drift guard tests (npm run check:schema-vocab)
  list-installed-plugins.mjs           CLI: emit NDJSON of installed plugins/skills for /knowledge-gaps --global
  fetch-brew-upstream.sh               API-only upstream facts for brew formulae (stdin: names; never reads ~/basic-memory)
  fetch-cask-upstream.sh               API-only upstream facts for casks (bulk cask.json; comma-segment version; opportunistic Tier-2 tap-bump-date enrichment)
  fetch-npm-upstream.sh                API-only upstream facts for npm packages (abbreviated packument)
  fetch-crate-upstream.sh              API-only upstream facts for crates (crates.io; UA + 1s rate-limit)
  fetch-vscode-upstream.sh             API-only upstream facts for VSCode exts (Open VSX + VS Marketplace)
lib/
  staleness-contract.mjs               Pure emit↔consume bucket-contract logic (imported by validate-plugin.mjs + check:contract)
  version-distance.mjs                 Semver↔calver version-distance classifier + ahead-of-registry ordering guard (check:distance)
  fourth-wall-rules.mjs                Fourth-wall rule registry + parity contracts (check:fourthwall)
  release-counts.mjs                   Component-count parse/compare (check:release-counts)
  mdast.mjs                            Shared mdast prose/heading collectors + unclosed-fence detector (check:mdast; used by validate-plugin)
  installed-plugins.mjs                Pure installed-plugin/skill resolver (used by list-installed-plugins.mjs)
  plugin-load-paths.mjs                Pure ${CLAUDE_PLUGIN_ROOT} path extractor (check:plugin-load-paths)
  portability-scan.mjs                 Pure same/cross-skill/tooling ref classifier (check:portability)
  bm-version-extract.mjs               Pure S2 version extractor, 6 priority patterns (check:bm-version-extract)
  analytics-guidance.mjs               Brew/cask analytics-source doc-rot detector (check:analytics-guidance)
  observation-metadata.mjs             Verified:/Since:/Ownership: observation-trailer parser (check:obs-metadata)
  schema-vocab.mjs                     Canonical relation-verb extraction + drift check (check:schema-vocab)
  check-harness.mjs                    Shared check()/done() fixture-test harness, used by all scripts/check-*.mjs
validate-plugin.mjs                    Plugin validator (color enum, frontmatter, MCP prefixes, staleness-bucket contract, relation-vocabulary drift, fence-balance, bare built-in tool audit)
VOICE.md                               Plugin identity, agent colors, description-tone conventions
```

## How it fits together

```
 User says            Triggers              Output
 ─────────────────    ───────────────────    ──────────────────────────
 /intel X  -> intel skill (package family) -> <ecosystem>-X note + cross-links
 /intel prefix:X -> intel skill (tool family)    -> <type>-X note + cross-links
 /knowledge-gaps   -> knowledge-gaps skill-> gap report (packages, tools, concepts)
                                             + offers /intel
 /knowledge-gaps --stale -> knowledge-gaps (--stale mode) -> version drift report (per ecosystem)
                                                     + offers /intel refreshes
 /knowledge-prime  -> knowledge-prime     -> context brief with gotchas + gaps
 /knowledge-ask Q  -> knowledge-ask skill -> cited answer + confidence tier
 /schema-evolve X  -> schema-evolve skill -> field proposals + dual-sync
 /tag-sync [N]     -> tag-sync skill     -> ~/.claude/references/raindrop-tags.md
 /session-bookmarks-> session-bookmarks  -> AI-bookmarked collection in Raindrop
 /raindrop-triage  -> raindrop-triage   -> dedupe + burst detect + tag + AI-triaged
                      (--promote)       -> classify into sorted/gems/archive/attention
 /session-reflect  -> session-reflect    -> BM notes + delegates /session-bookmarks
 /people-intel X   -> people-intel skill -> person note + cross-links
 /knowledge-garden N -> knowledge-garden  -> scoped audit of named notes (inline)
                      (no args/graph-wide)-> delegates to knowledge-gardener agent
 /knowledge-maintain N -> knowledge-maintain -> scoped fixes to named notes (inline, confirmed)
                      (heavy remediation) -> delegates to knowledge-maintainer agent
 "audit graph"     -> knowledge-gardener  -> health report (read-only, incl. tags)
 "fix the graph"   -> knowledge-maintainer-> structural + tag fixes + confirmations
                      ├── audits graph inline (lightweight)
                      ├── auto-fixes structure and tags
                      ├── auto-runs /intel for Tier 1 package gaps and undocumented tool manifests
                      ├── enqueues drifted notes (>30d) into a Refresh Queue for a human to action
                      └── asks before content changes
 "prime context"   -> knowledge-primer    -> context brief (autonomous agent)
 "audit tags"      -> raindrop-gardener   -> tag health report (read-only)

 [any BM write]    -> PostToolUse hook    -> schema validation feedback
 [any file edit]   -> PostToolUse hook    -> shfmt drift diff + schema sync reminder
 [BM tool failure] -> PostToolUseFailure  -> classified error + recovery guidance
 [session start]   -> SessionStart hook   -> graph context + priming hint
 /session-reflect  -> session-reflect     -> preview + write to BM
```

## Relationship to upstream

This plugin depends on but does not duplicate the 10 core `memory-*` skills from [`basicmachines-co/basic-memory-skills`](https://github.com/basicmachines-co/basic-memory-skills) (notes, schema, tasks, lifecycle, reflect, etc.). It adds multi-ecosystem package research (npm, Rust, Go, PHP, Python, Ruby), developer tool research (Homebrew, GitHub Actions, Docker, VSCode), project-level gap analysis, project context priming, knowledge exploration, Readwise integration, schema evolution, tag alignment, and autonomous graph maintenance on top of those foundations.

## Possible future additions

These are scoped out of current releases but worth tracking:

- **Tier-drift log for `knowledge-gaps`** — track when packages move between tiers over time so you can see which undocumented packages are becoming more critical (medium effort, medium value)
- **Per-audit reflection notes from `knowledge-gardener`** — the gardener is intentionally read-only; surfacing audit findings to Basic Memory would need a new output mechanism (e.g. a paired write agent step or a PostToolUse hook on the audit output)
- **Adaptive research depth in `intel`'s package family** — extend the 60-day freshness check into a multi-tier strategy: skip specific sources based on what changed since last update, weight sources by past yield for a given package (Phase 2+ from ACE/MemInsight research patterns)

## Migration notes

### v0.22.0 — Hyphen-delimited note titles and wiki-links

Note titles and wiki-links use **hyphen delimiters** (`npm-fastify`, `[[npm-fastify]]`) instead of colons (`npm:fastify`, `[[npm:fastify]]`). User command syntax is unchanged (`/intel npm:fastify`). Vaults populated before v0.22.0 needed a one-time title rename when this shipped.

## License

MIT
