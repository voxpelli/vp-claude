---
name: knowledge-gaps
description: "This skill should be used when the user asks about 'knowledge gaps', 'package coverage', 'which packages need notes', 'undocumented dependencies', 'dependency audit', 'missing documentation', 'tool coverage', 'undocumented tools', or 'brew/action/docker/vscode coverage'. Cross-references project dependencies and tool manifests against Basic Memory notes to find undocumented packages and tools. Supports npm, Rust crates, Go modules, PHP Composer packages, Python PyPI packages, Ruby gems, Homebrew formulae/casks, GitHub Actions, Docker images, and VSCode extensions."
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Skill
  - mcp__basic-memory__search_notes
  - mcp__basic-memory__list_directory
---

# Knowledge Gap Detection

Analyze the current project's dependencies against Basic Memory coverage to
identify packages that should be documented but aren't. Supports npm, Rust
crates, Go modules, PHP Composer, PyPI, and RubyGems.

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

Use `Glob` to check for manifest presence:
```
Glob(pattern="package.json")
Glob(pattern="Cargo.toml")
Glob(pattern="go.mod")
Glob(pattern="composer.json")
Glob(pattern="pyproject.toml")
Glob(pattern="requirements.txt")
Glob(pattern="Gemfile")
```

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

This returns all `<prefix>:*` note titles without loading content.
Cross-reference against the dependency list to classify each package:
- **Documented** — a `<prefix>:<package-name>` note exists
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
| Package | Import Count | Domain |
|---------|-------------|--------|
| fastify | 12 | engineering/fastify/ |

#### Tier 2 — Should Document (1-2 imports)
...

#### Tier 3 — Optional (dev only)
...

#### Already Documented
...

---

### crates Coverage: X/Y packages documented (Z%)

#### Tier 1 — Must Document (3+ imports)
| Package | Import Count | Domain |
|---------|-------------|--------|
| serde   | 28 | crates/ |

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

For undocumented tools from Steps 6–9, offer `/tool-intel` invocations:

- brew: `/tool-intel brew:ripgrep`
- cask: `/tool-intel cask:warp`
- action: `/tool-intel action:actions/checkout`
- docker: `/tool-intel docker:node`
- vscode: `/tool-intel vscode:esbenp.prettier-vscode`

Present packages ranked by import count, then tools grouped by type.

---

### 6. Detect tool manifests

Glob for tool manifest files in the current working directory:

```
Glob(pattern="Brewfile")
Glob(pattern=".github/workflows/*.yml")
Glob(pattern=".github/workflows/*.yaml")
Glob(pattern="Dockerfile")
Glob(pattern="*.dockerfile")
Glob(pattern="Dockerfile.*")
Glob(pattern=".vscode/extensions.json")
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
- **Documented** — a `<prefix>:<name>` note exists
- **Undocumented** — no dedicated note

### 9. Add tools section to gap report

Append a tools section to the gap report after the package sections:

```
---

## Tool Coverage Report

### Homebrew Formulae: X/Y documented
| Tool | Status |
|------|--------|
| brew:ripgrep | ✓ documented |
| brew:jq | ✗ undocumented |

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

---

### 10. Detect dead wiki-links

Check the graph for wiki-links that reference non-existent notes. These are
packages or tools that existing notes already mention but that have no dedicated
note yet — organic documentation debt surfaced by the graph itself.

Only run queries for ecosystems already detected in Steps 0–9 (skip `[[crate:`
if no Cargo.toml was found and no `crates/` directory was queried):

```
search_notes(query="[[npm:", search_type="text", page_size=20)
search_notes(query="[[crate:", search_type="text", page_size=20)
search_notes(query="[[go:", search_type="text", page_size=20)
search_notes(query="[[composer:", search_type="text", page_size=20)
search_notes(query="[[pypi:", search_type="text", page_size=20)
search_notes(query="[[gem:", search_type="text", page_size=20)
search_notes(query="[[brew:", search_type="text", page_size=20)
search_notes(query="[[action:", search_type="text", page_size=20)
search_notes(query="[[docker:", search_type="text", page_size=20)
search_notes(query="[[vscode:", search_type="text", page_size=20)
```

(`search_type="text"` is correct here — `[[prefix:` is structural syntax, not
semantic content; exact text match is more precise than hybrid/vector.)

From the results, extract all `[[prefix:name]]` references. Cross-reference
against the `list_directory` results already collected in Steps 2 and 8 to
identify which targets don't have a corresponding note.

Add dead-link findings to the gap report under each ecosystem section:

```
#### Referenced but not documented (dead wiki-links)
| Link | Referenced in |
|------|--------------|
| [[npm:some-pkg]] | npm:fastify, engineering/patterns/http |
```

Deduplicate: if a dead-linked package already appears in Tier 1/2/3 from
manifest parsing, add "(also wiki-linked)" annotation rather than listing it
twice.

Add dead-link counts to the Overall Summary:
```
- Dead wiki-links: Q (across R unique notes)
```

When offering enrichment in Step 5, include dead-link targets in the ranked
list, annotated with "(wiki-linked in N notes)" to show organic graph momentum.
