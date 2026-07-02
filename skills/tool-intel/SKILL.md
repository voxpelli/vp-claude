---
name: tool-intel
description: "This skill should be used when the user asks to 'research a homebrew formula', 'brew intel', 'what does [brew-tool] do', 'research a cask', 'cask intel', 'what does [cask] do', 'research a GitHub Action', 'action intel', 'what does [action] do', 'research a docker image', 'docker intel', 'what does [docker image] do', 'research a VSCode extension', 'vscode intel', 'what does [extension] do', 'research a gh extension', 'research a gh CLI extension', 'gh extension intel', 'what does [gh-extension] do', 'research a Claude Code plugin', 'plugin intel', 'research an agent skill', 'skill intel', 'what does [plugin/skill] do', 'add tool to knowledge graph', 'enrich [tool]', 'brew upgrade', 'brew outdated', 'upgrade haul', pasted brew upgrade output. Researches a developer environment or CI/CD tool using five-source enrichment (DeepWiki, Tavily, Raindrop, Readwise, changelog) and creates/updates a structured Basic Memory note with post-write cross-linking. Supports Homebrew formulae (brew:), Homebrew casks (cask:), GitHub Actions (action:), Docker images (docker:), VSCode extensions (vscode:), GitHub CLI extensions (gh:), Claude Code plugins (plugin:), and skills.sh agent-skill bundles (skill:)."
user-invocable: true
argument-hint: "<prefix>:<name>"
allowed-tools:
  - Bash
  - Read
  - mcp__basic-memory__search_notes
  - mcp__basic-memory__read_note
  - mcp__basic-memory__write_note
  - mcp__basic-memory__edit_note
  - mcp__basic-memory__build_context
  - mcp__basic-memory__list_directory
  - mcp__deepwiki__ask_question
  - mcp__tavily__tavily_search
  - mcp__tavily__tavily_extract
  - mcp__raindrop__find_bookmarks
  - mcp__raindrop__fetch_bookmark_content
  - mcp__readwise__readwise_search_highlights
  - mcp__readwise__reader_search_documents
  - mcp__homebrew__info
---

# Tool Intelligence

Research a developer environment or CI/CD tool and synthesize a structured
Basic Memory note using five enrichment sources, then cross-link existing notes.
Supports Homebrew formulae, Homebrew casks, GitHub Actions, Docker images,
VSCode extensions, and GitHub CLI extensions.

## Arguments

One argument: the tool identifier with a required ecosystem prefix.

| Form | Ecosystem | Example |
|------|-----------|---------|
| `brew:<name>` | Homebrew formula | `brew:ripgrep` |
| `cask:<name>` | Homebrew cask | `cask:warp` |
| `action:<owner>/<repo>` | GitHub Action | `action:actions/checkout` |
| `docker:<image>` | Docker Hub image | `docker:node` |
| `docker:<org>/<image>` | Docker Hub community | `docker:grafana/grafana` |
| `vscode:<publisher>.<ext>` | VSCode extension | `vscode:esbenp.prettier-vscode` |
| `gh:<owner>/<repo>` | GitHub CLI extension | `gh:meiji163/gh-notify` |
| `plugin:<owner>/<repo>` | Claude Code plugin (opt. `#<name>`) | `plugin:voxpelli/vp-claude#vp-knowledge` |
| `skill:<owner>/<repo>` | Agent skill bundle (skills.sh; opt. `#<name>`) | `skill:obra/superpowers` |

**Identifier normalization:**
- `action:` — strip `@version` suffix from `uses:` lines (e.g., `actions/checkout@v4` → `action:actions/checkout`)
- `docker:` — strip `:tag` suffix (e.g., `node:22-alpine` → `docker:node`)
- `vscode:` — always `publisher.extension-id` dot-separated
- `gh:` — strip `https://github.com/` if pasted, strip `@<tag>` suffix, require `owner/repo` form (e.g., `gh:meiji163/gh-notify`); error if no `/` is present
- `plugin:` / `skill:` — strip `https://github.com/` if pasted; require `owner/repo`; an optional `#<name>` suffix selects one plugin/skill from a multi-artifact repo (a marketplace holding several plugins, or a multi-skill bundle); error if no `/` is present. Build the title **literally** from the identifier you were given — do NOT drop a `#<name>` suffix even when it repeats the repo's last path segment. Whether that suffix is redundant depends on the install's source branch (a single-plugin self-hosted marketplace vs. a multi-plugin repo), which only the `/knowledge-gaps --global` resolver (`lib/installed-plugins.mjs`) can determine — and its offer already hands you the canonical, de-duplicated identifier verbatim. On a rare manual paste of a redundant suffix, Step 1's existence check (glob on the leaf `#`/`/`-segment) finds the canonical note so you update it instead of forking a duplicate.

## Batch detection: upgrade haul

**Before single-identifier dispatch**, check whether the input is a *batch
refresh* rather than one research call. Trigger the upgrade-haul flow when the
input is either:

- a pasted **`brew upgrade` / `brew outdated`** command line (or any
  `brew install`/`brew reinstall` line with **two or more** operands), or
- **two or more bare identifiers** (a space- or newline-separated list of names,
  with or without `brew:`/`cask:` prefixes).

Neither a single prefixed identifier (`/tool-intel brew:ripgrep`) **nor a single
bare name** (`/tool-intel ripgrep`) is a batch — both fall straight through to
[Step 0](#step-0-detect-ecosystem) unchanged (a bare name with no prefix hits
Step 0's normal prefix-error path, prompting for `brew:`/`cask:`). The batch
hook fires only on two or more operands.

When triggered, **load the shared reference** for the ecosystem-agnostic core
(input parsing, highlights-reel synthesis, the two recording axes, stale-cache
arbitration, batch orchestration, and the `--stale` relationship):

```
Read ${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/upgrade-haul.md
```

(The shared reference lives under `package-intel/references/` even though both
intel skills load it — same home as `forge-fallback.md`.) Do **not** restate its
mechanics here; the tool-intel-specific routing below is the *adapter* the
shared reference delegates to. Then resolve the batch per the adapter and run
each item through [Step 0](#step-0-detect-ecosystem) onward on the freshness
fast-path.

### Adapter: tool-intel surface

This section is the per-skill adapter the shared reference's
*Per-skill adapter contract* requires. It owns three things; everything else
(Axis A, orchestration, arbitration) is shared and lives in the reference.
Per-item outcomes and the batch-close summary follow the shared reference's
*Batch-outcome contract* — no adapter-specific extension needed.

**1. Input dialect.** Command words and flags that are noise:
`brew upgrade`, `brew outdated`, `brew install`, `brew reinstall`, leading
`-`/`--` flags, and a trailing redirect. The operands are the identifiers.
Strip version qualifiers per the shared reference (`claude-code@latest` →
`claude-code`).

**2. Ecosystem routing — bare-name → formula/cask auto-routing.** A pasted
`brew upgrade foo bar` yields **bare names with no `brew:`/`cask:` prefix**, so
the class (formula vs cask) is unknown up front. Resolve each operand:

- Run `brew info <name>` (or `mcp__homebrew__info` when the Homebrew MCP is
  reachable) and reuse the **artifacts-vs-Dependencies shape signal**: a cask
  exposes an `artifacts` block (`app`, `binary`, `pkg`); a formula exposes
  `Dependencies` / build-from-source fields. Route an `artifacts`-shaped result
  to the `casks/` directory (`brew_cask`), a `Dependencies`-shaped result to the
  `brew/` directory (`brew_formula`).
- An already-prefixed operand (`brew:foo`, `cask:bar`) skips this inference and
  routes by its prefix directly.

**Step-1 existence check globs BOTH directories.** Because formula-vs-cask is
unknown before routing, run the [Step 1](#step-1-check-for-existing-note)
existence check against **both** `brew/` and `casks/` for an unknown-class bare
name:

```
list_directory(dir_name="brew",  file_name_glob="*<name>*")
list_directory(dir_name="casks", file_name_glob="*<name>*")
```

Whichever directory holds the note fixes the class (and tells you the note
already exists, so you update rather than fork). If neither matches, fall back to
the `brew info` shape signal above to pick the class for a new note.

**If the shape signal is ambiguous, do not guess.** A dependency-free formula
(common for single-binary Go/Rust tools) exposes no `Dependencies` block; a
`brew info` / `mcp__homebrew__info` call can also error, or a name can resolve as
*both* a formula and a cask. In any of these cases — no clean `artifacts` shape,
no clean `Dependencies` shape, both present, or an error — surface the operand as
`class-ambiguous` in the batch summary ("needs an explicit `brew:`/`cask:`
prefix") and skip it from the auto-routed batch rather than misfiling a note
under the wrong type. (The Step-1 dual-directory glob above already resolves the
common case — an existing note — so this only bites a genuinely new, ambiguous
bare name.)

**Cask version-fetch routing on a `not-in-api` signal (dogfood edge case).**
`scripts/fetch-brew-upstream.sh` reads `formulae.brew.sh`, which is
**core-formula-only**, so it returns `upstream_state: "not-in-api"` for any
**cask** *and* for any third-party-tap formula. Join the fetch output to each
operand **by `name`**, then branch — mirroring the detector's tap handling
(knowledge-gardener Step 5b-iv resolution rules 1–2, which already classify
`tap + not-in-api/api-unavailable → Not in registry`):

1. **`not-in-api` with the name populated** → dispatch that operand to
   `scripts/fetch-cask-upstream.sh` (the `cask.json` source) and re-branch on its
   result:
   - **cask hit** (`ok`/`deprecated`/`disabled`) → it's a cask; route to
     `casks/`. (Dogfood 2026-06-24: `claude-code` is a cask — the re-dispatch
     recovered its version.)
   - **second `not-in-api`** → the operand is in neither core formulae nor casks:
     a third-party-tap or private formula. Do **not** keep the old version or
     invent one. Run `brew info <name>` for the locally-installed version, stamp
     it `(local, unverified — not in core-formula or cask APIs)` plus a `[gotcha]`
     noting the tap/private source, and report it in the batch summary's
     skipped/unverified column. (The changelog reel can still proceed via the
     upstream repo's git tags from `brew info`.)
2. **`api-unavailable`** → the script emits this as a single sentinel with an
   **empty `name`** (a curl/parse failure for the whole fetch run, not one
   operand). It does not join to any operand: treat every operand in that fetch
   batch as `unverified[api-unavailable]`, skip the version write, and report —
   **never** read a failed fetch as "no drift." An empty-name row is the
   run-failure signal.

**3. Axis-B narrative target.** Tool-intel records the curated changelog reel as
**inline `[feature]` / `[version]` observations** (the tool-intel narrative
style) — **not** a `## Release Highlights` section (that is package-intel's
target). Each surfaced delta change becomes its own observation line in
`## Observations`.

**Linked-timeline-note check (before writing Axis B).** A high-velocity tool's
changelog can be extracted out of the subject note into a dedicated timeline
note, leaving only a `see_also`/`documented_in` relation behind. Before writing
the reel, read the subject note's `## Relations` for such a link — a
`see_also`/`documented_in` relation whose target title matches a
"... Release History"/timeline pattern — and, when found, append the curated
reel to **that** note instead of inline. Worked example:
`casks/cask-claude-code.md` carries `see_also [[Claude Code Release History]]`
(a separate Basic Memory note, not a file in this repo); a haul touching that
cask appends its reel to the linked `Claude Code Release History` note, not
back into the cask note — re-inlining there would re-inflate exactly what was
just extracted. Fall back to today's inline behavior — appending `[feature]` /
`[version]` observations directly in the subject note — when no linked
timeline note exists. Axis A (the inline header pipe) always stays in the
subject note regardless of where Axis B lands.

**Recording targets — refresh BOTH axes.** Per the shared reference's two-axis
convention:

- **Axis A — the inline header pipe.** For brew/cask the recorded version lives
  in the note's header line `Homepage: … | v<version> | <license>` (S2
  **Pattern 1**) — that is the slot `--stale brew`/`--stale cask` reads first, so
  refresh **that**. brew/cask notes do **not** carry a `[version]` observation;
  do not add one (the hardened machine-stable schema slot is the separate,
  unstarted bead `80r4` — do not block on it). Use `edit_note(find_replace)` on
  the `| v<old> |` token.
- **Axis B — the inline changelog reel.** Add the curated `[feature]` /
  `[version]` observations for the delta (the tool-intel narrative style).

Both axes are independent: refreshing the inline reel alone leaves the **header
pipe stale**, and the pipe is exactly what `--stale` re-reads — so the drift
never closes. On every refreshed note, move the header pipe `| v<version> |`
**and** the inline reel — they do not update each other. (Dogfood: an
`llmfit`-style refresh that wrote only the narrative left the headline version at
the old value until it was bumped separately.)

## Ecosystem Dispatch

### Step 0: Detect ecosystem

The prefix before `:` determines the ecosystem. If no recognized prefix is
found, return an error listing the valid prefixes (`brew:`, `cask:`,
`action:`, `docker:`, `vscode:`, `gh:`, `plugin:`, `skill:`). Do not fall back to package-intel —
this skill covers tooling only.

**Ecosystem → BM mapping:**

| Prefix | BM Directory | Note type | Reference file |
|--------|-------------|-----------|----------------|
| `brew` | `brew/` | `brew_formula` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-brew.md` |
| `cask` | `casks/` | `brew_cask` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-cask.md` |
| `action` | `actions/` | `github_action` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-action.md` |
| `docker` | `docker/` | `docker_image` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-docker.md` |
| `vscode` | `vscode/` | `vscode_extension` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-vscode.md` |
| `gh` | `gh/` | `gh_extension` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-gh.md` |
| `plugin` | `plugins/` | `claude_plugin` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-plugin.md` |
| `skill` | `plugins/` | `claude_plugin` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-skill.md` |

**Title convention:** The user command uses a colon delimiter (`brew:ripgrep`),
but the BM note title replaces all `:`, `/`, and `#` with `-` (preserving `@`
and `.`). This matches the filename BM generates and enables native Obsidian
wiki-link resolution. Examples: `brew:ripgrep` → `brew-ripgrep`,
`action:actions/checkout` → `action-actions-checkout`,
`docker:grafana/grafana` → `docker-grafana-grafana`,
`gh:meiji163/gh-notify` → `gh-meiji163-gh-notify`,
`plugin:voxpelli/vp-claude#vp-knowledge` → `plugin-voxpelli-vp-claude-vp-knowledge`,
`skill:obra/superpowers` → `skill-obra-superpowers`. The mapping is purely
literal — every `:`/`/`/`#` becomes `-`, including any `#<name>` suffix
(`plugin:pbakaus/impeccable#impeccable` → `plugin-pbakaus-impeccable-impeccable`);
the canonical de-duplicated address is supplied by `/knowledge-gaps --global`.

### Step 1: Check for existing note

<!-- This pattern is mirrored in package-intel — update both when changing -->

Fast existence check first (no content loaded):
```
list_directory(dir_name="<ecosystem-dir>", file_name_glob="*<sanitized-name>*")
```
For `plugin:`/`skill:` two-part addresses, `<sanitized-name>` is the **leaf** segment —
the last `/`- or `#`-segment (e.g. `impeccable` for `plugin:pbakaus/impeccable#impeccable`) —
so the glob matches a note titled either with or without a namesake suffix.

If found, read the existing note to understand what's already documented:
```
read_note(identifier="<prefix>-<name>", include_frontmatter=true, output_format="json")
```

**Freshness check:** Scope research based on note age (check `updated_at`):

| Note age | Sources to run | Sources to skip |
|----------|---------------|-----------------|
| Missing or >180 days | All 5 (full pipeline) | None |
| 60–180 days | All except Raindrop | Raindrop |
| <60 days | DeepWiki + changelog only | Tavily, Raindrop, Readwise |

Always run the changelog step — version history moves fast.

Note any previous `[gotcha]` or `[security]` observations — these should guide
which sources to prioritize.

Append new observations rather than overwriting.

**Audit-context stale-handling branch:** If this invocation was triggered
from an audit-driven workflow (signaled by the caller — e.g. an audit
context arg like `audit-source=gardener-drift`, an `AUDIT_CONTEXT` env
var, or an explicit "from audit findings" annotation in the user
message), the audit's notion of freshness may already be stale by the
time research begins. Before launching enrichment:

1. Re-read the existing note as above (`read_note(..., output_format="json")`).
2. Recompute the freshness tier from the *current* `updated_at`, not the
   value the audit captured. Audits have a ~30-minute wall-clock
   staleness window in practice — another agent or a manual `/tool-intel`
   run may have refreshed the note between audit and this invocation.
3. If the recomputed freshness is `<60 days`, narrow the source pipeline
   per the freshness table above (DeepWiki + changelog only — skip
   Tavily, Raindrop, Readwise). Do NOT re-run the full 5-source pipeline
   just because the audit said the note was stale.
4. If the audit's stated drift fact (e.g. "version X.Y.Z behind upstream
   A.B.C") no longer matches what the re-read reveals, abort with
   `"stale audit input — note already current at <version>; no refresh
   needed"` and return without writing. The calling agent
   (knowledge-maintainer Section 3b) will surface this as a skip in its
   summary.

This branch is a no-op for direct user invocations (`/tool-intel brew:bat`
with no audit signal) — the freshness check above runs unchanged.

### Step 2: Fetch registry data

Delegate to the ecosystem reference file for this step:
`${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-<ecosystem>.md`

Each reference file explains the registry API or extraction method, required
fields, and how to find the upstream GitHub repository (for DeepWiki and
changelog steps).

**Forge detection (`brew:`, `cask:`, `vscode:`, `docker:`):** parse the **host**
of the resolved repository/homepage URL and hold it as `repo_forge` — `github`,
`codeberg` (or any Forgejo instance), `sourcehut` (`*.sr.ht`), or `unknown`.
When `repo_forge != github`, follow
`${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/forge-fallback.md` (shared
reference) for the DeepWiki-skip rule and changelog procedure. **`action:` and
`gh:` are always `github`** — their identifier encodes a GitHub `owner/repo`, so
skip forge detection for them.

### Step 3: Five-source enrichment

**Context7 is skipped for all tool types** — it is npm-biased and has no
useful coverage of Homebrew, Actions, Docker, or VSCode ecosystems.

Launch research queries — parallelize where possible:

**a) DeepWiki — architecture and design (action:, docker:, conditional for gh:):**

Use DeepWiki for tools that have upstream GitHub repositories with meaningful
code to analyze. Skip for `brew:` and `cask:` (formulae/casks rarely have
rich repos). Use for `vscode:` when a public GitHub repo exists. For `gh:`,
use **conditionally** — only when `gh release list --repo <owner>/<repo>`
returns ≥1 release (a reliable proxy for "well-known enough to be indexed";
alpha bash extensions like `gh-notify` are not in DeepWiki). **Also skip for any
tool whose `repo_forge != github` (from Step 2)** — DeepWiki indexes only
GitHub; note the skip in Step 6 (expected, not an error).

```
ask_question(repo="owner/repo", question="What are the key inputs, outputs, design patterns, gotchas, and security considerations?")
```

For `action:`, use `owner/repo` directly from the identifier.
For `docker:`, find the GitHub source repo via the Docker Hub `source` field
or repository link in the image description.

**Hallucination caveat** — DeepWiki can return information about a *different* repo with a similar name, or reply "Repository not found" for repos that exist (e.g., `voxpelli/claude-beads` is not indexed; upstream `steveyegge/beads` is). For `action:`, `gh:`, and `docker:` prefixes, fall back to `gh api` against the source repo per [`references/gh-api-fallback.md`](references/gh-api-fallback.md).

**Indexing lag** — DeepWiki re-indexes periodically, so for fast-moving CLI tools, recently added commands or flags may not appear yet. When Step 2 or the changelog step (3d) surfaces a version newer than what DeepWiki describes, treat its feature coverage as incomplete for that version range and supplement from the tool's `--help` output, README, or commit log.

**b) Tavily — security, gotchas, and recent changes:**

Always run for all tool types. Tailor the query to the tool category:

- `brew:`/`cask:`: `tavily_search(query="<name> homebrew formula gotchas conflicts issues <year>", max_results=5)`
- `action:`: `tavily_search(query="<owner>/<repo> github action security supply chain <year>", max_results=5)`
- `docker:`: `tavily_search(query="<image> docker image CVE vulnerability <year>", max_results=5)`
- `vscode:`: `tavily_search(query="<extension-id> vscode extension performance issues <year>", max_results=5)`
- `gh:`: `tavily_search(query="<owner>/<repo> gh extension security supply chain <year>", max_results=5)`

For `action:` notes, also extract the action definition directly:
```
tavily_extract(urls=["https://github.com/<owner>/<repo>/blob/main/action.yml"], query="inputs outputs runs permissions")
```
Fall back to `action.yaml` if `action.yml` returns nothing.

**c) Raindrop — bookmarked articles:**
```
find_bookmarks(search="<name>")
```

If bookmarks are found, fetch content from the top 2-3 most relevant results
(judge relevance by title and tags matching the tool):
```
fetch_bookmark_content(bookmark_id=<id>)
```

These are articles the user deliberately saved — high relevance signal.

**d) Changelog / versions:**

**Forge branch (`vscode:`, `brew:`, `cask:`):** if `repo_forge != github` (from
Step 2), the upstream repo's changelog lives on a non-GitHub forge — follow
[`../package-intel/references/forge-fallback.md`](../package-intel/references/forge-fallback.md)
(shared reference: Codeberg/Forgejo REST, sourcehut, unknown-forge fallback)
instead of the `gh` commands below. `action:`/`gh:`/`docker:` are unaffected
(GitHub or Docker Hub by construction).

- `action:`: Use GitHub releases — `gh release list --repo <owner>/<repo> --limit 10 2>/dev/null`; if empty, `tavily_extract` on the GitHub CHANGELOG.md
- `docker:`: Use Docker Hub tags API (see `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-docker.md`) for tag strategy overview
- `brew:`/`cask:`: Extract version from the formulae.brew.sh API response (already fetched in Step 2). If that stable version is *newer* than the upstream repo's newest GitHub Release, the release notes for the current version are missing — recover the changelog from git tags per [`references/gh-api-fallback.md`](references/gh-api-fallback.md) ("Recovering a Version/Changelog from Tags"). This is the `brew:sem` shape.
- `vscode:`: Extract version from Open VSX API response (already fetched in Step 2)
- `gh:`: Use GitHub releases — `gh release list --repo <owner>/<repo> --limit 10 2>/dev/null`; empty result means `runtime_shape: script` (or `local` per Step 2's classification ladder)

<!-- Staleness-detection logic is mirrored in package-intel Step 3e — update both. Recording target differs by ecosystem: a [version] observation here, ## Release Highlights there. -->
**Release-list staleness (`action:`/`gh:`)** — these prefixes have no independent registry, so the GitHub release list is the only version signal — and it lags whenever a maintainer pushes a git tag without cutting a Release. **Always cross-check** the newest Release against the newest git tag:

```bash
gh api repos/<owner>/<repo>/tags --jq '.[].name' 2>/dev/null | head -20
```

The `/tags` and `gh release list` outputs are *not* semver-sorted, and an error reads the same as an empty result — re-run without `2>/dev/null` to confirm the command exited 0, then follow the sorting, pre-release, and error≠empty rules in [`references/gh-api-fallback.md`](references/gh-api-fallback.md) ("Recovering a Version/Changelog from Tags") before trusting either. If the newest stable semver tag is ahead of the newest Release (or the release list is empty but the repo has recent commits), treat that tag as the real latest version, and derive a changelog from the commits between the last released tag and it:

```bash
gh api repos/<owner>/<repo>/compare/<last-release-tag>...<newest-tag> \
  --jq '.commits[].commit.message | split("\n")[0]' 2>/dev/null
```

(With no prior Release to compare from, list recent commits instead: `gh api "repos/<owner>/<repo>/commits?sha=<newest-tag>"`.) Record the recovered version as a `[version]` observation with explicit provenance, so a later reader knows it came from a tag, not a Release: `- [version] X.Y.Z (git tag <tag-name> — no GitHub Release as of YYYY-MM-DD)` — keep that parenthetical link-free (a markdown link plus a trailing parenthetical silently drops the whole observation past BM's `(context)` parser). Curate the commit subjects (skip merges and internal refactors) rather than dumping them. A release list that is empty *and* has no newer git tag (command confirmed to have exited 0) still means `runtime_shape: script` for `gh:`.

For `action:`, `gh:`, and `docker:` prefixes, [`references/gh-api-fallback.md`](references/gh-api-fallback.md) documents additional `gh api` endpoints (contents, commits, contributors, issue/PR verification) — useful when DeepWiki was unreliable in step 3a or when the changelog is sparse.

**e) Readwise — curated personal insights:**
```
readwise_search_highlights(vector_search_term="<tool-name>")
reader_search_documents(query="<tool-name> <tool-type>")
```

Highlights contain expert-selected passages from the user's reading. If results
found, extract patterns, gotchas, and best practices for observations. If both
return empty, note "source e: no Readwise content found" and proceed.

### Step 4: Curate and synthesize

**Graph curation — before writing, check how this tool is referenced in the
knowledge graph:**

If the tool note already exists (found in Step 1), use its title as the seed:
```
build_context(url="<prefix>-<name>", depth=1, max_related=10)
```

If the note doesn't exist yet, fall back to a text search:
```
search_notes(query="<tool-name>", page_size=5)
```

Use the results to:
- Identify related notes that should receive a back-link in `## Relations`
- Avoid duplicating observations already captured in a linked note
- Discover which engineering patterns or package notes this tool connects to

See `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/note-template-<ecosystem>.md` for the full template. Key
conventions per tool type:

| Prefix | Title format | Directory | Type |
|--------|-------------|-----------|------|
| `brew` | `brew-<name>` | `brew/` | `brew_formula` |
| `cask` | `cask-<name>` | `casks/` | `brew_cask` |
| `action` | `action-<owner>-<repo>` | `actions/` | `github_action` |
| `docker` | `docker-<image>` | `docker/` | `docker_image` |
| `vscode` | `vscode-<publisher>.<ext>` | `vscode/` | `vscode_extension` |
| `gh` | `gh-<owner>-<repo>` | `gh/` | `gh_extension` |
| `plugin` | `plugin-<owner>-<repo>` | `plugins/` | `claude_plugin` |
| `skill` | `skill-<owner>-<repo>` | `plugins/` | `claude_plugin` |

All tool notes share three core enrichment layers plus a type-specific content section:
- **Frontmatter** with `packages` array, `type`, and `tags`
- **`## Observations`** with `[category]` tagged items
- **`## Relations`** with `[[wiki-links]]`
- **Type-specific content section** (differs by type — e.g. `## Common Usage` for brew, `## Inputs & Outputs` for actions; see templates)

**For `vscode:` — always record the Open VSX trust signal.** Resolve the
4-state ladder (verified-restricted / public-namespace / marketplace-only=squattable
/ not-published-anywhere) from the Open VSX API fields fetched in Step 2 plus
Marketplace presence, emit it as one `[security]` observation, and add
`relates_to [[Publisher Verification Gradient]]`. The full ladder, detection
rules, and observation wording live in the "Open VSX Trust Signal" section of
`references/ecosystem-vscode.md`. (This is a derived signal off the existing
Open VSX fetch — not a new research source.)

**No wiki-links in observations.** Never use `[[Target]]` syntax in observation
lines. BM's parser treats any `[[` as a relation boundary — the text before it
becomes the `relation_type` field (max 200 chars), causing validation failures.
Put all wiki-links in `## Relations` only.

<!-- This verify-before-capture block is byte-identical with package-intel — update both when changing. -->
**Verify before capture (mandatory self-check — not CI-enforced).** This step is
required for the conditions below — not enforced by CI, but the same class of
obligation as the LLM-judgment fourth-wall rules. Unlike the Step 1 freshness
table (enforced by *which sources actually run*), no mechanical gate checks it;
treat that as a reason to self-enforce, not permission to skip. For any note
Step 1 did not put on the fast path — missing,
60+ days old, or a security-sensitive or thin-evidence subject — confirm
load-bearing claims (version, maintainer/owner, license, security posture, and
any "does X" capability claim) against the sources already fetched in this run
before writing. Do NOT make new source calls — Step 1's
freshness tiers deliberately pruned sources; verify against what was fetched. A
wrong note compounds via citation and cross-project reciprocation, so a persisted
claim carries a higher bar than a passing remark. If a claim cannot be confirmed
from this run's sources, weaken it to a capability statement ("designed for X"
rather than "does X") and date-qualify uncertain facts (e.g. "as of the 2026-05
release") — never fabricate; if a fact is unknown, say so or omit it. Routine
refreshes (note under 60 days) skip this step.

**Record contradictions, do not resolve them silently.** When two sources
disagree on a load-bearing fact (version, maintainer, license, behavior), record
both values with their provenance as a `[gotcha]` observation — prefer the more
recent or authoritative source and name which — rather than silently picking
one.
### Step 5: Write or update the note

<!-- This pattern is mirrored in package-intel — update both when changing -->

**New tool:** Use `write_note` with the full template. Set
`note_type="<tool-type>"` (e.g., `note_type="github_action"`).

**Relocated stub (a note about this tool already exists, but at a
different directory or title than the target ecosystem location — e.g. an
old `indieweb/history/` stub for what is now a documented Homebrew formula):**
This is **not** a fresh create, and it is **not** a physical relocation
either — verified via a live dry-run (2026-07-02, current BM version 0.22.1):
`write_note(overwrite=True, directory=<new>, ...)` targeting a *different*
directory than the existing stub does NOT find or overwrite the stub by
title. It creates a genuinely new, separate note at the new location (with
its own freshly-correct `permalink` — no stale-permalink re-key needed) and
leaves the old stub completely untouched at its old path. Left alone, this
produces a silent duplicate: two notes for one tool, only one of them
current. `move_note` was not independently verified in this dry-run; don't
assume it behaves differently without checking. Handle it explicitly:

1. If Step 1's existence check didn't surface the stub (it globs only the
   target ecosystem directory), run a broader
   `search_notes(query="<tool-name>")` before concluding the note is new
   — a stub in an unrelated directory won't match the directory-scoped glob.
2. Read the stub (reuse the "Step 1: Check for existing note" read above if you
   already have it) and record its `## Relations` entries and current
   `permalink`.
3. Write the new note with `write_note(overwrite=True, ...)`, targeting the
   correct ecosystem `directory` and title (e.g. `brew-<name>` / `cask-<name>`
   — the `<prefix>-<tool-name>` convention this skill uses throughout), and
   fold the stub's genuine relations (ones that still apply to the tool's
   new identity, not history-specific cruft) into the new content's
   `## Relations` section. If a relation's continued relevance is unclear,
   don't merge it blind — carry it forward and flag it for review in Step 6
   rather than dropping it silently.
4. Once the new note is confirmed to carry everything needed (re-read it and
   check `## Relations`), delete the old stub with
   `delete_note(identifier=<old permalink>)` — the write in step 3 did not
   remove it, and leaving it behind is exactly the duplicate this procedure
   exists to prevent. Only delete after confirming the new note is complete;
   never delete before the replacement is verified.
5. In Step 6, report which relations were carried forward, which were
   dropped or need review, and that the old stub was deleted — never drop
   relations silently, and never leave an unreported duplicate.

**Existing tool:** Pick the operation based on the note's current state:

| Note state | Use |
|------------|-----|
| `## Observations` has at least one `- [category]` line | `find_replace` anchored on the last observation line |
| `## Observations` exists but is empty | `find_replace` anchored on `## Observations\n` |
| `## Observations` is absent entirely | `find_replace` anchored on the next section header (typically `## Relations\n`); prepend a new `## Observations` section before it |
| Last observation wraps across multiple lines | Include all continuation lines in both `find_text` and the prefix of `content`, then append the new observation after |

Canonical call (populated section):

````
edit_note(
  identifier="<prefix>-<tool-name>",
  operation="find_replace",
  find_text="- [<last-category>] <last observation text>",
  content="- [<last-category>] <last observation text>\n- [<new-category>] <new observation text>"
)
````

Empty-section fallback (anchor on header):

````
edit_note(
  identifier="<prefix>-<tool-name>",
  operation="find_replace",
  find_text="## Observations\n",
  content="## Observations\n- [<new-category>] <new observation text>\n"
)
````

Do NOT use `operation="append"` with `section="Observations"` when the section
already exists — it appends to end of file, not end of section. The substring
match in `find_replace` is byte-exact: use the observation text verbatim, no
whitespace normalization or escaping.

If `find_replace` fails (no match found), the note may have been edited since
you last read it. Re-run `read_note`, re-derive the anchor, and retry once.
If the second attempt also fails, stop and report the error to the user — do
not loop.

**Trust `schema_validate` and the file, not the inline count.** When verifying an
edit, the `edit_note` inline observation-count echo can transiently double or
triple — a BM index re-parse artifact on notes with `###` subsections inside
`## Observations` (observed 2026-05-30: `--stale` refresh edits showed inflated
counts while the files were correct and `schema_validate` stayed clean). Confirm
against `schema_validate` and the actual file contents (re-read the note), not
that echo. Do NOT delete "duplicate" observations on the strength of the inline
count alone — first confirm the duplication exists in the file itself (re-read /
grep); a re-sync clears the phantom while the file was always correct.

### Step 6: Confirm and summarize

Report to the user:
- Ecosystem detected and note location (directory/title)
- Key findings from each source (1 line each)
- Any security or supply-chain concerns
- Cross-links added (from Step 7)

### Step 7: Cross-link existing notes

After writing the note, search for existing notes that reference this tool
in their body text or observations but lack a wiki-link back to it:

```
search_notes(query="<tool-name>", search_type="text", page_size=10)
```

For each result (excluding the note just written):
1. Read its `## Relations` section
2. If the tool is mentioned in body/observations but not linked in Relations,
   add a link via `edit_note` with `find_replace`:

```
edit_note(
  identifier="<existing-note-title>",
  operation="find_replace",
  find_text="- <last_relation_type> [[<Last Existing Relation>]]",
  content="- <last_relation_type> [[<Last Existing Relation>]]\n- relates_to [[<prefix>-<tool-name>]]"
)
```

Only add links where the relationship is genuine. Skip this step for updates to
existing tools where cross-links likely already exist.
