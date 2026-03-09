---
name: package-intel
description: "This skill should be used when the user asks to 'research package', 'package intel', 'what does [npm-pkg] do', 'add package to knowledge graph', 'enrich [pkg]', or when adding depends_on [[npm:*]] relations. Researches an npm package using five-source enrichment (DeepWiki, Context7, Tavily, Raindrop, changelog) and creates/updates a structured Basic Memory note."
user-invocable: true
allowed-tools:
  - Bash
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

Research an npm package and synthesize a structured Basic Memory note using
five enrichment sources. Specializes the generic `memory-research` pattern
for the npm ecosystem — adding `packages` frontmatter, npm-specific security
checks, changelog tracking, and the cross-tool enrichment pipeline.

## Arguments

One argument: the npm package name (e.g., `fastify`, `@fastify/postgres`,
`sql-template-tag`).

## Workflow

### 1. Check for existing note

Fast existence check first (no content loaded):
```
list_directory(dir_name="npm", file_name_glob="*<sanitized-pkg-name>*")
```

If found, read the existing note to understand what's already documented:
```
read_note(identifier="npm/npm-<sanitized-slug>", include_frontmatter=true)
```

Append new observations rather than overwriting.

### 2. Resolve GitHub repository

```bash
npm view <package-name> repository.url 2>/dev/null
```

If that fails, use `tavily_search(query="<package-name> npm github repository")`
to find the GitHub owner/repo.

### 3. Five-source enrichment (run in parallel)

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

**c) Tavily — security and recent changes:**
```
tavily_search(query="<package-name> npm CVE vulnerability <current-year-minus-1> <current-year>", max_results=5)
```

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
   platform targets, Node.js version range
2. **Knowledge graph** — `build_context` or `search_notes` for existing notes
   referencing this package (via `[[npm:*]]` links or `packages` metadata)

Skip internal refactors, unused new features, and fixes for untargeted platforms.
The goal is a short, high-signal list — not a changelog mirror.

**Always include links** to the release page or PR for each notable change.

### 4. Synthesize into note

See `references/note-template.md` for the full template. Key conventions:

- **Title**: `npm:<package-name>` (resolves `[[npm:pkg]]` wiki-links)
- **Directory**: `npm/`
- **Type**: `npm_package` (snake_case — Basic Memory's canonical convention)
- **Three layers**: frontmatter metadata, `## Observations` with `[category]` tags, `## Relations` with `[[wiki-links]]`

### 5. Write or update the note

**New package:** Use `write_note` with the full template. Set
`note_type="npm_package"`.

**Existing package:** Use `edit_note` with `find_replace` to insert new
observations after the last existing `- [category]` line in `## Observations`.
Do NOT use `operation="append"` with `section="Observations"` — it appends to
the end of the file, not the end of the section.

### 6. Confirm and summarize

Report to the user:
- Note location (directory/title)
- Key findings from each source (1 line each)
- Any security concerns
- Suggested related notes to link
