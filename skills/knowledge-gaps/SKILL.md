---
name: knowledge-gaps
description: "This skill should be used when the user asks about 'knowledge gaps', 'package coverage', 'which packages need notes', 'undocumented dependencies', 'dependency audit', or 'missing documentation'. Cross-references project dependencies against Basic Memory notes to find undocumented packages, tiered by import frequency. Supports npm, Rust crates, Go modules, PHP Composer packages, Python PyPI packages, and Ruby gems."
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

Present them ranked by import count across all ecosystems combined.
