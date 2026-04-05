# Obsidian Migration: Rename Colon Prefixes in BM Vault

After installing vp-knowledge v0.22.0, run this one-time migration to rename
existing note titles and wiki-links from colon-prefix (`npm:fastify`) to
hyphen-prefix (`npm-fastify`).

**Why:** Obsidian forbids colons in filenames on all platforms and resolves
wiki-links by filename. BM already stores `npm:fastify` as `npm-fastify.md` —
this migration aligns titles with filenames so Obsidian can navigate links.

## Prerequisites

- vp-knowledge v0.22.0 installed (`/plugin install vp-knowledge@vp-plugins`)
- Basic Memory running and healthy (`bm status`)
- Backup your vault:

```bash
cp -r ~/basic-memory ~/basic-memory-backup
```

## Step 1: Rename titles and headings

```bash
PREFIXES="npm\|crate\|go\|composer\|pypi\|gem\|brew\|cask\|action\|docker\|vscode"

# Rename title: frontmatter
find ~/basic-memory -name '*.md' -exec sed -i '' \
  "s/^title: \($PREFIXES\):/title: \1-/" {} +

# Rename H1 headings
find ~/basic-memory -name '*.md' -exec sed -i '' \
  "s/^# \($PREFIXES\):/# \1-/" {} +
```

## Step 2: Rename wiki-links in note bodies

```bash
PREFIXES="npm\|crate\|go\|composer\|pypi\|gem\|brew\|cask\|action\|docker\|vscode"

find ~/basic-memory -name '*.md' -exec sed -i '' \
  "s/\[\[\($PREFIXES\):/[[\1-/g" {} +
```

## Step 3: Reindex

```bash
bm reindex
```

This rebuilds the BM database from the modified files. Titles, wiki-links,
and relation edges will all reflect the new hyphen convention.

## Step 4: Update BM schema notes

Run `/schema-evolve` for each affected schema type to dual-sync the convention
changes from the local `schemas/` files to the BM schema notes:

```
/schema-evolve npm_package
/schema-evolve crate_package
/schema-evolve go_module
/schema-evolve composer_package
/schema-evolve pypi_package
/schema-evolve ruby_gem
/schema-evolve brew_formula
/schema-evolve brew_cask
/schema-evolve github_action
/schema-evolve docker_image
/schema-evolve vscode_extension
```

## Step 5: Verify

```bash
# Should return 0 results — no colon-prefixed titles remaining
bm tool search-notes 'npm:' --json 2>/dev/null | jq '[.results[] | select(.title | startswith("npm:"))] | length'

# Should return notes — hyphen-prefixed titles exist
bm tool search-notes 'npm-' --json 2>/dev/null | jq '.results | length'

# Quick spot-check: pick a known note
bm tool read-note npm-fastify
```

## Rollback

If something goes wrong:

```bash
cp -r ~/basic-memory-backup ~/basic-memory && bm reindex
```

This restores the vault to its pre-migration state. The v0.22.0 plugin will
still emit hyphenated titles for new notes, but old notes will work fine —
`list_directory` + file glob works regardless of title convention.
