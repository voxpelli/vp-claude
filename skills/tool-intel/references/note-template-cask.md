# Homebrew Cask Note Template

Use this template when creating new `cask-*` notes with `write_note`. Place in
the `casks/` directory so it resolves `[[cask-*]]` wiki-links automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

```markdown
---
title: cask-<cask-name>
type: brew_cask
tags: [<domain>, <category>]
packages: ["<cask-name>"]
---

# cask-<cask-name>

[`<cask-name>`](https://formulae.brew.sh/cask/<cask-name>) — one-line
description from the cask's `desc` field.

Homepage: [<vendor-homepage>](<url>) | v<version> | <license>

## About

Brief description of what this GUI application does and who it's for.
Note whether it's open-source or proprietary.

Installs: <app-name>.app to /Applications

## Observations

- [pattern] Primary use case and how it fits into the development workflow
- [licensing] License type — free, freemium, paid, open-source
- [requirement] macOS version requirement or architecture limitation
- [gotcha] Auto-updates independently of Homebrew (if `auto_updates: true`)
- [alternative] Alternative casks or web-based tools covering the same need

## Relations

- alternative_to [[cask-<alternative>]]
- relates_to [[brew-<cli-equivalent>]]
```

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the exact Homebrew cask name: `["warp"]`.
One cask per note. This is how `schema_validate` matches notes to the
`brew_cask` schema.

### `type` value

Always `brew_cask` (snake_case). Not `brew-cask` or `homebrew_cask`.

### Observation categories

| Category | When to use |
|----------|-------------|
| `pattern` | Primary use case in the workflow |
| `licensing` | Free, freemium, paid, or open-source |
| `requirement` | macOS version, architecture, or system requirement |
| `gotcha` | Self-updating behavior, installation artifacts, uninstall complexity |
| `alternative` | Alternative tools with similar functionality |
| `performance` | Startup time, memory usage, battery impact |
| `conflict` | Conflicts with other casks or system tools |

### Auto-updating casks

If `auto_updates: true` in the cask definition, add a `[gotcha]` observation:
`brew outdated` will not flag this cask even when a new version is available
because the app manages updates itself.

### Relations

- Use `[[brew-<name>]]` for a CLI formula equivalent (e.g., cask:warp → brew-warp might not exist, but cask:docker → brew-docker does)
- Use `[[cask-<alternative>]]` for competing GUI tools in the same category
