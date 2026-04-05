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

## Steps 1–2: Rename titles, headings, and wiki-links

Save this as a script and run it, or paste the whole block into your terminal:

```bash
bash -c '
PREFIXES="npm|crate|go|composer|pypi|gem|brew|cask|action|docker|vscode"

# Rename title: frontmatter
find ~/basic-memory -name "*.md" -exec sed -i "" -E \
  "s/^title: ($PREFIXES):/title: \1-/" {} +

# Rename H1 headings
find ~/basic-memory -name "*.md" -exec sed -i "" -E \
  "s/^# ($PREFIXES):/# \1-/" {} +

# Rename wiki-links in note bodies
find ~/basic-memory -name "*.md" -exec sed -i "" -E \
  "s/\[\[($PREFIXES):/[[\1-/g" {} +

echo "Done — renamed titles, headings, and wiki-links"
'
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

Should return 0 — no colon-prefixed titles remaining:

```bash
bm tool search-notes 'npm:' --json 2>/dev/null | jq '[.results[] | select(.title | startswith("npm:"))] | length'
```

Should return notes — hyphen-prefixed titles exist:

```bash
bm tool search-notes 'npm-' --json 2>/dev/null | jq '.results | length'
```

Quick spot-check:

```bash
bm tool read-note npm-fastify
```

## Known limitation: slashes in action/composer/go identifiers

Three ecosystems use slashes in their identifiers: `action:actions/checkout`,
`composer:laravel/framework`, `go:github.com/gin-gonic/gin`. This migration
replaces the colon but leaves slashes intact — producing titles like
`action-actions/checkout`. BM resolves these by exact title match (works), but
Obsidian interprets `/` as a path separator so `[[action-actions/checkout]]`
won't navigate correctly.

This is a pre-existing limitation — slashes were also broken with the old
colon convention. The migration fixes the 8 slash-free ecosystems (npm, crate,
pypi, gem, brew, cask, docker, vscode). A full slash-to-hyphen migration for
action/composer/go notes would require additional sed passes and is tracked
separately.

## Rollback

If something goes wrong:

```bash
cp -r ~/basic-memory-backup ~/basic-memory && bm reindex
```

This restores the vault to its pre-migration state. The v0.22.0 plugin will
still emit hyphenated titles for new notes, but old notes will work fine —
`list_directory` + file glob works regardless of title convention.
