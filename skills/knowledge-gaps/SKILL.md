---
name: knowledge-gaps
description: "This skill should be used when the user asks about 'knowledge gaps', 'package coverage', 'which packages need notes', 'undocumented dependencies', 'dependency audit', 'missing documentation', 'tool coverage', 'undocumented tools', 'brew/action/docker/vscode coverage', 'standard coverage', 'protocol coverage', 'domain standards', 'concept gaps', 'missing hub notes', 'undocumented concepts', 'topics without notes', or 'what should have its own note'. Cross-references project dependencies, tool manifests, and domain standards against Basic Memory notes to find undocumented packages, tools, standards, and concept-level hub gaps via relation graph analysis and Readwise reading signals. Supports npm, Rust crates, Go modules, PHP Composer packages, Python PyPI packages, Ruby gems, Homebrew formulae/casks, GitHub Actions, Docker images, and VSCode extensions."
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - mcp__basic-memory__search_notes
  - mcp__basic-memory__list_directory
  - mcp__basic-memory__build_context
  - mcp__readwise__readwise_search_highlights
  - mcp__readwise__reader_search_documents
---

# Knowledge Gap Detection

Analyze the current project's dependencies against Basic Memory coverage to
identify packages that should be documented but aren't. Supports npm, Rust
crates, Go modules, PHP Composer, PyPI, and RubyGems.

## Edge Cases

- **No manifest files found** — if none of the Step 0 globs match, report
  "No package manifest files detected" and skip Steps 1–5. Still proceed to
  Steps 6–9 to check for tool manifests.
- **No tool manifests found** — if Steps 6 finds nothing, report "No tool
  manifests detected" and skip Steps 7–9. Still run Step 10 for dead wiki-links.
- **Ecosystem directory missing in BM** — if `list_directory` returns nothing
  for `npm/`, `crates/`, etc., treat coverage as 0 documented for that
  ecosystem. Do not error.
- **Empty manifest** — if `package.json` has no `dependencies` or
  `devDependencies`, or `Cargo.toml` has no `[dependencies]` tables, report
  "No dependencies found in <manifest>" and skip that ecosystem.
- **Brewfile with only comments or taps** — if no `brew "..."`, `cask "..."`,
  or `vscode "..."` lines exist after filtering, report "No tools found in
  Brewfile".
- **Workflow file with no `uses:` lines** — if a `.github/workflows/*.yml`
  file exists but has no `uses:` lines matching the pattern, skip it silently.
- **RETRO-*.md not committed** — retro files are gitignored; `find` still
  detects them locally. This is expected behavior.
- **Readwise not available** — if `readwise_search_highlights` or
  `reader_search_documents` fails or returns no results, skip the reading-
  signal analysis in Step 14b and report only graph-based hub gaps in Step 15.
- **`bm` CLI not available** — if the `bm project info` command in Step 10
  fails, skip the quick-exit gate and proceed directly with the relation
  index queries.

## Workflow

### 0. Detect project ecosystems

Before parsing dependencies, scan for manifest files using the `Read` tool
(not Bash). Check for the following in the current working directory:

| Manifest file | Ecosystem | BM directory |
|---------------|-----------|-------------|
| `package.json` | npm | `npm/` |
| `Cargo.toml` | Rust / crates | `crates/` |
| `go.mod` | Go modules | `go/` |
| `composer.json` | PHP / Composer | `composer/` |
| `requirements.txt` or `pyproject.toml` | Python / PyPI | `pypi/` |
| `Gemfile` or `Gemfile.lock` | Ruby / RubyGems | `gems/` |

A project may have multiple manifest files (e.g., a monorepo with both
`package.json` and `Cargo.toml`). Process each detected ecosystem separately
and combine results in the final report.

Check for root-level manifest files using `Read` — do not use `Glob` for
root manifests, as it recurses into `node_modules/` and similar directories:

```
Read("./package.json")
Read("./Cargo.toml")
Read("./go.mod")
Read("./composer.json")
Read("./pyproject.toml")
Read("./requirements.txt")
Read("./Gemfile")
```

If Read succeeds, the ecosystem is present and the content is already loaded
for Step 1 (no re-reading needed). If Read returns "file not found", skip
that ecosystem.

### 1. Parse dependencies

For each detected ecosystem, read the manifest and extract dependencies:

**npm** (`package.json`):
Read `package.json` and extract all `dependencies` and `devDependencies` keys.
Exclude workspace packages (check `workspaces` field and skip matching entries).

**Rust** (`Cargo.toml`):
Read `Cargo.toml` and extract `[dependencies]`, `[dev-dependencies]`, and
`[build-dependencies]` table keys. Exclude workspace members.

**Go** (`go.mod`):
Read `go.mod` and extract all `require` directives. Ignore indirect
dependencies (`// indirect` comments) unless explicitly requested.

**PHP Composer** (`composer.json`):
Read `composer.json` and extract `require` and `require-dev` keys. Skip
`php` and `ext-*` entries (platform requirements, not packages).

**Python PyPI** (`pyproject.toml` or `requirements.txt`):
- `pyproject.toml`: extract `[project].dependencies` array and
  `[project.optional-dependencies]` entries
- `requirements.txt`: extract package names (strip version specifiers)

**Ruby** (`Gemfile`):
Read `Gemfile` and extract all `gem '<name>'` lines. Group by Bundler groups
(`group :development`, etc.).

### 2. Check Basic Memory coverage

For each ecosystem, get all documented packages in one lightweight call:

```
list_directory(dir_name="<ecosystem-dir>", depth=1)
```

This returns all `<prefix>-*` note titles without loading content.
Cross-reference against the dependency list to classify each package:
- **Documented** — a `<prefix>-<package-name>` note exists
- **Undocumented** — no dedicated note

For undocumented packages that land in Tier 1 (after step 3), check if
they're mentioned in engineering notes:
```
search_notes(search_type="text", query="<package-name>", page_size=3)
```

Classify matches as:
- **Mentioned** — appears in a note but isn't the primary subject

Limit this fallback to Tier 1 candidates to avoid excessive API calls.

### 3. Tier by import frequency

For undocumented packages, count imports using the Grep tool. Ripgrep
automatically respects `.gitignore`, skipping `node_modules`, `.git`, etc.

**npm:**
```
Grep(pattern="from ['\"]<package-name>['\"/]", glob="**/*.{js,ts,mjs,cjs}", output_mode="count")
Grep(pattern="require\\(['\"]<package-name>['\"/]", glob="**/*.{js,ts,mjs,cjs}", output_mode="count")
```

**Rust:**
```
Grep(pattern="use <crate_name>::", glob="**/*.rs", output_mode="count")
Grep(pattern="extern crate <crate_name>", glob="**/*.rs", output_mode="count")
```
(Replace hyphens with underscores for the crate name in `use` statements.)

**Go:**
```
Grep(pattern="\"<module/path>\"", glob="**/*.go", output_mode="count")
Grep(pattern="\"<module/path>/", glob="**/*.go", output_mode="count")
```

**PHP Composer:**
```
Grep(pattern="use <Vendor>\\\\<Package>", glob="**/*.php", output_mode="count")
```

**Python:**
```
Grep(pattern="import <package_name>", glob="**/*.py", output_mode="count")
Grep(pattern="from <package_name>", glob="**/*.py", output_mode="count")
```
(Replace hyphens with underscores for import names.)

**Ruby:**
```
Grep(pattern="require ['\"]<gem_name>['\"]", glob="**/*.rb", output_mode="count")
```

For scoped npm packages (e.g., `@fastify/postgres`), match the full name —
the `@` and `/` don't need escaping in the pattern.

Classify:
- **Tier 1** (3+ files import it): Must document — core dependency
- **Tier 2** (1-2 files): Should document — used but limited scope
- **Tier 3** (devDependencies/dev only, 0 runtime imports): Optional — tooling

### 4. Generate gap report

Present a structured report with a section per ecosystem:

```
## Knowledge Gap Report — <project-name>

### npm Coverage: X/Y packages documented (Z%)

#### Tier 1 — Must Document (3+ imports)
| Package | Import Count |
|---------|-------------|
| fastify | 12 |

#### Tier 2 — Should Document (1-2 imports)
...

#### Tier 3 — Optional (dev only)
...

#### Already Documented
...

---

### crates Coverage: X/Y packages documented (Z%)

#### Tier 1 — Must Document (3+ imports)
| Package | Import Count |
|---------|-------------|
| serde   | 28 |

...

---

### Overall Summary
- Total packages across all ecosystems: N
- Documented: M (Z%)
- Undocumented Tier 1: P packages
```

### 5. Offer enrichment

For the top 3-5 undocumented Tier 1 packages across all ecosystems, offer to
run `/package-intel` with the appropriate prefixed invocation:

- npm: `/package-intel fastify`
- crate: `/package-intel crate:serde`
- go: `/package-intel go:github.com/gin-gonic/gin`
- composer: `/package-intel composer:laravel/framework`
- pypi: `/package-intel pypi:requests`
- gem: `/package-intel gem:rails`

Present packages ranked by import count.

---

### 6. Detect tool manifests

Glob for tool manifest files in the current working directory:

```
Read("./Brewfile")
Glob(pattern=".github/workflows/*.yml")
Glob(pattern=".github/workflows/*.yaml")
Read("./Dockerfile")
Glob(pattern="*.dockerfile")
Glob(pattern="Dockerfile.*")
Read("./.vscode/extensions.json")
```

Announce which manifests are found. If none are found, skip Steps 7–9 and
note "No tool manifests detected" in the report.

### 7. Parse tool manifests

For each detected manifest, read and extract tool identifiers:

**Brewfile:**
Read the file and extract entries by line pattern:
- `brew "<name>"` or `brew '<name>'` → `brew:<name>`
- `cask "<name>"` or `cask '<name>'` → `cask:<name>`
- `vscode "<publisher>.<ext>"` or `vscode '<publisher>.<ext>'` → `vscode:<publisher>.<ext>`

Skip comment lines (`#`) and other directive types (`tap`, `mas`, `whalebrew`).

**`.github/workflows/*.yml` / `*.yaml`:**
Read each workflow file. Grep for `uses:` lines:
```
Grep(pattern="uses:\\s+[^./]", glob=".github/workflows/*.{yml,yaml}", output_mode="content")
```

From each match, extract the action reference:
- `uses: actions/checkout@v4` → `action:actions/checkout`
- `uses: docker://alpine:3.18` → skip (docker:// protocol, not an action)
- `uses: ./.github/actions/my-action` → skip (local action, `./` prefix)

Strip `@version` suffix. Deduplicate across all workflow files.

**`Dockerfile` / `*.dockerfile` / `Dockerfile.*`:**
Read each Dockerfile. Extract `FROM` lines:
```
Grep(pattern="^FROM\\s+", glob="{Dockerfile,*.dockerfile,Dockerfile.*}", output_mode="content")
```

From each match, extract the image identifier:
- `FROM node:22-alpine` → `docker:node` (strip `:tag`)
- `FROM node:22-alpine AS builder` → `docker:node` (strip `AS alias` and tag)
- `FROM gcr.io/distroless/node` → skip (non-Docker-Hub registry)
- `FROM ghcr.io/owner/image` → skip (non-Docker-Hub registry)
- `FROM quay.io/org/image` → skip (non-Docker-Hub registry)

Skip registries with a `.` or `/` prefix that indicates non-Docker-Hub. Strip
version tags (`:tag`) and AS aliases. Deduplicate across files.

**`.vscode/extensions.json`:**
Read the file and extract the `recommendations` array. Each entry is a
`vscode:<publisher>.<extension-id>` identifier. Example:
```json
{ "recommendations": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint"] }
```
→ `vscode:esbenp.prettier-vscode`, `vscode:dbaeumer.vscode-eslint`

### 8. Check Basic Memory coverage for tools

For each tool type with detected entries, get all documented tools in one call:

```
list_directory(dir_name="brew", depth=1)
list_directory(dir_name="casks", depth=1)
list_directory(dir_name="actions", depth=1)
list_directory(dir_name="docker", depth=1)
list_directory(dir_name="vscode", depth=1)
```

Only query directories for tool types that had manifest entries detected.
Cross-reference against the parsed identifiers to classify each tool:
- **Documented** — a `<prefix>-<name>` note exists
- **Undocumented** — no dedicated note

### 9. Add tools section to gap report

Append a tools section to the gap report after the package sections:

```
---

## Tool Coverage Report

### Homebrew Formulae: X/Y documented
| Tool | Status |
|------|--------|
| brew-ripgrep | ✓ documented |
| brew-jq | ✗ undocumented |

### Homebrew Casks: X/Y documented
...

### GitHub Actions: X/Y documented
...

### Docker Images: X/Y documented
...

### VSCode Extensions: X/Y documented
...

### Tool Summary
- Total tools across all types: N
- Documented: M (Z%)
- Undocumented: P
```

No import-count tiering for tools — all manifest entries are equally "used".
Group by type, show documented vs undocumented count per type.

For the top undocumented tools, offer `/tool-intel` invocations:

- brew: `/tool-intel brew:ripgrep`
- cask: `/tool-intel cask:warp`
- action: `/tool-intel action:actions/checkout`
- docker: `/tool-intel docker:node`
- vscode: `/tool-intel vscode:esbenp.prettier-vscode`

---

### 10. Detect dead wiki-links

Check the graph for wiki-links referencing non-existent notes — organic
documentation debt surfaced by the graph itself.

**Quick-exit gate:** Check the unresolved count first:
```
Bash: bm project info main --json | jq '.statistics.total_unresolved_relations'
```
If the count is 0, skip this step. If the CLI is unavailable, proceed with
the search.

**Query the relation index** for each ecosystem detected in Steps 0–9.
Use `entity_types=["relation"]` to search the relation index directly —
this returns relation objects with `from_entity` and `to_entity` fields:

```
search_notes(query="npm-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="crate-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="go-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="composer-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="pypi-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="gem-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="brew-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="action-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="docker-", entity_types=["relation"], output_format="json", page_size=50)
search_notes(query="vscode-", entity_types=["relation"], output_format="json", page_size=50)
```

Only query prefixes for ecosystems detected in Steps 0–9.

**Identify unresolved relations:** For each result, check whether `to_entity`
is present in the JSON response. Relations missing `to_entity` are unresolved
— the wiki-link target has no corresponding note.

Extract the target name from the relation `title` (format:
`"source → target"`) or `matched_chunk`. Cross-reference against the
`list_directory` results from Steps 2 and 8 to confirm.

**Deduplicate:** If a dead-linked package already appears in Tier 1/2/3
from manifest parsing, add "(also wiki-linked)" annotation rather than
listing it twice.

Add dead-link findings to the gap report:

```
#### Referenced but not documented (dead wiki-links)
| Link | Referenced in |
|------|--------------|
| [[npm-some-pkg]] | npm-fastify, engineering/patterns/http |
```

Add dead-link counts to the Overall Summary:
```
- Dead wiki-links: Q (across R unique notes)
```

When offering enrichment (Steps 5, 9), include dead-link targets annotated
with "(wiki-linked in N notes)" to show organic graph momentum.

**Limitation:** `page_size=50` per prefix is a sample, not exhaustive — the
graph may have more unresolved relations than one page returns. This is
acceptable for a gap detection tool (the gardener handles comprehensive
auditing). The highest-scored results surface the most commonly referenced
dead links.

---

### 11–13. Domain standard detection

Read the standard detection reference file for Steps 11–13:
`${CLAUDE_PLUGIN_ROOT}/skills/knowledge-gaps/references/standard-detection.md`

This covers detecting domain standards in Basic Memory, classifying them by
codebase reference count, and adding a standards section to the gap report.

---

### 14–15. Concept-level gap detection

Read the concept detection reference file for Steps 14–15:
`${CLAUDE_PLUGIN_ROOT}/skills/knowledge-gaps/references/concept-detection.md`

This covers mining the relation graph for implicit hub gaps, checking
Readwise for reading signals, and adding a concept coverage section to
the gap report.
