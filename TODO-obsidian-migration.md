# Obsidian Migration: Rename Prefixed Titles in BM Vault

After installing vp-knowledge v0.22.1, run this one-time migration to rename
existing note titles and wiki-links so they match BM's on-disk filenames,
enabling native Obsidian wiki-link resolution.

**What changes:** Colons and slashes in prefixed titles become hyphens.
`npm:fastify` → `npm-fastify`, `action:actions/checkout` → `action-actions-checkout`,
`npm:@fastify/postgres` → `npm-@fastify-postgres` (`@` and `.` are preserved).

**Why:** Obsidian forbids colons in filenames and interprets `/` as a path
separator. BM already stores these as `npm-fastify.md` and
`action-actions-checkout.md` on disk — this migration aligns titles with
filenames.

## Prerequisites

- vp-knowledge v0.22.1 installed (`/plugin install vp-knowledge@vp-plugins`)
- Basic Memory running and healthy (`bm status`)
- Backup your vault:

```bash
cp -r ~/basic-memory ~/basic-memory-backup
```

## Run the migration

Paste this block into your terminal:

```bash
bash -c '
PREFIXES="npm|crate|go|composer|pypi|gem|brew|cask|action|docker|vscode"

# Replace colons with hyphens (idempotent — safe to re-run)
find ~/basic-memory -name "*.md" -exec sed -i "" -E \
  "s/^title: ($PREFIXES):/title: \1-/" {} +
find ~/basic-memory -name "*.md" -exec sed -i "" -E \
  "s/^# ($PREFIXES):/# \1-/" {} +
find ~/basic-memory -name "*.md" -exec sed -i "" -E \
  "s/\[\[($PREFIXES):/[[\1-/g" {} +

# Replace slashes with hyphens (loop handles multi-slash Go paths)
for i in 1 2 3 4 5; do
  find ~/basic-memory -name "*.md" -exec sed -i "" -E \
    "s/^(title: ($PREFIXES)-[^/]*)\//\1-/" {} +
  find ~/basic-memory -name "*.md" -exec sed -i "" -E \
    "s/^(# ($PREFIXES)-[^/]*)\//\1-/" {} +
  find ~/basic-memory -name "*.md" -exec sed -i "" -E \
    "s/(\[\[($PREFIXES)-[^]]*)\//\1-/g" {} +
done

echo "Done — colons and slashes replaced"
'
```

## Reindex

```bash
bm reindex
```

This rebuilds the BM database from the modified files. Titles, wiki-links,
and relation edges will all reflect the new hyphen convention.

## Update BM schema notes

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

## Verify

No colon-prefixed titles remaining:

```bash
bm tool search-notes 'npm:' --json 2>/dev/null | jq '[.results[] | select(.title | startswith("npm:"))] | length'
```

No slash-containing titles remaining:

```bash
grep -rn '^title: \(npm\|action\|go\|composer\|docker\)-.*/' ~/basic-memory/ --include='*.md' | head
```

Hyphen-prefixed titles exist:

```bash
bm tool search-notes 'npm-' --json 2>/dev/null | jq '.results | length'
```

Quick spot-check:

```bash
bm tool read-note npm-fastify
bm tool read-note action-actions-checkout
```

## Rollback

If something goes wrong:

```bash
cp -r ~/basic-memory-backup ~/basic-memory && bm reindex
```
