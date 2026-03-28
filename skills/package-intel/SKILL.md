---
name: package-intel
description: "This skill should be used when the user asks to 'research package', 'package intel', 'what does [npm-pkg] do', 'add package to knowledge graph', 'enrich [pkg]', when adding depends_on [[npm:*]] relations, 'research crate', 'what does [crate] do', 'crate intel', 'rust package', 'pypi package', 'python package', 'go module', 'golang package', 'composer package', 'php package', 'ruby gem', 'gem intel'. Researches a package using five-source enrichment (DeepWiki, Context7, Tavily, Raindrop, changelog) and creates/updates a structured Basic Memory note. Supports npm, Rust crates, Go modules, PHP Composer packages, Python PyPI packages, and Ruby gems."
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
  - mcp__plugin_context7_context7__resolve-library-id
  - mcp__plugin_context7_context7__query-docs
  - mcp__tavily__tavily_search
  - mcp__tavily__tavily_extract
  - mcp__raindrop__find_bookmarks
  - mcp__raindrop__fetch_bookmark_content
---

# Package Intelligence

Research a package and synthesize a structured Basic Memory note using five
enrichment sources. Supports npm, Rust crates, Go modules, PHP Composer
packages, Python PyPI packages, and Ruby gems.

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

### Step 1: Check for existing note

<!-- This pattern is mirrored in tool-intel — update both when changing -->

Fast existence check first (no content loaded):
```
list_directory(dir_name="<ecosystem-dir>", file_name_glob="*<sanitized-pkg-name>*")
```

If found, read the existing note to understand what's already documented:
```
read_note(identifier="<prefix>:<package-name>", include_frontmatter=true, output_format="json")
```

**Freshness check:** If the note exists and was updated within the last 60 days
(check `updated_at` in frontmatter), consider scoping down the research:
- Skip Tavily security search unless a CVE is suspected
- Skip Raindrop search (bookmarks don't change frequently)
- Focus DeepWiki/Context7 on what's changed since the last update
- Still run the changelog step — version history moves fast

If the note is stale (>60 days) or missing, run the full five-source pipeline.

Note any previous `[gotcha]` or `[limitation]` observations — these should guide
which sources to prioritize and what edge cases to look for in new research.

Append new observations rather than overwriting.

### Step 2: Resolve repository

Delegate to the ecosystem reference file for this step:
`references/ecosystem-<ecosystem>.md`

Each reference file explains the registry API, required headers, and how to
extract `owner/repo` for use in the DeepWiki and changelog steps.

### Step 3: Five-source enrichment (run in parallel)

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

See `references/note-template-<ecosystem>.md` for the full template. Key
conventions per ecosystem:

| Ecosystem | Title format | Directory | Type |
|-----------|-------------|-----------|------|
| npm | `npm:<name>` | `npm/` | `npm_package` |
| crate | `crate:<name>` | `crates/` | `crate_package` |
| go | `go:<module/path>` | `go/` | `go_module` |
| composer | `composer:<vendor>/<pkg>` | `composer/` | `composer_package` |
| pypi | `pypi:<name>` | `pypi/` | `pypi_package` |
| gem | `gem:<name>` | `gems/` | `ruby_gem` |

All notes use three enrichment layers:
- **Frontmatter** with `packages` array, `type`, and `tags`
- **`## Observations`** with `[category]` tagged items
- **`## Relations`** with `[[wiki-links]]`

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

### Step 6: Confirm and summarize

Report to the user:
- Ecosystem detected and note location (directory/title)
- Key findings from each source (1 line each)
- Any security concerns
- Suggested related notes to link
