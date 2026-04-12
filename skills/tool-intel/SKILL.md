---
name: tool-intel
description: "This skill should be used when the user asks to 'research a homebrew formula', 'brew intel', 'what does [brew-tool] do', 'research a cask', 'cask intel', 'what does [cask] do', 'research a GitHub Action', 'action intel', 'what does [action] do', 'research a docker image', 'docker intel', 'what does [docker image] do', 'research a VSCode extension', 'vscode intel', 'what does [extension] do', 'add tool to knowledge graph', 'enrich [tool]'. Researches a developer environment or CI/CD tool using five-source enrichment (DeepWiki, Tavily, Raindrop, Readwise, changelog) and creates/updates a structured Basic Memory note with post-write cross-linking. Supports Homebrew formulae (brew:), Homebrew casks (cask:), GitHub Actions (action:), Docker images (docker:), and VSCode extensions (vscode:)."
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
---

# Tool Intelligence

Research a developer environment or CI/CD tool and synthesize a structured
Basic Memory note using five enrichment sources, then cross-link existing notes.
Supports Homebrew formulae, Homebrew casks, GitHub Actions, Docker images, and
VSCode extensions.

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
| `brew` | `brew/` | `brew_formula` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-brew.md` |
| `cask` | `casks/` | `brew_cask` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-cask.md` |
| `action` | `actions/` | `github_action` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-action.md` |
| `docker` | `docker/` | `docker_image` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-docker.md` |
| `vscode` | `vscode/` | `vscode_extension` | `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-vscode.md` |

**Title convention:** The user command uses a colon delimiter (`brew:ripgrep`),
but the BM note title replaces all `:` and `/` with `-` (preserving `@` and
`.`). This matches the filename BM generates and enables native Obsidian
wiki-link resolution. Examples: `brew:ripgrep` → `brew-ripgrep`,
`action:actions/checkout` → `action-actions-checkout`,
`docker:grafana/grafana` → `docker-grafana-grafana`.

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

### Step 2: Fetch registry data

Delegate to the ecosystem reference file for this step:
`${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-<ecosystem>.md`

Each reference file explains the registry API or extraction method, required
fields, and how to find the upstream GitHub repository (for DeepWiki and
changelog steps).

### Step 3: Five-source enrichment

**Context7 is skipped for all tool types** — it is npm-biased and has no
useful coverage of Homebrew, Actions, Docker, or VSCode ecosystems.

Launch research queries — parallelize where possible:

**a) DeepWiki — architecture and design (action: and docker: only):**

Use DeepWiki for tools that have upstream GitHub repositories with meaningful
code to analyze. Skip for `brew:` and `cask:` (formulae/casks rarely have
rich repos). Use for `vscode:` when a public GitHub repo exists.

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

If bookmarks are found, fetch content from the top 2-3 most relevant results
(judge relevance by title and tags matching the tool):
```
fetch_bookmark_content(bookmark_id=<id>)
```

These are articles the user deliberately saved — high relevance signal.

**d) Changelog / versions:**

- `action:`: Use GitHub releases — `gh release list --repo <owner>/<repo> --limit 10 2>/dev/null`; if empty, `tavily_extract` on the GitHub CHANGELOG.md
- `docker:`: Use Docker Hub tags API (see `${CLAUDE_PLUGIN_ROOT}/skills/tool-intel/references/ecosystem-docker.md`) for tag strategy overview
- `brew:`/`cask:`: Extract version from the formulae.brew.sh API response (already fetched in Step 2)
- `vscode:`: Extract version from Open VSX API response (already fetched in Step 2)

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

All tool notes share three core enrichment layers plus a type-specific content section:
- **Frontmatter** with `packages` array, `type`, and `tags`
- **`## Observations`** with `[category]` tagged items
- **`## Relations`** with `[[wiki-links]]`
- **Type-specific content section** (differs by type — e.g. `## Common Usage` for brew, `## Inputs & Outputs` for actions; see templates)

**No wiki-links in observations.** Never use `[[Target]]` syntax in observation
lines. BM's parser treats any `[[` as a relation boundary — the text before it
becomes the `relation_type` field (max 200 chars), causing validation failures.
Put all wiki-links in `## Relations` only.

### Step 5: Write or update the note

<!-- This pattern is mirrored in package-intel — update both when changing -->

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
