---
name: knowledge-gaps
description: "This skill should be used when the user asks about 'knowledge gaps', 'package coverage', 'which packages need notes', 'undocumented dependencies', 'dependency audit', or 'missing documentation'. Cross-references project dependencies against Basic Memory notes to find undocumented packages, tiered by import frequency."
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - mcp__basic-memory__search_notes
  - mcp__basic-memory__list_directory
---

# Knowledge Gap Detection

Analyze the current project's dependencies against Basic Memory coverage to
identify packages that should be documented but aren't.

## Workflow

### 1. Parse dependencies

Read `package.json` and extract all `dependencies` and `devDependencies` keys.
Exclude workspace packages (check `workspaces` field and skip matching entries).

### 2. Check Basic Memory coverage

Get all documented packages in one lightweight call:
```
list_directory(dir_name="npm", depth=1)
```

This returns all `npm:*` note titles without loading content. Cross-reference
against the dependency list to classify each package:
- **Documented** — an `npm:<package-name>` note exists
- **Undocumented** — no dedicated note

For undocumented packages that land in Tier 1 (after step 3), check if they're
mentioned in engineering notes:
```
search_notes(search_type="text", query="<package-name>", page_size=3)
```

Classify matches as:
- **Mentioned** — appears in a note but isn't the primary subject

Limit this fallback to Tier 1 candidates to avoid excessive API calls.

### 3. Tier by import frequency

For undocumented packages, estimate importance by counting imports across
the project's source directories. Discover source directories dynamically:

```bash
# Find directories containing JS/TS source files (exclude node_modules, test fixtures)
find . -maxdepth 2 -type f \( -name "*.js" -o -name "*.ts" -o -name "*.mjs" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/fixtures/*" \
  | sed 's|/[^/]*$||' | sort -u | head -20
```

Then count imports using the Grep tool:
```
Grep(pattern="from ['\"]<package-name>", path="<source-dir>", output_mode="count")
Grep(pattern="require\\(['\"]<package-name>", path="<source-dir>", output_mode="count")
```

Classify:
- **Tier 1** (3+ files import it): Must document — core dependency
- **Tier 2** (1-2 files): Should document — used but limited scope
- **Tier 3** (devDependencies only, 0 runtime imports): Optional — tooling

### 4. Generate gap report

Present a structured report:

```
## Knowledge Gap Report — <project-name>

### Coverage: X/Y packages documented (Z%)

### Tier 1 — Must Document (3+ imports)
| Package | Import Count | Domain |
|---------|-------------|--------|
| fastify | 12 | engineering/fastify/ |

### Tier 2 — Should Document (1-2 imports)
| Package | Import Count | Domain |
|---------|-------------|--------|

### Tier 3 — Optional (dev only)
| Package | Notes |
|---------|-------|

### Already Documented
| Package | Note Title |
|---------|-----------|
```

### 5. Offer enrichment

For the top 3-5 undocumented Tier 1 packages, offer to run `/package-intel`
to create notes. Present them ranked by import count.
