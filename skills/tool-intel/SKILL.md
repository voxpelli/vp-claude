---
name: tool-intel
description: "This skill should be used when the user asks to 'research a homebrew formula', 'brew intel', 'what does [brew-tool] do', 'research a cask', 'research a GitHub Action', 'action intel', 'what does [action] do', 'research a docker image', 'docker intel', 'research a VSCode extension', 'vscode intel', 'add tool to knowledge graph', 'enrich [tool]'. Researches a developer environment or CI/CD tool using four-source enrichment (DeepWiki, Tavily, Raindrop, changelog) and creates/updates a structured Basic Memory note. Supports Homebrew formulae (brew:), Homebrew casks (cask:), GitHub Actions (action:), Docker images (docker:), and VSCode extensions (vscode:)."
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Glob
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
---

# Tool Intelligence

Research a developer environment or CI/CD tool and synthesize a structured
Basic Memory note using four enrichment sources. Supports Homebrew formulae,
Homebrew casks, GitHub Actions, Docker images, and VSCode extensions.

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

**Identifier normalization:**
- `action:` — strip `@version` suffix from `uses:` lines (e.g., `actions/checkout@v4` → `action:actions/checkout`)
- `docker:` — strip `:tag` suffix (e.g., `node:22-alpine` → `docker:node`)
- `vscode:` — always `publisher.extension-id` dot-separated

## Ecosystem Dispatch

### Step 0: Detect ecosystem

The prefix before `:` determines the ecosystem. If no recognized prefix is
found, return an error listing the valid prefixes (`brew:`, `cask:`,
`action:`, `docker:`, `vscode:`). Do not fall back to package-intel — this
skill covers tooling only.

**Ecosystem → BM mapping:**

| Prefix | BM Directory | Note type | Reference file |
|--------|-------------|-----------|----------------|
| `brew` | `brew/` | `brew_formula` | `references/ecosystem-brew.md` |
| `cask` | `casks/` | `brew_cask` | `references/ecosystem-cask.md` |
| `action` | `actions/` | `github_action` | `references/ecosystem-action.md` |
| `docker` | `docker/` | `docker_image` | `references/ecosystem-docker.md` |
| `vscode` | `vscode/` | `vscode_extension` | `references/ecosystem-vscode.md` |

### Step 1: Check for existing note

Fast existence check first (no content loaded):
```
list_directory(dir_name="<ecosystem-dir>", file_name_glob="*<sanitized-name>*")
```

If found, read the existing note to understand what's already documented:
```
read_note(identifier="<prefix>:<name>", include_frontmatter=true, output_format="json")
```

**Freshness check:** If the note exists and was updated within the last 60 days
(check `updated_at` in frontmatter), consider scoping down the research:
- Skip Tavily security search unless a CVE/supply-chain issue is suspected
- Skip Raindrop search (bookmarks don't change frequently)
- Focus on what's changed since the last update

If the note is stale (>60 days) or missing, run the full four-source pipeline.

Note any previous `[gotcha]` or `[security]` observations — these should guide
which sources to prioritize.

Append new observations rather than overwriting.

### Step 2: Fetch registry data

Delegate to the ecosystem reference file for this step:
`references/ecosystem-<ecosystem>.md`

Each reference file explains the registry API or extraction method, required
fields, and how to find the upstream GitHub repository (for DeepWiki and
changelog steps).

### Step 3: Four-source enrichment

**Context7 is skipped for all tool types** — it is npm-biased and has no
useful coverage of Homebrew, Actions, Docker, or VSCode ecosystems.

Launch research queries — parallelize where possible:

**a) DeepWiki — architecture and design (action: and docker: only):**

Use DeepWiki for tools that have upstream GitHub repositories with meaningful
code to analyze. Skip for `brew:`, `cask:`, and `vscode:`.

```
ask_question(repo="owner/repo", question="What are the key inputs, outputs, design patterns, gotchas, and security considerations?")
```

For `action:`, use `owner/repo` directly from the identifier.
For `docker:`, find the GitHub source repo via the Docker Hub `source` field
or repository link in the image description.

**b) Tavily — security, gotchas, and recent changes:**

Always run for all tool types. Tailor the query to the tool category:

- `brew:`/`cask:`: `tavily_search(query="<name> homebrew formula gotchas conflicts issues <year>", max_results=5)`
- `action:`: `tavily_search(query="<owner>/<repo> github action security supply chain <year>", max_results=5)`
- `docker:`: `tavily_search(query="<image> docker image CVE vulnerability <year>", max_results=5)`
- `vscode:`: `tavily_search(query="<extension-id> vscode extension performance issues <year>", max_results=5)`

For `action:` notes, also extract the action definition directly:
```
tavily_extract(urls=["https://github.com/<owner>/<repo>/blob/main/action.yml"], query="inputs outputs runs permissions")
```
Fall back to `action.yaml` if `action.yml` returns nothing.

**c) Raindrop — bookmarked articles:**
```
find_bookmarks(search="<name>")
```

**d) Changelog / versions:**

- `action:`: Use GitHub releases — `gh release list --repo <owner>/<repo> --limit 10 2>/dev/null`; if empty, `tavily_extract` on the GitHub CHANGELOG.md
- `docker:`: Use Docker Hub tags API (see `references/ecosystem-docker.md`) for tag strategy overview
- `brew:`/`cask:`: Extract version from the formulae.brew.sh API response (already fetched in Step 2)
- `vscode:`: Extract version from Open VSX API response (already fetched in Step 2)

### Step 4: Synthesize into note

See `references/note-template-<ecosystem>.md` for the full template. Key
conventions per tool type:

| Prefix | Title format | Directory | Type |
|--------|-------------|-----------|------|
| `brew` | `brew:<name>` | `brew/` | `brew_formula` |
| `cask` | `cask:<name>` | `casks/` | `brew_cask` |
| `action` | `action:<owner>/<repo>` | `actions/` | `github_action` |
| `docker` | `docker:<image>` | `docker/` | `docker_image` |
| `vscode` | `vscode:<publisher>.<ext>` | `vscode/` | `vscode_extension` |

All notes use three enrichment layers:
- **Frontmatter** with `packages` array, `type`, and `tags`
- **Type-specific content section** (see templates — differs by tool type)
- **`## Observations`** with `[category]` tagged items
- **`## Relations`** with `[[wiki-links]]`

### Step 5: Write or update the note

**New tool:** Use `write_note` with the full template. Set
`note_type="<tool-type>"` (e.g., `note_type="github_action"`).

**Existing tool:** Use `edit_note` with `find_replace` to insert new
observations after the last existing `- [category]` line in `## Observations`.
Do NOT use `operation="append"` with `section="Observations"` — it appends to
the end of the file, not the end of the section.

### Step 6: Confirm and summarize

Report to the user:
- Ecosystem detected and note location (directory/title)
- Key findings from each source (1 line each)
- Any security or supply-chain concerns
- Suggested related notes to link
