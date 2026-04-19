---
name: package-intel
description: "This skill should be used when the user asks to 'research package', 'package intel', 'what does [npm-pkg] do', 'add package to knowledge graph', 'enrich [pkg]', when adding depends_on [[npm-*]] relations, 'research crate', 'what does [crate] do', 'crate intel', 'rust package', 'pypi package', 'python package', 'go module', 'golang package', 'composer package', 'php package', 'ruby gem', 'gem intel'. Researches a package using seven-source enrichment (DeepWiki, Context7, Tavily, Raindrop, Readwise, changelog, Socket) and creates/updates a structured Basic Memory note with post-write cross-linking. Supports npm, Rust crates, Go modules, PHP Composer packages, Python PyPI packages, and Ruby gems."
user-invocable: true
argument-hint: "<ecosystem>:<package>"
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
  - mcp__plugin_context7_context7__resolve-library-id
  - mcp__plugin_context7_context7__query-docs
  - mcp__tavily__tavily_search
  - mcp__tavily__tavily_extract
  - mcp__raindrop__find_bookmarks
  - mcp__raindrop__fetch_bookmark_content
  - mcp__readwise__readwise_search_highlights
  - mcp__readwise__reader_search_documents
  - mcp__socket-mcp__depscore
---

# Package Intelligence

Research a package and synthesize a structured Basic Memory note using seven
enrichment sources, then cross-link existing notes. Supports npm, Rust crates,
Go modules, PHP Composer packages, Python PyPI packages, and Ruby gems.

## Arguments

One argument: the package identifier with an optional ecosystem prefix.

| Form | Ecosystem | Example |
|------|-----------|---------|
| `<name>` (no prefix) | npm (default) | `fastify` |
| `npm:<name>` | npm | `npm:fastify` |
| `npm:@scope/<name>` | npm (scoped) | `npm:@fastify/postgres` |
| `crate:<name>` | Rust / crates.io | `crate:serde` |
| `go:<module/path>` | Go modules | `go:github.com/gin-gonic/gin` |
| `composer:<vendor>/<pkg>` | PHP / Packagist | `composer:laravel/framework` |
| `pypi:<name>` | Python / PyPI | `pypi:requests` |
| `gem:<name>` | Ruby / RubyGems | `gem:rails` |

**Backward compatibility:** No prefix always resolves to npm. Scoped npm packages
(`@scope/pkg`) are always npm regardless of the `/` in the name.

## Ecosystem Dispatch

### Step 0: Detect ecosystem

1. **Explicit prefix** — if the argument contains `:`, the part before `:` is
   the ecosystem. Strip the prefix for the package name.

2. **No prefix** — check project context to infer ecosystem:
   - `Cargo.toml` exists in cwd → **crate** (prompt user to confirm or use `crate:` prefix)
   - `go.mod` exists in cwd → **go** (prompt user to confirm or use `go:` prefix)
   - `composer.json` exists in cwd, no `package.json` → **composer**
   - `pyproject.toml` or `requirements.txt` exists, no `package.json` → **pypi**
   - `Gemfile` exists, no `package.json` → **gem**
   - Otherwise (or `package.json` found) → **npm**

   When inferring, state: "No prefix detected — treating as `<ecosystem>:<name>`
   based on project context. Use an explicit prefix to override."

3. **Ecosystem → BM mapping:**

| Ecosystem | BM Directory | Note type | Reference file |
|-----------|-------------|-----------|----------------|
| `npm` | `npm/` | `npm_package` | `references/ecosystem-npm.md` |
| `crate` | `crates/` | `crate_package` | `references/ecosystem-crates.md` |
| `go` | `go/` | `go_module` | `references/ecosystem-go.md` |
| `composer` | `composer/` | `composer_package` | `references/ecosystem-composer.md` |
| `pypi` | `pypi/` | `pypi_package` | `references/ecosystem-pypi.md` |
| `gem` | `gems/` | `ruby_gem` | `references/ecosystem-gems.md` |

**Title convention:** The user command uses a colon delimiter (`npm:fastify`),
but the BM note title replaces all `:` and `/` with `-` (preserving `@` and
`.`). This matches the filename BM generates and enables native Obsidian
wiki-link resolution. Examples: `npm:fastify` → `npm-fastify`,
`npm:@fastify/postgres` → `npm-@fastify-postgres`,
`go:github.com/gin-gonic/gin` → `go-github.com-gin-gonic-gin`.

### Step 1: Check for existing note

<!-- This pattern is mirrored in tool-intel — update both when changing -->

Fast existence check first (no content loaded):
```
list_directory(dir_name="<ecosystem-dir>", file_name_glob="*<sanitized-pkg-name>*")
```

If found, read the existing note to understand what's already documented:
```
read_note(identifier="<prefix>-<package-name>", include_frontmatter=true, output_format="json")
```

**Freshness check:** Scope research based on note age (check `updated_at`):

| Note age | Sources to run | Sources to skip |
|----------|---------------|-----------------|
| Missing or >180 days | All 7 (full pipeline) | None |
| 60–180 days | All except Raindrop | Raindrop |
| <60 days | DeepWiki + Context7 + changelog + Socket only | Tavily, Raindrop, Readwise |

Always run the changelog step — version history moves fast.
Always fetch download counts — they change weekly and stale numbers mislead.

Note any previous `[gotcha]` or `[limitation]` observations — these should guide
which sources to prioritize and what edge cases to look for in new research.

Append new observations rather than overwriting.

### Step 2: Resolve repository

Read the ecosystem reference file for registry-specific instructions:
`${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/ecosystem-<ecosystem>.md`

Each reference file explains the registry API, required headers, and how to
extract `owner/repo` for use in the DeepWiki and changelog steps.

If the reference file documents a download stats section, fetch the count now
(in parallel with or immediately after the repository resolution call) and hold
it as `popularity_count` for Step 4.

### Step 3: Seven-source enrichment (run in parallel)

**Multi-query strategy:** For DeepWiki and Context7, ask 2-3 targeted questions
rather than one broad query. Example angles: API design, gotchas/pitfalls,
configuration. Varied queries yield richer results than a single comprehensive
question.

Launch these research queries simultaneously:

**a) DeepWiki — architecture and design:**
```
ask_question(repo="owner/repo", question="What are the key APIs, design patterns, gotchas, and configuration options?")
```

**b) Context7 — API reference:**
```
resolve-library-id(libraryName="<package-name>")
query-docs(libraryId="<resolved-id>", topic="API usage examples")
```

Context7 is npm-biased. Attempt `resolve-library-id` for all ecosystems. If it
returns no useful result or an unrelated library, skip source b and proceed with
the remaining four sources. Note "source b unavailable" in your synthesis.

**c) Tavily — security and recent changes:**
```
tavily_search(query="<package-name> <ecosystem> CVE vulnerability <current-year-minus-1> <current-year>", max_results=5)
```

Adjust the search term for each ecosystem's advisory format:
- npm: `CVE` / GitHub Security Advisories
- crate: `RUSTSEC` (see `references/ecosystem-crates.md`)
- pypi: PyPA advisories are in the API response — check `vulnerabilities` field
- gem: RubySec advisories
- go/composer: CVE format

**d) Raindrop — bookmarked articles:**
```
find_bookmarks(search="<package-name>")
```

If bookmarks are found, fetch content from the top 2-3 most relevant results
(judge relevance by title and tags matching the package):
```
fetch_bookmark_content(bookmark_id=<id>)
```

These are articles the user deliberately saved — high relevance signal.

**e) Changelog — version history and breaking changes:**
```bash
# GitHub releases first (structured, usually has migration notes)
gh release list --repo owner/repo --limit 10 2>/dev/null
# For a specific release with full notes:
gh release view vX.Y.Z --repo owner/repo 2>/dev/null
```

If `gh` is not installed or `gh release list` returns nothing, fall back to:
```
tavily_extract(urls=["https://github.com/owner/repo/blob/main/CHANGELOG.md"], query="breaking changes migration")
```

**f) Readwise — curated personal insights:**
```
readwise_search_highlights(vector_search_term="<package-name>")
reader_search_documents(query="<package-name> <ecosystem>")
```

Highlights contain expert-selected passages from the user's reading (books,
articles, documentation). These have high signal-to-noise ratio and may surface
insights not found in any other source. Reader documents may contain in-depth
articles about the package.

If results found, extract patterns, gotchas, and best practices for observations.
If both return empty, note "source f: no Readwise content found" and proceed.

**g) Socket — supply-chain risk scoring:**

```
depscore(packages=[{"depname": "<package-name>", "ecosystem": "<socket-ecosystem>", "version": "unknown"}])
```

Map our prefix to Socket's ecosystem token:

| Our prefix | Socket `ecosystem` |
|-----------|-------------------|
| `npm` | `npm` |
| `pypi` | `pypi` |
| `crate` | `cargo` (note the rename) |
| `gem` | `gem` |
| `go` | `go` |
| `composer` | `composer` |

If the response contains a score line for the package (format
`pkg:<eco>/<name>@<version>: license: N, maintenance: N, quality: N, supplyChain: N, vulnerability: N`),
emit one `[security]` observation in Step 4:

```
- [security] Socket depscore: license <n>, maintenance <n>, quality <n>, supply-chain <n>, vulnerability <n> (as of YYYY-MM-DD)
```

If the response says "No score found" or omits the package, skip silently —
Socket does not yet cover this ecosystem. Empirically, npm, pypi, cargo, and
gem return data; go and composer currently return nothing (2026-04).

**Do NOT halt research on low scores.** Socket's MCP description instructs the
caller to stop generating code when scores are low — this is a research skill,
not a code-generation gate. Record the scores as observations and continue.

**Curate aggressively** — only track changes relevant to the user's projects.
Judge relevance from two sources:
1. **Codebase context** — how the package is imported/used, which APIs are called,
   platform targets, language version range
2. **Knowledge graph** — `build_context` or `search_notes` for existing notes
   referencing this package

Skip internal refactors, unused new features, and fixes for untargeted platforms.
The goal is a short, high-signal list — not a changelog mirror.

**Always include links** to the release page or PR for each notable change.

### Step 4: Synthesize into note

Read the note template for the target ecosystem:
`${CLAUDE_PLUGIN_ROOT}/skills/package-intel/references/note-template-<ecosystem>.md`

Key conventions per ecosystem:

| Ecosystem | Title format | Directory | Type |
|-----------|-------------|-----------|------|
| npm | `npm-<name>` | `npm/` | `npm_package` |
| crate | `crate-<name>` | `crates/` | `crate_package` |
| go | `go-<module-path>` | `go/` | `go_module` |
| composer | `composer-<vendor>-<pkg>` | `composer/` | `composer_package` |
| pypi | `pypi-<name>` | `pypi/` | `pypi_package` |
| gem | `gem-<name>` | `gems/` | `ruby_gem` |

All notes use three enrichment layers:
- **Frontmatter** with `packages` array, `type`, and `tags`
- **`## Observations`** with `[category]` tagged items
- **`## Relations`** with `[[wiki-links]]`

If `popularity_count` was obtained in Step 2, add a `[popularity]` observation.
Include the metric window (weekly vs total) and registry name — e.g.,
`- [popularity] 2.1M downloads/week (npm, 2026-04)` or
`- [popularity] 850M total downloads (crates.io, 2026-04)`. Omit for PyPI and Go.

**No wiki-links in observations.** Never use `[[Target]]` syntax in observation
lines. BM's parser treats any `[[` as a relation boundary — the text before it
becomes the `relation_type` field (max 200 chars), causing validation failures.
Put all wiki-links in `## Relations` only.

### Step 5: Write or update the note

<!-- This pattern is mirrored in tool-intel — update both when changing -->

**New package:** Use `write_note` with the full template. Set
`note_type="<ecosystem-type>"` (e.g., `note_type="crate_package"`).

**Existing package:** Use `edit_note` with `find_replace` to insert new
observations after the last existing `- [category]` line in `## Observations`.
Do NOT use `operation="append"` with `section="Observations"` — it appends to
the end of the file, not the end of the section.

When updating an existing note that has a `[popularity]` observation, use
`find_replace` to replace the old line with the current count rather than
appending a second popularity line.

### Step 6: Confirm and summarize

Report to the user:
- Ecosystem detected and note location (directory/title)
- Key findings from each source (1 line each)
- Any security concerns
- Cross-links will be added in Step 7

### Step 7: Cross-link existing notes

After writing the note, search for existing notes that reference this package
in their body text or observations but lack a wiki-link back to it:

```
search_notes(query="<package-name>", search_type="text", page_size=10)
```

For each result (excluding the note just written):
1. Read its `## Relations` section
2. If the package is mentioned in body/observations but not linked in Relations,
   add a link via `edit_note` with `find_replace`:

```
edit_note(
  identifier="<existing-note-title>",
  operation="find_replace",
  find_text="- <last_relation_type> [[<Last Existing Relation>]]",
  content="- <last_relation_type> [[<Last Existing Relation>]]\n- relates_to [[<prefix>-<package-name>]]"
)
```

Only add links where the relationship is genuine — don't link notes that
mention the same word in an unrelated context. Skip this step for updates to
existing packages where cross-links likely already exist.
