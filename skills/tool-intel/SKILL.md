---
name: tool-intel
description: "This skill should be used when the user asks to 'research a homebrew formula', 'brew intel', 'what does [brew-tool] do', 'research a cask', 'cask intel', 'what does [cask] do', 'research a GitHub Action', 'action intel', 'what does [action] do', 'research a docker image', 'docker intel', 'what does [docker image] do', 'research a VSCode extension', 'vscode intel', 'what does [extension] do', 'research a gh extension', 'research a gh CLI extension', 'gh extension intel', 'what does [gh-extension] do', 'add tool to knowledge graph', 'enrich [tool]'. Researches a developer environment or CI/CD tool using five-source enrichment (DeepWiki, Tavily, Raindrop, Readwise, changelog) and creates/updates a structured Basic Memory note with post-write cross-linking. Supports Homebrew formulae (brew:), Homebrew casks (cask:), GitHub Actions (action:), Docker images (docker:), VSCode extensions (vscode:), and GitHub CLI extensions (gh:)."
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

**Identifier normalization:**
- `action:` — strip `@version` suffix from `uses:` lines (e.g., `actions/checkout@v4` → `action:actions/checkout`)
- `docker:` — strip `:tag` suffix (e.g., `node:22-alpine` → `docker:node`)
- `vscode:` — always `publisher.extension-id` dot-separated
- `gh:` — strip `https://github.com/` if pasted, strip `@<tag>` suffix, require `owner/repo` form (e.g., `gh:meiji163/gh-notify`); error if no `/` is present

## Ecosystem Dispatch

### Step 0: Detect ecosystem

The prefix before `:` determines the ecosystem. If no recognized prefix is
found, return an error listing the valid prefixes (`brew:`, `cask:`,
`action:`, `docker:`, `vscode:`, `gh:`). Do not fall back to package-intel —
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

**Title convention:** The user command uses a colon delimiter (`brew:ripgrep`),
but the BM note title replaces all `:` and `/` with `-` (preserving `@` and
`.`). This matches the filename BM generates and enables native Obsidian
wiki-link resolution. Examples: `brew:ripgrep` → `brew-ripgrep`,
`action:actions/checkout` → `action-actions-checkout`,
`docker:grafana/grafana` → `docker-grafana-grafana`,
`gh:meiji163/gh-notify` → `gh-meiji163-gh-notify`.

### Step 1: Check for existing note

<!-- This pattern is mirrored in package-intel — update both when changing -->

Fast existence check first (no content loaded):
```
list_directory(dir_name="<ecosystem-dir>", file_name_glob="*<sanitized-name>*")
```

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

### Step 5: Write or update the note

<!-- This pattern is mirrored in package-intel — update both when changing -->

**New tool:** Use `write_note` with the full template. Set
`note_type="<tool-type>"` (e.g., `note_type="github_action"`).

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
