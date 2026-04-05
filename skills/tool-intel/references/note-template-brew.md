# Homebrew Formula Note Template

Use this template when creating new `brew-*` notes with `write_note`. Place in
the `brew/` directory so it resolves `[[brew-*]]` wiki-links automatically.

**No wiki-links in observations.** Never use `[[Target]]` in `## Observations`
lines — BM parses `[[` as a relation boundary. Put all `[[wiki-links]]` in
`## Relations` only.

```markdown
---
title: brew-<formula-name>
type: brew_formula
tags: [<domain>, <category>]
packages: ["<formula-name>"]
---

# brew-<formula-name>

[`<formula-name>`](https://formulae.brew.sh/formula/<formula-name>) — one-line
description from the formula's `desc` field.

Homepage: [<project-homepage>](<url>) | v<version> | <license>

## Common Usage

- `<formula-name> --flag` — what this flag does
- `<formula-name> subcommand` — what this subcommand does
- Key config file: `~/.config/<name>` or environment variable `<NAME>`

## Observations

- [pattern] How this tool is typically used in development workflows
- [gotcha] Surprising behavior, common mistakes (e.g., keg-only, PATH conflicts)
- [conflict] Conflicts with: brew-<other> — reason for conflict
- [compatibility] macOS version requirements or architecture notes
- [convention] Important shell setup or post-install steps from `caveats`

## Relations

- relates_to [[brew-<dependency>]]
- alternative_to [[cask-<gui-equivalent>]]
```

## Field Guidelines

### `packages` frontmatter

Always a JSON array with the exact Homebrew formula name: `["ripgrep"]`.
One formula per note. This is how `schema_validate` matches notes to the
`brew_formula` schema.

### `type` value

Always `brew_formula` (snake_case). Not `brew-formula` or `homebrew_formula`.

### Observation categories

| Category | When to use |
|----------|-------------|
| `pattern` | How the tool is typically used |
| `gotcha` | Surprising behavior — keg-only, PATH issues, caveats |
| `conflict` | Conflicts with other formulae or system tools |
| `compatibility` | macOS version, architecture (arm64/x86_64), or Rosetta notes |
| `convention` | Setup steps required after install (shell completions, PATH) |
| `performance` | Speed or resource characteristics |
| `security` | Security considerations for the tool itself |
| `alternative` | Alternative formulae or casks covering the same need |

### Keg-only formulae

If the formula is "keg-only" (not linked to standard paths), document this as a
`[gotcha]` observation and note the manual linking command from `caveats`.

### Relations

- Use `[[brew-<dep>]]` for Homebrew formula dependencies
- Use `[[cask-<name>]]` for a cask that provides the GUI equivalent
- Use `[[npm-<pkg>]]` or other ecosystem links if the tool is related to packages
